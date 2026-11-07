# Teuta Steel — full website review

Review date: 3 November 2026 (Europe/Paris).

## Overall assessment

The site has a coherent slate/amber identity and a working phone-first enquiry journey. It does not need another wholesale redesign. The largest remaining problems are commercial clarity: customers cannot consistently see what a price buys, some stored prices are hidden, saved enquiries can retain outdated information, and visually different mesh products still look identical.

Recommendation: resolve the P1 items below before replacing the production frontend. Then improve navigation, real-work evidence and content. P1 means a direct risk of a wrong/incomplete enquiry or an important release dependency; P2 means a meaningful usability, accuracy or operational improvement. No numerical design score is assigned because it would imply measurements this review did not perform.

## Scope and limits

Reviewed the deployed frontend at https://test.teutasteel.com, its current local source, selected backend source/configuration and aggregate live catalogue records. The test frontend uses https://api.teutasteel.com and live MySQL by the owner's explicit choice.

Browser coverage: home, product groups, category 113, category 111, Multival dialog, enquiry, services, press-brake detail, about, contact, guides, projects and login. Responsive samples at 320, 390 and 430px; tablet catalogue at 768px; desktop at approximately 1280px. Not every route was exhaustively tested at every width.

Customer journey exercised: browse to Multival -> choose 4 mm -> quantity 2 -> add -> review enquiry. The displayed numeric subtotal was correct (176.4 EUR). The temporary item was cleared afterward. Service-detail -> request retained the selected press-brake service. AL/EN switching and anonymous admin redirect were checked. No WhatsApp message, login attempt, catalogue edit, upload, account creation, production migration or deployment was performed. Browser language and viewport were restored.

The administrator assessment is source/configuration review plus unauthenticated boundary checks. No signed-in staff session was available in this review, so saving, conflicts, uploads, bulk apply, role changes and keyboard operation inside the current live admin were not freshly certified. Earlier test reports remain historical evidence only. Automated suites were not rerun for this read-only audit. This is not a penetration test, engineering certification or Lighthouse/Core Web Vitals assessment.

## Catalogue snapshot

Counts are from a read-only live query. Reachable means product active and every ancestor category active; it is different from the raw active flag.

| Measure | Count |
|---|---:|
| All products | 2,378 |
| Products marked active | 2,378 |
| Reachable public products | 1,346 |
| Active but behind inactive category branches | 1,032 |
| Categories | 69 |
| Reachable products with a positive price | 406 |
| Reachable products without a positive price | 940 |
| Priced variants | 582 |
| Priced variants without a recorded price unit | 558 |
| Reachable products without a product photo reference | 431 |
| Reachable products without an English description row | 936 |
| Reachable products without dimension rows | 6 |
| Negative prices among reachable variants | 0 |

Missing photos are not automatically defects for standard profiles with accurate drawings. Missing prices can be deliberate quote-only products. Missing English rows do not prove every rendered product is unreadable: codes and fallback content exist. The actionable problem is distinguishing deliberate quote-only/technical-drawing cases from incomplete records.

Category 111 has 19 separate R-pattern products and no individual photos. Category 112 has 22 products, 21 without individual photos. Category 113 has one four-thickness Multival product and two accessory products.

## Prioritized findings

### F01 — P1 / confirmed: stored accessory prices are hidden

Observed on phone and desktop: Lidhëse H and Mbyllëse U have no visible card price, although their live values are EUR 3.50 and EUR 3.00. Their generated WhatsApp links contain those values. The same issue affects the price label in the detail variant markup.

Cause: products.component.html requires both a positive price and hasAnyDimension(...), around lines 1007–1008 and 1284. A product can have a legitimate price without a geometric measurement.

Change: show valid prices independently of geometric dimensions. Keep dimension-dependent drawings separate. If the price unit is unknown, do not infer a commercial unit from the section shape; show a clear request-for-confirmation state until it is recorded.

Acceptance: the two accessories show EUR 3.50 / EUR 3.00 on both cards and detail views without inventing their lengths or changing their prices.

