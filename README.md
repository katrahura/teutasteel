# TeutaSteel website

Angular 18 front end for TeutaSteel, with server-side rendering and prerendering. It talks to the
Flask API in a separate repository (`C:\Users\User\source\TSRepos\backend`).

## Requirements

Node 20 and npm 10 (developed against Node 20.13.1 / npm 10.9.0).

## Getting started

```bash
npm install
npm start          # ng serve, then open http://localhost:4200
```

Use `http://localhost:4200`, not `127.0.0.1` — the dev server binds to IPv6 localhost only.

## Configuration

`src/environments/environment.ts` is used by `ng serve`; the production build swaps in
`environment.production.ts` through `fileReplacements` in `angular.json`. The API URL lives here and
nowhere else.

| Setting | Development | Production |
|---|---|---|
| `apiUrl` | `http://127.0.0.1:5000` | `https://api.teutasteel.com` |
| `cloudinaryBaseUrl` | `https://res.cloudinary.com/dy0idyurz/image/upload` | same |
| `whatsappNumber` | `38344776650` | same |
| `contactEmail` | `info@teutasteel.com` | same |

## Scripts

| Command | What it does |
|---|---|
| `npm start` | dev server (SSR) on <http://localhost:4200> |
| `npm run build` | production build into `dist/teutasteel-website`, prerendering 7 routes |
| `npm run test:ci` | unit tests once, headless Chrome |
| `npm test` | unit tests in watch mode |

## Layout

| Path | Contents |
|---|---|
| `src/app/pages/` | home, products, about, contact, login, admin/user dashboards |
| `src/app/services/` | `product.service`, `auth.service`, `auth.interceptor` (functional), `token-storage` |
| `src/app/shared/` | mobile navigation, `language-storage`, `translate-category-title` |
| `src/app/testing/test-providers.ts` | shared TestBed providers used by every spec |
| `src/assets/i18n/` | `al.json` (default) and `en.json` |

## How it talks to the API

- Reads: `GET /category/top`, `GET /category/<id>/children`,
  `GET /category/<id>?page=&per_page=&lang=`.
- Writes (token required): `POST /product/create`, `PUT /product/<id>`, `POST /category/create`,
  `PUT /category/without-products/<id>`.
- Authentication: `POST /auth/login` returns a JWT that is kept in local storage; the functional
  `authInterceptor` attaches it to every request, and no header is sent when there is no token.
- `?lang=` selects the product text; category names are mapped through the `CATEGORY.*` keys and fall
  back to the stored title, so a category added in the admin UI stays readable before its translation
  entry exists.

The anonymous catalogue reads are intentionally public; the full category list, the product list and
every mutation require a token.

## Rendering

`npm run build` prerenders `/`, `/products`, `/about`, `/contact` and `/login`, and the browser
**hydrates** that HTML (`provideClientHydration()` in `app.config.ts`), so the prerendered markup is
reused rather than thrown away and re-rendered. Verified against the production build: no hydration
mismatch, and the language switcher plus client-side routing keep working.

Data is fetched in the browser only — components check `isPlatformBrowser` so prerendering never calls
the API.

## Language

Albanian is the default and the choice is remembered in local storage, so it survives a page reload.
Add new strings to both `al.json` and `en.json`; `en.json` is the fallback.

## Deploying

1. `npm run build`
2. `python tools/make_release.py` — writes `dist/release/teutasteel-frontend-<date>.zip`: the contents of
   `dist/teutasteel-website/browser/`, plus an `.htaccess` (caching, compression, the WebP MIME type) and a
   short README for whoever uploads it. It refuses to package a build older than the sources, and checks
   that the pages, robots, sitemap, manifest and icons are all present before writing anything.
3. upload the contents of that archive to the web root (the `server/` folder is only needed on a Node host
   that runs the SSR entry, and is not in the archive)
4. prerendered pages exist for `/`, `/products`, `/about`, `/contact`, `/login`, `/admin-dashboard` and
   `/user-dashboard`; the host must serve `<path>/index.html` for those
