# Teuta Steel — project handover


> Hosting identifiers are redacted in this public copy. The unredacted operations copy is kept outside the repository.

Last reconciled: 7 November 2026 (Europe/Paris).

Read this first when continuing work. This document supersedes status statements in older reports that say the fixes are uncommitted, unpushed or undeployed. Those reports remain evidence of the checks performed at that time.

## Current state

| Item | State |
|---|---|
| Frontend source | C:\Users\User\teutasteel-website |
| Backend source | C:\Users\User\source\TSRepos\backend |
| Frontend repository | https://github.com/katrahura/teutasteel.git |
| Frontend branch / application commit | `main` in this repository (release commit); the test build is produced from this content with `npm run build:staging` |
| Backend application commit | 77870cf (live; `pre-77870cf` tag marks the previous revision) |
| Test website | https://test.teutasteel.com/ |
| API used by test website | https://api.teutasteel.com |
| Database used by test website | Existing live MySQL, through the live API |
| Live backend observed | master at 77870cf |
| Search-engine operations | [docs/SEO-OPERATIONS.md](docs/SEO-OPERATIONS.md) |
| Production release | [PRODUCTION-RELEASE-PLAN.md](PRODUCTION-RELEASE-PLAN.md) |
| Live MySQL migration observed | b9e3f1c25a70 (head), read-only check on 28 October |

**This is a separate frontend preview sharing production data. It is not an isolated test environment. Admin edits made from the test website affect the live catalogue and settings.** The owner explicitly selected this arrangement after being offered an isolated alternative.

The latest frontend was published to the test subdomain only during this staging task. The production frontend was not replaced by that deployment. The live backend is now observed at the repaired commit; the staging task did not deploy it or apply production migrations. Do not infer who deployed it or when from this observation.

## Design, images and customer journey

Earlier work established the slate/amber industrial visual style, clearer service-to-enquiry journeys and consistent generated catalogue illustrations.

- Six product-group images were uploaded and assigned. Mapping: product-group-image-upload.json.
- Twenty-eight missing subcategory images were assigned. The saved report records 37 subcategories with images and preservation of existing images. Mapping: subcategory-image-report.json.
- Service illustrations were generated, with simpler replacements requested for the last three. Saved original/replacement assets and previews remain in the evidence folder.
- Customer journey evidence includes service context preserved into enquiries, page titles/canonical links, and desktop/mobile screenshots. Read customer-journey-verification.json for the recorded cases; this is not a claim that those checks were rerun against the test deployment.

## Seven mobile improvements

1. Shared links open the exact public product independently of category pagination; hidden/inactive products remain unavailable.
2. Phone homepage categories appear earlier (recorded at approximately 553px rather than 1,408px at 390px width).
3. Compact accessible navigation replaces wrapped links; recorded header height fell from approximately 150px to 65px. Navigation and Escape close the menu; focus handling was added.
4. Product dialog separates scrolling details from fixed actions, selected variants and editable quantities.
5. Enquiry drafts preserve details and service context using device storage, with clear/reset behavior and storage-failure handling.
6. Phone input text is at least 16px and principal touch targets at least 44px.
7. Compact product cards show image, code, dimensions, price/unit, primary enquiry action and secondary WhatsApp access.

Historical mobile validation: 29 frontend checks, 25 API checks, production build with 22 prerendered routes; responsive checks at 320, 390 and 430px, desktop at 1280px. See mobile-fixes-verification.md for the exact journey and limits. Later admin builds prerender 26 routes.

## Administrator work

DeepSeek Harness implemented phases 0–8: capability-based shell and permissions, business settings, catalogue attention queue, product/variant editing, category/media tools, bulk prices and CSV previews/history, service content/search reports, and handover/layout work.

Independent repairs then addressed:

- Optimistic product concurrency, including child dimensions, translations and images; stale writes return conflicts.
- Bulk preview binding to actor, variants, versions, units and prices; fingerprint-bound idempotent retries and race handling.
- Import signatures bound to reviewed CSV and target versions; encoding/header/value validation and safe retries.
- Uploaded image URLs persisted in save payloads; cancellation and late-response protection shared across product/category/media editors.
- Unsaved-change protection across close, Escape, switching products, creating products and navigation.
- Account capability cache tied to token and invalidated on login/logout/account changes.
- Correct category selection, bounded category thumbnails, functioning AL/EN controls, and conflict notice layout.
- Accurate settings messaging: browser-fetched contact values do not automatically replace static metadata on rebuild.

Details: [ADMIN-FIXES-VERIFICATION.md](ADMIN-FIXES-VERIFICATION.md), [ADMIN-HANDOFF.md](ADMIN-HANDOFF.md), [ADMIN-IMPLEMENTATION-STATUS.md](ADMIN-IMPLEMENTATION-STATUS.md). Use the repair verification over earlier conflicting acceptance statements.

## Checks and their limits

- Final repair suites: 276 backend tests on disposable SQLite databases; 263 frontend tests passed.
- Final repair build passed with 26 prerendered routes. Test deployment rebuild also passed with 26 routes.
- Existing non-blocking warnings: product CSS warning budget (13.90 kB, below error limit), automatic localize polyfills, Bootstrap selector warnings. No budget was increased.
- Local disposable-data browser checks covered two-tab conflicts, current category, AL/EN changes, phone menu Tab/Enter/Escape focus, and exact single/multiple-variant enquiries with quantities/subtotal.
- No WhatsApp message was sent during those checks.
- Staging deployment HTTP checks passed for home, products and admin shell after directory redirects, and main JavaScript. Live settings/content returned 200; anonymous admin identity returned 401. CORS accepted the test origin.
- An admin HTML response of 200 proves page delivery, not a completed signed-in browser journey.
- The newly published deployment was not visually verified because the local router still returned stale DNS. Earlier browser evidence is local evidence, not post-deployment evidence.

## Open items

- Run a signed-in browser acceptance pass on the published test website. Avoid catalogue edits unless intentionally changing live data.
- Confirm real Cloudinary upload/save/cancel behavior and account preset configuration. Mocked cancellation/payload tests passed; external cancellation was not staged.
- Physical iPhone/Android keyboards, real mobile network conditions and opening WhatsApp remain unverified.
- Static metadata requires an explicit content update; ordinary settings saves/rebuilds alone do not guarantee saved contact data in prerendered metadata.
- Optional search synonyms and batch price reversal remain unimplemented; single-price reversal exists.
- The preview has no site-wide password gate. No-index rules discourage search engines but are not authentication.
- A MySQL-isolated staging copy would be needed for safe destructive testing; the current owner-approved setup shares live data.
- Keep resolving existing build warnings as separate maintenance, without raising budgets to hide them.

## Git and deployment precautions

Application changes were committed and pushed after the older reports were written. Frontend main was pushed to GitHub. Backend changes were initially pushed to review/admin-fixes-20261028 to avoid triggering the production checkout hook.

The backend remote is a live non-bare checkout: ssh://[hosting-account]@[origin-ip]:22/home/[hosting-account]/backend. Its post-receive hook queues cPanel deployment when the checked-out branch receives an update. **A push to master can deploy production.** Check the current checkout and hook before any push; do not use routine pushing as a backup mechanism.

At reconciliation, both local application working trees were clean before these documentation additions. The server checkout had existing untracked .htaccess, backups/ and env.backup. Do not overwrite them or print their secrets.

Existing prerequisite migrations are c41f8a2d7e10 (product version/unit), a7d2c9e4f610 (category English title), b9e3f1c25a70 (bulk applications), on top of earlier history. The independent repairs added no migration. Live MySQL was observed at head; no migration was run by this documentation task.

For hosting details, build procedure, DNS troubleshooting and rollback, read [docs/STAGING-OPERATIONS.md](docs/STAGING-OPERATIONS.md).

## Evidence location

C:\Users\User\Documents\Codex\2026-10-08\c-teutasteel-website\outputs

