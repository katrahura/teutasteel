# Admin handoff

Written 2026-10-28, after implementing phases 0–8 of
`DEEPSEEK-ADMIN-IMPLEMENTATION-PLAN.md`. This document says what was delivered, what was reused, what
changed, how to deploy and roll back, and what was **not** verified. It is not a claim that every
screen was observed in a browser: the checks that were run are listed with their results, and the
gaps are listed with the same care.

## Delivered

| Phase | What the owner can now do | Where |
|---|---|---|
| 0 | A baseline, a capability map and this tracking record | `ADMIN-IMPLEMENTATION-STATUS.md` |
| 1 | Sign in and see only the sections the server says the account may use; a phone navigation that is one panel behind a button; a clear "forbidden" page for a signed-in account without rights | `/admin/*`, `admin-shell`, `adminGuard`, `GET /admin/me` |
| 2 | Change the shop's telephone, WhatsApp, email, address, hours, delivery sentence and VAT sentence once, in each language, and have them appear in the shell, footer, contact/request pages, service detail, home hero and every WhatsApp enquiry link | `/admin/settings`, `GET /settings`, `ContactService` |
| 3 | Open a dashboard whose first section is what needs attention; each count opens the working list or the catalogue table filtered to it; the catalogue totals separate "switched on" from "reachable through an enabled category" | `/admin/overview`, `GET /admin/summary`, `?gap=…` |
| 4 | Create a product inside the panel, move it between categories, edit one variant without touching the others, type what a price is *for*, and be told (not silently overwritten) when somebody else changed the record first | `/admin/products`, shared `product-editor` |
| 5 | Search, collapse, create and edit the category tree; see how many products a branch holds before switching it off; set both labels, the parent, the picture and its alt text; edit an image without losing the old one if the upload is interrupted | `/admin/categories`, `/admin/media` |
| 6 | Preview a bulk price change that names the variant, currency and unit; apply only the preview that was reviewed; retry an apply without raising prices twice; search and page the change history; export a CSV that a spreadsheet will not execute | `/admin/products` panels, `/admin/activity` |
| 7 | Read searches for a date range, see them normalised, and know they are questions rather than orders; edit the seven service offerings in both languages with picture, alt text, order and visibility, without losing the copy that already ships | `/admin/overview`, `/admin/content` |
| 8 | This document, a migration test up/down/up, and a measured pass over the public pages at five widths | this file |

### Reused rather than rebuilt

- The catalogue table, its filters, the shared product editor, duplication, the CSV thickness import
  and its history, the bulk-price preview/apply, single-price history and revert, the activity log,
  the category list and the Cloudinary uploader were extended, not replaced.
- The public catalogue, the mobile enquiry flow, the service ids and the existing translations were
  kept. No second admin, no second editor, no parallel price system.
- Service copy is stored in the existing settings key/value table under `content.service.<id>.<field>`;
  no new table was needed.

## Migrations and configuration

Three migrations, all additive and nullable or defaulted, applied in order:

| Revision | Adds | Rollback |
|---|---|---|
| `c41f8a2d7e10` | `products.version` (default 1), `dimensions.price_unit` (nullable) | `flask db downgrade 9a577bc5dd12` |
| `a7d2c9e4f610` | `categories.title_en` (nullable) | same |
| `b9e3f1c25a70` | `bulk_applications` (idempotency keys, stored answers) | same |

Tested on a disposable SQLite database: full `upgrade`, then `downgrade 9a577bc5dd12`, then `upgrade`
again, all clean. **No migration was run against production or a shared database in this work.**
Rolling back to `9a577bc5dd12` drops the three additions above; no existing column is touched.

Configuration that did not change: `SECRET_KEY` (now also signs bulk-preview tokens), the Cloudinary
cloud name / unsigned preset / folder, `CORS_ORIGINS`, `DATABASE_URI`. No secret was written to the
repository.

### Release order

1. **Backend first** (`flask db upgrade`, then restart). The old frontend keeps working: every new
   field is optional and the three write routes still accept the old payload shape.
2. **Frontend second** (build + deploy). It reads `GET /settings`, `GET /content/services`,
   `GET /admin/me`, the version on each product and the preview token from a bulk preview.
3. Public pages are prerendered. A settings or content change reaches a customer on the next page
   load (the browser fetches once after hydration); the static copy a crawler sees, and the
   `index.html` structured data, refresh at the next build. Do not promise instant changes to search
   results or link previews.

## Checks run

