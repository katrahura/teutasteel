# Test website operations


> Hosting identifiers are redacted in this public copy. The unredacted operations copy is kept outside the repository.

Last reconciled: 7 November 2026. Main status: [PROJECT-HANDOVER.md](../PROJECT-HANDOVER.md).

## Architecture and ownership decision

Browser -> Cloudflare -> cPanel static frontend at test.teutasteel.com.
Browser -> https://api.teutasteel.com -> existing live MySQL.

The owner explicitly chose existing live API + live MySQL. There is no separate active test database. Changes made through the admin panel affect production. This is a frontend preview for review before replacing the production frontend.

## Hosting inventory

| Item | Value |
|---|---|
| cPanel account | [hosting-account] |
| Origin IP | [origin-ip] |
| Test document root | /home/[hosting-account]/test.teutasteel.com |
| Production frontend root | /home/[hosting-account]/public_html |
| Existing API application | /home/[hosting-account]/backend |
| Existing API Python | /home/[hosting-account]/virtualenv/backend/3.11/bin/python |
| DNS authority | Cloudflare: clara.ns.cloudflare.com and mark.ns.cloudflare.com |
| DNS record | A: test -> [origin-ip], Proxied (orange cloud) |

The subdomain was created using cPanel UAPI SubDomain addsubdomain with domain=test, rootdomain=teutasteel.com, dir=test.teutasteel.com. Its document root is separate from public_html.

## TLS and DNS history

The origin presents a Cloudflare Origin certificate covering *.teutasteel.com and teutasteel.com, valid from 25 February 2021 through 22 February 2036. Direct browser connections do not trust that origin CA. Cloudflare proxying is required for the current certificate arrangement; do not switch the record back to DNS-only without arranging a browser-trusted origin certificate.

AutoSSL is disabled on this hosting account (UAPI returned feature unavailable). No certificate-validation bypass was used. Public HTTPS through Cloudflare returned 200 with verification enabled. The Cloudflare SSL mode was not inspected or changed during this task; do not claim it was verified as Full (strict).

The local Wi-Fi DNS server, 192.168.1.1, cached an old missing-record answer after the record was added. Cloudflare authoritative servers, 1.1.1.1 and 8.8.8.8 returned the correct proxied addresses while local resolution failed. Clearing the Windows DNS cache did not clear the router's upstream cache. For that symptom, compare resolver responses, wait for negative-cache expiry or restart the router; mobile data provides an independent check. Do not treat a local stale response as evidence that the authoritative record is missing.

## Frontend build and publication

Application source: the release commit on `main` in this repository. The test build is produced with
`npm run build:staging` from that commit; rebuild from source rather than relying on an artifact hash.

The deployed build uses production optimization with these values:

- apiUrl: https://api.teutasteel.com
- siteUrl: https://test.teutasteel.com
- Existing Cloudinary delivery configuration unchanged.

Build command: `npm run build:staging`. It uses the named `staging` configuration (which replaces only
`environment.ts` with `environment.staging.ts`), writes `dist/staging`, then runs
`tools/prepare-staging.mjs`. No temporary edit of the production environment file is needed.

The packaging step rewrites the test domain into the prerendered HTML, replaces any robots meta with
`noindex,nofollow,noarchive`, removes the production `sitemap.xml`, writes a disallow-all `robots.txt`,
copies the `.htaccess` and `404.php`, and generates the branded `404.html`. Only the separate test
document root is updated; server bundles and source secrets are never published.

The root .htaccess disables Passenger, serves directory index.html, sends unknown frontend routes to index.html, blocks /api with 404, and adds X-Robots-Tag noindex/nofollow/noarchive plus Cache-Control no-store. Directory indexing and MultiViews are disabled. Existing prerendered directories may redirect to trailing slashes before returning 200.

## Deployment artifacts and rollback

Server archives:

- /home/[hosting-account]/staging-site-live-api-20261028.tar.gz — published browser build including staging restrictions.
- /home/[hosting-account]/staging-placeholder-20261028.tar.gz — prior placeholder HTML, robots.txt and .htaccess. Its .htaccess at capture time included the temporary Passenger setup, so it is **not** a safe blind static rollback.
- /home/[hosting-account]/staging-site-20261028.tar.gz may not exist: the separate-API frontend upload did not complete. Check existence rather than assuming.

To return staging to a static maintenance notice, back up the current test document root first, restore the placeholder HTML and robots.txt selectively, and keep Passenger disabled with the current no-index/static .htaccess. Verify HTTPS, /api returning 404, and no-index headers afterward. This changes staging only. It does not reverse catalogue/settings edits in shared MySQL; those require record-specific recovery or a verified database backup.

Never restore a test archive into public_html or the backend application. Never reset the live database to the unused SQLite copy.

## Retired setup attempt

Before the owner selected live services, an isolated backend was prepared outside the web root at /home/[hosting-account]/staging-backend, with its own virtual environment, secret and staging.sqlite. An initial catalogue/staff snapshot was copied read-only from production. It is now unused; Passenger is disabled on the test domain and /api returns 404. No separate API is used by the published frontend.

