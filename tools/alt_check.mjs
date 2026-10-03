/**
 * Finds images without alt text (WCAG 1.1.1), across the pages and both widths.
 * Run with: node --experimental-websocket cdp_alt_check.mjs
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

const inspect = `(() => {
  const out = { missing: [], empty: 0, total: 0 };
  for (const image of document.querySelectorAll('img')) {
    const rect = image.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    out.total++;
    const alt = image.getAttribute('alt');
    if (alt === null) {
      out.missing.push({
        src: (image.getAttribute('src') || '').split('/').pop().slice(0, 30),
        cls: (image.getAttribute('class') || '').split(' ').slice(0, 2).join('.').slice(0, 30),
      });
    } else if (alt.trim() === '') {
      out.empty++;
    }
  }
  // the same question for elements that carry a background image
  return out;
})()`;

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url: 'about:blank' });
await wait(1200);

let problems = 0;
let unloaded = 0;
for (const route of ['/', '/products', '/about', '/contact', '/login']) {
  const navigation = await send('Page.navigate', { url: BASE + route });
  await wait(8000);
  // A failed navigation leaves the previous document in place, and a page that is not there
  // has no images to complain about, so "0 missing" would mean nothing was checked.
  const failure = navigation.result && navigation.result.errorText;
  if (failure) {
    problems++;
    unloaded++;
    console.log(`\n===== ${route} — COULD NOT LOAD (${failure}) =====`);
    continue;
  }
  // open a category so its products are on screen too
  if (route === '/products') {
    await evaluate(`(() => {
      const buttons = [...document.querySelectorAll('button, a')].filter((el) => /shiko|view/i.test(el.textContent || ''));
      if (buttons.length) buttons[0].click();
    })()`);
    await wait(4000);
  }
  const result = await evaluate(inspect);
  console.log(`\n===== ${route} — ${result.total} visible image(s) =====`);
  console.log(`   without an alt attribute: ${result.missing.length}   empty alt (decorative): ${result.empty}`);
  for (const image of result.missing) {
    problems++;
    console.log(`      ${image.src || '(no src)'}  class=${image.cls}`);
  }
}
console.log(`\nSUMMARY: ${problems} image(s) with no alt attribute`
            + (unloaded ? `, ${unloaded} page(s) that did not load` : ''));
console.log(problems === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');
ws.close();
process.exit(problems === 0 ? 0 : 1);