### F02 — P1 / confirmed data gap: the price basis is mostly unknown

558 of 582 priced variants lack price_unit. A visible number alone does not tell a customer whether it buys a metre, sheet, bar, kilogram or piece. The repeated quantity label 'pieces' does not resolve what the stored price is for.

Change: use the existing administrator 'missing price unit' queue to confirm these values with the owner/source list. Require a unit for newly published priced variants; let intentional quote-only products remain quote-only. Record the source basis and conversion when changing m² prices into full-sheet prices. Verify quantity/subtotal arithmetic before enabling metre/kg-based selling; this review did not establish an observed non-piece arithmetic failure.

Acceptance: every publicly priced variant has a confirmed unit; card, dialog, enquiry and WhatsApp use the same basis. Unknown units are explicitly unresolved rather than guessed. Do not populate all missing units with 'piece'.

### F03 — P1 / confirmed in source: saved enquiries do not refresh prices

QuoteListService stores unitPrice/detail/dimensions in browser storage and returns them later. ContactComponent totals and exports those saved values without reconciling them with current public product data. No catalogue version or expiry is carried for price validation.

Why it matters: a draft created before the Multival m²-to-piece correction can retain the older price/basis. A shop price change, product withdrawal or changed variant can similarly leave an apparently current request with stale details. This was established by source review, not by modifying a customer's old draft.

Change: refresh each saved product/variant before review/handoff; compare price, unit, dimensions and availability. Clearly mark changed/unavailable lines, ask the customer to review changes, and prevent obsolete lines being presented as current prices. Preserve typed notes and quantities. Treat this as an enquiry, not an accepted order.

Acceptance: save a draft against disposable data, change its price/unit or deactivate its variant, then reopen it. The customer sees the change; an obsolete price is not silently sent.

### F04 — P1 / confirmed: the handoff loses part of the product specification

For a 4 mm Multival sheet, the enquiry/WhatsApp line read 'Multival — Trashësia 4 mm — 6 m — 88.20 Eur (2)'. The sheet's 2.1 m width, price basis and product URL are missing. After switching to English, the stored line still said 'Trashësia'. The numeric subtotal was correct but rendered as '176.4 Eur' rather than a consistently formatted currency value.

Cause: the request stores display-ready detail text, and ContactComponent.getQuoteLink() exports code/detail/quantity only. QuoteItem has structured dimensions but no explicit price-unit field used by this export.

Change: store stable product/variant identity, dimensions, price unit and price snapshot; derive language-specific descriptions when rendering/exporting. Include full size, thickness, quantity, unit price/basis and a public link. Format currency consistently to two decimal places; retain the distinction between priced and quote-only lines.

Acceptance: the message identifies 'Multival, 6000 × 2100 × 4 mm, 2 sheets, EUR 88.20/sheet' with a link. AL -> EN changes the labels without changing the selected variant. Two sheets produce EUR 176.40.

### F05 — P1 / confirmed: buyers cannot distinguish the 19 R-pattern meshes

The split product records and prices are correct, but every R pattern has no individual photo and no verified opening/thickness/raised-or-flat specification. The desktop grid shows identical grey rectangles. The first page is ordered by existing IDs (R1, R9, R12...) rather than natural R1–R19 order, making comparison harder.

Change: obtain a labelled sample board or supplier chart. For each code, record opening dimensions, strand width, thickness and raised/flattened finish, and attach the matching real image or verified technical drawing. Provide a comparison view and natural code sorting. Until confirmed, make the missing specification explicit and direct buyers to confirmation instead of presenting the generic sheet rectangle as the actual pattern.

Acceptance: a buyer can distinguish any two R codes using verified information. No invented supplier-to-code mapping or arbitrary stock images.

### F06 — P1 release dependency / configuration check: admin image uploads need verification

The deployed backend env file has no CLOUDINARY_UPLOAD_PRESET value. The media-config implementation reports configured=false when the cloud/preset is absent. Source confirms the browser uploader needs that preset. No real signed-in /admin/media/config request was made here, so an alternative Passenger-injected environment value was not ruled out.

