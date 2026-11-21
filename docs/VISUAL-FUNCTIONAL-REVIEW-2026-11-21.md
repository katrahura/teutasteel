# Teuta Steel — visual and functional review

Review date: 21 November 2026 (Europe/Paris).

This review **changed the frontend**; it is not a read-only audit. All changes are uncommitted in the working tree.

## Scope and method

- Reviewed the public site against the production build, served locally on `http://127.0.0.1:4321`, calling the live `https://api.teutasteel.com` read-only. No catalogue record, setting or order was changed.
- Browser coverage: headless Chrome 157 at **1280 × 900** and **390 × 844**. Home, product groups, a category, the product dialog, search results, services, one service page, about, contact, request a quote (empty and with an item), guides, projects, login and the app's 404 route.
- Interaction checks: search for `IPE 100`, AL → EN switch, phone menu open/close and focus, add one product to the request list, fill the two required fields and read the generated WhatsApp message, request page at both widths.
- Automated checks: production build, 275 unit tests, 877 translation keys, keyboard/focus audit, colour-contrast audit, link check.
- Limits: no signed-in administrator session (no credentials were used), no WhatsApp message was sent, no order or catalogue write, no physical phone, no Lighthouse/Core Web Vitals run. The admin pages are therefore reviewed in source only; the public site is reviewed in the browser.

## What was found and what changed

### Home page

| Finding | Change |
|---|---|
| The featured-products row was a fixed four-column grid at every width. At 390px each card was about 60px wide and its text wrapped one word per line — "100-1 / 5.00 / Eur / Njësia …". | The grid is now 2 columns on phones and tablets, 4 on desktop; card copy and description are clamped. See [home.component.css](../src/app/pages/home/home.component.css). |
| The same price text was repeated in full on every card: "5.00 EUR / Njësia e çmimit për konfirmim". | Home cards use the short "për konfirmim" form; the full sentence remains in the product detail. |
| Descriptions that merely repeat the product code were printed under it. | Suppressed when the description equals the code. |
| Seven full-height service cards stacked down the phone page, making the homepage about 7,100px tall before the footer. | On phones the services are a horizontal snap strip, so every service is still present but the page is about 5,200px. |
| The "Pse Teuta Steel" card had a translucent background; the audit could not measure its light text, and some mobile colours were low contrast. | Solid slate panel; on phones the card turns light with dark text, a dark-amber tick and a darker caption. Home contrast now passes. |

### Catalogue

| Finding | Change |
|---|---|
| The category title and the word "Products" were one unseparated heading: **"Laser cut sheets Products"** / "Pllaka me prerje lazer Produkte". | A breadcrumb — *Product Groups / category* — with the category as the single `h1`; the duplicate "Back to groups" button is only kept in search results. |
| Each child-category card read "View Products" **before** the category name. | The name now comes first, then the action. |
| The price line was omitted entirely when a product had no stored price, which looked like a failed load. | Cards say **"Çmimi: sipas kërkesës" / "Price: On request"**. |
| The quantity label was followed by "price unit to be confirmed" — a sentence about the price sitting beside the quantity, reading as if the customer had to choose it. | The quantity keeps only a real unit; the unknown price basis is stated once, on the price line, with the full sentence in the title attribute. |
| The size filter read "Height (mm), from (to 3000 mm)" with unlabelled boxes. | "Height (mm)" label, minimum, "to", maximum with the catalogue maximum as its placeholder, and "mm". |
| Pagination buttons were blue pills that grew on hover; the disabled state was barely different. | Neutral outline buttons, no scaling, visible disabled state, quieter page count. |
| The product page reserved 90px for a navigation overlay that no longer exists, and showed group shortcuts inside a category. | Normal 24px gap; shortcuts only on the groups view; Bootstrap search icon instead of an emoji. |
| The product detail dialog had no header: the code sat inside the details column and the close button floated over the photograph. It also had a very tall image panel, and Escape dropped focus onto the document body. | The dialog now has a header with the category, product code and close button; a price summary; a contained image panel; and closing it returns focus to the card that opened it. |
| The colour of the action buttons on contact/about/login was Bootstrap blue while the rest of the site uses amber. | One `.btn-accent` action style, plus the existing slate secondary style. |

### Contact

The old page was one centred column of text and a map below it. It is now two panels: the contact details, actions and social links on the left, the map, hours and a direct WhatsApp action on the right. Each detail has an icon and a label; the primary action is the amber quote button. The phone layout stacks the same panels. The map keeps its title and the existing keyboard focus ring.

### Request a quote

- The draft notice used to sit inside the first form column, pushing the phone field onto the same line as the heading and leaving name and phone out of line. The notice is now a full-width row, and the two required fields sit side by side.
- The request card has a consistent border/shadow and padding at both widths.
- The WhatsApp hand-off line was `08252 — 1000 × 2000 mm (1 Price basis to confirm)`. It is now `08252 — 1000 × 2000 mm — On request (1)`, followed by the product URL. A recorded unit still appears as `(2 metre)`. The generated link was read from the running page; no message was sent.
- The send action uses a dark WhatsApp green that passes contrast; it is visibly disabled until name and phone are present.

### About

