"""Checks the CORS preflights the browser will send, which is a class of bug that curl and
the backend test suite cannot see: an authenticated call needs `Authorization` allowed, and
a preflight that refuses it fails in the browser while working perfectly everywhere else.

    python tools/cors_check.py                      # the deployed API
    python tools/cors_check.py --api http://127.0.0.1:5000

A 404 for an endpoint the browser asks about is reported as "not deployed yet" rather than
a failure: it is a deployment state, not a misconfiguration, and the frontend handles it.
"""
from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request

ORIGIN = "https://www.teutasteel.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

CASES = [
    ("POST", "/auth/login", "content-type", "signing in"),
    ("GET", "/category/top", "authorization", "loading the catalogue"),
    ("GET", "/category/tree", "authorization", "loading the category tree"),
    ("GET", "/user/1", "authorization", "opening the profile"),
    ("PUT", "/category/1", "authorization,content-type", "saving a category"),
    ("DELETE", "/product/delete/1", "authorization", "deleting a product"),
]


def preflight(api: str, method: str, path: str, requested: str):
    request = urllib.request.Request(f"{api}{path}", method="OPTIONS")
    request.add_header("Origin", ORIGIN)
    request.add_header("Access-Control-Request-Method", method)
    request.add_header("Access-Control-Request-Headers", requested)
    request.add_header("User-Agent", UA)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.headers
    except urllib.error.HTTPError as error:
        return error.code, error.headers
    except Exception as error:                                   # noqa: BLE001
        return 0, {"error": str(error)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="https://api.teutasteel.com")
    parser.add_argument("--origin", default=ORIGIN)
    args = parser.parse_args()
    api = args.api.rstrip("/")

    print(f"API: {api}   origin: {args.origin}\n")
    refused = []
    undeployed = []
    for method, path, requested, what in CASES:
        status, headers = preflight(api, method, path, requested)
        allow_origin = headers.get("Access-Control-Allow-Origin")
        allow_headers = (headers.get("Access-Control-Allow-Headers") or "").lower()
        allow_methods = (headers.get("Access-Control-Allow-Methods") or "").upper()
        wanted = [name.strip().lower() for name in requested.split(",")]

        origin_ok = allow_origin in (args.origin, "*")
        headers_ok = allow_headers == "*" or all(name in allow_headers for name in wanted)
        method_ok = not allow_methods or method in allow_methods

        if status == 404:
            undeployed.append(f"{method} {path}")
            print(f"   --   {method} {path}  ({what}) - endpoint not deployed yet")
            continue

        ok = status in (200, 204) and origin_ok and headers_ok and method_ok
        if not ok:
            refused.append(f"{method} {path} ({what})")
        print(f"   {'ok  ' if ok else 'FAIL'} {method} {path}  ({what})")
        print(f"        status={status} allow-origin={allow_origin} "
              f"allow-headers={headers.get('Access-Control-Allow-Headers')} "
              f"methods={'ok' if method_ok else headers.get('Access-Control-Allow-Methods')}")

    if undeployed:
        print(f"\n{len(undeployed)} endpoint(s) not deployed yet (the frontend handles this):")
        for entry in undeployed:
            print("   " + entry)

    print(f"\n{len(refused)} preflight(s) the browser would refuse")
    for entry in refused:
        print("   " + entry)
    print("RESULT: " + ("PASS" if not refused else "FAIL"))
    return 0 if not refused else 1


if __name__ == "__main__":
    sys.exit(main())