Change: first verify the authenticated live config response. If unconfigured, set a constrained unsigned upload preset or implement the chosen signed-upload flow; configure permitted formats/size/folder and verify assignment/save/cancel. Do not expose a Cloudinary API secret to the frontend. Existing delivery of already-uploaded assets works independently of upload configuration.

Acceptance: a real staff browser upload succeeds, saves to the selected product/category, survives refresh, and cancelling a second upload retains the previous image. Verify against isolated test data, not by overwriting a real product during acceptance.

### F07 — P2 / confirmed: dimensions mix units and the sheet graphic is unhelpful

Multival detail shows 'Width: 2100' next to 'Length: 6 m'; the card shows '2100 × 6000 × 4' without units. The same card represents four thicknesses but its summary/drawing uses the first (4 mm), which can look like a chosen specification. The tall grey strip does not explain a multiwall polycarbonate sheet.

Change: display the full-sheet size as 6 m × 2.1 m, and thickness separately as 4/6/8/10 mm. When a variant is selected, label that chosen thickness explicitly. Use a suitable polycarbonate sheet photograph/cross-section schematic without suggesting unverified internal geometry. Keep the corrected whole-sheet prices and weight exclusion.

Acceptance: every dimension has an unambiguous unit, the card does not imply 4 mm is selected, and selecting another thickness updates the specification clearly. No steel-weight estimate returns.

### F08 — P2 / confirmed: localization is incomplete on direct category links

With English selected, a direct link to category 111 displayed 'Rrjetë metalike e zgjeruar Products' even though the database has title_en='Expanded Metal Mesh'. Accessory codes remain Albanian, while English descriptions explain their purpose. Enquiry lines also keep the language in which they were added (F04).

Source: loadCategoryWithProducts() restores title but not title_en into selectedCategory (products.component.ts around 1668–1671). Initial prerendered pages also briefly show Albanian before the remembered English language hydrates; later inspection confirmed the English preference persisted, so a permanent language-reset defect is not claimed.

Change: preserve both category labels through every load path; keep product codes stable but show translated customer-facing names where appropriate. Rebuild descriptions from structured enquiry data. Review actual product-description coverage using the existing missing-language queue.

Acceptance: direct links, category browsing, reloads and language switching agree on the category name. English enquiries contain English labels. Do not confuse the transient prerender language flash with a lost preference.

### F09 — P2 / confirmed content issue: the portfolio exposes planning material

'Our work' is linked in the footer. The page is honestly marked SAMPLE, but customers can read invented project scenarios and 'Photos needed' shooting instructions. These are useful internal preparation notes rather than customer proof. Service examples link into this page as well.

Change: publish 3–6 real completed jobs with owner-approved photographs, material/process details and outcomes. Until then, retain an explicitly illustrative applications page if useful, but remove internal photo briefs and do not market it as completed company work. Preserve the current sample disclosure and noindex while it remains illustrative.

Acceptance: every claimed completed job has real evidence; no customer-facing production brief remains. Illustrative examples are unmistakably labelled and separate from actual projects.

### F10 — P2 / design improvement: catalogue organization follows imports more than buying intent

Decorative metal contains 987 reachable products and 14 child categories, including Multival and Plexiglass near the end. A buyer looking for roofing/polycarbonate must know to enter a decorative-steel group. Current home featured products include an unexplained '100-1' code and small connectors rather than a deliberately selected set of the main buying tasks.

Change: provide prominent entry points for steel sections/tubes, steel sheets, expanded mesh/grating, and polycarbonate/roofing accessories. Aliases/navigation shortcuts can improve discoverability without immediately moving records between categories. Curate featured products by customer value rather than mere availability of a photo/price. Add breadcrumbs and relevant filters; later consider a material/finish/opening/thickness comparison for mesh.

Acceptance: a first-time phone user can find Multival from the home page without guessing 'Decorative metal'; sections remain searchable by code; existing links continue working.

### F11 — P2 / confirmed phone polish: request controls fall below the site's target