Key files: DEEPSEEK-ADMIN-IMPLEMENTATION-PLAN.md, HARNESS-INDEPENDENT-ADMIN-REVIEW.md, ADMIN-FIXES-VERIFICATION.md, mobile-fixes-verification.md, STAGING-DEPLOYMENT.md, customer-journey-verification.json, product-group-image-upload.json, subcategory-image-report.json, admin-fixes-backend-final.log, admin-fixes-frontend-final.log, admin-fixes-build-final.log, mobile-final-build.log. Screenshots include admin-fixed-mobile.png, admin-fixed-conflict.png, admin-fixes-enquiry.png, mobile-fixed-home.png, mobile-fixed-cards.png, mobile-fixed-selector.png, and subcategories-mobile.png.

Generated assets are in product-group-illustrations/, subcategory-illustrations/, service-illustrations/ and their ZIP archives. Retain these with the mappings so later image replacements can preserve the visual style and correct assignments.

These evidence paths belong to this workstation. Copy the evidence folder when transferring the project; it is not automatically included in the GitHub repository.

## Catalogue correction — 29 October 2026

Category 112 now represents Steel Grating Panels / Panele grilë çeliku (Reshetka), replacing the inaccurate Lattice panels label and expanded-mesh image. A galvanized walkway grating illustration based on the owner's photo was generated and assigned through live MySQL. Existing 22 products and parent/visibility were preserved. Public API and optimized image URL verified. Evidence: outputs/STEEL-GRATING-CORRECTION.md and outputs/steel-grating-update.json in the workstation evidence folder. Server before-state backup: /home/[hosting-account]/backups/steel-grating-category-112-20261029.json.

Decorative panels follow-up (29 October): category 111 now uses the former category-112 expanded diamond mesh image, teutasteel-subcategory-lattice-panels-20261021-v1.webp. Its name/products are unchanged; category 112 keeps its new grating image. Both assignments verified through the public API. Backup: /home/[hosting-account]/backups/decorative-panels-category-111-20261029.json.

## Individual R-pattern panels — 29 October 2026

Category 111 now contains 19 individual R1–R19 products. Shared-price rows were expanded; existing grouped IDs 4160/4167 now identify R1/R17. Ten products were added; R16 capitalization normalized. Every panel has 1000 × 2000 mm dimensions, source-list EUR prices per piece, AL/EN code labels and no invented thickness/image. All 19 public API records verified. Evidence and rollback notes: outputs/R-PANEL-CORRECTION.md and outputs/r-panels-after-split-20261029.json. Server before-state backup: /home/[hosting-account]/backups/r-panels-before-split-20261029.json. The historical price-list importer must be corrected before reuse; it still encodes shared-price rows as combined product codes.

Expanded-metal naming follow-up (29 October): category 111 is now Expanded Metal Mesh / Rrjetë metalike e zgjeruar. Public API verified 19 products. Turkish/Greek supplier research found relevant expanded-metal catalogues but no reliable R1–R19 mapping; individual images remain unassigned. Sources and name rollback backup recorded in outputs/R-PANEL-CORRECTION.md.

## Multival pricing and profiles — 29 October 2026

Product 4191's four variants converted from confirmed EUR/m² to EUR/piece using 6 × 2.1 m = 12.6 m²: 4/6/8/10 mm => 88.20/113.40/138.60/163.80. Stored 2100 × 6000 mm and piece unit; thicknesses preserved. Accessory IDs 4195/4196 renamed Lidhëse H/Mbyllëse U with AL/EN descriptions and schematic profile images. Their 3.50/3.00 prices and unknown units/lengths remain unchanged. Price history/activity recorded, narrow before-state backed up; public API/image verification passed. Full report: outputs/MULTIVAL-CORRECTION.md; evidence: outputs/multival-conversion-verified.json. Server backup: /home/[hosting-account]/backups/multival-before-conversion-20261029.json. Future imports must respect the m²-to-piece basis and avoid double conversion.

## Multival calculated-weight fix — 29 October 2026

