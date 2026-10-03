/**
 * What the site looks like with the new frontend deployed and the old API still live.
 *
 * That is the state the owner will be in if the frontend goes first - the production
 * build points at api.teutasteel.com, which answers 404 to /category/top, /category/tree
 * and /category/<id>/children. This walks every page in both languages and separates the
 * two kinds of failure that matter:
 *
 *   - an unhandled exception is a bug: the page broke
 *   - a logged API error is expected here: the catalogue is unreachable, on purpose, and
 *     the page is supposed to say so and stay usable
 *
 * Run with a static server on the built site:
 *   node --experimental-websocket tools/frontend_only_check.mjs
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
let exceptions = [];
let loggedErrors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') {
    const details = m.params.exceptionDetails;
    exceptions.push(String((details.exception && details.exception.description) || details.text).slice(0, 130));
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    loggedErrors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 110));
  }
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

const describe = `(() => {
  const text = document.body.innerText.replace(/\\s+/g, ' ').trim();
  return {
    heading: (document.querySelector('h1') || {}).textContent?.trim().slice(0, 40) || null,
    textLength: text.length,
    navLinks: document.querySelectorAll('nav a, .mnav-links a').length,
    catalogueNotice: /temporarily unavailable|përkohësisht|nuk është i disponueshëm/i.test(text),
    categoryCards: document.querySelectorAll('.parent-toggle, .child-card').length,
    // a route that needs a token sends an anonymous visitor to the login form
    showsLoginForm: !!document.querySelector('input[type="password"]'),
    emptySections: [...document.querySelectorAll('section')].filter((s) => s.innerText.trim() === '').length,
    images: document.querySelectorAll('img').length,
    brokenImages: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).length,
  };
})()`;

/** what "rendered" means for each route, rather than a crude length threshold */
const expectation = (route) => {
  if (route === '/login' || route.endsWith('dashboard')) {
    // without a token these routes show the login form
    return (state) => state.showsLoginForm;
  }
  if (route === '/products') {
    // with the old API the catalogue is unreachable and the page says so; with the new
    // one it lists categories. Both are a correctly rendered page.
    return (state) => state.heading !== null && (state.catalogueNotice || state.categoryCards > 0);
  }
  return (state) => state.heading !== null && state.textLength > 250;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url: 'about:blank' });
await wait(1200);

let failures = 0;
for (const language of ['al', 'en']) {
  console.log(`\n########## language: ${language} ##########`);
  await send('Page.navigate', { url: BASE + '/' });
  await wait(6000);
  await evaluate(`localStorage.setItem('language', ${JSON.stringify(language)})`);

  for (const route of ROUTES) {
    await send('Runtime.discardConsoleEntries');
    exceptions = [];
    loggedErrors = [];

    await send('Page.navigate', { url: BASE + route });
    await wait(8000);
    const state = await evaluate(describe);

    const rendered = expectation(route)(state);
    const usable = state.navLinks > 0;
    if (!rendered || !usable || exceptions.length) failures++;
    console.log(`   ${route.padEnd(18)} text=${String(state.textLength).padStart(5)} `
      + `heading=${(state.heading || '(none)').slice(0, 22).padEnd(22)} `
      + `exceptions=${exceptions.length} loggedErrors=${loggedErrors.length} `
      + `notice=${state.catalogueNotice ? 'yes' : 'no '} brokenImages=${state.brokenImages}`
      + (rendered && usable ? '' : '   <-- DID NOT RENDER'));
    for (const exception of exceptions.slice(0, 2)) console.log('        EXCEPTION: ' + exception);
  }
}

console.log(`\n${failures} page(s) failed to render or threw`);
console.log(failures === 0
  ? 'RESULT: PASS - the site is usable while the API is still the old one'
  : 'RESULT: FAIL');
ws.close();
process.exit(failures === 0 ? 0 : 1);