At 390px, increase/decrease controls measured 40 × 40px and Remove was 40px tall. Header/menu and main actions measured 44px. No page-wide horizontal overflow was observed in the sampled widths. The 320px Multival dialog was visible and within the viewport, with a fixed action region. The TEST SITE label overlapped page content; that is staging-only chrome.

Change: bring frequently tapped request controls to at least the project's existing 44px target; maintain spacing and visible focus. Give the staging environment label a reserved area instead of covering content. Verify keyboard focus after modal close and real iPhone/Android keyboards; these were not fully certified here.

Acceptance: measured tap areas meet the chosen target at 320/390/430px, controls remain reachable above a phone keyboard, and the notice never covers a price or form label. This is not a claim of a complete WCAG conformance audit.

### F12 — P2 / confirmed: unknown URLs return the homepage with HTTP 200

https://test.teutasteel.com/review-nonexistent-20261103 returned 200 and the homepage HTML. The server SPA fallback and Angular wildcard redirect explain this. Current routes also commonly redirect /path to /path/ while runtime navigation uses /path.

Change: add a useful not-found view with routes back to products/search/contact, and serve a real 404 for invalid public URLs where the hosting setup permits. Choose one canonical trailing-slash policy. After catalogue quality improves, consider genuine product-detail/category pages with their own metadata; current generic products metadata should not be mistaken for product-specific search visibility.

Acceptance: invalid URLs are understandable to users and return 404; valid deep links still load their exact product; canonical URLs match the chosen policy. Keep staging noindex.

### F13 — P2 / content review: replace broad suitability claims with useful buying guidance

The guide currently says '1-2 mm for parts that carry weight' (en.json GUIDES.SHEET_2; Albanian equivalent exists). This is too broad to help someone select material for a particular job. The about page also relies mainly on general claims rather than concrete company facts.

Change: have the owner/qualified technical reviewer approve guide wording and replace blanket application claims with the information needed for a quotation/design review. Add real yard/team/equipment photos, confirmed capabilities, delivery coverage and response expectations. Do not invent machine limits, certifications, stock availability or lead times.

Acceptance: technical copy avoids implying that thickness alone establishes suitability. Company-specific claims are verified and supported with real information.

### F14 — P2 / release control: the deployed weight fix is still uncommitted

The local working tree still contains the three Multival weight-fix source changes plus documentation changes. The repaired test build therefore cannot be identified solely by the last committed application revision. This is an operational/reproducibility issue, not a newly broken weight calculation.

Change: review and commit the pending fix/docs, record exact source revision and build artifact, and introduce a named staging configuration/build step so siteUrl, noindex rules and labels do not depend on repeated manual postprocessing. Preserve the explicit live-data decision. Do not push the backend checked-out branch as a routine backup: its hook can deploy production.

Acceptance: another developer can reproduce the same test build from a documented revision and command; the release record identifies configuration and artifact; production receives neither test labels nor noindex/no-store restrictions by accident.

## Administrator improvements, using what already exists

Keep the existing capability-based shell, attention queues, bulk previews, idempotency, conflict handling and import/history screens. This review does not justify rebuilding them.

1. Work through existing unknown-unit, missing-language, missing-photo and no-size queues, prioritizing reachable/priced products. Add a 'needs verification' status so deliberate unknowns are not treated as complete facts.
2. Add explicit product material and material-specific attributes: polycarbonate versus steel, multiwall construction, mesh openings/strand/thickness/finish. Shape inference should not be the long-term source of material physics or selling units.
3. Add source pricing basis and a reviewed conversion tool (m² × full-sheet area -> per-sheet price). Show before/after units, quantity basis and rounding; prevent repeat conversion.
4. Verify uploader configuration as F06, and add a small read-only environment/configuration status view so missing dependencies are visible to administrators.
5. Extend account management beyond creation when required: disable departing staff, change roles through an audited administrator action and invalidate sessions appropriately. Source reviewed here exposes list/create; no full account lifecycle was verified.
6. Make the LIVE DATA connection highly visible in admin, and use a separate MySQL/API copy for destructive regression tests. The shared setup is owner-approved, not a deployment mistake to silently reverse.
7. Attach verification provenance and source-price-list date to imported/corrected rows. The old price-list importer still models shared-price rows as combined product codes and should not be rerun unchanged.

