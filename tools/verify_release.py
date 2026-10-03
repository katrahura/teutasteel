"""Checks the release archive - the thing that actually gets uploaded - not the build.

The browser checks have been running against dist/.../browser, which is what the archive is
made from but not what is shipped. A packager that drops a file, or mislays the .htaccess,
would leave every one of those checks passing against something nobody uploads.

This compares the archive's contents with the build, checks the .htaccess is present and
still carries the headers, and unpacks it so the browser checks can run against the real
article:

    python tools/verify_release.py
    # then, in another shell, serve the printed directory and point the checks at it
"""
from __future__ import annotations

import pathlib
import shutil
import sys
import tempfile
import zipfile

PROJECT = pathlib.Path(__file__).resolve().parent.parent
RELEASE_DIR = PROJECT / "dist" / "release"
BUILD_DIR = PROJECT / "dist" / "teutasteel-website" / "browser"
# added by the packager, not part of the build
ADDED = {".htaccess": 1, "RELEASE-README.txt": 0}
EXPECTED_HTACCESS = [
    'Header set X-Content-Type-Options "nosniff"',
    'Header set X-Frame-Options "SAMEORIGIN"',
    'Header set Referrer-Policy "strict-origin-when-cross-origin"',
    'Header set Permissions-Policy "geolocation=(), microphone=(), camera=()"',
    'Header always set Strict-Transport-Security "max-age=31536000"',
    'Header set Cache-Control "public, max-age=31536000, immutable"',
    'Header set Cache-Control "public, max-age=0, must-revalidate"',
    "Options -MultiViews",
]


def main() -> int:
    archives = sorted(RELEASE_DIR.glob("*.zip"))
    if not archives:
        print(f"no archive in {RELEASE_DIR}; run tools/make_release.py first")
        return 1
    archive = archives[-1]
    print(f"archive: {archive.name}  ({archive.stat().st_size / 1024:.0f} kB)\n")

    problems = []
    with zipfile.ZipFile(archive) as bundle:
        names = set(bundle.namelist())
        build = {str(path.relative_to(BUILD_DIR)).replace("\\", "/")
                 for path in BUILD_DIR.rglob("*") if path.is_file()}

        missing = build - names
        extra = names - build - set(ADDED)
        print(f"build files: {len(build)}   entries in the archive: {len(names)}")
        for name in sorted(missing):
            problems.append(f"in the build but not in the archive: {name}")
        for name in sorted(extra):
            problems.append(f"in the archive but not in the build: {name}")
        if not missing and not extra:
            print("   every build file is present, and nothing unexpected was added")

        absent = [name for name in ADDED if name not in names]
        for name in absent:
            problems.append(f"the archive has no {name}")
        if not absent:
            print(f"   the packager's own files are there: {', '.join(sorted(ADDED))}")

        htaccess = bundle.read(".htaccess").decode("utf-8", "replace") if ".htaccess" in names else ""
        for line in EXPECTED_HTACCESS:
            if line not in htaccess:
                problems.append(f".htaccess is missing: {line}")
        if htaccess and not any(".htaccess is missing" in p for p in problems):
            print(f"   .htaccess carries all {len(EXPECTED_HTACCESS)} expected directives")

        biggest = sorted(((item.file_size, item.filename) for item in bundle.infolist()),
                         reverse=True)[:3]
        print("\n   largest entries:")
        for size, name in biggest:
            print(f"      {size / 1024:7.0f} kB  {name}")

    unpacked = pathlib.Path(tempfile.gettempdir()) / "teuta-release-check"
    if unpacked.exists():
        shutil.rmtree(unpacked)
    unpacked.mkdir(parents=True)
    with zipfile.ZipFile(archive) as bundle:
        bundle.extractall(unpacked)
    served = sum(1 for path in unpacked.rglob("*") if path.is_file())
    print(f"\n   unpacked {served} files to {unpacked}")

    print()
    if problems:
        print(f"RESULT: FAIL - {len(problems)} problem(s)")
        for problem in problems:
            print("   " + problem)
        return 1
    print("RESULT: PASS - the archive is the build, plus the headers and the readme")
    print(f"\nServe it and point the browser checks at it:\n"
          f"   cd \"{unpacked}\" && python -m http.server 4321\n"
          f"   node --experimental-websocket tools/frontend_only_check.mjs\n"
          f"   node --experimental-websocket tools/link_check.mjs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
