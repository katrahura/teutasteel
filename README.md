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
2. upload the contents of `dist/teutasteel-website/browser/` to the web root (the `server/` folder is
   only needed on a Node host that runs the SSR entry)
3. prerendered pages exist for `/`, `/products`, `/about`, `/contact` and `/login`; the host must serve
   `<path>/index.html` for those and fall back to `/index.html` for anything else
4. `robots.txt` and `sitemap.xml` are copied from `public/` into the build

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

Both hosts are behind Cloudflare, and it answers **403 to any request that does not look like a browser**,
so the script sends a browser user agent — worth knowing if you write your own check with curl. After a
deploy, if Cloudflare is caching HTML for the site, purge the cache for the changed files, otherwise
visitors can keep getting an old `index.html` that points at asset names which no longer exist.
