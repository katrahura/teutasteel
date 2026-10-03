/**
 * Checks the icons: each visible one has a mask image, draws something, and different
 * icons draw different pictures. Written after a subset font turned out to contain
 * nothing but .notdef, which nothing else would have noticed.
 *
 * Run with: node --experimental-websocket tools/icon_check.mjs
 */
const DEBUG = 'http://127.0.0.1:9222';
const BASE = process.env.SWEEP_BASE || 'http://127.0.0.1:4321';
const OUT_DIR = process.env.ICON_OUT || 'C:\\Users\\User\\AppData\\Local\\Temp';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const { writeFileSync } = await import('node:fs');
const { createHash } = await import('node:crypto');

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

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });

let failures = 0;
const seen = new Map();

for (const route of ['/contact', '/']) {
  await send('Page.navigate', { url: BASE + route });
  await wait(8000);

  const icons = await evaluate(`(() => {
    const out = [];
    for (const element of document.querySelectorAll('i[class*="bi-"]')) {
      const style = getComputedStyle(element, '::before');
      const rect = element.getBoundingClientRect();
      const name = [...element.classList].find((c) => c.startsWith('bi-')) || '?';
      const mask = style.maskImage !== 'none' ? style.maskImage : style.webkitMaskImage;
      const hidden = rect.width === 0 || rect.height === 0
        || getComputedStyle(element).visibility === 'hidden';
      out.push({
        name,
        mask: mask && mask !== 'none',
        size: Math.round(rect.width) + 'x' + Math.round(rect.height),
        rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
        visible: !hidden,
      });
    }
    return out;
  })()`);

  console.log(`\n===== ${route} — ${icons.length} icon element(s) =====`);
  for (const icon of icons) {
    // icons inside the closed mobile drawer have no box yet by design
    if (!icon.visible) { console.log(`   skip ${icon.name}: hidden right now`); continue; }
    if (!icon.mask) { failures++; console.log(`   FAIL ${icon.name}: no mask image`); continue; }
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { ...icon.rect, scale: 2 },
    });
    if (!shot.result || !shot.result.data) { failures++; console.log(`   FAIL ${icon.name}: no screenshot`); continue; }
    const buffer = Buffer.from(shot.result.data, 'base64');
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
    const file = `${OUT_DIR}\\icon-${icon.name}.png`;
    writeFileSync(file, buffer);
    const first = seen.get(icon.name);
    if (first === undefined) seen.set(icon.name, hash);
    else if (first !== hash) { failures++; console.log(`   FAIL ${icon.name}: differs between pages (${first} vs ${hash})`); continue; }
    console.log(`   PASS ${icon.name.padEnd(20)} box ${icon.size.padEnd(8)} hash ${hash}`);
  }
}

const hashes = [...seen.values()];
const distinct = new Set(hashes).size === hashes.length;
console.log(`\n   ${distinct ? 'PASS' : 'FAIL'}  the ${hashes.length} distinct icon names draw distinct images`);
if (!distinct) failures++;

console.log(failures === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failures})`);
ws.close();
process.exit(failures === 0 ? 0 : 1);