The page was four columns of text on white and a blue button. It now has a slate opening band with the mission line and two actions, three content cards (mission, offer, values), a dark "why us" panel and a quote panel, all using the site's existing copy. No new capability, project, certification or delivery claim was invented.

### Login

The page is now a split card: a slate staff panel with the logo and the "accounts are created by an administrator" note, and a form panel with an amber submit button, `autocomplete` attributes and a way back to the homepage. The form IDs and submit behaviour are unchanged, so the existing login tests still pass.

### Shared shell

- Language buttons on phones now have a 44px tap area (they measured 31 × 27px).
- A global `:focus-visible` fallback and a `.btn:focus-visible` ring cover every button that previously relied on a Bootstrap box shadow. The keyboard audit went from 10 problems to 0.
- The footer privacy separator no longer floats at a line end, and the staff "Panel" link goes directly to the prerendered `/admin/overview` instead of the legacy `/admin-dashboard` redirect.
- `src/icons.css` is a curated SVG-mask set rather than the full icon font, so the new about/contact icons were added there explicitly. Without that, the new icons rendered as empty coloured squares.

## Checks run

| Check | Result |
|---|---|
| `npm run build` | Pass. 27 routes prerendered. Existing warnings only: component CSS 14.22 kB against a 14.34 kB error budget, localize polyfill, Bootstrap selector warnings. |
| `npm run test:ci` | **275 / 275 SUCCESS**, exit 0. |
| `npm run check:i18n` | Pass: 877 keys in both languages, no missing values or placeholders. |
| `node --experimental-websocket tools/keyboard_audit.mjs` | **0 keyboard/focus problems**, desktop and phone, exit 0. |
| `node --experimental-websocket tools/contrast_audit.mjs` | **0 distinct contrast failures** on `/`, `/products`, `/about`, `/contact`, `/login`. |
| `node --experimental-websocket tools/link_check.mjs` | 0 link problems, 0 dead internal links. It reports `/admin-dashboard` as unloadable because a plain static server has no SPA fallback; the footer now links to `/admin/overview`, which is a real prerendered directory. |
| Custom browser flow | Search `IPE 100` → 1 result; switch to EN (heading and Back to Groups in English); phone menu opens with focus on Home; add 08252 to the request; `/request` shows 1 item; filling name and phone enables the WhatsApp link and puts both values in it. No console errors, no horizontal overflow, no broken images on any captured page. |
| Product dialog keyboard check | Opens with focus inside the dialog, locks body scroll, closes on Escape, unlocks the body, and returns focus to the product card's image button. |

## Not changed, and why

- **Signed-in admin journeys.** No credentials were used and the test site shares live catalogue data. The admin screens need the separate signed-in acceptance pass already listed in the handover.
- **Wide empty space in the product-group rows.** The full-width expandable rows are the working drill-down for 987 products; a card grid would constrain the expanded sub-category grid.
- **Missing price basis on 558 of 582 variants.** This is a data/owner task, not a frontend one. The site now says "to confirm" instead of hiding it.
- **True HTTP 404 status.** That is served by the production `.htaccess`/`404.php`; a local static server cannot prove it. The app's own 404 page was reviewed and left as it was.
- **Real project/workshop photographs.** None were added, because the repository has no verified photographs of the workshop or team and inventing that evidence would be worse than the current text-only page.

## Evidence

All images are in [`docs/review-2026-11-21/`](review-2026-11-21/).

| Before | After |
|---|---|
| [home, desktop](review-2026-11-21/before-home-desktop.png) | [home, desktop](review-2026-11-21/after-home-desktop.png) |
| [home, phone](review-2026-11-21/before-home-phone.png) | [home, phone](review-2026-11-21/after-home-phone.png) |
| [contact](review-2026-11-21/before-contact-desktop.png) | [contact](review-2026-11-21/after-contact-desktop.png) |
| [about](review-2026-11-21/before-about-desktop.png) | [about](review-2026-11-21/after-about-desktop.png) |
| [login](review-2026-11-21/before-login-desktop.png) | [login](review-2026-11-21/after-login-desktop.png) |
| [request](review-2026-11-21/before-request-desktop.png) | [request](review-2026-11-21/after-request-desktop.png) |
| [category](review-2026-11-21/before-category-desktop.png) | [category](review-2026-11-21/after-category-desktop.png) |
| — | [product dialog, desktop](review-2026-11-21/after-dialog-desktop.png) |
| — | [product dialog, phone](review-2026-11-21/after-dialog-phone.png) |
| — | [search results](review-2026-11-21/after-search-desktop.png) |
| — | [request with an item](review-2026-11-21/after-request-item-desktop.png) |

## Suggested next steps

1. Run the signed-in admin acceptance pass against isolated data; verify product/category edits, uploads, bulk prices and conflicts.
2. Have the owner confirm the missing price units (the largest remaining commercial accuracy gap) and approve guide/about wording.
3. Shoot the workshop/team photographs and replace the About placeholders when `SHOW_PLACEHOLDERS` is turned on.
4. Do one real phone pass, including the WhatsApp hand-off and a phone keyboard on the request form.
5. Consider a dedicated product-dialog redesign and a curated set of featured products based on what the shop actually wants to sell.
