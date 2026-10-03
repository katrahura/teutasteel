/**
 * What the site looks like the day it goes up: categories exist, nothing is in them yet.
 *
 * That is the state after the parent_id migration until the owner has filled the catalogue,
 * and the state a customer sees the moment the site is live. A category with no products
 * used to render as blank space, which reads as "broken" rather than "not yet", and the
 * "No subcategories" line was hardcoded English.
 *
 * Run with the API pointed at a database with categories and no products:
 *   node --experimental-websocket tools/empty_catalogue_check.mjs
 */
const DEBUG = 'http://127.0.0.1:9222';
const BASE = process.env.SWEEP_BASE || 'http://localhost:4200';
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
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') {
    const details = m.params.exceptionDetails;
    exceptions.push(String((details.exception && details.exception.description) || details.text).slice(0, 120));
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

const failures = [];
const record = (label, ok, detail = '') => {
  if (!ok) failures.push(label);
  console.log(`   [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? '  ' + detail : ''}`);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url: BASE + '/' });
await wait(7000);
await evaluate(`localStorage.removeItem('token')`);
await evaluate(`localStorage.setItem('language', 'en')`);
await send('Runtime.discardConsoleEntries');
exceptions = [];

console.log('=== the home page, with categories but nothing in them ===');
await send('Page.navigate', { url: BASE + '/' });
await wait(9000);
const home = await evaluate(`(() => ({
  heading: (document.querySelector('h1') || {}).textContent?.trim().slice(0, 30) || null,
  text: document.body.innerText.replace(/\\s+/g, ' ').trim().length,
  cards: document.querySelectorAll('.products-section .card, .products-section img').length,
}))()`);
record('the home page renders', !!home.heading && home.text > 250, JSON.stringify(home));
record('no exception on the home page', exceptions.length === 0,
       exceptions.length ? exceptions[0] : '');

console.log('\n=== the products page, opening a category that is empty ===');
await send('Runtime.discardConsoleEntries');
exceptions = [];
await send('Page.navigate', { url: BASE + '/products' });
await wait(9000);
const groups = await evaluate(`document.querySelectorAll('.parent-toggle').length`);
console.log(`   categories listed: ${groups}`);
record('the categories are listed', groups > 0);

// "No subcategories" lives inside the collapsed children container, so the category has to
// be expanded before the text is on screen at all.
await evaluate(`(() => {
  const toggle = [...document.querySelectorAll('.parent-toggle')]
    .find((el) => (el.textContent || '').includes('Doors'));
  if (toggle) toggle.click();
  return !!toggle;
})()`);
await wait(2500);
const leaf = await evaluate(`/no subcategories|nuk ka nën-kategori/i.test(document.body.innerText)`);
record('the "no subcategories" line is translated, not hardcoded English', leaf,
       leaf ? '' : '(the line was not found even with the category expanded)');

await evaluate(`(() => {
  const card = [...document.querySelectorAll('.col-12')]
    .find((el) => (el.innerText || '').includes('Doors'));
  const view = card ? [...card.querySelectorAll('button')]
    .find((el) => /View Products|Shiko Produktet/i.test(el.textContent || '')) : null;
  if (view) view.click();
  return !!view;
})()`);
await wait(6000);
const empty = await evaluate(`(() => {
  const text = document.body.innerText.replace(/\\s+/g, ' ');
  return {
    says: /no products|nuk ka produkte/i.test(text),
    cards: document.querySelectorAll('.products-pagination-container .card').length,
  };
})()`);
record('an empty category says so instead of showing blank space', empty.says,
       `cards: ${empty.cards}`);
record('no exception on the products page', exceptions.length === 0,
       exceptions.length ? exceptions[0] : '');

console.log(`\n${failures.length} failure(s)`);
console.log(failures.length === 0
  ? 'RESULT: PASS - an empty catalogue reads as "nothing yet", in the right language'
  : 'RESULT: FAIL');
ws.close();
process.exit(failures.length === 0 ? 0 : 1);
