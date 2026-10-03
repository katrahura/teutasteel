/**
 * Measures the contrast of the two elements added in rounds 59 and 66 - the "inactive"
 * badge and the empty-category message. The page audit does not reach them: the badge only
 * appears for a signed-in user looking at a switched-off category, and the message only
 * after selecting one with nothing in it.
 */
const DEBUG = 'http://127.0.0.1:9222';
const BASE = process.env.SWEEP_BASE || 'http://localhost:4200';
const TOKEN = process.env.SWEEP_TOKEN || '';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(DEBUG + '/json/list');
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* not up */ }
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

// the ratio, computed the way WCAG defines it
const MEASURE = `(selector) => {
  const parse = (value) => {
    const m = value.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((n) => parseFloat(n));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const luminance = ({ r, g, b }) => {
    const channel = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const element = document.querySelector(selector);
  if (!element) return { found: false };
  const style = getComputedStyle(element);
  const foreground = parse(style.color);
  let node = element, background = null;
  while (node && !background) {
    const candidate = parse(getComputedStyle(node).backgroundColor);
    if (candidate && candidate.a > 0.5) background = candidate;
    node = node.parentElement;
  }
  background = background || { r: 255, g: 255, b: 255, a: 1 };
  const l1 = luminance(foreground), l2 = luminance(background);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return {
    found: true,
    text: (element.textContent || '').trim().slice(0, 40),
    size: parseFloat(style.fontSize),
    bold: parseInt(style.fontWeight, 10) >= 700,
    color: style.color,
    background: 'rgb(' + background.r + ', ' + background.g + ', ' + background.b + ')',
    ratio: Math.round(ratio * 100) / 100,
  };
}`;

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url: BASE + '/' });
await wait(7000);
await evaluate(`localStorage.setItem('language', 'en')`);
if (TOKEN) await evaluate(`localStorage.setItem('token', ${JSON.stringify(TOKEN)})`);

await send('Page.navigate', { url: BASE + '/products' });
await wait(10000);

const results = [];
const measure = async (label, selector, context) => {
  const value = await evaluate(`(${MEASURE})(${JSON.stringify(selector)})`);
  if (!value.found) {
    console.log(`   [SKIP] ${label} - not on the page (${context})`);
    return false;
  }
  // WCAG AA: 3:1 for large text (>=24px, or >=18.66px bold), 4.5:1 otherwise
  const large = value.size >= 24 || (value.bold && value.size >= 18.66);
  const needed = large ? 3 : 4.5;
  const ok = value.ratio >= needed;
  results.push(ok);
  console.log(`   [${ok ? 'PASS' : 'FAIL'}] ${label}: "${value.text}" `
    + `ratio ${value.ratio}:1 (needs ${needed}:1, ${value.size}px) - ${value.color} on ${value.background}`);
  return ok;
};

console.log('=== the two elements added in rounds 59 and 66 ===');
await measure('the "inactive" badge', '#productsSection .badge, .badge', 'a category switched off');

// open a category with nothing in it
await evaluate(`(() => {
  const card = [...document.querySelectorAll('.col-12')]
    .find((el) => (el.innerText || '').includes('Profiles'));
  const view = card ? [...card.querySelectorAll('button')]
    .find((el) => /View Products|Shiko Produktet/i.test(el.textContent || '')) : null;
  if (view) view.click();
  return !!view;
})()`);
await wait(6000);
await measure('the empty-category message', '.products-pagination-container p.text-muted',
              'a category with no products');

console.log(`\n${results.filter((ok) => !ok).length} failure(s) out of ${results.length} measured`);
ws.close();
process.exit(results.length && results.every(Boolean) ? 0 : 1);
