"""Packages the built frontend into something that can be uploaded as it is.

    python tools/make_release.py            # after npm run build

Writes dist/release/teutasteel-frontend-<date>.zip containing the contents of
dist/teutasteel-website/browser/ (what belongs in the web root) plus an .htaccess
and a README for whoever uploads it. Refuses to package a build that is older than
the sources it came from.
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

HTACCESS = """\
# Teuta Steel - frontend

# MultiViews would answer /products with products.html if one existed; this app uses
# directories with index.html, so turn it off.
Options -MultiViews
DirectoryIndex index.html

# Some shared hosts still do not know these types. Browsers sniff images, but it is
# better to say so than to rely on that.
AddType image/webp .webp
AddType font/woff2 .woff2

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/plain text/xml application/javascript \\
    text/javascript application/json application/xml image/svg+xml
</IfModule>

<IfModule mod_headers.c>
  # File names are hashed at build time, so they can be cached hard; the HTML must
  # not be, or a cached shell keeps pointing at assets that a deploy has removed.
  <FilesMatch "\\.(js|css|woff2?|png|jpe?g|webp|svg|ico)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "\\.(html|json|xml|txt)$">
    Header set Cache-Control "public, max-age=0, must-revalidate"
  </FilesMatch>
  Header set X-Content-Type-Options "nosniff"
</IfModule>

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType text/html "access plus 0 seconds"
</IfModule>
"""

RELEASE_README = """\
Teuta Steel - frontend release
==============================

Upload everything in this archive into the web root of www.teutasteel.com,
replacing the files that are there (keep the directory structure).

Before you upload: the site being replaced is a Bootstrap Studio export. Its own
folders are still on the server and nothing here overwrites them. They are no
longer used by anything and can be deleted once the new site is live:

    assets/bootstrap/    assets/css/    assets/fonts/    assets/img/    assets/js/
    manifest.json (this archive replaces it)

After uploading:

1. Check https://www.teutasteel.com/ in a browser, then /products, /about and
   /contact.
2. Run tools/smoke_test.py from the development machine; it checks 28 things and
   tells you which ones failed.
3. If Cloudflare has a caching rule for HTML, purge it, or visitors can keep an old
   index.html that points at asset names which no longer exist.

The API is deployed separately (a git push to 160.153.129.39, then flask db
upgrade). Until it is, the catalogue sections hide themselves and the products page
shows a translated "catalogue unavailable" notice - the rest of the site works.
"""


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
        "login/index.html", "admin-dashboard/index.html", "user-dashboard/index.html",
        "robots.txt", "sitemap.xml", "manifest.json", "favicon.ico",
        "icons/icon-192.png", "icons/icon-512.png", "assets/logo.svg",
    ]
    missing = [entry for entry in required if not (BROWSER / entry).exists()]
    if missing:
        print("the build is missing files the site needs:")
        for entry in missing:
            print("   " + entry)
        return 1

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    archive = out_dir / f"teutasteel-frontend-{stamp}.zip"

    files = sorted(path for path in BROWSER.rglob("*") if path.is_file())
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for path in files:
            bundle.write(path, path.relative_to(BROWSER).as_posix())
        bundle.writestr(".htaccess", HTACCESS)
        bundle.writestr("RELEASE-README.txt", RELEASE_README)

    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    size = archive.stat().st_size
    print(f"wrote {archive}")
    print(f"   {len(files)} files from the build, plus .htaccess and RELEASE-README.txt")
    print(f"   {size / 1024:.0f} kB, sha256 {digest[:16]}")
    print(f"   the SSR bundle in {SERVER.name}/ is not included: a static host does not need it")

    biggest = sorted(files, key=lambda p: p.stat().st_size, reverse=True)[:5]
    print("   largest entries:")
    for path in biggest:
        print(f"      {path.stat().st_size / 1024:6.0f} kB  {path.relative_to(BROWSER).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