Removed incorrect solid-steel estimates for Multival and guarded non-steel sheet categories/codes; recorded weights remain available when supplied. 15 focused tests passed; staging build passed (26 routes). Published only to test.teutasteel.com and verified updated bundles over HTTPS. No live data or production frontend change. Evidence: outputs/MULTIVAL-WEIGHT-FIX.md. Rollback archive: /home/[hosting-account]/staging-before-weight-fix-20261029.tar.gz. Source changes uncommitted.

## Full website review — 3 November 2026

Read docs/FULL-WEBSITE-REVIEW-2026-11-03.md. This was a read-only browser/source/catalogue review, not an implementation or signed-in admin acceptance run. Priorities: visible accessory prices, confirmed selling units (558 of 582 priced variants lack them), refreshed complete enquiry specifications, verified mesh imagery/specs, upload configuration check, translations and reproducible staging release. Live reachable catalogue count: 1346. Screenshots/HTTP/data evidence saved in the workstation outputs folder. No catalogue/config/deployment changes were made by the review.


## Seven-point implementation — 3 November 2026

Published frontend fixes to https://test.teutasteel.com only. All 274 frontend tests passed; staging build succeeded with 27 prerendered routes. Production frontend was not replaced; backend application source/migrations unchanged.

Implemented visible dimension-free prices; explicit unknown price basis; fractional metre/kilogram quantities; current-price enquiry reconciliation with changed-price acknowledgement, removed-variant refusal and API-failure blocking; complete translated specifications and product URLs; Multival dimensions and non-steel weight correction; direct catalogue shortcuts; all 19 mesh codes in natural order; removal of customer-facing photo production briefs; phone request controls; in-flow staging notice; admin quality reminders and upload config retry; named staging build and no-index/404 handling.

Owner confirmed H/U prices per metre. Live product 4195/dimension4416 is EUR3.50/m; product4196/dimension4417 EUR3.00/m. Profile lengths remain unknown. Backup: /home/[hosting-account]/backups/polycarbonate-accessory-units-20261103.json. Other 556 priced variants still need owner-confirmed selling units; unknown facts remain visibly unconfirmed. Exact mesh images/openings/thickness/finish require supplier evidence.

Owner explicitly approved restricted Cloudinary preset teutasteel_admin_images_v1 and shared live API configuration/restart. Unsigned JPEG/PNG/WebP/AVIF/GIF, generated IDs, no overwrites, product_images folder. Real temporary upload and delivery passed; test asset removed. Private configuration backup: /home/[hosting-account]/backups/backend-env-before-admin-upload-20261103. Public settings returned 200 after restart. Never publish the private env backup or uploader credentials.

Acceptance: actual browser verified H connector 2.5 metres at EUR3.50 = EUR8.75; full enquiry link includes quantity/unit/product URL; request at 320/390/430px has no horizontal overflow and quantity control height45px; English category heading and all R1-R19 cards verified. Test enquiry cleared, service context cleared, language restored AL and viewport reset. No WhatsApp sent. Known public routes return200; unknown routes and missing assets return404; X-Robots-Tag is noindex/nofollow/noarchive. Branded server 404 recovery is verified: the host replaced native ErrorDocument responses, so staging now rewrites unknown paths to a minimal 404.php responder that returns status404 and reads the generated 404.html. No input is executed or reflected. Browser recovery link to products passed. The named staging build includes this handler; PHP support is required on staging.

Pending acceptance: owner chose to do normal signed-in admin media-page check later. Automatic approval review rejected a proposed programmatic admin-token check because it bypassed normal login; that approach was not executed. Do not mint an admin token for acceptance. Signed-in upload binding/cancellation and a fresh keyboard-only admin pass are not claimed verified here.

Release: npm run build:staging creates dist/staging/browser; upload browser files only. Server artifact /home/[hosting-account]/seven-point-staging-20261103.tar.gz. Pre-change test backup /home/[hosting-account]/staging-before-seven-points-20261103.tar.gz. Do not extract into public_html or backend. Do not push backend master: its hook can deploy production. Workstation evidence: C:\Users\User\Documents\Codex\2026-10-08\c-teutasteel-website\outputs (seven-point tests/build logs, mobile screenshot, upload verification, status).
