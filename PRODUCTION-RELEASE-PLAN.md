# Production release plan — Teuta Steel

Status: **preparation**, 8 November 2026.
Current frontend: `3adba84` (SEO build ready). Current backend: `77870cf` (live).
Production frontend: still the old static site. Test site: new Angular build, deliberately `noindex`.

This plan is ordered. Do not skip a gate; a later phase assumes the earlier one is signed off.

## Definition of a successful release

- `https://www.teutasteel.com/` serves the new Angular site.
- Every old page has a single 301 to its new page; unknown paths return a real 404.
- `/products/`, category pages, product dialogs, services, guides, about and contact work on desktop and phone.
- The request form/WhatsApp handoff, admin login/editing/upload, and the public API work against production.
- One canonical host (`www`), HTTPS, no `noindex`, `robots.txt` and `sitemap.xml` correct.
- A verified backup and a tested rollback exist.
- The owner has signed off the content/data deferrals listed at the end.

## Critical path — 10 steps

1. Owner decisions and code freeze.
2. Full backup of the production site and database.
3. Fix the release-gating content/data items.
4. Final code/QA pass and build.
5. Add privacy page, 301 map and production `.htaccess`.
6. Rehearse the deploy in a separate directory.
7. Set the maintenance window and lower DNS/cache TTLs.
8. Swap the production document root.
9. Run the live verification matrix; roll back on a failed gate.
10. Submit the sitemap, monitor, and finish the deferred data work.

---

## Phase 0 — decisions and freeze

Owner decisions, all needed before Phase 5:

- [ ] **Launch window** and acceptable downtime (the atomic directory rename is seconds; DNS/cache should be lowered first).
- [ ] **Data gate:** confirm units for the core categories (see Phase 2) or explicitly accept launching with “price basis to confirm”.
- [ ] **Privacy/legal copy** for the new site, including the request form, Cloudinary-hosted images and any analytics.
- [ ] **Calculator redirect:** `/Calculator.html` → `/request/` (recommended) or `/products/`.
- [ ] **Analytics:** keep Google Tag Manager/GA4, add it to the new build, or launch without it.
- [ ] **Search Console/Bing access:** DNS TXT permission for the domain property.
- [ ] **Test-site policy after launch:** keep it public with live data, or restrict it.

Freeze:

- [ ] No code changes after the release tag except release-blocking fixes.
- [ ] No admin editing during the cutover.
- [ ] Announce a read-only window to staff.

## Phase 1 — backup and rollback point

- [ ] Record the current production state: document root, `.htaccess` (currently empty), file list, PHP/Passenger config, SSL mode, DNS records and TTLs.
- [ ] Archive `public_html` **including hidden files** to a dated tarball outside the document root; verify it lists `index.html`, `assets/`, `privacy`, `api/`.
- [ ] Take a database dump (`mysqldump`/cPanel backup) and store it off-host; confirm the dump opens.
- [ ] Copy `env.backup`, Cloudinary settings and the backend checkout state; tag the backend rollback point (`pre-77870cf` already exists).
- [ ] Prove the rollback: extract the site archive into a throwaway directory and compare file count/checksum.
- [ ] Record the current DNS TTL and lower it to 300 seconds at least 24 hours before cutover.

**Gate G1:** backup exists, is readable, and the restore test passed.

## Phase 2 — content and catalogue data

The UI already says “price basis to confirm” instead of inventing units, so an incomplete catalogue is honest — but it is not “fixed”.

Release gate — core categories:

- [ ] Square/rectangular tubes (155 priced variants).
- [ ] Flat bars (67).
- [ ] Round tubes (50).
- [ ] Solid round/square bar (37).
- [ ] Steel sheets (32).
- [ ] Confirm each price’s unit (piece, metre, m², kg) from the owner/source list and update through the admin.
- [ ] Re-check that no priced variant in these categories has an empty unit; no negative prices; no hidden price that should be visible.

Can ship with a documented follow-up:

- [ ] The remaining 215 priced variants in the other categories.
- [ ] R1–R19 individual photographs/specifications (owner/supplier evidence).
- [ ] 21 of 22 category-112 products without individual photographs.
- [ ] 2 products without an English translation row; 6 without dimension rows.
- [ ] 431 products without an image reference (many are intentional section drawings).
- [ ] F07: one dimension-unit presentation (Multival still mixes 2100 mm and 6 m).
- [ ] F13: technical guidance copy and real project evidence.

**Gate G2:** the owner signs the list above as launch-blocking or accepted follow-up; the core categories are corrected.

## Phase 3 — code, tests and build

