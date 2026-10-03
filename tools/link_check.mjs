/**
 * Audits every link on the built site: internal links must resolve, external ones must be
 * well formed, mailto/tel must be plausible, and nothing must point at the old site's
 * pages or at an empty href.
 *
 * Run with a static server on the built site:
 *   node --experimental-websocket tools/link_check.mjs
 */
const DEBUG = 'http://127.0.0.1:9222';
const BASE = process.env.SWEEP_BASE || 'http://127.0.0.1:4321';
const ROUTES = ['/', '/products', '/about', '/contact', '/login',
                '/admin-dashboard', '/user-dashboard'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(DEBUG + '/json/list');
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await wait(500);
  }
  throw new Error('no CDP target');
}

const ws = new WebSocket(await findTarget());
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  const r = pending.get(m.id);
  if (r) { pending.delete(m.id); r(m); }
});
await new Promise((res, rej) => {
  ws.addEventListener('open', res);
  ws.addEventListener('error', rej);
});
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (reply.result && reply.result.exceptionDetails) {
    throw new Error('page exception: ' + JSON.stringify(reply.result.exceptionDetails));
  }
  return reply.result && reply.result.result ? reply.result.result.value : undefined;
}

const collect = `(() => {
  const links = [...document.querySelectorAll('a[href]')].map((a) => ({
    href: a.getAttribute('href'),
    text: (a.getAttribute('aria-label') || a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
    target: a.getAttribute('target') || '',
    rel: a.getAttribute('rel') || '',
  }));
  const images = [...document.querySelectorAll('img[src]')].map((i) => ({ href: i.getAttribute('src'), text: 'img', target: '', rel: '' }));
  return [...links, ...images];
})()`;

const resolved = (href) => {
  try { return new URL(href, BASE).href; } catch { return null; }
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url: 'about:blank' });
await wait(1200);

const seen = new Map();       // href -> { text, pages }
const problems = [];
const external = new Set();
const bare = [];              // routes that produced no links at all

for (const route of ROUTES) {
  const navigation = await send('Page.navigate', { url: BASE + route });
  await wait(8000);
  // A failed navigation leaves whatever page was already loaded in place, so the links
  // below would be the *previous* page's and the check would pass having tested nothing.
  const failure = navigation.result && navigation.result.errorText;
  if (failure) {
    bare.push(`${route} - ${failure}`);
    continue;
  }
  const found = await evaluate(collect);
  if (found.length === 0) {
    const text = await evaluate(`document.body.innerText.replace(/\\s+/g, ' ').trim().length`);
    bare.push(`${route} (${text} characters of text)`);
  }
  for (const link of found) {
    const key = link.href;
    if (!seen.has(key)) seen.set(key, { text: link.text, pages: [], target: link.target, rel: link.rel });
    seen.get(key).pages.push(route);

    const url = resolved(link.href);
    if (url === null) { problems.push(`malformed href "${link.href}" on ${route}`); continue; }
    const parsed = new URL(url);

    if (link.href === '' || link.href === '#' || link.href.startsWith('javascript:')) {
      problems.push(`placeholder href "${link.href}" (text "${link.text}") on ${route}`);
    } else if (!link.text) {
      problems.push(`link with no text and no aria-label: ${link.href} on ${route}`);
    } else if (link.target === '_blank' && !/noopener/.test(link.rel)) {
      problems.push(`target=_blank without rel=noopener: ${link.href} on ${route}`);
    } else if (link.href.startsWith('mailto:')) {
      if (!/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}/i.test(link.href)) problems.push(`odd mailto "${link.href}" on ${route}`);
    } else if (link.href.startsWith('tel:')) {
      if (!/^tel:\+?[0-9\s-]{6,}$/.test(link.href)) problems.push(`odd tel "${link.href}" on ${route}`);
    } else if (parsed.origin !== new URL(BASE).origin) {
      external.add(parsed.host);
    }
  }
}

// check every internal link actually resolves
console.log('internal links:');
const internal = [...seen.entries()].filter(([href]) => {
  const url = resolved(href);
  return url && new URL(url).origin === new URL(BASE).origin && !href.startsWith('#');
});
const broken = [];
for (const [href, info] of internal) {
  const url = resolved(href);
  const response = await fetch(url);
  const ok = response.status === 200;
  if (!ok) broken.push(`${href} -> ${response.status}`);
  console.log(`   ${ok ? 'ok  ' : 'DEAD'} ${response.status} ${href.padEnd(46)} "${info.text.slice(0, 24)}"`);
  // a 200 that is the host's own 404 page still counts as dead
  if (ok && /not found|404/i.test((await response.clone().text()).slice(0, 600))) {
    broken.push(`${href} serves a 404 page`);
    console.log('        (that URL serves a "not found" page)');
  }
}

console.log(`\nexternal hosts referenced (${external.size}): ${[...external].join(', ')}`);
if (bare.length) {
  console.log(`\n${bare.length} route(s) could not be loaded from ${BASE}:`);
  for (const entry of bare) console.log('   ' + entry);
}
console.log(`\n${problems.length} link problem(s):`);
for (const problem of [...new Set(problems)]) console.log('   ' + problem);
console.log(`${broken.length} dead internal link(s)`);
for (const entry of broken) console.log('   ' + entry);

const failed = problems.length + broken.length + bare.length;
console.log(failed === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${failed})`);
ws.close();
process.exit(failed === 0 ? 0 : 1);
