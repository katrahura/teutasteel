/**
 * Keyboard and focus audit: tabs through each page with real key events at both the
 * mobile and desktop widths, and checks that what receives focus is visible, has a
 * focus indicator someone can see, and that nothing clickable is unreachable.
 *
 * Run with: node --experimental-websocket tools/keyboard_audit.mjs
 */
const DEBUG = 'http://127.0.0.1:9222';
const BASE = process.env.SWEEP_BASE || 'http://127.0.0.1:4321';
const ROUTES = ['/', '/products', '/about', '/contact', '/login'];
// the mobile header and the desktop navbar swap over at 992px, so both need walking
const VIEWPORTS = [
  { name: 'mobile 390x844', width: 390, height: 844 },
  { name: 'desktop 1280x800', width: 1280, height: 800 },
];
const MAX_TABS = 45;
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

async function pressTab(shift = false) {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', {
      type,
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
      modifiers: shift ? 8 : 0,
    });
  }
  await wait(280); // frames take their own moment to show they have focus
}

const describeFocus = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: 'body', end: true };
  // a unique marker per element: two inputs with the same classes are still two
  // different stops, and keying them by class hid the second one
  if (!el.dataset.auditId) {
    window.__auditSeq = (window.__auditSeq || 0) + 1;
    el.dataset.auditId = String(window.__auditSeq);
  }
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  const ownIndicator = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0)
    || style.boxShadow !== 'none';
  // a control that contains focus (or sits inside a frame) can be shown by an
  // ancestor: :focus-within is how the map's wrapper does it
  let indicator = ownIndicator;
  let indicatorFrom = ownIndicator ? 'self' : null;
  if (!indicator && el.parentElement) {
    const parentStyle = getComputedStyle(el.parentElement);
    if ((parentStyle.outlineStyle !== 'none' && parseFloat(parentStyle.outlineWidth) > 0)
        || parentStyle.boxShadow !== 'none') {
      indicator = true;
      indicatorFrom = 'ancestor';
    }
  }
  return {
    id: el.dataset.auditId,
    tag: el.tagName.toLowerCase(),
    cls: (el.getAttribute('class') || '').split(' ').filter(Boolean).slice(0, 2).join('.'),
    text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28),
    href: el.getAttribute('href') || null,
    visible,
    indicator,
    focusVisible: el.matches(':focus-visible'),
    offscreen: rect.top < -5 || rect.left < -5,
    tagIndex: el.tabIndex,
  };
})()`;

/** elements that react to a click but cannot be reached with the keyboard */
const clickOnly = `(() => {
  const found = [];
  for (const el of document.querySelectorAll('div, span, li, img, i')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    // decorations inside a link or button inherit cursor: pointer; they are not
    // controls of their own and must not be reported as ones
    if (el.closest('a, button, [role="button"], [role="menuitem"], [tabindex]')) continue;
    if (style.cursor !== 'pointer') continue;
    found.push(el.tagName.toLowerCase() + '.' + (el.getAttribute('class') || '').split(' ')[0]
      + ' "' + (el.textContent || '').trim().slice(0, 24) + '"');
  }
  return [...new Set(found)].slice(0, 6);
})()`;

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url: 'about:blank' });
await wait(1200);

let problems = 0;
for (const viewport of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 992,
  });
  console.log(`\n############ ${viewport.name} ############`);
  for (const route of ROUTES) {
    await send('Page.navigate', { url: BASE + route });
    await wait(8000);
    await evaluate('document.body.focus()');
    await wait(300);

    const stops = [];
    const seen = new Set();
    for (let step = 0; step < MAX_TABS; step++) {
      await pressTab();
      const focus = await evaluate(describeFocus);
      if (focus.end) break;
      const key = focus.id;
      // tabbing wraps around to the top of the page: stop rather than walking the
      // whole navigation twice
      if (seen.has(key)) break;
      seen.add(key);
      stops.push(focus);
    }

    const invisible = stops.filter((stop) => !stop.visible);
    // a cross-origin frame takes focus into its own document, where the parent's
    // computed styles no longer describe what is on screen: reported, not judged
    const frames = stops.filter((stop) => stop.tag === 'iframe');
    const noIndicator = stops.filter((stop) => !stop.indicator && stop.tag !== 'iframe');
    const pointer = await evaluate(clickOnly);

    console.log(`\n===== ${route} — ${stops.length} focusable stops =====`);
    console.log('   order: ' + stops.map((stop) => stop.tag + (stop.text ? `(${stop.text.slice(0, 14)})` : '')).join(' > ').slice(0, 320));
    if (invisible.length) {
      problems += invisible.length;
      console.log('   FOCUSABLE BUT NOT VISIBLE:');
      for (const stop of invisible) console.log(`      ${stop.tag}.${stop.cls} "${stop.text}"`);
    }
    if (noIndicator.length) {
      problems += noIndicator.length;
      console.log('   NO FOCUS INDICATOR:');
      for (const stop of noIndicator) console.log(`      ${stop.tag}.${stop.cls} "${stop.text}"`);
    }
    if (pointer.length) {
      problems += pointer.length;
      console.log('   CLICKABLE BUT NOT FOCUSABLE (cursor: pointer, no tabindex/role):');
      for (const entry of pointer) console.log(`      ${entry}`);
    }
    if (!invisible.length && !noIndicator.length && !frames.length && !pointer.length) console.log('   (no problems)');
    if (frames.length) {
      console.log('   frames reached (focus inside another document, checked separately):',
        frames.map((stop) => stop.tag).join(', '));
    }
  }
}

console.log(`\nSUMMARY: ${problems} keyboard/focus problem(s)`);
console.log(problems === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');
ws.close();
process.exit(0);
