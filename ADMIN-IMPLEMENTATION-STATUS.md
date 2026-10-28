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
| 1 — role-aware access and shell | **verified** — `/admin/me`, session service, `adminGuard`, capability tabs, `/admin/forbidden`, header account/role, View website, AL/EN control, read-only settings for an editor, one navigation that becomes a phone panel | `admin-shell`, `app.routes`, `auth.guard`, `app/auth.py`, `admin_routes.py` | none | 5 guard + 6 shell tests | see "Limitations" |
| 2 — settings reach customers | **verified** — 13 public keys, AL/EN sentence pairs, server + client validation, `ContactService` wired into shell/footer/contact/request/service/home/product enquiries, preview + refresh note in the panel | `public-settings.service`, `contact.service`, `app.component`, `contact`, `home`, `service-detail`, `products`, `admin-settings`, `admin.service` | none (key/value table) | 213 backend, 211 frontend, build 25 routes | see "Phase 2 — the path a setting takes" |
| 3 — dashboard and quality queue | **verified** — "Needs attention" queue first (seven checks, each linking to the worklist and to the filtered table), reachable-vs-active counted separately, missing-language and negative-price checks, gap filter on `/admin/products` kept in the URL, compact recent changes with a link to the full history | `admin-dashboard`, `admin-products`, `admin.service`, `admin_routes.py` | none | 220 frontend, 221 backend, build 25 routes | see "Phase 3 — what each count means" |
| 4 — product and variant editing | **implemented, verification pending** — create inside the panel (saved inactive), category reassignment, typed price unit per variant, version-checked saves (409 conflict + reload), stale loads/uploads ignored, dirty-change warnings, sectioned editor, preview link, per-field errors; backend gaps for missing price units | `product-editor`, `admin-products`, `products`, `product_routes.py`, `dimension_schema`, new migration | **one**: `products.version`, `dimensions.price_unit` (`c41f8a2d7e10`) | 227 frontend, 236 backend, migration applied to a throwaway DB, build 25 routes | desktop/phone flows and the customer enquiry regressions are checked in phase 8 |
| 5 — category and image management | **implemented, verification pending** — searchable collapsible tree with branch counts and thumbnails, create/edit (AL + EN labels, parent, visibility, image + alt), effective visibility shown, impact before switching off, cycle refusal on the server, category writes now admin-only, upload bound to the edited entity, public preview | `admin-categories`, `admin-media`, `category_routes.py`, `category_schema`, `category.py`, `translate-category-title` | `a7d2c9e4f610` (`categories.title_en`) | 237 frontend, 246 backend, migrations applied to a throwaway DB, build 25 routes | browser check in phase 8; media stays product-only (category images live in the category editor) |
| 6 — bulk prices, imports, history | **implemented, verification pending** — apply bound to a signed preview token and refused when prices/selection moved, idempotency key makes a retry change nothing, preview names variant/currency/unit, Decimal half-up money, formula-injection-safe CSV exports, searchable/filterable/paged history | `product_routes.py`, `bulk_application.py`, `admin_routes.py`, `admin-products`, `admin.service`, `shared/csv` | `b9e3f1c25a70` (`bulk_applications`) | 242 frontend, 256 backend, build 25 routes | import stays partial-apply by policy; batch reversal not added |
| 7 — search insights and content | **implemented, verification pending** — search report gains date range, text filter, normalised spelling and "a search is not an order"; staff searches are no longer recorded as customer questions; `/admin/content` edits AL/EN title/description, picture, alt text, order and visibility for the seven services, with the shipped copy as fallback | `admin-dashboard`, `admin.service`, `content.service`, new `admin-content`, `services`, `service-detail`, `home`, `admin_routes.py`, `app/__init__.py` | none (settings key/value) | 252 frontend, 268 backend, build 26 routes | synonyms not added; content dirty-warning is per-card save only |
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

## Phase 3 — what each count means

Every figure has one definition, in `_gap_condition()` / the summary, and the table's `?gap=` uses the
same function as the worklist. The tests assert the figure equals the list.

| Check | Means | Does not mean |
|---|---|---|
| `hidden_by_category` | Active, and some category above it (or its own) is off | Not "the product is switched off" — that one is not work |
| `no_photo` | Priced, and no image row carrying a path | Not "no visual": a drawn section is intentional, so the label says *photograph* |
| `no_thickness` | Priced, and no thickness > 0 anywhere (0 is "not filled in") | Not "unpriced" |
| `no_size` | Priced, and a row with no height/width/length/thickness | — |
| `no_details` | No dimension rows at all | — |
| `missing_language` | No Albanian or no English translation | Not "the text is poor" |
| `bad_price` | A dimension with a negative price | **Not zero**: zero is an item sold by enquiry |
| `off_category` (legacy) | Any product whose direct category is off | Kept for pages built against it; the queue uses `hidden_by_category` |

