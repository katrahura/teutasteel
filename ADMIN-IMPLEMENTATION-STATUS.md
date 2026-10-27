# Admin implementation status

Tracking file for `DEEPSEEK-ADMIN-IMPLEMENTATION-PLAN.md` (phases 0-8). One row per phase; a phase is
marked **verified** only when its acceptance conditions have been checked, not when its code exists.

Baseline measured 2026-10-27 23:26 (Europe/Paris), before any phase-0 work:

| Check | Result |
|---|---|
| frontend tree | clean, head `8afa599` |
| backend tree | clean, head `fade8a0` |
| backend suite | **195 tests, OK**, then 200 after `test_admin_me` |
| frontend build | **24 prerendered routes**, no errors; **25** after the forbidden route |
| migrations | 15 files, head `9a577bc5dd12 (head)` |
| local API | `http://127.0.0.1:5000` running |
| local frontend | `http://localhost:4200` (ng serve) and `http://127.0.0.1:4321` (built dist) |

Size warnings, measured 2026-10-28 00:30: the production build reports `products.component.css`
**13.90 kB against a 10.24 kB budget**, plus two selector warnings (`.form-floating>~label`,
`Did not expect successive traversals`). The budget was **not** raised. The earlier line saying there
were no warnings above budget was wrong.

Commit gate used from phase 2 onward: `npx ng build` must exit 0 before a frontend commit, and the
whole backend suite must pass before a backend commit. A test count read after the fact is not the gate.

## Phases

| Phase | State | Files | Migrations | Checks | Open decisions |
|---|---|---|---|---|---|
| 0 — reconcile and baseline | **verified** | this file | none | 195 backend / 24 routes / trees clean | see "Unresolved" |
| 1 — role-aware access and shell | **in progress** — `/admin/me`, session service, `adminGuard`, capability tabs, `/admin/forbidden`, header account/role, View website, AL/EN control, read-only settings for an editor. Open: the phone drawer was reverted; 320px is met by tabs wrapping | `admin-shell`, `app.routes`, `auth.guard`, `app/auth.py`, `admin_routes.py` | none | 5 guard tests | see "Limitations" |
| 2 — settings reach customers | **verified** — 13 public keys, AL/EN sentence pairs, server + client validation, `ContactService` wired into shell/footer/contact/request/service/home/product enquiries, preview + refresh note in the panel | `public-settings.service`, `contact.service`, `app.component`, `contact`, `home`, `service-detail`, `products`, `admin-settings`, `admin.service` | none (key/value table) | 213 backend, 211 frontend, build 25 routes | see "Phase 2 — the path a setting takes" |
| 3 — dashboard and quality queue | pending | `admin-overview`, `admin_routes.py` | none expected | — | — |
| 4 — product and variant editing | pending | `product-editor`, `product_routes.py` | likely one (price unit, version) | — | price-unit vocabulary |
| 5 — category and image management | pending | `admin-categories`, `admin-media`, `category_routes.py` | none expected | — | category depth policy |
| 6 — bulk prices, imports, history | pending | `admin-products`, `product_routes.py`, `admin_routes.py` | possible | — | preview/apply staleness token |
| 7 — search insights and content | pending | new `/admin/content`, `admin_routes.py` | possible | — | approved service copy |
| 8 — final quality and handoff | pending | `ADMIN-HANDOFF.md` | none | — | — |

## What already exists (reuse, do not rebuild)