## Performance, SEO and security observations

- The checked test pages, category tree and public settings/content endpoints returned 200. Most page URLs redirected once to a trailing slash.
- Single-sample HTML/API request times were approximately 0.11–0.35 seconds from this computer. These are not phone load times, LCP/INP/CLS metrics or a performance score.
- No completed broken image was found in the inspected page snapshots; missing product images are generally replaced by drawings. Off-screen lazy assets were not exhaustively crawled.
- Earlier build reports show an approximately 845 kB raw initial bundle and existing CSS/localize/Bootstrap warnings. No new build or bundle-size measurement was run in this review. Avoid reporting those historical sizes as fresh performance results.
- Test pages carried X-Robots-Tag: noindex, nofollow, noarchive and Cache-Control: no-store. That is appropriate for this preview; production needs its own indexing/cache policy.
- Anonymous /admin/me and /admin/users returned 401; navigating /admin/overview redirected to login. This is a good boundary check, not proof of every authorization path.
- The deployed env file has no CORS allowlist. The application supports bearer authentication, so this alone is not a demonstrated permission hole. Restrict known browser origins as a hardening task after identifying all legitimate clients.
- Static metadata and browser-fetched business settings remain separate; the handover already records that saved contact values do not automatically rewrite the prerendered metadata. Keep that release task explicit.
- No live staff mutation, two-browser conflict, external upload/cancel, production backup restoration or penetration test was performed.

## Recommended sequence and acceptance checklist

### 1. Fix commercial correctness before adding more decoration

- [ ] F01: display stored prices without requiring geometric dimensions.
- [ ] F02: confirm price units for reachable priced variants; do not mass-guess.
- [ ] F03/F04: refresh stored requests and export complete, language-correct specifications.
- [ ] F06: verify real admin upload configuration and a cancelled upload against disposable data.
- [ ] F14: commit the weight fix/docs and record a reproducible staging build.

### 2. Make the catalogue explain the products

- [ ] F05: verify R-code specifications/images; sort naturally and offer comparison.
- [ ] F07/F08: consistent dimensions, correct category translations and clearer sheet presentation.
- [ ] F10: add polycarbonate/mesh shortcuts and curate home featured items.
- [ ] Track quote-only, missing-image and missing-language cases separately in the admin queues.

### 3. Build trust and complete mobile/release checks

- [ ] F09/F13: real projects, genuine business photographs, approved technical guidance.
- [ ] F11: tap targets, keyboard focus, actual phone keyboard/WhatsApp handoff checks.
- [ ] F12: useful 404s and consistent canonical URLs.
- [ ] Signed-in admin acceptance on isolated data; existing conflict/import/bulk safeguards must remain intact.
- [ ] Repeat a representative AL/EN phone/desktop enquiry journey, with no message sent unless authorized.

## Evidence

Workstation evidence folder: C:\Users\User\Documents\Codex\2026-10-08\c-teutasteel-website\outputs.

- full-review-data-20261103.log — live aggregate counts and configuration flags.
- full-review-http-20261103.json — page/API statuses, headers, metadata and timing samples.
- review-2026-11-03/browser-checks.json — page summaries and responsive sampling. Some fast navigation snapshots captured the pre-hydration Albanian content; later stable inspections confirmed English preference persistence. Zero-size dialog samples in that initial file are not evidence of a failed dialog: a separate explicit visible-dialog wait confirmed the loaded 320px dialog.
- review-2026-11-03/multival-dialog-320.png — corrected weight exclusion, mixed units and mobile layout.
- review-2026-11-03/accessory-hidden-prices-desktop.png — priced accessories whose card prices are hidden.
- review-2026-11-03/expanded-mesh-desktop.png — indistinguishable mesh drawings and mixed-language direct-link heading.

No application fixes were made by this review. Only review records were written; proposed changes await a separate implementation instruction.
