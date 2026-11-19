"""Packages the built frontend into something that can be uploaded as it is.

    python tools/make_release.py            # after npm run build

Writes dist/release/teutasteel-frontend-<date>.zip containing the contents of
dist/teutasteel-website/browser/ (what belongs in the web root) plus the production
.htaccess, 404.php, the branded 404 page and a README for whoever uploads it.

The server files are taken from tools/production.htaccess and tools/production-404.php
so they can be reviewed as ordinary files in the repository rather than as strings in
this script. The branded 404.html is the prerendered /404 route from the build itself.

Refuses to package a build that is older than the sources it came from.
"""
from __future__ import annotations

import argparse
import hashlib
import pathlib
import sys
import zipfile
from datetime import datetime

PROJECT = pathlib.Path(__file__).resolve().parent.parent
BROWSER = PROJECT / "dist" / "teutasteel-website" / "browser"
SERVER = PROJECT / "dist" / "teutasteel-website" / "server"
SOURCE_DIRS = ["src", "public", "tools"]
SOURCE_FILES = ["angular.json", "package.json", "README.md"]

HTACCESS_SOURCE = PROJECT / "tools" / "production.htaccess"
PHP_404_SOURCE = PROJECT / "tools" / "production-404.php"

RELEASE_README = """\
Teuta Steel - frontend release
==============================

Upload everything in this archive into the web root of www.teutasteel.com,
replacing the files that are there (keep the directory structure).

Do not delete, before the upload, the files that are not in this archive:
  /api/            legacy API endpoints still served from this root
  /.well-known/    if present
Anything under /assets/ that the old site still references externally is archived
separately by the operator, not by this archive.

What is included beyond the build
---------------------------------
  .htaccess   the production server rules (see below)
  404.php     returns a real HTTP 404 status and the branded 404 page
  404.html    the branded page itself, prerendered from the site
  privacy/    the standalone privacy page (indexable, no JavaScript needed)

The .htaccess
-------------
It sets one canonical host (www), sends the old page URLs to their new pages with a
single 301 each, serves the prerendered pages, sends every known application route to
the SPA shell, and answers everything else with 404.php. It also turns off MultiViews,
declares the WebP and woff2 types, compresses text, sets caching (a year for the
hashed assets, revalidate for the HTML) and adds security headers.

Old URL -> new URL (each must be 301, one hop):
  /index.html        -> /
  /produktet.html    -> /products/
  /cnc.html          -> /services/cnc/
  /na-kontaktoni.html-> /contact/
  /rreth-nesh.html   -> /about/
  /Calculator.html   -> /request/
  /privacy           -> /privacy/   (the directory redirects itself)

IF THE SITE RETURNS 500 AFTER UPLOADING, DELETE .htaccess. That file is the only thing
here that can take the whole site down: a directive Apache cannot parse fails every
request. Everything else in this archive works without it, and you lose nothing but the
headers, the redirects and the caching. Try re-uploading it afterwards, or send it to be
checked.

If /api/ stops answering after this upload, the root .htaccess is the suspect: it
switches Passenger off for the web root. A preserved legacy directory that is itself a
Passenger application must re-enable it in its own .htaccess.

After uploading:

1. Check https://www.teutasteel.com/ in a browser, then /products, /about and
   /contact and /privacy/.
2. Check the redirect map above: each old URL must make exactly one 301.
3. Check an unknown path returns 404 (not the SPA shell) and that /api/ still answers.
4. Run tools/headers_check.py from the development machine; it checks the security
   and caching headers and prints what is missing.
5. Run tools/smoke_test.py; it checks the site and the API and tells you which checks
   failed.
6. If Cloudflare has a caching rule for HTML, purge it, or visitors can keep an old
   index.html that points at asset names which no longer exist.

The API is deployed separately (a git push to the backend remote, then flask db
upgrade). Until it is, the catalogue sections hide themselves and the products page
shows a translated "catalogue unavailable" notice - the rest of the site works.
"""


def read_server_file(path: pathlib.Path) -> str:
    """A file that must be in the archive; fail loudly rather than ship without it."""
    text = path.read_text(encoding="utf-8")
    if not text.strip():
        raise SystemExit(f"{path} is empty - refusing to package it")
    return text


def newest_source_time() -> tuple[float, str]:
    newest, name = 0.0, ""
    for directory in SOURCE_DIRS:
        for path in (PROJECT / directory).rglob("*"):
            if path.is_file() and path.stat().st_mtime > newest:
                newest, name = path.stat().st_mtime, str(path.relative_to(PROJECT))
    for entry in SOURCE_FILES:
        path = PROJECT / entry
        if path.exists() and path.stat().st_mtime > newest:
            newest, name = path.stat().st_mtime, entry
    return newest, name


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(PROJECT / "dist" / "release"))
    parser.add_argument("--force", action="store_true", help="package even if the build looks stale")
    args = parser.parse_args()

    if not (BROWSER / "index.html").exists():
        print(f"no build at {BROWSER} - run: npm run build")
        return 1

    build_time = (BROWSER / "index.html").stat().st_mtime
    source_time, source_name = newest_source_time()
    if source_time > build_time and not args.force:
        print("the build is older than the sources:")
        print(f"   newest source: {source_name}")
        print("   run npm run build first (or pass --force)")
        return 1

    # what a static host must be able to serve, checked rather than assumed
    required = [
        "index.html", "products/index.html", "about/index.html", "contact/index.html",
        "privacy/index.html", "404/index.html",
        "login/index.html", "admin/index.html", "admin/overview/index.html", "admin/products/index.html",
        "user-dashboard/index.html", "guides/index.html",
        "robots.txt", "sitemap.xml", "manifest.json", "favicon.ico",
        "icons/icon-192.png", "icons/icon-512.png", "assets/logo.svg",
    ]
    missing = [entry for entry in required if not (BROWSER / entry).exists()]
    if missing:
        print("the build is missing files the site needs:")
        for entry in missing:
            print("   " + entry)
        return 1

    htaccess = read_server_file(HTACCESS_SOURCE)
    php_404 = read_server_file(PHP_404_SOURCE)
    branded_404 = read_server_file(BROWSER / "404" / "index.html")

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    archive = out_dir / f"teutasteel-frontend-{stamp}.zip"

    files = sorted(path for path in BROWSER.rglob("*") if path.is_file())
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for path in files:
            bundle.write(path, path.relative_to(BROWSER).as_posix())
        bundle.writestr(".htaccess", htaccess)
        bundle.writestr("404.php", php_404)
        bundle.writestr("404.html", branded_404)
        bundle.writestr("RELEASE-README.txt", RELEASE_README)

    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    size = archive.stat().st_size
    print(f"wrote {archive}")
    print(f"   {len(files)} files from the build, plus .htaccess, 404.php, 404.html and RELEASE-README.txt")
    print(f"   {size / 1024:.0f} kB")
    print(f"   sha256 {digest}")
    print(f"   the SSR bundle in {SERVER.name}/ is not included: a static host does not need it")

    biggest = sorted(files, key=lambda p: p.stat().st_size, reverse=True)[:5]
    print("   largest entries:")
    for path in biggest:
        print(f"      {path.stat().st_size / 1024:6.0f} kB  {path.relative_to(BROWSER).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
