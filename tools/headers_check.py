"""Checks the security and caching headers the site should be serving.

    python tools/headers_check.py

Run it after a frontend deploy. The headers come from the .htaccess in the release
archive, so they only exist once Apache is serving the new files - a local static server
such as python -m http.server ignores .htaccess entirely, which is why this is separate
from smoke_test.py.

It checks what the site sends today as well as what it should, so it is useful before the
deploy: run it now and every security header it names is missing.
"""
from __future__ import annotations

import argparse
import re
import sys
import urllib.error
import urllib.request

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"),
    "Accept": "text/html,*/*;q=0.8",
}

# what should be there, and what it stops
EXPECTED = {
    "X-Content-Type-Options": ("nosniff", "a browser guessing a file's type"),
    "X-Frame-Options": ("SAMEORIGIN", "the site being framed by another page"),
    "Referrer-Policy": (None, "the full page URL leaking to other sites"),
    "Permissions-Policy": (None, "unused camera, microphone and location access"),
    "Strict-Transport-Security": ("max-age=", "downgrade to plain HTTP"),
}


def fetch(url: str):
    request = urllib.request.Request(url)
    for name, value in HEADERS.items():
        request.add_header(name, value)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read()
    except Exception as error:                                   # noqa: BLE001
        return 0, {}, str(error).encode()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", default="https://www.teutasteel.com")
    args = parser.parse_args()

    status, headers, body = fetch(f"{args.site}/")
    print(f"{args.site}/ -> {status}")
    print(f"   server: {headers.get('Server')}")

    missing = 0
    print("\nsecurity headers:")
    for name, (wanted, why) in EXPECTED.items():
        value = headers.get(name)
        present = value is not None and (wanted is None or wanted.lower() in value.lower())
        if not present:
            missing += 1
        print(f"   {'ok  ' if present else 'MISS'} {name:<28} {value or '(not sent)'}"
              + ('' if present else f'   - stops {why}'))

    # one hashed asset, to see whether the caching rules apply
    match = re.search(r'(main-[A-Z0-9]+\.js)', body.decode("utf-8", "replace"))
    if match:
        asset_status, asset_headers, _ = fetch(f"{args.site}/{match.group(1)}")
        cache = asset_headers.get("Cache-Control")
        good = bool(cache and "max-age=" in cache and int(re.search(r"max-age=(\d+)", cache).group(1)) > 86400)
        if not good:
            missing += 1
        print(f"\ncaching on a hashed asset ({match.group(1)}, {asset_status}):")
        print(f"   {'ok  ' if good else 'MISS'} Cache-Control: {cache or '(not sent)'}")
    else:
        print("\nno hashed asset in the page; is this still the old site?")

    html_cache = headers.get("Cache-Control")
    html_ok = bool(html_cache and ("no-cache" in html_cache or "max-age=0" in html_cache))
    if not html_ok:
        missing += 1
    print(f"\ncaching on the HTML itself:")
    print(f"   {'ok  ' if html_ok else 'MISS'} Cache-Control: {html_cache or '(not sent)'}"
          + ('' if html_ok else '   - a cached shell can point at assets a deploy removed'))

    print(f"\n{missing} header(s) missing")
    print("RESULT: " + ("PASS" if missing == 0 else "FAIL - see the .htaccess in the release archive"))
    return 0 if missing == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