`publicly_reachable` is active products whose whole category chain is on. A product that is off is
neither reachable nor "hidden by its category", so the two figures do not double-count it.

Price units are typed per variant since phase 4, so they *are* checked now (`no_price_unit`): a priced
row with no unit is listed as work, and unknown stays unknown rather than being inferred from a shape.
A unit outside the list is refused by the server.

## Phase 4 — what the editor protects

| Risk | What happens now | Evidence |
|---|---|---|
| Two people edit one product | Every save carries the version it read; the server checks-and-sets in one statement and answers **409** with the current version, applying nothing | `test_a_stale_save_is_refused_and_leaves_the_product_alone`, `test_a_stale_conflict_does_not_touch_the_variants_or_their_history` |
| A slow load replaces a newer selection | Each load has a token; an answer for a product already left is dropped | editor spec "ignores a slow answer…" |
| An upload lands on the wrong product | The upload remembers the product it started on and is discarded if the selection moved | code path in `onImage`; browser check in phase 8 |
| Untyped or invented price units | `price_unit` is a closed list (piece, tube, sheet, bar, metre, kilogram) or NULL; the editor offers "Unknown" and nothing is inferred | `test_a_price_unit_is_stored_and_unknown_stays_unknown`, `test_a_unit_outside_the_list_is_refused` |
| Duplicate variants | Two rows describing the same height/width/length/thickness are refused by field path | `test_the_same_variant_twice_is_refused` |
| Malformed prices | Negative prices and more than two decimals are refused; **zero is allowed** (sold by enquiry) | `test_a_negative_price_is_refused_but_zero_is_allowed`, `test_a_price_with_three_decimal_places_is_refused` |
| Variant identities lost | Updates keep row ids, delete only rows the form removed, and open price history only for changed prices | `test_editing_one_variant_keeps_the_other_and_the_price_history` |
| Ordinary account editing | `POST /product/create`, `PUT /product/<id>` and the single-price route now require **staff**; deletes stay administrator-only | `test_an_ordinary_account_may_not_edit_create_or_price` |
| Silently dropping edits | Closing, switching product or leaving the page warns when the form is dirty | editor spec "asks before discarding…"; `beforeunload` |
| Preview instead of guessing | The preview opens the public product page for the **saved** record; an unsaved edit says so, and a new product has no link yet | editor spec "offers the preview…" |

Deliberately not done: a general undo/rollback (phase 6 defines the narrower price reversal); a second
editor for the public catalogue - both call the same component.

## Phase 5 — what the category page protects

| Risk | What happens now | Evidence |
|---|---|---|
| A category becoming its own ancestor | The server walks descendants and refuses a self-parent or a move under one's own section, with the reason | `test_a_category_cannot_be_its_own_parent`, `test_a_category_cannot_be_moved_under_its_own_section` |
| An editor or ordinary account changing the tree | Category create/update now require **admin**; the page renders read-only for an editor, with no New/Edit controls | `test_an_editor_may_read_the_categories_and_may_not_change_them`, categories spec "shows an editor a read-only tree" |
| Switching off a large branch blind | The editor states how many products and categories below it would be hidden; nothing is deleted, so switching back on is the undo | categories spec "says what switching a branch off would hide"; `product_total` counts switched-off rows too |
| An enabled section hidden by a disabled group | The row says which ancestor hides it; the tree does not pretend it is visible | categories spec "says when an enabled category is hidden…" |
| An upload landing on the wrong record | Both the product editor and the media page remember what the upload started on and discard a mismatched result; category uploads likewise | code paths; browser check in phase 8 |
| Losing an image on an unrelated save | A category save omits `image_asset` unless the form has one, so "I did not touch the photograph" means exactly that | `update_category_without_products` behaviour; existing image tests |
| A category with no English label | `title_en` is optional; empty falls back to the stored title and then the CATEGORY.* translation | `translate-category-title` spec |

Limitations recorded: the category thumbnail uses the uploaded URL rather than a derived smaller
rendition; the uploader has progress and retry but no cancel button; the Media page remains a
product worklist, with category images handled inside the category editor.

## Phase 6 — what makes a bulk change safe to retry