- [ ] `git status` clean in frontend and backend; local `main`/`master` equal their remotes.
- [ ] Backend: `pytest -q` — currently **278 passed**.
- [ ] Frontend: `npx ng test --watch=false --browsers=ChromeHeadless` — currently **275 passed**.
- [ ] Translation parity: `npm run check:i18n` — every key present in both languages, no empty value or placeholder mismatch.
- [ ] Production build: `npm run build:seo` — **27 routes** plus a **1,402-URL sitemap**.
- [ ] Staging build still removes the sitemap and sets `noindex`: `npm run build:staging`.
- [ ] Check the built `index.html` for `siteUrl` `https://www.teutasteel.com`, `apiUrl` `https://api.teutasteel.com`, one title, canonical, description and two JSON-LD blocks.
- [ ] Check no `test.teutasteel.com` URLs in the production artifact.
- [ ] Fix before launch if they are judged blocking:
  - [ ] Product stylesheet is **13.90 kB against a 14.00 kB error limit**; trim or consciously accept.
  - [ ] External Cloudinary cancellation and a signed-in media-page save.
  - [ ] Two-browser 409 conflict on the deployed environment.
  - [ ] Keyboard-only admin pass.
- [ ] Run the mobile matrix at 320/390/430/768/1280 px on home, products, category, product dialog, request, contact and 404.

**Gate G3:** tests/build green, production artifact inspected, no new warnings or TODO blockers.

## Phase 4 — SEO, old URLs, privacy and server rules

Create `privacy/index.html` from the existing `/privacy` page, reviewed for the new site (request form, Cloudinary, analytics, admin). Add the footer link and keep `/privacy/` indexable.

Add the production `.htaccess` (draft below) and `404.php`; do not reuse the staging headers.

Old URL map — every entry needs a test after deployment:

| Old production URL | New destination | Status |
|---|---|---|
| `/` | `/` | 200 |
| `/index.html` | `/` | 301 |
| `/produktet.html` | `/products/` | 301 |
| `/cnc.html` | `/services/cnc/` | 301 |
| `/na-kontaktoni.html` | `/contact/` | 301 |
| `/rreth-nesh.html` | `/about/` | 301 |
| `/Calculator.html` | `/request/` (decision) | 301 |
| `/privacy` | `/privacy/` | 301/200 |
| `/api/*` | unchanged | verify |
| old `/assets/*` | archive; add redirects only for images still referenced externally | audit |

- [ ] `www` is canonical; `https://teutasteel.com/*` → `https://www.teutasteel.com/*` (single 301, no chain).
- [ ] HTTPS enforced; Cloudflare SSL mode verified; HSTS considered after a successful week.
- [ ] `robots.txt` production allows public pages and points to `sitemap.xml`; no `noindex` header.
- [ ] `sitemap.xml` contains **1,402** canonical URLs (or the regenerated count).
- [ ] Old query-string URLs and `/index` variants are tested.
- [ ] Search Console domain property verified by DNS TXT (can be done before cutover).
- [ ] Bing Webmaster Tools prepared.

Production `.htaccess` draft:

```apache
Options -Indexes -MultiViews
DirectoryIndex index.html
PassengerEnabled off
ErrorDocument 404 /404.html

RewriteEngine On

# One canonical host. Do not touch api.teutasteel.com.
RewriteCond %{HTTP_HOST} ^teutasteel\.com$ [NC]
RewriteRule ^ https://www.teutasteel.com%{REQUEST_URI} [R=301,L]

# Legacy pages, one hop each.
RewriteRule ^index\.html$ / [R=301,L]
RewriteRule ^produktet\.html$ /products/ [R=301,L]
RewriteRule ^cnc\.html$ /services/cnc/ [R=301,L]
RewriteRule ^na-kontaktoni\.html$ /contact/ [R=301,L]
RewriteRule ^rreth-nesh\.html$ /about/ [R=301,L]
RewriteRule ^Calculator\.html$ /request/ [R=301,L]

# Existing files and directories first.
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Known application routes use the SPA shell.
RewriteRule ^(?:products|request|services|about|contact|guides|projects|privacy|login|404|admin-dashboard|user-dashboard)/?$ index.html [L]
RewriteRule ^services/(?:cnc|shears|profiles|bending|pressbrake|complex|decoration)/?$ index.html [L]
RewriteRule ^admin(?:/(?:overview|products|categories|media|content|settings|users|forbidden))?/?$ index.html [L]
RewriteRule ^ 404.php [L]

<IfModule mod_headers.c>
  # Long cache only for fingerprinted assets; the HTML must revalidate.
  <FilesMatch "\.(?:js|css|woff2?|svg|png|jpe?g|webp|avif)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
```

`404.php` can reuse `tools/staging-404.php` minus the `noindex` header; it must return HTTP 404 and read `404.html`.

**Gate G4:** redirect map, privacy page, production `.htaccess`, robots and sitemap reviewed on a copy.

## Phase 5 — rehearsal

