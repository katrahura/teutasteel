/**
 * Paging through a real category.
 *
 * The catalogue has categories with hundreds of products - "Laser sheets" has 556, which is 70
 * pages of eight - and nothing had ever been paged through. This walks it: open the category,
 * check the page against what the API says is on it, go forward and back, and report anything
 * the browser complained about.
 *
 * The API is the reference, not the markup: it says which eight product codes belong on page
 * one, and this refuses to pass unless those eight are the ones on screen.
 */
const DEBUG = 'http://127.0.0.1:9222';
const BASE = process.env.SWEEP_BASE || 'http://localhost:4200';
const API = process.env.SWEEP_API || 'http://127.0.0.1:5000';
const CATEGORY = process.env.SWEEP_CATEGORY || 'Laser sheets';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const say = (message) => console.log('   ' + message);
const fail = (message) => { failures++; console.log('   FAIL ' + message); };
const pass = (message) => console.log('   ok   ' + message);

// --- the API's own answer for the pages we are about to look at -----------------
async function pageFromApi(page) {
  const res = await fetch(`${API}/category/59?page=${page}&per_page=8&lang=en`);
  if (!res.ok) throw new Error(`the API answered ${res.status} for page ${page}`);
  const body = await res.json();
  return {
    codes: body.products.map((p) => String(p.code).trim()).filter(Boolean),
    total: body.pagination.total_items,
    totalPages: body.pagination.total_pages,
  };
}

async function findTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const list = await (await fetch(DEBUG + '/json/list')).json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await wait(500);
  }
  throw new Error('no CDP target - is Chrome running with --remote-debugging-port=9222?');
}

const ws = new WebSocket(await findTarget());
let seq = 0;
const pending = new Map();
let consoleErrors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args.map((a) => String(a.value ?? a.description ?? '')).join(' ').slice(0, 140));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    consoleErrors.push(String((d.exception && d.exception.description) || d.text).slice(0, 140));
  }
  const r = pending.get(m.id);
  if (r) { pending.delete(m.id); r(m); }
});
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (reply.result && reply.result.exceptionDetails) throw new Error(JSON.stringify(reply.result.exceptionDetails));
  return reply.result && reply.result.result ? reply.result.result.value : undefined;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });

// --- open the site and the category --------------------------------------------
console.log(`\n===== ${CATEGORY}, paged =====`);
const navigation = await send('Page.navigate', { url: BASE + '/products' });
await wait(9000);
const navFailure = navigation.result && navigation.result.errorText;
if (navFailure) { fail(`the products page did not load (${navFailure})`); ws.close(); process.exit(1); }

const opened = await evaluate(`(() => {
  const clickIf = (text) => {
    const el = [...document.querySelectorAll('button, a, .parent-toggle, span')]
      .find((e) => (e.textContent || '').trim().toLowerCase() === text.toLowerCase()
                || (e.textContent || '').trim().toLowerCase().includes(text.toLowerCase()));
    if (el) { el.click(); return true; }
    return false;
  };
  const named = (text) => {
    // the row, list item or card that mentions this category
    const holder = [...document.querySelectorAll('li, .card, .list-group-item, tr, div')]
      .filter((e) => (e.textContent || '').includes(text) && e.querySelectorAll('button').length);
    if (!holder.length) return false;
    const innermost = holder[holder.length - 1];
    const button = [...innermost.querySelectorAll('button')].find((b) => /view products|shiko/i.test(b.textContent || ''));
    if (button) { button.click(); return true; }
    return false;
  };
  const expanded = clickIf('Decorative metal');
  return { expanded };
})()`);
say(`expanded the parent group: ${opened.expanded}`);
await wait(3000);

const selected = await evaluate(`(() => {
  const holders = [...document.querySelectorAll('li, .card, .list-group-item, tr, div')]
    .filter((e) => (e.textContent || '').includes(${JSON.stringify(CATEGORY)}) && e.querySelectorAll('button').length);
  if (!holders.length) return { clicked: false, reason: 'no row for that category' };
  const innermost = holders[holders.length - 1];
  const button = [...innermost.querySelectorAll('button')].find((b) => /view products|shiko/i.test(b.textContent || ''));
  if (!button) return { clicked: false, reason: 'no View Products button in the row' };
  button.click();
  return { clicked: true, row: innermost.textContent.trim().slice(0, 60) };
})()`);
say(`opened the category: ${selected.clicked ? selected.row : selected.reason}`);
if (!selected.clicked) fail('could not open the category, so nothing was paged');
await wait(7000);