| Risk | What happens now | Evidence |
|---|---|---|
| Applying a preview the catalogue has moved past | The preview signs (HMAC, app secret) the mode, value, selection and every price it saw. An apply must carry that token; the server recomputes it from the current rows and answers **409 stale_preview**, writing nothing | `test_a_preview_made_before_a_price_moved_is_refused`, `test_a_changed_selection_invalidates_the_preview` |
| Double click / network retry raising prices twice | An apply carries an idempotency key generated with the preview; the first answer is stored and replayed verbatim (`replayed: true`), with no second write | `test_the_same_apply_retried_changes_the_prices_once` |
| Rounding nobody can predict | Money is Decimal, two places, **half-up**; 10.05 + 10% is 11.06, not the 11.05 a float `round()` gives | `test_percentages_round_half_up_and_the_preview_names_the_variant` |
| Not knowing which variant/unit a preview changes | Each row carries the code, the size, the currency and the typed unit (or "unknown") | same test; `test_the_preview_names_the_unit_and_currency_it_is_changing` |
| A price falling to zero or below | Refused before writing, and listed in `refused` | `test_a_price_that_would_reach_zero_is_refused_rather_than_written` |
| A CSV cell executing in a spreadsheet | Text cells starting with `= + - @`, tab or CR are prefixed with an apostrophe; quotes/commas are escaped; real numbers stay numbers | `shared/csv.spec.ts`; dashboard and rejected-row exports use it |
| A history that stops being usable | `/admin/activity` takes `q`, `action`, `actor`, `from`, `to`, `page`, `per_page`, and returns the total, pages and the action list; the products page offers search, an action filter and paging | `test_activity_log.py` filters/paging tests |

Policy kept explicit: the CSV thickness import is **partial** - good lines are applied, refused lines are
reported with a reason and change nothing, and the import is recorded. That is documented in the
import panel rather than silently changed to all-or-nothing. Batch price reversal was **not** added;
the existing single-price revert remains the undo for one row.

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

- The admin phone navigation is one element that the CSS shows as a strip or as a panel behind one
  button; a spec asserts there is exactly one `.admin-tabs`, that it is displayed at desktop width, and
  that the button toggles it, closes on Escape and on choosing a tab. This is the failure that was
  reverted before (a second copy rendered from an `ng-template` stayed visible at 1440px). It was not
  observed in a real phone browser, and the 320px measurement in this file predates the panel.
- The admin header's render was not observed settling in a real browser: `/admin/me` answers 200 with
  capabilities, but the probe still showed the loading line. The probe or a stale bundle is the likely
  cause; the header is covered by the session service and the shell spec, not by a browser observation.
- `index.html` structured data is static. A changed telephone reaches it only at the next build, so a
  search result can name the old number until then.
- `mobile-nav.component.ts` is no longer rendered (the header carries the links) and still reads the
  environment directly. Dead code, left in place rather than deleted in this pass.

## Progress log

Newest first.

- **Phase 7 — implemented, verification pending.** The search report can be read for a date range and
  filtered by text; each row carries a normalised spelling; the page says plainly that a search is a
  question, not an order. Searches made while signed in are **not recorded at all**, so the report is
  what customers asked rather than a log of the owner testing the catalogue - the price is that the
  owner cannot use their own searches as a test sample, which is the honest trade. New `/admin/content`
  edits the seven services (stable ids the quote form uses): AL/EN title and description, picture and
  alt text in each language, order, and whether it is shown. It stores the copy in the settings table
  under `content.service.<id>.<field>` - no migration - and the public list, detail and home pages read
  it through one `ContentService`, falling back field by field to the copy that already ships, so a
  blank panel changes nothing. Editors read it; only an administrator writes. Frontend **252 tests**,
  build **26 routes** (the new page), backend suite. Not done: synonyms, and the content cards save per
  service without a page-level unsaved-changes guard (each card states its own saved state).

- **Phase 6 — implemented, verification pending.** A bulk apply is now bound to its preview: the
  preview signs the mode, value, selection and every price it saw, the apply must carry that token,
  and the server recomputes it from the current rows - a stale preview gets 409 and writes nothing.
  An idempotency key (new `bulk_applications` table, migration `b9e3f1c25a70`) makes a double click or
  network retry return the first answer instead of raising prices twice. The preview names the size,
  currency and typed unit of every variant it would change; money moved to Decimal with explicit
  half-up rounding. Exports are protected against spreadsheet formula injection through
  `shared/csv.ts` (dashboard worklist and rejected-row file). The history is searchable by text,
  action and account, filterable by date, paged, and returns its total and the action list. The bulk
  panel says "selected on this page" so nobody thinks the selection spans the filtered catalogue.
  Frontend **242 tests**, backend suite, build **25 routes, exit 0**. Deliberately not done: batch
  price reversal (the single-row revert remains), and the CSV import keeps its documented
  partial-apply policy.