| Screen / capability | API | Permission |
|---|---|---|
| `/admin/overview` — gap counts, searches | `GET /admin/catalogue`, `GET /admin/searches` | staff |
| `/admin/products` — table, 4 filters, search, pagination | `GET /admin/catalogue` | staff |
| Product editor (shared with the public dialog) | `PUT /product/<id>`, `POST /product/create`, `PUT /product/<id>/...` | staff |
| Duplicate a product (inactive) | `POST /admin/products/<id>/duplicate` | staff |
| Bulk price preview and apply | `POST /product/prices/bulk` | staff |
| CSV thickness import, preview, rejected rows, history | `POST /product/import-thickness`, `GET /admin/imports` | staff |
| Price history and single-price revert | `PUT /product/<id>`, `POST /dimension/<id>/price/revert` | staff |
| Activity history | `GET /admin/activity` | staff |
| `/admin/categories` — list, switch on/off | `GET /category/`, `PUT /category/<id>` | staff |
| `/admin/media` — upload to Cloudinary, assign to product | `GET /admin/media/config`, `PUT /product/<id>`, unsigned Cloudinary upload | staff |
| Photo upload inside the product editor | same, via `CloudinaryService` | staff |
| `/admin/users` — list, create | `GET|POST /admin/users` | **admin only** |
| `/admin/settings` — 13 business fields | `GET` staff, `PUT` **admin only** | as stated |
| Delete product / category | `DELETE /product/delete/<id>` | **admin only** |
| Roles | `staff_required` allows admin + editor; deletes and accounts stay admin | server-enforced ✓ |

Server authorization is in place on every route above. The interface reflects it by capability
(phase 1); the authorization itself is still checked on every request.

## Phase 2 — the path a setting takes

1. The owner saves on `/admin/settings`; `PUT /admin/settings` is administrator-only, refuses unknown
   keys and invalid values by field, and writes one row per key in `settings`.
2. `GET /settings` answers the same 13 keys without a token, plus `configured` per key. Nothing else:
   no user, no upload credential, no admin configuration.
3. `PublicSettingsService` asks once, caches the answer, gives up after 1.5 s and answers `{}` on any
   failure. `ContactService` turns that into the details a page shows, with the environment values and
   the page's own translation as fallbacks; `telNumber` / `whatsappNumber` derive the dialling form
   (`+383 (44) 133-208` → `tel:+38344133208`) while the display keeps what the owner wrote.
4. The request is made **in the browser only**. The pages are prerendered, so the static copy carries
   the built-in details and the browser applies the saved ones when the page runs. A change therefore
   reaches the page on the next load, without a rebuild; the static copy a crawler sees, and the
   `index.html` structured data (which still names the built-in telephone), refresh at the next build.

| Setting | Where a customer meets it |
|---|---|
| `contact_phone` | top bar, footer, contact page, service detail, home hero |
| `contact_whatsapp` | footer, contact page, home hero, service/quote WhatsApp destinations |
| `contact_email` | footer, contact page |
| `contact_address` | footer, contact page, service detail |
| `opening_hours_{al,en}` | top bar and footer hours, service detail (falls back to `opening_hours`, then the translation) |
| `delivery_text_{al,en}` | contact page and request page (hidden when empty — there is no built-in promise) |
| `vat_text_{al,en}` | contact page and request page (hidden when empty) |

Server validation: email shape, dialable number (allowed characters, 6–15 digits), per-field length,
control characters stripped, empty always allowed. Client validation mirrors it and shows the reason
beside the box. When both languages are written for a sentence the old single value is cleared, so it
cannot reappear later; one language written keeps it as the other's fallback.

## Unresolved (need the owner)

- Cloudinary *Strict Transformations* is enabled in the account but **not enforced**: a never-requested
  transformation (`w_1313,q_87`) is still created and delivered, from any referer including none.
  Reported to the owner; the account, not the code, is the place to fix it.
- The production frontend is stale: `www.teutasteel.com/products` answers 404 and `/assets/i18n/al.json`
  404 — the 2021 static site is still served. The newest archive is `teutasteel-frontend-20261027-2243.zip`,
  which predates the last five commits.
- The product dialog measured 1140x1194px (one column) at some point; a later change by the owner may have
  fixed it, unverified.
- Photo storage, price rounding and delivery-wording values: deferred by the owner.

## Limitations recorded rather than hidden

- The admin phone drawer was attempted and reverted (increment 8): at 1440px it stayed visible beside the
  strip, so the navigation appeared twice. The base `display: none` did not take effect and the cause was
  never established. The 320px acceptance criterion is met without it by the tabs wrapping; a drawer
  remains an improvement, not a blocker.
