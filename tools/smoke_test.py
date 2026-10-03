"""Checks a deployed site and its API from the outside, in one command.

Run it after deploying (nothing to install - standard library only):

    python tools/smoke_test.py

Point it somewhere else with the environment:

    SITE_URL=http://127.0.0.1:4321 API_URL=http://127.0.0.1:5000 python tools/smoke_test.py

It answers the questions you have right after a deploy: is the site up, is the new
front-end the one being served, and is the API the new one too? Every check prints
what it saw, and the command exits non-zero if anything failed.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

SITE_URL = os.environ.get("SITE_URL", "https://www.teutasteel.com").rstrip("/")
API_URL = os.environ.get("API_URL", "https://api.teutasteel.com").rstrip("/")
TIMEOUT = float(os.environ.get("SMOKE_TIMEOUT", "20"))

# Both hosts sit behind Cloudflare, which answers 403 to a request that does not
# look like a browser. Without these headers every check below fails with 403 and
# the tool would report a healthy deployment as broken.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Accept": "text/html,application/json,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "sq,en;q=0.8",
}

results = []


def check(label, condition, detail=""):
    results.append((label, bool(condition)))
    mark = "PASS" if condition else "FAIL"
    print(f"   [{mark}] {label}" + (f"  {detail}" if detail else ""))
    return bool(condition)


def fetch(url, method="GET", payload=None, token=None, timeout=None):
    """Returns (status, body-text, headers). Never raises for HTTP errors."""
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    for name, value in HEADERS.items():
        request.add_header(name, value)
    if data:
        request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=timeout or TIMEOUT) as response:
            return response.status, response.read().decode("utf-8", "replace"), dict(response.headers)
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", "replace"), dict(error.headers or {})
    except Exception as error:                                   # noqa: BLE001
        return 0, f"{type(error).__name__}: {error}", {}


def as_json(text):
    try:
        return json.loads(text)
    except ValueError:
        return None


print(f"site: {SITE_URL}\napi : {API_URL}\n")

print("the site")
status, home, _ = fetch(f"{SITE_URL}/")
check("the home page answers", status == 200, f"(status {status})")
check("it is the Angular application", "<app-root" in home)
check("it names the business", "TeutaSteel" in home)

bundle = re.search(r'(main-[A-Z0-9]+\.js)', home or "")
if check("it references its main bundle", bool(bundle), f"({bundle.group(1) if bundle else 'none'})"):
    status, script, _ = fetch(f"{SITE_URL}/{bundle.group(1)}")
    # a single big bundle means the lazy-loading change is not deployed
    check("the bundle is the slim one (pages load on demand)",
          status == 200 and len(script) < 250_000,
          f"({len(script):,} bytes)")

for route in ("products", "about", "contact"):
    status, page, _ = fetch(f"{SITE_URL}/{route}")
    canonical = re.search(r'<link rel="canonical" href="([^"]+)"', page or "")
    check(f"/{route} answers", status == 200, f"(status {status})")
    check(f"/{route} names itself as canonical",
          bool(canonical) and canonical.group(1).rstrip("/").endswith(f"/{route}"),
          f"({canonical.group(1) if canonical else 'no canonical'})")

status, robots, _ = fetch(f"{SITE_URL}/robots.txt")
check("robots.txt is served", status == 200 and "Sitemap:" in robots)

status, sitemap, _ = fetch(f"{SITE_URL}/sitemap.xml")
check("the sitemap is served", status == 200 and "</urlset>" in sitemap,
      f"({len(re.findall(r'<loc>', sitemap or ''))} urls)")

print("\nthe api")
status, body, _ = fetch(f"{API_URL}/category/top")
tops = as_json(body) if status == 200 else None
new_api = check("GET /category/top answers (the new backend is live)",
                status == 200 and isinstance(tops, list),
                f"(status {status})" + ("" if status == 200 else " - if this is 404 the backend deploy has not happened"))

if new_api and tops:
    first = tops[0]
    check("the categories carry parent_id (the migration ran)",
          "parent_id" in first, f"(keys: {', '.join(sorted(first)[:6])})")
    status, children, _ = fetch(f"{API_URL}/category/{first['id']}/children")
    check("GET /category/<id>/children answers",
          status == 200 and isinstance(as_json(children), list), f"(status {status})")
    status, page, _ = fetch(f"{API_URL}/category/{first['id']}?per_page=8&lang=al")
    payload = as_json(page) if status == 200 else None
    check("GET /category/<id> answers with pagination",
          status == 200 and isinstance(payload, dict) and "pagination" in payload, f"(status {status})")

status, _, _ = fetch(f"{API_URL}/category/")
check("GET /category/ refuses an anonymous caller", status == 401, f"(status {status})")

status, body, _ = fetch(f"{API_URL}/auth/login", method="POST",
                        payload={"username": "definitely-not-a-user", "password": "wrong"})
check("login rejects wrong credentials without an error",
      status in (401, 429), f"(status {status})")

failed = [label for label, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
if failed:
    print("failed:")
    for label in failed:
        print("   " + label)
    print("\nRESULT: FAIL")
    sys.exit(1)
print("RESULT: PASS")
