/**
 * Checks the mobile drawer's keyboard behaviour: closed it is out of the tab order,
 * opening moves focus into it, Escape closes it and returns focus to the hamburger.
 *
 * Run with: node --experimental-websocket tools/drawer_check.mjs
 */
const DEBUG = 'http://127.0.0.1:9222';
const BASE = process.env.SWEEP_BASE || 'http://127.0.0.1:4321';
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
const pageErrors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') {
    const details = m.params.exceptionDetails;
    pageErrors.push((details.exception && (details.exception.description || details.exception.value)) || details.text);
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

async function pressKey(key, code, keyCode) {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  }
  await wait(300);
}

const state = `(() => {
  const sheet = document.getElementById('mnav-sheet');
  const active = document.activeElement;
  return {
    open: sheet ? sheet.classList.contains('open') : null,
    inert: sheet ? sheet.hasAttribute('inert') : null,
    visibility: sheet ? getComputedStyle(sheet).visibility : null,
    insideSheet: sheet ? sheet.contains(active) : false,
    activeTag: active ? active.tagName.toLowerCase() : null,
    activeClass: active ? (active.getAttribute('class') || '').split(' ')[0] : null,
    activeLabel: active ? (active.getAttribute('aria-label') || '').slice(0, 22) : null,
  };
})()`;

async function pressTab() {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', {
      type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
    });
  }
  await wait(150);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: BASE + '/' });
await wait(9000);

const closed = await evaluate(state);
console.log('closed      :', JSON.stringify(closed));

// walk the tab order with the drawer closed: nothing inside it may be reached
await evaluate('document.body.focus()');
let reachedClosedDrawer = false;
for (let step = 0; step < 12; step++) {
  await pressTab();
  const focus = await evaluate(state);
  if (focus.insideSheet) reachedClosedDrawer = true;
}
console.log('closed, tabbing reached inside the drawer:', reachedClosedDrawer);

// open it by clicking the hamburger, as a visitor would
await evaluate(`document.querySelector('.mnav-toggle').click()`);
await wait(900);
const opened = await evaluate(state);
console.log('after click :', JSON.stringify(opened));

await pressKey('Escape', 'Escape', 27);
const afterEscape = await evaluate(state);
console.log('after Escape:', JSON.stringify(afterEscape));
console.log('page errors :', pageErrors.length, pageErrors.slice(0, 2).map((e) => String(e).slice(0, 90)));

const checks = [
  ['closed, the sheet is hidden', closed.visibility === 'hidden'],
  ['closed, the sheet is inert', closed.inert === true],
  ['closed, tabbing never reaches inside it', reachedClosedDrawer === false],
  ['opening sets the open class', opened.open === true],
  ['opening moves focus into the drawer', opened.activeClass === 'mnav-close' && opened.activeLabel.length > 0],
  ['open, its controls are reachable', opened.inert === false && opened.insideSheet === true],
  ['Escape closes the drawer', afterEscape.open === false],
  ['Escape returns focus to the hamburger', afterEscape.activeClass === 'mnav-toggle'],
];
console.log('\nSUMMARY');
let failed = 0;
for (const [label, ok] of checks) {
  if (!ok) failed++;
  console.log(`   [${ok ? 'PASS' : 'FAIL'}] ${label}`);
}
console.log(failed === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failed})`);
ws.close();
process.exit(failed === 0 ? 0 : 1);