// --- what the API says should be on screen -------------------------------------
let page1, page2;
try {
  page1 = await pageFromApi(1);
  page2 = await pageFromApi(2);
  say(`the API says: ${page1.total} products, ${page1.totalPages} pages of ${page1.codes.length}`);
} catch (error) {
  fail(String(error.message));
}

const readScreen = `(() => {
  const text = document.body.innerText;
  const pager = (document.querySelector('.pagination-info') || {}).textContent || '';
  return {
    text,
    pager: pager.replace(/\\s+/g, ' ').trim(),
    next: !![...document.querySelectorAll('button, a')].find((b) => /next|ardhshëm|tjeter/i.test(b.textContent || '')),
    prev: !![...document.querySelectorAll('button, a')].find((b) => /previous|kthehu|mëparshëm/i.test(b.textContent || '')),
  };
})()`;

if (page1) {
  const screen = await evaluate(readScreen);
  const missing = page1.codes.filter((code) => !screen.text.includes(code));
  if (!screen.text.includes(page1.codes[0])) fail(`page 1 does not show the first product the API returned (${page1.codes[0]})`);
  else pass(`page 1 shows the API's first product, ${page1.codes[0]}`);
  if (missing.length) fail(`page 1 is missing ${missing.length} of the API's 8 codes: ${missing.slice(0, 3).join(', ')}`);
  else pass(`all ${page1.codes.length} of the API's page-1 codes are on screen`);
  const expectedPager = `1`;
  if (screen.pager && !new RegExp(`\\b1\\b`).test(screen.pager)) fail(`the pager does not say page 1: "${screen.pager}"`);
  else if (screen.pager) pass(`the pager reads "${screen.pager}"`);
  else fail('there is no pager on the page at all');
  if (page1.totalPages > 1 && !screen.pager.includes(String(page1.totalPages))) {
    fail(`the pager does not mention the API's ${page1.totalPages} pages: "${screen.pager}"`);
  } else if (screen.pager) pass(`it agrees with the API on the number of pages`);
  if (!screen.next) fail('there is no Next control to page with');

  // --- forward ---
  if (screen.next && page2) {
    consoleErrors = [];
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('button, a')].find((b) => /next|ardhshëm|tjeter/i.test(b.textContent || ''));
      if (b) b.click();
    })()`);
    await wait(6000);
    const after = await evaluate(readScreen);
    const missingNext = page2.codes.filter((code) => !after.text.includes(code));
    if (after.pager && !/\b2\b/.test(after.pager)) fail(`after Next the pager says "${after.pager}"`);
    else pass(`after Next the pager reads "${after.pager}"`);
    if (missingNext.length) fail(`page 2 is missing ${missingNext.length} of the API's 8 codes: ${missingNext.slice(0, 3).join(', ')}`);
    else pass(`all ${page2.codes.length} of the API's page-2 codes are on screen`);
    const leaked = page1.codes.filter((code) => !page2.codes.includes(code) && after.text.includes(code));
    if (leaked.length) fail(`page 2 still shows ${leaked.length} product(s) from page 1: ${leaked.slice(0, 3).join(', ')}`);
    else pass('page 1 products are gone from page 2');

    // --- back ---
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('button, a')].find((b) => /previous|kthehu|mëparshëm/i.test(b.textContent || ''));
      if (b) b.click();
    })()`);
    await wait(6000);
    const back = await evaluate(readScreen);
    const missingBack = page1.codes.filter((code) => !back.text.includes(code));
    if (back.pager && !/\b1\b/.test(back.pager)) fail(`after Previous the pager says "${back.pager}"`);
    else pass(`after Previous the pager reads "${back.pager}"`);
    if (missingBack.length) fail(`going back lost ${missingBack.length} of page 1's codes`);
    else pass('going back returns page 1 exactly');
  }

  const noise = consoleErrors.filter((e) => !/favicon|net::ERR_/i.test(e));
  if (noise.length) { fail(`${noise.length} console error(s): ${noise.slice(0, 2).join(' | ')}`); }
  else pass('no console errors');
}

console.log(`\nSUMMARY: ${failures} problem(s) paging "${CATEGORY}"`);
console.log(failures === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');
ws.close();
process.exit(failures === 0 ? 0 : 1);