- The admin header's render was not observed settling in a real browser: `/admin/me` answers 200 with
  capabilities, but the probe still showed the loading line. The probe or a stale bundle is the likely
  cause; the header is covered by the session service and its guard spec, not by a browser observation.
- `index.html` structured data is static. A changed telephone reaches it only at the next build, so a
  search result can name the old number until then.
- `mobile-nav.component.ts` is no longer rendered (the header carries the links) and still reads the
  environment directly. Dead code, left in place rather than deleted in this pass.

## Progress log

Newest first.

- **Phase 2, increment 6 — verified.** The mapping is now proved in specs, not just by construction:
  the shell test flushes a saved phone/address/hours and asserts the top bar and footer; the contact
  test flushes the two sentences and asserts the page. Frontend **211 tests**, backend **213**, build
  **25 routes, exit 0**. Acceptance checked against the plan: blank values keep the built-in details
  (service spec), a failed request keeps them too (service spec), a saved value changes its intended
  location (shell/contact specs), an editor's write is refused by the server (existing
  `test_settings`), and the refresh story is on the panel and in this file.

- **Phase 2, increment 5** — settings that reach customers, wired: `ContactService` (one cached read,
  environment/translation fallbacks, `telNumber`/`whatsappNumber`), the shell top bar and footer
  (address added), contact and request pages (delivery/VAT sentences when set), service detail, home
  hero and CTA, and the product-card WhatsApp enquiry. The client asks only in the browser, so a build
  never calls the API. Backend: the three sentences exist per language (`*_al`, `*_en`), with the old
  single key kept as fallback and cleared when both languages are written; email/number/length
  validation with per-field refusal; control characters stripped. Frontend: field-level errors, dirty
  and saved states, AL/EN boxes, a "See the contact page" preview and the refresh note.

- **Phase 2, increment 2** — `PublicSettingsService` (frontend `e41f968`): one cached `GET /settings`,
  `field(key, fallback)` returning the caller's own text when a setting is blank, and an empty object
  rather than an error when the request fails. (Now also times out rather than holding a build open.)

- **Phase 2, increment 1** — public `GET /settings` (backend `f2629fa`): seven approved fields, no
  token, no users, no upload credential, no admin configuration; an unset field answers empty so the page
  keeps its own text.

- **Phase 1, increment 8 — reverted.** A phone drawer rendered from the same `ng-template` as the strip.
  At 320px it measured correctly (320/320, no overflow, six links). At 1440px the drawer was still visible,
  so the panel showed the navigation twice. Reverted rather than shipped. See "Limitations".

- **Phase 1, increment 6 — reverted.** The AL/EN control in the admin header produced
  `TS1128: Declaration or statement expected` and the production build failed with `Prerendered 0`. It was
  committed before the build was read. Reverted on the remote by `a2c9963`. It has since been re-added
  correctly and the build gates the commit.

- **Phase 1, increments 1–4** — `GET /admin/me` (id, username, email, role, capabilities,
  `can_enter_admin`; 401 and "signed in without rights" are different answers); `AdminSessionService`
  (one cached answer), `adminGuard` (sign in / allowed / forbidden, and an unreachable server is none of
  them); `/admin/forbidden`; tabs rendered from capabilities; header account/role, View website; tabs wrap
  below 520px. Measured at 320px: `scrollWidth 320 / clientWidth 320` on `/admin/products`,
  `/admin/categories`, `/admin/settings`.

## Next (read this first)

**Phase 3 — a focused dashboard and actionable quality queue.** The panel's dashboard already has gap
counts and search reports; the phase turns them into a "Needs attention" list whose every count links
to a matching, filtered worklist, with the current catalogue APIs (`GET /admin/catalogue?gap=…`) rather
than new ones where they exist. Then phases 4–8 in order.

Before phase 3, close phase 1: prove the four roles in the shell (a spec that answers `/admin/me` with
each role's capabilities and asserts the visible tabs), and either ship the drawer with a computed-style
check first or record the wrapping as the accepted phone navigation.
