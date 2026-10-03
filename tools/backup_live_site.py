"""Downloads the site that is live now, so it can be put back if a deploy goes wrong.

    python tools/backup_live_site.py

The Bootstrap Studio export that www.teutasteel.com serves today is not in any
repository: the frontend repo's first commit is already the Angular app. If the deploy
overwrites it and something is wrong, this archive is the only way back.

It fetches the home page, then every local file that page references - stylesheets,
scripts, images, fonts, the manifest, the favicon - and then anything those stylesheets
reference in turn. Cloudflare answers 403 to requests that do not look like a browser,
so it sends a browser user agent, and anything that fails is reported rather than
silently left out.
"""
from __future__ import annotations

import argparse
import hashlib
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime

SITE = "https://www.teutasteel.com"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,image/*,*/*;q=0.8",
    "Accept-Language": "sq,en;q=0.8",
}
# Cloudflare's own endpoint, not a file on the server
SKIP = ("/cdn-cgi/",)

ROLLBACK_README = """\
Teuta Steel - backup of the site that was live before the Angular deploy
=======================================================================

This is the Bootstrap Studio export that www.teutasteel.com served, downloaded file by
file, including the stylesheets, scripts, images and fonts it references. It exists
because that export is not in any git repository - the frontend repository's first
commit is already the Angular application - so if a deploy went wrong there would be
nothing to put back.

To roll back
------------

1. Extract this archive's www.teutasteel.com/ contents into the web root.
2. Delete the files the Angular build added and this backup does not contain:
       index.html          (replaced by this backup's index.html)
       main-*.js  chunk-*.js  polyfills-*.js  scripts-*.js  styles-*.css
       icons/              about/  products/  contact/  login/
       admin-dashboard/    user-dashboard/
       assets/images/  assets/logo.svg  assets/fonts/icons.woff
3. Leave assets/img/, assets/css/, assets/js/, assets/bootstrap/ in place: the backup
   needs them, and the Angular build does not use them.
4. Purge Cloudflare's cache for the HTML, or visitors keep the Angular index.html.

To check it first
-----------------

Serve the extracted folder locally (python -m http.server) and open it: the page should
look exactly like the site did before the deploy.
"""


def fetch(url: str) -> tuple[int, bytes, str]:
    request = urllib.request.Request(url)
    for name, value in HEADERS.items():
        request.add_header(name, value)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, response.read(), response.headers.get("Content-Type") or ""
    except urllib.error.HTTPError as error:
        return error.code, b"", error.headers.get("Content-Type") if error.headers else ""
    except Exception as error:                                   # noqa: BLE001
        return 0, b"", f"{type(error).__name__}: {error}"


def absolute(url: str) -> str:
    """The full URL for something the markup refers to relatively."""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return urllib.parse.urljoin(SITE + "/", url)