- [ ] Build the exact release artifact from the tag; record its SHA-256.
- [ ] Upload it to `/home/<account>/release-YYYYMMDD.tar.gz`.
- [ ] Extract into `/home/<account>/public_html_new`; do not touch `public_html` yet.
- [ ] Copy the reviewed `privacy/` directory and any preserved `/api/` content into the new root.
- [ ] Set files 644, directories 755, correct owner/group.
- [ ] Test `public_html_new` through a temporary subdomain or a host-header override; check assets, API, 404, redirects and admin login.
- [ ] Purge nothing yet; production is still untouched.
- [ ] Dry-run the rename and rollback commands in a scratch directory.

**Gate G5:** the new root works end-to-end from a temporary URL; rollback command is known.

## Phase 6 — cutover

Do this in the agreed window, with staff notified.

- [ ] Confirm no admin edits for the last 30 minutes.
- [ ] Re-check the backup and DB dump.
- [ ] Upload the release artifact; verify checksum.
- [ ] Archive `public_html` again immediately before the swap.
- [ ] `mv public_html public_html_old_YYYYMMDD`
- [ ] `mv public_html_new public_html`
- [ ] Purge Cloudflare cache for `/`, `/products/*`, `/services/*`, `/assets/*`, `/sitemap.xml`, `/robots.txt`.
- [ ] Hit the home page and a product page immediately.

If the swap fails, reverse the two `mv` commands and purge again. Do not debug in production.

## Phase 7 — live verification

Run every check; record status, URL and time.

| # | Check | Pass condition |
|---|---|---|
| 1 | `/` | 200, new title, canonical `https://www.teutasteel.com/` |
| 2 | `/products/` | 200, product list renders |
| 3 | `?category=113`, `?category=111` | 200, products and prices |
| 4 | `?product=4195`, `?product=2166` | dialog opens; price/unit correct; one visual |
| 5 | `/services/`, `/services/cnc/`, `/guides/`, `/about/`, `/contact/`, `/request/` | 200 |
| 6 | `/privacy/` | 200, readable policy |
| 7 | old URLs table | one 301 each to the right page |
| 8 | unknown path | **404** with branded page, not the SPA shell |
| 9 | `https://teutasteel.com/` | 301 to `https://www.teutasteel.com/` |
| 10 | headers | no `X-Robots-Tag: noindex`; cache policy as intended |
| 11 | `robots.txt`, `sitemap.xml` | correct host, 1,402 URLs |
| 12 | API | `/settings`, `/category/tree`, `/product/public/4195` = 200 |
| 13 | admin | login, open editor, save, upload, bulk preview; no 409/500 unless expected |
| 14 | request form/WhatsApp | real submission and handoff |
| 15 | phone | 320/390/430 px; no overflow; touch targets |
| 16 | analytics | page view recorded (if enabled) |
| 17 | Search Console | fetch home, submit sitemap, no coverage errors |

**Gate G6:** all 17 pass. Any failure in 1–14 is a rollback trigger unless it is fixed within the window.

## Phase 8 — rollback

- [ ] Trigger on blank page, 5xx, missing assets, API failure, admin outage, form failure or redirect loop.
- [ ] Restore: `mv public_html public_html_failed_YYYYMMDD; mv public_html_old_YYYYMMDD public_html`.
- [ ] Purge Cloudflare; verify `/`, `/products/`, API and admin.
- [ ] Keep the failed archive and logs for diagnosis.
- [ ] Do not restore the database unless the release wrote data; if it did, restore the dump with the backend stopped.

## Phase 9 — after launch

First 48 hours:

- [ ] Watch Cloudflare/cPanel error logs, 5xx and 404 spikes.
- [ ] Check Search Console coverage: old URLs redirect, new URLs indexed, sitemap processed.
- [ ] Check form/WhatsApp enquiries arrive.
- [ ] Check admin saves/versions and uploads in production.
- [ ] Confirm no test URL or `noindex` leaked.

First two weeks:

- [ ] Finish the deferred units, R-panel images/specs, category 112 photos, English rows and dimension rows.
- [ ] Decide the language-URL project (`/en/` + `hreflang`) and clean product paths (`/products/2166-08252`) with SSR/prerender.
- [ ] Re-run Core Web Vitals; trim the product CSS budget.
- [ ] Remove or lock down the test site/live-DB admin access.
- [ ] Update `PROJECT-HANDOVER.md`, `ADMIN-IMPLEMENTATION-STATUS.md` and this plan with the release commit and date.

## Known deferred items (not release blockers unless the owner says so)

- English language URLs/hreflang; product pages are query strings and client-rendered.
- Remaining 215 unit confirmations and all non-core data.
- F07 dimension formatting, F13 copy/projects, R-panel imagery.
- Analytics/consent if not enabled now.
- Batch price reversal, synonyms and other non-launch features.

## Immediate next actions

Owner:
1. Confirm the data gate and Calculator redirect.
2. Approve privacy/legal copy and analytics.
3. Give a launch window and Search Console/DNS access.

Engineering:
1. Create the reviewed privacy page and production `.htaccess`.
2. Run the Phase 3 checks and produce the release artifact with a checksum.
3. Rehearse in `public_html_new`, then agree the go/no-go.