- **Phase 5 — implemented, verification pending.** The category page is now a searchable, collapsible
  tree with a thumbnail, the branch's product total, its descendant count and the effective
  visibility (an enabled section under a switched-off group says which ancestor hides it). Creating
  and editing happen in a panel on the same page: both labels (`title` + `title_en`), parent (with
  the category's own sections excluded), visibility, image upload with alt text, and the impact of
  switching a branch off stated as "hides N products and M categories below it, nothing is deleted".
  The server refuses self-parenting and moves under one's own descendants, and **category writes now
  require an administrator** - they previously required only a token, so any signed-in account could
  create or rename categories. `categories.title_en` is the new nullable column
  (`a7d2c9e4f610`, applied to a throwaway SQLite DB; rollback is
  `flask db downgrade c41f8a2d7e10`). `translateCategoryTitle` prefers it in English. The media page
  now binds an upload to the product it started on and discards a mismatched result; its save sends
  only the image. Frontend **237 tests**, backend **246**, build **25 routes, exit 0**. Not yet
  checked in a browser: the tree's keyboard behaviour, a real upload cancellation, and the mobile
  layout at 320px. Marked implemented, not verified.

- **Phase 4 — implemented, verification pending.** The editor gained: create mode (one empty variant,
  both language rows, saved **inactive**), a category select for reassignment, a typed `price_unit`
  per variant, section headings, a customer-preview link, an inactive banner, a dirty badge and
  confirm-on-close, `beforeunload` for the tab, a load token so an older answer cannot replace a newer
  selection, and upload binding to the product it began on. Saves carry `expected_version`; the server
  answers 409 and changes nothing when it is stale, and the form offers a reload. Backend: the
  migration `c41f8a2d7e10` adds `products.version` and `dimensions.price_unit` (tested on a throwaway
  SQLite database, upgrade only; rollback is `flask db downgrade 9a577bc5dd12`); the three write routes
  now require staff - a real gap, since an ordinary signed-in account could edit products before;
  negative prices, three-decimal prices, negative measurements and duplicate variants are refused by
  field path; the dashboard has a ninth check (`no_price_unit`). Backend **236 tests**, frontend
  **227**, build **25 routes, exit 0**. Not yet checked: the desktop/phone flow in a browser, an
  actual concurrent-edit round trip between two browsers, the customer single-variant and
  multiple-thickness enquiry regressions, and the product dialog's long-standing size question. Those
  are phase 8 checks; the phase is marked implemented, not verified.

- **Phase 3 — verified.** The dashboard leads with "Needs attention": seven checks, only the non-zero
  ones, each row opening the existing worklist (export, paging, empty state kept) and offering the same
  check on `/admin/products?gap=…`, where the record is edited. The table reads `gap` from the address,
  shows it, keeps it through paging and a save, and clears it with the other filters. Catalogue totals
  now distinguish switched-on (2,300-type figure) from reachable through every enabled ancestor, and
  `category_active` on a row walks the whole chain rather than the direct parent. New checks:
  missing language, negative price. `no_photo` now requires an image row with a path, so an empty-path
  row is not a photograph; the label and the help text say photograph rather than visual, so a drawn
  profile is not called broken. Recent changes are six lines with a link to the full history
  (`/admin/products?activity=1` opens it). Backend tests assert each figure equals its worklist and
  that the table returns the same rows. Frontend **220 tests**, build **25 routes, exit 0**.
  Deliberately not done: a price-unit check (no field yet, phase 4) and sortable columns (the table is
  ordered by code, so there is no sort to preserve).

- **Phase 1, increment 9 — verified.** The phone navigation is one `<nav class="admin-tabs">`: a strip
  at desktop width, and below 520px a panel behind a button, opened with the button, closed with Escape
  (focus returned to the button) or by choosing a tab. No second copy is rendered, which is what went
  wrong in increment 8. A new shell spec answers `/admin/me` with each role's capabilities and asserts
  the visible tabs: six for an administrator, five for an editor (no accounts), none for an ordinary
  account; it also asserts exactly one navigation, that it is displayed at desktop width, and the
  open/Escape/choose behaviour. Frontend **217 tests**, build **25 routes, exit 0**. Phase 1 acceptance:
  the three role outcomes are the guard spec, the tabs are the shell spec, and the server still checks
  every request (existing `test_roles`).

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

**Phase 8 — final quality and handoff.** The cross-device and customer-page pass for phases 4–7 is
still owed, as are `ADMIN-HANDOFF.md`, the migration rollback notes, and a release-order note. The
checks to run: the public home, product groups, search, a direct product link, size/quantity
selection, an enquiry draft, a service quote context, and the contact links; the admin at 320, 390,
430, 768 and 1280px; keyboard/focus/labels/error announcements. Record what cannot be observed here
(a real second browser for the concurrency conflict, a real upload cancellation) rather than claiming
it.
