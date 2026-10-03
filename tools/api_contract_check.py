"""Calls every endpoint the frontend calls, with the parameters it sends, and checks the
response carries the fields its templates read.

The backend sweep (calling every route) found eighteen endpoints that could only answer 500.
This is the other direction: not "does the route work" but "does it give the site what the
site asks for". A field quietly dropped from a schema breaks a page without failing a single
backend test.

    python tools/api_contract_check.py --api http://127.0.0.1:5000 --token <jwt>
    python tools/api_contract_check.py --user admin --password adminpass

Where the endpoint appears in the code:
    product.service.ts  /category/, /category/<id>/children, /category/top,
                        /category/create, /product/create, /category/<id>?page=…&lang=…,
                        /product/<id>, /category/without-products/<id>
    auth.service.ts     /auth/login
    user.service.ts     /user/<id>
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


def call(api: str, method: str, path: str, body=None, token: str | None = None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(f"{api}{path}", data=data, method=method)
    request.add_header("Content-Type", "application/json")
    request.add_header("User-Agent", UA)
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            status = response.status
    except urllib.error.HTTPError as error:
        return error.code, None, error.read()[:200]
    except Exception as error:                                   # noqa: BLE001
        return 0, None, str(error).encode()
    try:
        return status, json.loads(raw), raw[:200]
    except ValueError:
        return status, None, raw[:200]


def check(api, method, path, token, wanted, note=""):
    status, payload, raw = call(api, method, path, None, token)
    keys = sorted(payload) if isinstance(payload, dict) else (
        f"list[{len(payload)}]" if isinstance(payload, list) else type(payload).__name__)
    missing = []
    if status not in (200, 201):
        missing.append(f"status {status}")
    elif isinstance(payload, list):
        sample = payload[0] if payload else {}
        if not isinstance(sample, dict):
            missing.append("the list does not contain objects")
        else:
            for field in wanted:
                # a field may live on the object's own keys
                if field not in sample:
                    missing.append(field)
    elif isinstance(payload, dict):
        for field in wanted:
            if field not in payload:
                missing.append(field)
    else:
        missing.append("no JSON body")

    ok = not missing
    print(f"   [{'ok  ' if ok else 'FAIL'}] {method} {path}  {note}")
    print(f"          {keys if not isinstance(keys, list) else 'keys: ' + ', '.join(keys)}")
    if missing:
        print(f"          missing: {', '.join(missing)}")
        print(f"          body was: {raw[:120]!r}")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://127.0.0.1:5000")
    parser.add_argument("--token")
    parser.add_argument("--user", default="admin")
    parser.add_argument("--password", default="adminpass")
    args = parser.parse_args()
    api = args.api.rstrip("/")

    token = args.token
    if not token:
        status, payload, raw = call(api, "POST", "/auth/login",
                                    {"username": args.user, "password": args.password})
        if status != 200 or not isinstance(payload, dict):
            print(f"could not sign in: {status} {raw[:120]!r}")
            return 1
        # auth.service.ts stores response.access_token and reads the id out of the token
        if "access_token" not in payload:
            print(f"FAIL: the login response has no access_token: {sorted(payload)}")
            return 1
        print(f"   [ok  ] POST /auth/login  access_token present")
        token = payload["access_token"]

    failures = 0
    print("\nreads the site makes on every page:")
    failures += not check(api, "GET", "/category/top", token, ["id", "title"], "(the home page)")
    status, categories, _ = call(api, "GET", "/category/", None, token)
    failures += not check(api, "GET", "/category/", token, ["id", "title"], "(the catalogue)")
    category_id = categories[0]["id"] if isinstance(categories, list) and categories else 1

    failures += not check(api, "GET", f"/category/{category_id}/children", token, [],
                          "(opening a category)")
    failures += not check(api, "GET",
                          f"/category/{category_id}?page=1&per_page=12&lang=al", token,
                          ["products"], "(the products of a category)")

    # the products are not necessarily in the first category, so look through them until
    # one has some - otherwise the shape check below silently asserts nothing
    product_id = None
    for candidate in ([category_id] + [item["id"] for item in categories
                                       if isinstance(item, dict) and "id" in item])[:8]:
        status, listing, _ = call(api, "GET",
                                  f"/category/{candidate}?page=1&per_page=12&lang=al", None, token)
        if isinstance(listing, dict) and listing.get("products"):
            product_id = listing["products"][0].get("id")
            print(f"          (took a product from category {candidate})")
            break

    profile_id = 1
    failures += not check(api, "GET", f"/user/{profile_id}", token, ["id", "username"],
                          "(the user dashboard)")

    print("\nthe shape of a product, as the templates read it:")
    if product_id:
        status, product, _ = call(api, "GET", f"/product/{product_id}", None, token)
        if not isinstance(product, dict):
            print(f"   [FAIL] GET /product/{product_id} did not return an object")
            failures += 1
        else:
            # models.ts declares dimensions and translations as required arrays, and the
            # product cards read code, slug and description
            for field, kind in (("code", str), ("dimensions", list), ("translations", list),
                                ("is_active", bool), ("cut_type", int)):
                present = field in product
                right = isinstance(product.get(field), kind) if present else False
                ok = present and right
                if not ok:
                    failures += 1
                print(f"   [{'ok  ' if ok else 'FAIL'}] product.{field}"
                      f"{'' if ok else f'  ({kind.__name__} expected, got {type(product.get(field)).__name__})'}")
    else:
        print("   (no product to inspect)")

    print("\nthe writes the admin forms make:")
    status, created, raw = call(api, "POST", "/category/create",
                                {"title": "Contract Check", "is_active": True,
                                 "top_category": True, "parent_id": None}, token)
    ok = status in (200, 201) and isinstance(created, dict) and "id" in created
    failures += not ok
    print(f"   [{'ok  ' if ok else 'FAIL'}] POST /category/create -> {status} "
          f"{sorted(created) if isinstance(created, dict) else raw[:80]!r}")

    if ok:
        new_id = created["id"]
        status, updated, raw = call(api, "PUT", f"/category/without-products/{new_id}",
                                    {"title": "Contract Check 2"}, token)
        ok2 = status in (200, 201) and isinstance(updated, dict)
        failures += not ok2
        print(f"   [{'ok  ' if ok2 else 'FAIL'}] PUT /category/without-products/{new_id} -> {status}")

        status, product, raw = call(api, "POST", "/product/create",
                                    {"code": "CONTRACT-1", "cut_type": 1, "is_active": True,
                                     "new_product": False, "category_id": new_id,
                                     "translations": [{"language": "en", "content": "x",
                                                       "slug": "contract-1",
                                                       "description": "contract"}],
                                     "dimensions": [{"height": 1, "width": 1, "length": 1,
                                                     "weight": 1, "price": 1.0,
                                                     "currency": "EUR"}]}, token)
        made = status in (200, 201) and isinstance(product, dict) and "id" in product
        failures += not made
        print(f"   [{'ok  ' if made else 'FAIL'}] POST /product/create -> {status} "
              f"{sorted(product) if isinstance(product, dict) else raw[:80]!r}")

        if made:
            pid = product["id"]
            status, edited, raw = call(api, "PUT", f"/product/{pid}",
                                       {"code": "CONTRACT-2", "cut_type": 1}, token)
            ok3 = status in (200, 201)
            failures += not ok3
            print(f"   [{'ok  ' if ok3 else 'FAIL'}] PUT /product/{pid} -> {status}")
            call(api, "DELETE", f"/product/delete/{pid}", None, token)

        call(api, "DELETE", f"/category/{new_id}", None, token)
        print("   cleaned up the rows this check created")

    print(f"\n{failures} contract failure(s)")
    print("RESULT: " + ("PASS - the API answers everything the site asks for"
                        if failures == 0 else "FAIL"))
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
