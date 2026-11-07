import { promises as fs } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve('dist/staging/browser');
await fs.access(join(root,'index.html'));
async function prepare(dir) {
 for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
  const file = join(dir,entry.name);
  if (entry.isDirectory()) await prepare(file);
  else if (entry.name.endsWith('.html')) {
   let html=await fs.readFile(file,'utf8');
   html=html.replaceAll('https://www.teutasteel.com','https://test.teutasteel.com').replaceAll('https://teutasteel.com','https://test.teutasteel.com');
   html=html.replace(/<meta\b[^>]*name="robots"[^>]*>/g,'').replace('</head>','<meta name="robots" content="noindex,nofollow,noarchive"></head>');
   await fs.writeFile(file,html);
  }
 }
}
await prepare(root);
await fs.writeFile(join(root,'robots.txt'),'User-agent: *\nDisallow: /\n');
// A sitemap of production URLs has no place on a no-indexed preview: it contradicts robots.txt and
// advertises the wrong host if it is ever fetched. Remove it rather than rewrite it, because crawling
// is disallowed anyway.
await fs.rm(join(root,'sitemap.xml'),{force:true});
await fs.copyFile('tools/staging.htaccess',join(root,'.htaccess'));
await fs.copyFile('tools/staging-404.php',join(root,'404.php'));
await fs.writeFile(join(root,'404.html'),`<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>404 · Teuta Steel</title><style>body{font:18px/1.6 Arial;background:#f8fafc;color:#17212b;margin:0;padding:8vw}main{max-width:680px;margin:auto}a{display:inline-block;padding:12px 20px;background:#eaa22f;color:#17212b;border-radius:6px;margin:8px 8px 0 0}h1{font-size:40px}</style></head><body><main><strong>TEUTA STEEL · 404</strong><h1>Faqja nuk u gjet / Page not found</h1><p>Kjo adresë nuk përputhet me një faqe. / This address does not match a page.</p><a href="/products">Produktet / Products</a><a href="/contact">Kontakti / Contact</a></main></body></html>`);
console.log('Prepared staging browser files, indexing restrictions and HTTP 404 handling.');
