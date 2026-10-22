"""Minimal dependency-free PDF text extractor (FlateDecode + text operators).

Usage: python pdf_extract.py <file.pdf> [out.txt]
"""
import re
import sys
import zlib


def iter_streams(data: bytes):
    """Yield (dict_bytes, decoded_stream_bytes) for every stream object."""
    for m in re.finditer(rb"stream\r?\n", data):
        start = m.end()
        end = data.find(b"endstream", start)
        if end == -1:
            continue
        raw = data[start:end]
        # Header dict precedes the 'stream' keyword.
        hdr_start = data.rfind(b"<<", 0, m.start())
        hdr = data[hdr_start:m.start()] if hdr_start != -1 else b""
        if b"FlateDecode" in hdr:
            try:
                raw = zlib.decompress(raw)
            except zlib.error:
                try:
                    raw = zlib.decompressobj().decompress(raw)
                except zlib.error:
                    continue
        yield hdr, raw


TEXT_SHOW = re.compile(rb"\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>")
OP = re.compile(rb"(Tj|TJ|Td|TD|T\*|ET|BT|')")


def decode_pdf_string(tok: bytes) -> str:
    if tok.startswith(b"<"):
        hexs = re.sub(rb"[^0-9A-Fa-f]", b"", tok)
        if len(hexs) % 2:
            hexs += b"0"
        try:
            b = bytes.fromhex(hexs.decode("ascii"))
        except ValueError:
            return ""
        # Heuristic: UTF-16BE if BOM or many NULs
        if b[:2] in (b"\xfe\xff",) or (len(b) > 1 and b[1:2] == b"\x00"):
            try:
                return b.decode("utf-16-be", "replace")
            except Exception:
                pass
        return b.decode("latin-1", "replace")
    body = tok[1:-1]
    out = bytearray()
    i = 0
    while i < len(body):
        c = body[i]
        if c == 0x5C and i + 1 < len(body):  # backslash
            n = body[i + 1]
            mapping = {0x6E: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12}
            if n in mapping:
                out.append(mapping[n])
                i += 2
                continue
            if 0x30 <= n <= 0x37:  # octal
                j = i + 1
                digs = b""
                while j < len(body) and len(digs) < 3 and 0x30 <= body[j] <= 0x37:
                    digs += body[j : j + 1]
                    j += 1
                out.append(int(digs, 8) & 0xFF)
                i = j
                continue
            out.append(n)
            i += 2
            continue
        out.append(c)
        i += 1
    return out.decode("latin-1", "replace")


def extract(path: str) -> str:
    data = open(path, "rb").read()
    pages_text = []
    for _hdr, stream in iter_streams(data):
        if b"BT" not in stream and b"Tj" not in stream and b"TJ" not in stream:
            continue
        # Split into lines, keep text-showing operators in order.
        chunk = []
        pos = 0
        line_open = False
        for m in re.finditer(
            rb"\[(?:\\.|[^\\\]])*\]|\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>|\bT[dD]\b|\bT\*\b|\bBT\b|\bET\b|\bTj\b|\bTJ\b",
            stream,
        ):
            tok = m.group(0)
            if tok in (b"Td", b"TD", b"T*", b"BT"):
                if line_open:
                    chunk.append("\n")
                    line_open = False
                elif chunk:
                    chunk.append(" ")
            elif tok == b"ET":
                chunk.append("\n")
                line_open = False
            elif tok == b"Tj":
                pass  # string token was already appended
            elif tok.startswith(b"["):
                for s in TEXT_SHOW.finditer(tok):
                    chunk.append(decode_pdf_string(s.group(0)))
            elif tok.startswith((b"(", b"<")):
                chunk.append(decode_pdf_string(tok))
                line_open = True
            pos = m.end()
        text = "".join(chunk)
        text = re.sub(r"[ \t]{2,}", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if text:
            pages_text.append(text)
    return "\n\n=== PAGE BREAK ===\n\n".join(pages_text)


if __name__ == "__main__":
    src = sys.argv[1]
    out = extract(src)
    dest = sys.argv[2] if len(sys.argv) > 2 else None
    if dest:
        open(dest, "w", encoding="utf-8").write(out)
        print(f"wrote {len(out)} chars to {dest}")
    else:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        print(out[:20000])