Related private archives: /home/[hosting-account]/staging-backend-20261028.tar and /home/[hosting-account]/staging-site-live-api-20261028.tar.gz. The unused staging-backend directory contains a private snapshot and must stay private. Plan deliberate cleanup after confirming it is not referenced; it was not silently deleted during deployment.

## Acceptance and troubleshooting

Recorded deployment checks: HTTPS home 200; /products and /admin/overview 200 after directory redirects; main-NKRCYX2N.js 200; /api/category/top 404; robots.txt 200 with no-index header; live settings/content 200; live anonymous /admin/me 401; Access-Control-Allow-Origin accepted https://test.teutasteel.com. The frontend build passed with 26 prerendered routes.

Browser visual verification was blocked by stale local DNS. A visible browser tab URL by itself does not establish that the application loaded correctly. Still perform phone/desktop browsing, signed-in admin loading, catalogue images, language switching and enquiry draft checks. Avoid production writes during acceptance; do not send WhatsApp messages as a test without authorization.

If blank: check console and JavaScript HTTP status, then API request URL, API response and CORS. If DNS fails: compare authoritative/public/local resolver answers. If TLS fails: verify the record remains proxied; never bypass browser warnings. If admin is forbidden: check the staff role and token, rather than weakening permissions.

The preview is publicly reachable. No-index is a crawler instruction, not access control. Site-wide access protection has not been configured.

## Production release boundary

This staging deployment did not publish a new production frontend, modify the live API configuration or run a production migration. The live backend was separately observed at repaired commit 5e2d5ca and MySQL head b9e3f1c25a70. Before a future production frontend release, capture current backups, review differences and unresolved acceptance checks, verify API compatibility, then deploy explicitly to the production target. The live backend Git hook can trigger deployment on a push to its checked-out branch.


## Seven-point implementation — 3 November 2026

Published frontend fixes to https://test.teutasteel.com only. All 274 frontend tests passed; staging build succeeded with 27 prerendered routes. Production frontend was not replaced; backend application source/migrations unchanged.

Implemented visible dimension-free prices; explicit unknown price basis; fractional metre/kilogram quantities; current-price enquiry reconciliation with changed-price acknowledgement, removed-variant refusal and API-failure blocking; complete translated specifications and product URLs; Multival dimensions and non-steel weight correction; direct catalogue shortcuts; all 19 mesh codes in natural order; removal of customer-facing photo production briefs; phone request controls; in-flow staging notice; admin quality reminders and upload config retry; named staging build and no-index/404 handling.

Owner confirmed H/U prices per metre. Live product 4195/dimension4416 is EUR3.50/m; product4196/dimension4417 EUR3.00/m. Profile lengths remain unknown. Backup: /home/[hosting-account]/backups/polycarbonate-accessory-units-20261103.json. Other 556 priced variants still need owner-confirmed selling units; unknown facts remain visibly unconfirmed. Exact mesh images/openings/thickness/finish require supplier evidence.

Owner explicitly approved restricted Cloudinary preset teutasteel_admin_images_v1 and shared live API configuration/restart. Unsigned JPEG/PNG/WebP/AVIF/GIF, generated IDs, no overwrites, product_images folder. Real temporary upload and delivery passed; test asset removed. Private configuration backup: /home/[hosting-account]/backups/backend-env-before-admin-upload-20261103. Public settings returned 200 after restart. Never publish the private env backup or uploader credentials.

Acceptance: actual browser verified H connector 2.5 metres at EUR3.50 = EUR8.75; full enquiry link includes quantity/unit/product URL; request at 320/390/430px has no horizontal overflow and quantity control height45px; English category heading and all R1-R19 cards verified. Test enquiry cleared, service context cleared, language restored AL and viewport reset. No WhatsApp sent. Known public routes return200; unknown routes and missing assets return404; X-Robots-Tag is noindex/nofollow/noarchive. Branded server 404 recovery is verified: the host replaced native ErrorDocument responses, so staging now rewrites unknown paths to a minimal 404.php responder that returns status404 and reads the generated 404.html. No input is executed or reflected. Browser recovery link to products passed. The named staging build includes this handler; PHP support is required on staging.

Pending acceptance: owner chose to do normal signed-in admin media-page check later. Automatic approval review rejected a proposed programmatic admin-token check because it bypassed normal login; that approach was not executed. Do not mint an admin token for acceptance. Signed-in upload binding/cancellation and a fresh keyboard-only admin pass are not claimed verified here.

Release: npm run build:staging creates dist/staging/browser; upload browser files only. Server artifact /home/[hosting-account]/seven-point-staging-20261103.tar.gz. Pre-change test backup /home/[hosting-account]/staging-before-seven-points-20261103.tar.gz. Do not extract into public_html or backend. Do not push backend master: its hook can deploy production. Workstation evidence: C:\Users\User\Documents\Codex\2026-10-08\c-teutasteel-website\outputs (seven-point tests/build logs, mobile screenshot, upload verification, status).
