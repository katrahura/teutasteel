/**
 * Builds the public sitemap from the same catalogue the site serves.
 *
 * The static sitemap that ships in `public/` only knows the fixed pages. The catalogue is the part
 * search engines actually need to discover, so this script asks the public API for every reachable
 * category and product and writes their canonical URLs next to the built site.
 *
 * Usage:
 *   node tools/generate-sitemap.mjs [output-directory]
 *
 * Defaults to `dist/teutasteel-website/browser`. `SITE_URL` and `CATALOGUE_API` can override the
 * host and API for a preview. A network failure leaves the fixed pages in place and reports it; it
 * does not stop a release.
 */
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';

const SITE = (process.env.SITE_URL || 'https://www.teutasteel.com').replace(/\/$/, '');
const API = (process.env.CATALOGUE_API || 'https://api.teutasteel.com').replace(/\/$/, '');
const OUT = resolve(process.argv[2] || 'dist/teutasteel-website/browser');

const FIXED = [
  '/',
  '/products/',
  '/services/',
  '/guides/',
  '/about/',
  '/contact/',
  '/services/cnc/',
  '/services/shears/',
  '/services/profiles/',
  '/services/bending/',
  '/services/pressbrake/',
  '/services/complex/',
  '/services/decoration/',
];

const escapeXml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

async function get(path) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'user-agent': 'teutasteel-sitemap/1.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return response.json();
}

function walkCategories(nodes, found) {
  for (const node of nodes || []) {
    if (node?.id) found.set(node.id, node);
    walkCategories(node?.children, found);
  }
}

async function catalogueUrls() {
  const tree = await get('/category/tree?lang=en');
  const categories = new Map();
  walkCategories(tree, categories);

  const productIds = new Set();
  for (const category of categories.values()) {
    let page = 1;
    let totalPages = 1;
    do {
      const body = await get(`/category/${category.id}?per_page=100&page=${page}&lang=en`);
      for (const product of body.products || []) {
        if (product?.id) productIds.add(product.id);
      }
      totalPages = body.pagination?.total_pages || 1;
      page += 1;
    } while (page <= totalPages);
  }
  return { categories, productIds };
}

async function main() {
  const urls = FIXED.map((path) => `${SITE}${path}`);
  let categoryCount = 0;
  let productCount = 0;

  try {
    const { categories, productIds } = await catalogueUrls();
    for (const id of categories.keys()) {
      urls.push(`${SITE}/products/?category=${id}`);
      categoryCount += 1;
    }
    for (const id of productIds) {
      urls.push(`${SITE}/products/?product=${id}`);
      productCount += 1;
    }
  } catch (error) {
    console.warn(`Catalogue could not be read (${error.message}); writing fixed pages only.`);
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');

  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(join(OUT, 'sitemap.xml'), xml);
  console.log(`Wrote ${urls.length} URLs (${categoryCount} categories, ${productCount} products) to ${join(OUT, 'sitemap.xml')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