5. `robots.txt`, `sitemap.xml`, `manifest.json` and `icons/` are copied from `public/` into the build

The site being replaced is a Bootstrap Studio export whose folders are still on the server
(`assets/css/`, `assets/img/`, …). Nothing in this build overwrites them; they are unused once the new site
is live, and the release README says so.

The site sits behind Cloudflare, and two of its behaviours are worth knowing:

- it **injects a "content signals" policy into `robots.txt`** (a rights reservation about AI crawling).
  The API host proves this is Cloudflare's, not a file: `api.teutasteel.com/robots.txt` returns the same
  text even though that app has no such route. So don't be surprised by it, and don't try to remove it —
  the `robots.txt` in `public/` is served alongside it.
- HTML is reported as `DYNAMIC` (not cached), and the build's asset names are content-hashed, so a deploy
  does not need a cache purge. If a caching rule for HTML is ever added, purge after deploying, or visitors
  keep an old `index.html` that points at asset names which no longer exist.

The web app manifest keeps the site installable on a phone, as the previous site's `manifest.json` did. Its
icons are rendered from `assets/logo.svg` into `public/icons/icon-192.png` and `icon-512.png` (the old
manifest pointed at `assets/img/final.png`, an image this build does not contain).

Until the API has the newer endpoints deployed (`/category/top`, `/category/<id>/children`, `/category/tree`),
the catalogue stays empty and the products page shows a translated "catalogue temporarily unavailable"
message — the rest of the site works.

### Verifying a deployment

```powershell
python tools\smoke_test.py
```

Checks the live site and its API from the outside and exits non-zero if anything is wrong: the home page
answers and is the Angular application, the main bundle is the slim (lazy-loading) one, `/products`,
`/about` and `/contact` answer with their own canonical, `robots.txt` and the sitemap are served, and on
the API side `/category/top` exists (which is what proves the backend deploy happened), categories carry
`parent_id`, `/category/` refuses an anonymous caller and login rejects wrong credentials.

Point it at a local build with `SITE_URL=http://127.0.0.1:4321 API_URL=http://127.0.0.1:5000`.

Colour contrast is checked separately, because it needs a browser:

```powershell
python -m http.server 4321 --bind 127.0.0.1    # from dist/teutasteel-website/browser
& $env:CHROME_BIN --headless=new --remote-debugging-port=9222 --user-data-dir=$env:TEMP\cdp about:blank
node --experimental-websocket tools\contrast_audit.mjs
```

`tools/contrast_audit.mjs` visits every page and works out what is actually painted behind each piece of
text — including the colour a gradient has at that spot, and reporting text over a photograph instead of
guessing — then fails anything below the WCAG AA threshold (4.5:1, or 3:1 for large text). It should end
with `0 distinct contrast failure(s)`.

Keyboard access is checked the same way, with the same Chrome running:

```powershell
node --experimental-websocket tools\keyboard_audit.mjs   # both widths, every page
node --experimental-websocket tools\drawer_check.mjs     # the mobile menu's behaviour
node --experimental-websocket tools\icon_check.mjs       # the icons still draw
```

`keyboard_audit.mjs` sends real Tab presses at 390 px and 1280 px wide and fails anything that takes focus
while invisible, anything focusable with no visible indicator, and anything clickable that cannot be reached
from the keyboard. It should end with `0 keyboard/focus problem(s)`; controls whose focus moves into another
document (the map) are listed rather than judged. `drawer_check.mjs` asserts the closed menu is out of the
tab order, that opening it moves focus inside, and that Escape closes it and hands focus back.

Both hosts are behind Cloudflare, and it answers **403 to any request that does not look like a browser**,
so the script sends a browser user agent — worth knowing if you write your own check with curl. After a
deploy, if Cloudflare is caching HTML for the site, purge the cache for the changed files, otherwise
visitors can keep getting an old `index.html` that points at asset names which no longer exist.
