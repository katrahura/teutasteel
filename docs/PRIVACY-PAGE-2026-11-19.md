# Privacy page — 19 November 2026

Scope: `public/privacy/index.html`, the footer link to it, and its place in the sitemap and
the production server rules. This is the Phase 4 deliverable from
[PRODUCTION-RELEASE-PLAN.md](../PRODUCTION-RELEASE-PLAN.md), item "Create `privacy/index.html`
from the existing `/privacy` page, reviewed for the new site".

**Status: draft, pending the owner's and, if the owner wants one, a lawyer's review.** The
page is written to describe what the new site actually does. It is not published until a
release is deployed.

## Where the copy came from

The live site's `/privacy` page (fetched 19 November 2026) is a single static HTML file holding
the policy twice, English first and then Albanian. That bilingual shape and the section
structure were kept; the wording was rewritten where the old statements are no longer true of
the new site.

## What changed, and why

| Old policy said | New page says | Why |
|---|---|---|
| Data from "lead forms" is collected | The request form **sends nothing to our servers**; it prepares a WhatsApp message that the visitor sends from their own WhatsApp | `contact.component.ts` (`prepareSend`) builds a `wa.me/…?text=` link and comments that this is deliberately server-side-free. The backend has no enquiry endpoint. |
| "We do not store your data in external databases" | The request list and the chosen language are kept in the browser's **local storage**; staff accounts, including a hashed password, are in the site's own database | `quote-list.service.ts`, `language-storage.ts`, `token-storage.ts`, admin accounts. The old wording was too broad to be true. |
| No third-party services mentioned | Lists WhatsApp/Meta, Cloudinary (images), Google Maps (contact page), Google Fonts (stylesheet), and says each may see technical data and set its own cookies | The new site loads all four: `contact.whatsappLink()`, `environment.cloudinaryBaseUrl` / `res.cloudinary.com`, the map `<iframe>` in `contact.component.html`, and the Google Fonts `<link>` in `index.html`. |
| No analytics statement | Says no advertising cookies, no analytics and no tracking pixels **as of publication**, and that the page is updated before any tool is enabled | No GA4/GTM/analytics script exists in `src/` (`grep` for `gtag|googletagmanager|analytics`). This keeps the page true if the owner leaves analytics off at launch. |
| Contact details: `+383 44 470 818` | `+383 44 133 208` (phone) and `+383 44 776 650` (WhatsApp), same email and address | `src/environments/environment.ts` and the site's JSON-LD. The old page carried a number the site no longer shows. |
| "Last updated 09 07 2025" | 19 November 2026 | The content changed. |

Rights section: access, correction, deletion, objection and withdrawal, with the Information and
Privacy Agency of Kosovo named as the supervisory authority. No link to the agency is included
because the correct URL was not confirmed at the time of writing.

## Implementation

- The page is a plain static file at `public/privacy/index.html`, copied into the build by the
  Angular asset glob (`public/**/*`). No component, no route, no JavaScript, no external fonts,
  so it renders even if the application bundle fails.
- **The footer link is a plain `href="/privacy/"`, not a `routerLink`.** The application has no
  `privacy` route, so a router link would match the `**` catch-all and show the 404 page
  instead. This is noted in the template next to the link.
- `/privacy/` is served by `DirectoryIndex` from the real directory; `/privacy` gets Apache's
  normal 301 to the trailing slash. It is deliberately **not** in the `.htaccess` SPA fallback
  list, so an accidental removal of the directory cannot turn it back into the shell.
- It is indexable: no `noindex` meta, no `X-Robots-Tag`, and it is listed in both the static
  fallback sitemap (`public/sitemap.xml`) and the generated one (`tools/generate-sitemap.mjs`).
- Relative links use root-absolute paths (`/assets/logo.svg`, `/contact/`) because the page is
  served from `/privacy/`.

## Open owner decisions (Phase 0 of the release plan)

1. **Analytics.** The page states there is none. If GA4/GTM is enabled at launch, this section
   must change first, and a consent decision is needed.
2. **Legal review.** Whether the owner wants a lawyer to review the Albanian and English
   wording before launch.
3. **Supervisory authority link.** Confirm the Information and Privacy Agency's official URL
   (or drop the mention).
4. **Operator identity.** The page names the trading name and address only. If a registered
   legal entity name or business number should appear, supply it.
5. **Cloudinary / hosting names.** The page names Cloudinary and Google because the browser
   contacts them directly. Cloudflare is described generically as a content delivery network,
   not named; say if it should be named.

## How to check it

```powershell
# after the build
python -m http.server 4321 --directory dist/teutasteel-website/browser
# /privacy/ serves the static page; /privacy redirects to /privacy/
```

`python -m http.server` does not read `.htaccess`, so the 301 from `/privacy` to `/privacy/`
and the real 404 must be verified on the server after deployment (Phase 5/7 checks 7-8).
