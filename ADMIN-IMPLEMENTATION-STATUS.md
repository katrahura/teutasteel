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

Size warnings: the production build reports none above the configured budget; no budget was raised.

## Phases

| Phase | State | Files | Migrations | Checks | Open decisions |
|---|---|---|---|---|---|
| 0 — reconcile and baseline | **verified** | this file | none | 195 backend / 24 routes / trees clean | see "Unresolved" below |
| 1 — role-aware access and shell | **in progress** — `GET /admin/me` (5 backend tests), session service, `adminGuard` (5 frontend tests), capability-driven tabs, `/admin/forbidden`. Remaining: account/role in the header, "View website", drawer at 320px, editor read-only settings | `admin-shell`, `app.routes`, `auth.guard`, `app/auth.py`, `admin_routes.py` | none expected | — | needs a server "who am I" endpoint |
| 2 — settings reach customers | **in progress** — public `GET /settings` done, 4 tests | `admin-settings`, public shell/contact, `admin_routes.py`, new public route | none expected (table exists) | — | which fields the public may read |
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
| `/admin/categories` — list, switch on/off | `GET /category/`, `PUT /category/<id>` | staff (**confirm in phase 1**) |
| `/admin/media` — upload to Cloudinary, assign to product | `GET /admin/media/config`, `PUT /product/<id>`, unsigned Cloudinary upload | staff |
| Photo upload inside the product editor | same, via `CloudinaryService` | staff |
| `/admin/users` — list, create | `GET|POST /admin/users` | **admin only** |
| `/admin/settings` — 7 business fields | `GET` staff, `PUT` **admin only** | as stated |
| Delete product / category | `DELETE /product/delete/<id>` | **admin only** |
| Roles | `staff_required` allows admin + editor; deletes and accounts stay admin | server-enforced ✓ |

Server authorization is in place on every route above; the interface does **not** yet reflect it
(phase 1). `AuthGuard` checks only that a token exists.

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

## Unfinished work owned by others

None at baseline: both trees were clean. `089f499` merged the earlier uncommitted customer-journey work
after it was verified to build and pass; it was not line-by-line reviewed.

## Progress log

- **Phase 2, increment 1** — public `GET /settings` (backend `f2629fa`): seven approved fields, no
  token, no users, no upload credential, no admin configuration; an unset field answers empty so the page
  keeps its own text. Four tests, including the field list itself. Remaining for phase 2: one frontend
  service reading it once and feeding shell, footer, contact/request pages and the two wording fields,
  with the current translations as fallback; read-only/public-preview state on the settings page; and the
  documented refresh story (the public pages are prerendered, so a settings change reaches them after a
  rebuild unless the shell fetches at runtime).

- **Phase 1, increment 8 — reverted.** A phone drawer rendered from the same `ng-template` as the strip.
  At 320px it measured correctly (320/320, no overflow, six links). At 1440px the drawer was still visible,
  so the panel showed the navigation twice; the base `display: none` did not take effect and the cause was
  not established before the round ran out. Reverted rather than shipped: a duplicated navigation is worse
  than no drawer. The 320px acceptance criterion is met without it, by the tabs wrapping. Next attempt
  should read the computed style of `.admin-drawer` first.

- **Phase 1, increment 6 — reverted.** The AL/EN control in the admin header produced
  `TS1128: Declaration or statement expected` and the production build failed with `Prerendered 0`. It was
  committed before the build was read. It is reverted on the remote by `a2c9963`; the tree is green again at
  25 prerendered routes. What changes: the build's exit code gates the commit, not a test count read
  afterwards. The language control is still to do.

- **Phase 1, increment 1** — `GET /admin/me`: id, username, email, role, capabilities, `can_enter_admin`.
  Answered for any signed-in account so 401 (not signed in) and empty capabilities (signed in, no rights)
  are distinguishable. Backend commit `8e514d6`, five tests. Capabilities mirror the routes' own checks;
  deletes and accounts stay administrator-only.
- **Phase 1, increment 2** — `AdminSessionService` (one cached answer), `adminGuard` (three outcomes:
  sign in / allowed / forbidden, and an unreachable server is none of them), `/admin/forbidden` page,
  tabs rendered from capabilities. Commit `9a5c6a5`, 193 tests green, 25 routes.
- **Phase 1, increment 3** — guard spec: five tests covering all three outcomes and the stale-answer case.
  Commit on the next line, 198 tests green.
- **Phase 1, increment 4** — the header carries the account and the role the server reported plus a View
  website link, and below 520px the tabs wrap instead of the page scrolling sideways. Measured at 320px:
  `scrollWidth 320 / clientWidth 320` on `/admin/products`, `/admin/categories`, `/admin/settings`.
- Phase 1 acceptance is **not yet verified**: the language control, the editor read-only settings view and a phone drawer are still open, and the
  browser-side render of the header was not observed settling (`/admin/me` answers 200 with capabilities;
  the probe still showed the loading line, which points at the probe or a stale bundle, not at the API).

## Next

Phase 1: the server answer exists (`GET /admin/me`, capabilities per role, five tests). Remaining: the guard
that tells 401 from 403, tabs driven by capabilities, a read-only settings view for an editor, a compact
shell with a phone drawer, and the 320px check.

Previously planned: a server answer for "who am I and what may I do", child-route protection, tabs hidden by
capability, expired-session handling distinct from forbidden, and a compact shell with drawer on phones.