def local_path(url: str) -> str | None:
    """The path to store a URL under, or None when it is not part of the site."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme and parsed.netloc and parsed.netloc not in ("www.teutasteel.com", "teutasteel.com"):
        return None
    path = parsed.path or "/"
    if any(path.startswith(prefix) for prefix in SKIP):
        return None
    if path.endswith("/"):
        path += "index.html"
    return path.lstrip("/")


def references(text: str) -> set[str]:
    # strip the quote entities a stylesheet or attribute may carry, and ignore
    # anything that is obviously not a path (SVG selectors, stray brackets, quotes)
    text = text.replace("&quot;", '"').replace("&#39;", "'").replace("&amp;", "&")
    found = set(re.findall(r'(?:href|src)\s*=\s*["\']([^"\'#]+)["\']', text, re.I))
    found |= set(re.findall(r'url\(\s*["\']?([^"\')]+)["\']?\s*\)', text, re.I))
    return {url for url in found if not any(character in url for character in '[]"<>')}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(pathlib.Path(r"C:\TeutaSteel Website")))
    args = parser.parse_args()

    print(f"fetching {SITE}/")
    status, home, _ = fetch(f"{SITE}/")
    if status != 200 or not home:
        print(f"   failed: status {status}")
        return 1
    home_text = home.decode("utf-8", "replace")
    print(f"   {len(home):,} bytes, {len(references(home_text))} references")

    files: dict[str, bytes] = {"index.html": home}
    missing: list[tuple[str, int]] = []      # referenced by the site, absent on the server
    failures: list[tuple[str, str]] = []     # could not be reached at all
    queue = {url for url in references(home_text) if not url.startswith(("mailto:", "tel:", "data:", "#"))}

    # the manifest and robots are not always linked from the markup; the favicon is
    # optional, because this export does not have one
    queue |= {"/manifest.json", "/robots.txt"}
    optional = {"favicon.ico"}

    seen: set[str] = set()
    while queue:
        url = queue.pop()
        path = local_path(url)
        if path is None or path in seen or path in files:
            continue
        seen.add(path)
        target = absolute(url)
        status, body, content_type = fetch(target)
        if status != 200 or not body:
            if status == 404:
                # referenced by the page but absent on the server: nothing to back up,
                # and worth reporting on its own
                if path not in optional:
                    missing.append((path, status))
            else:
                failures.append((path, str(status or content_type)))
            continue
        files[path] = body
        print(f"   {status} {len(body):>9,}  {path}")
        # a stylesheet can reference fonts and images of its own
        if path.endswith(".css") or content_type.startswith("text/css"):
            for nested in references(body.decode("utf-8", "replace")):
                if nested.startswith(("mailto:", "tel:", "data:", "#")):
                    continue
                if nested.startswith(("http://", "https://")):
                    queue.add(nested)
                else:
                    # relative to the stylesheet that mentioned it
                    queue.add(urllib.parse.urljoin("/" + path, nested))

    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    archive = pathlib.Path(args.out) / f"backup-live-site-{stamp}.zip"

    # A path with a percent escape in it is served differently by different servers:
    # this export really does contain "assets/img/Layer%202.png" as a file name, and a
    # server that decodes the request will look for "Layer 2.png" and miss it. Store
    # both, and say so in the manifest.
    decoded: dict[str, bytes] = {}
    for path, body in files.items():
        if "%" in path:
            plain = urllib.parse.unquote(path)
            if plain != path:
                decoded[plain] = body

    lines = ["Teuta Steel - backup manifest", ""]
    for path, body in sorted(files.items()):
        lines.append(f"{hashlib.sha256(body).hexdigest()}  {len(body):>9,}  {path}")
    for path in sorted(decoded):
        lines.append(f"{'(copy of the same bytes)':<64}  {path}")

    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for path, body in sorted(files.items()):
            bundle.writestr(f"www.teutasteel.com/{path}", body)
        for path, body in sorted(decoded.items()):
            bundle.writestr(f"www.teutasteel.com/{path}", body)
        bundle.writestr("www.teutasteel.com/BACKUP-README.txt", ROLLBACK_README)
        bundle.writestr("BACKUP-MANIFEST.txt", "\n".join(lines) + "\n")

    total = sum(len(body) for body in files.values())
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    print(f"\nwrote {archive}")
    print(f"   {len(files)} files ({len(decoded)} stored under a second, decoded name), "
          f"{total / 1024:.0f} kB of content, {archive.stat().st_size / 1024:.0f} kB compressed")
    print(f"   sha256 {digest[:16]}")

    if missing:
        print(f"\n{len(missing)} file(s) the live site references do not exist on the server:")
        for path, code in missing:
            print(f"   {code} {path}")
        print("   (they cannot be backed up because they are already missing; the live")
        print("    site has these broken links today, before any deploy)")

    if failures:
        print(f"\n{len(failures)} reference(s) could not be reached at all:")
        for path, reason in failures[:10]:
            print(f"   {reason} {path}")
        return 1

    print("\n   every reference resolved (except the missing files above, if any)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
