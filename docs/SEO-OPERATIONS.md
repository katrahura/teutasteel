# Search-engine operations

Last updated: 7 November 2026. Status: [PROJECT-HANDOVER.md](../PROJECT-HANDOVER.md).

## What the build now carries

- **One canonical host:** `https://www.teutasteel.com`. Every public page writes a self-referencing
  `rel="canonical"`, with a trailing slash because the server answers directory routes that way.
- **Query-aware canonicals:** `/products/?product=ID` is treated as its own page; the category the
  visitor arrived from is not part of the product canonical. `/products/?category=ID` is the category
  page. Search terms, page numbers and `?edit=` are not canonical.
- **Per-page title, description, OG and Twitter tags** from `SeoService` and the `SEO.*` translation
  keys. Private pages get `noindex, nofollow` and no canonical.
- **Structured data:** `Organization` + `LocalBusiness` and `WebSite` (with search action) in
  `src/index.html`. Add `Product`/`Offer` and `BreadcrumbList` when product pages get stable paths.
- **robots.txt** allows public pages, blocks `/admin*`, `/login`, `/request`, `/projects`, `/404`, and
  points to the sitemap. The staging packager replaces it with disallow-all.
- **sitemap.xml:** `npm run sitemap` asks the public API for every reachable category and product and
  writes the canonical URLs into the built site. The checked-in `public/sitemap.xml` is only the
  fixed-page fallback.

## Release sequence

```powershell
npm run build:seo      # ng build + full catalogue sitemap
# verify:
#   dist/teutasteel-website/browser/sitemap.xml has ~1,400 URLs
#   dist/teutasteel-website/browser/robots.txt points at the sitemap
# upload the browser files to the production document root
```

`build:seo` is the production command. `npm run build` alone leaves the fixed-page sitemap in place.
If the catalogue API is unreachable, the sitemap step warns and keeps the fixed pages rather than
failing the release.

## Host redirects

Search engines must see one host. At the production host:

```apache
RewriteEngine On
RewriteCond %{HTTP_HOST} ^teutasteel\.com$ [NC]
RewriteRule ^(.*)$ https://www.teutasteel.com/$1 [R=301,L]

RewriteCond %{HTTPS} !=on
RewriteRule ^(.*)$ https://www.teutasteel.com/$1 [R=301,L]
```

The current production site still answers on both hosts. Fix that when the new frontend replaces it.

## Search Console and Bing

1. Verify a **Domain property** for `teutasteel.com` with a DNS TXT record.
2. Submit `https://www.teutasteel.com/sitemap.xml`.
3. Inspect and request indexing for `/`, `/products/`, the main categories and a few products.
4. Check **Pages** for 404s and “Crawled – currently not indexed”; check **Performance** monthly.
5. Repeat in Bing Webmaster Tools.

Do not submit the test site. It is deliberately `noindex` and its robots file disallows everything.

## Known limits — not fixed by metadata

- Language is stored in `localStorage`; English has no separate URL. Search engines mostly see the
  Albanian default. To index both languages, add `/en/` routes plus `hreflang` (`sq`, `en`,
  `x-default`).
- Product addresses are query strings (`/products/?product=2166`) and product/category pages are
  client-rendered; only 27 routes are prerendered. Stable paths such as `/products/2166-08252` and
  SSR/prerender for products and categories are the next SEO project.
- Product/category pages still use the generic `Produkte` title. Unique product titles need the
  product data at render time, which is the same SSR/path work.
- 556 priced variants have no confirmed unit; incomplete product data weakens snippets even when the
  page is indexed.