| Check | Result |
|---|---|
| Backend suite (`pytest -q`, backend `venv`) | **268 passed**, 0 failed |
| Frontend suite (`ng test --watch=false --browsers=ChromeHeadless`) | **252 passed**, 0 failed |
| Production build (`npx ng build`) | **26 prerendered routes**, exit 0 |
| Build size warnings | `products.component.css` 13.90 kB against a 10.24 kB budget; two selector warnings (`.form-floating>~label`); **no budget raised** |
| Migration upgrade → downgrade → upgrade on a throwaway DB | clean |
| Public pages, 9 routes × 5 widths (320, 390, 430, 768, 1280) in headless Chrome, development build served statically | **no page-wide horizontal overflow on any pair**; every page carried its title and tel links |
| Signed-in admin, 7 routes × 5 widths (same widths), against a **disposable SQLite database and a disposable administrator** | **no page-wide horizontal overflow on any pair**; `app-admin-shell` and seven tabs present on every one, including 320px |
| Product editor opened from a row, at 1280 and 320 | 1148×1439 and 288×2960; code loaded, category select populated, variant row present with the unit select (piece, tube, sheet, bar, metre, kilogram, Unknown); no page overflow |
| Public product dialog through `?product=1` and `?product=2` | opened as `#productDetailsModal`: 800×547 (one variant) and 800×615 (two variants) at 1280; 304×784 at 320 with both thicknesses listed |
| Enquiry link inside the dialog | `https://wa.me/…?text=…CHECK-2…<product url>`; the code and the shared link are in the message |
| Saved business settings on the public page | telephone, address and a normalised `tel:+38344999888` in the shell and the contact page; the settings form showed the saved value |

Signed-in method: the backend was started on a spare port against a **throwaway database** seeded with
an administrator, an editor, two products (one single-variant, one two-thickness) and some settings; a
development build pointed at that port was served statically; Chrome was driven through its own
protocol with the token placed in `localStorage` exactly where the app keeps it. Nothing touched the
production API, the real database or any published site. The temporary environment values were
reverted before committing.

Measurement method: a development build (`environment.apiUrl` pointing at the local API) served by a
small static server; Chrome driven through its own protocol with device metrics overridden per width;
`document.documentElement.scrollWidth <= clientWidth` and the 3 widest offending elements recorded per
page. Routes: `/`, `/products`, `/products?product=1`, `/request`, `/contact`, `/services`,
`/services/cnc`, `/about`, `/login`.

## Not verified here (read before claiming more)

- **Two editors at once were not driven from two browsers.** The 409 path is covered by the backend
  suite and the editor's own spec, not by a real second session.
- **An interrupted upload was not cancelled mid-flight.** The binding to the product/category is in
  the code and in the specs; a real network interruption was not staged.
- **Keyboard-only operation was not performed end to end.** Focus outlines, Escape handling and the
  drawer's focus return are in the specs and the markup, not in a manual pass.
- The single-variant enquiry dialog link was not captured separately; the two-variant one was, and the
  link is built by the same function for both.
- The delivery sentence was only written in English in the fixture, so it correctly did **not** appear
  on the Albanian page; the per-language selection is covered by the service spec.
- Search synonyms (phase 7's optional half) were **not** added.
- Batch price reversal was **not** added; single-price revert remains.
- The content cards save one service at a time and have no page-level unsaved-changes guard.
- Cloudinary *Strict Transformations* is still not enforced in the account (an owner/account action).
- The production frontend is still stale; publishing and production changes were out of scope.

## Rollback

- **Code:** each increment is its own commit in the frontend and backend repositories; revert the
  range rather than resetting. The status file records which commit belongs to which phase.
- **Database:** `flask db downgrade 9a577bc5dd12` (see table). This loses only the three additions
  listed; product prices, images, translations and ids are untouched. Take a backup first anyway.
- **Settings/content:** both live in `settings` rows. Clearing a row restores the built-in/public
  fallback; no deployment is needed.

## Where to look

- Tracking and evidence: `ADMIN-IMPLEMENTATION-STATUS.md`.
- Implementation plan: `DEEPSEEK-ADMIN-IMPLEMENTATION-PLAN.md` (planning outputs).
- Frontend: `src/app/pages/admin/**`, `src/app/services/{admin,admin-session,contact,content}.service.ts`,
  `src/app/shared/csv.ts`, `src/app/guards`, `src/app/pages/services/**`, `src/app/app.component.*`.
- Backend: `app/routes/{admin_routes,product_routes,category_routes}.py`, `app/auth.py`,
  `app/models/{product,dimension,category,setting,bulk_application}.py`, `app/schemas/**`,
  `migrations/versions/`.
