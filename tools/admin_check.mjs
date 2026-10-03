/**
 * Signs in by placing a token in localStorage (the way the login page does) and walks
 * the admin dashboard with a populated API: what renders, what breaks, and whether the
 * modals still open.
 *
 * Run with: node --experimental-websocket cdp_dashboard.mjs
 */
const DEBUG = 'http://127.0.0.1:9222';
const BASE = process.env.SWEEP_BASE || 'http://localhost:4200';
const TOKEN = process.env.SWEEP_TOKEN || '';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

if (!TOKEN) {
  console.log('set SWEEP_TOKEN to a valid token');
  process.exit(1);
}

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
let errors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 140));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const details = m.params.exceptionDetails;
    errors.push('EXCEPTION ' + String((details.exception && details.exception.description) || details.text).slice(0, 140));
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

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });

// the page has to exist before its localStorage can be written
await send('Page.navigate', { url: BASE + '/' });
await wait(7000);
await evaluate(`localStorage.setItem('token', ${JSON.stringify(TOKEN)})`);
await send('Runtime.discardConsoleEntries');
errors = [];

for (const route of ['/admin-dashboard', '/user-dashboard']) {
  await send('Page.navigate', { url: BASE + route });
  await wait(9000);

  const state = await evaluate(`(() => {
    const text = document.body.innerText.replace(/\\s+/g, ' ').trim();
    const tables = document.querySelectorAll('table').length;
    const rows = document.querySelectorAll('table tbody tr').length;
    const buttons = [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean);
    const headings = [...document.querySelectorAll('h1, h2, h3')].map((h) => h.textContent.trim()).slice(0, 8);
    return {
      url: location.pathname,
      length: text.length,
      excerpt: text.slice(0, 260),
      tables, rows,
      buttons: [...new Set(buttons)].slice(0, 14),
      headings,
    };
  })()`);

  console.log(`\n===== ${route} -> ${state.url} =====`);
  console.log(`   text length: ${state.length}  tables: ${state.tables}  rows: ${state.rows}`);
  console.log(`   headings: ${state.headings.join(' | ')}`);
  console.log(`   buttons: ${state.buttons.join(' | ')}`);
  console.log(`   text: ${state.excerpt}`);
  console.log(`   errors so far: ${errors.length}`);
}

// try the interactive parts that have bitten before: the modals
const modalTries = [
  ['create category', `(() => {
     const button = [...document.querySelectorAll('button')].find((b) => /shto|krijo|add|new/i.test(b.textContent || ''));
     if (!button) return 'no button';
     button.click();
     return button.textContent.trim().slice(0, 30);
   })()`],
  ['edit first row', `(() => {
     const button = document.querySelector('table tbody tr button, table tbody tr a');
     if (!button) return 'no row control';
     button.click();
     return button.textContent.trim().slice(0, 30) || '(icon)';
   })()`],
];

errors = [];
for (const [label, script] of modalTries) {
  const clicked = await evaluate(script);
  await wait(2500);
  const after = await evaluate(`(() => ({
    dialogs: document.querySelectorAll('.modal.show, [role="dialog"]').length,
    visible: [...document.querySelectorAll('.modal')].filter((m) => m.classList.contains('show')).length,
    text: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 120),
  }))()`);
  console.log(`\n${label}: clicked ${clicked} -> open modals: ${after.visible}`);
  console.log(`   page still readable: ${after.text.slice(0, 90)}`);
}

console.log(`\nconsole errors during the walk: ${errors.length}`);
for (const error of errors.slice(0, 4)) console.log('   ' + error);
ws.close();
process.exit(0);
