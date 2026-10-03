/**
 * What happens when the token in the browser is no longer any good.
 *
 * The interceptor used to attach it and nothing else, so an expired session left the app
 * believing it was signed in: the editing controls stayed on screen, every save answered
 * 401, and the page said "try again" - which retrying never fixed.
 *
 * Run with: node --experimental-websocket tools/session_check.mjs
 * Expects the dev server on 4200 and the API on 5000.
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
let loggedErrors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') {
    const details = m.params.exceptionDetails;
    exceptions.push(String((details.exception && details.exception.description) || details.text).slice(0, 120));
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    loggedErrors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 90));
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
await evaluate(`localStorage.setItem('language', 'en')`);
// a token that is well-formed enough to be sent, and rejected by the API
await evaluate(`localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiJ9.not-a-real-token.nope')`);
await send('Runtime.discardConsoleEntries');
exceptions = [];
loggedErrors = [];

console.log('=== a dead token, and a save ===');
await send('Page.navigate', { url: BASE + '/products' });
await wait(10000);
record('the page loads with a dead token', await evaluate(`!!document.querySelector('.parent-toggle, .card')`));

console.log('   opening the create-category dialog and submitting it');
await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')]
    .find((b) => /Create New Category|Krijo Kategori/i.test(b.textContent || ''));
  if (button) button.click();
  return !!button;
})()`);
await wait(2500);
await evaluate(`(() => {
  const title = document.getElementById('categoryTitle');
  if (title) {
    title.value = 'Expired session test';
    title.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const submit = [...document.querySelectorAll('.modal.show button')]
    .find((b) => /Create|Save|Krijo|Ruaj/i.test(b.textContent || ''));
  if (submit) submit.click();
  return true;
})()`);
await wait(6000);

const where = await evaluate(`location.pathname + location.search`);
const token = await evaluate(`localStorage.getItem('token')`);
const alertText = await evaluate(`(() => {
  const alert = document.querySelector('[role="alert"]');
  return alert ? alert.textContent.trim() : null;
})()`);

record('the app signed the user out', token === null, token === null ? 'token cleared' : `token still "${String(token).slice(0, 20)}"`);
record('and sent them to the login page', /\/login/.test(where), where);
record('with a message that says why', !!alertText && /expired|skadoi/i.test(alertText),
       alertText === null ? '(no message)' : JSON.stringify(alertText.slice(0, 60)));
record('no unhandled exception', exceptions.length === 0,
       exceptions.length ? exceptions[0] : `${loggedErrors.length} logged error(s)`);

console.log(`\n${failures.length} failure(s)`);
console.log(failures.length === 0
  ? 'RESULT: PASS - an unusable token signs the user out and says so'
  : 'RESULT: FAIL');
ws.close();
process.exit(failures.length === 0 ? 0 : 1);
