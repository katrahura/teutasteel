/**
 * Drives the admin forms as a person would: create a category, create a product inside
 * it, edit both, and check every step against the API.
 *
 * Run with: node --experimental-websocket tools/admin_form_check.mjs
 *
 * SWEEP_BASE is the site (the dev server, which talks to the local API), SWEEP_API the
 * API itself, SWEEP_TOKEN a valid admin token. The names it creates are timestamped, so
 * running it twice does not leave two rows with the same title to confuse the next run.
 */
const DEBUG = 'http://127.0.0.1:9222';
const BASE = process.env.SWEEP_BASE || 'http://localhost:4200';
const API = process.env.SWEEP_API || 'http://127.0.0.1:5000';
const TOKEN = process.env.SWEEP_TOKEN || '';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

if (!TOKEN) {
  console.log('set SWEEP_TOKEN');
  process.exit(1);
}

const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const CATEGORY_NAME = `UI Flow ${stamp}`;
const PRODUCT_CODE = `UI-${stamp}`;

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
    errors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 150));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const details = m.params.exceptionDetails;
    errors.push('EXCEPTION ' + String((details.exception && details.exception.description) || details.text).slice(0, 150));
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

const openModal = (pattern) => `(() => {
  const found = [...document.querySelectorAll('button')]
    .find((b) => new RegExp(${JSON.stringify(pattern)}, 'i').test(b.textContent || '') && !b.closest('.modal.show'));
  if (!found) return 'trigger not found';
  found.click();
  return 'clicked ' + found.textContent.trim().slice(0, 26);
})()`;

/** opens the edit dialog on the card whose text contains the given marker */
const editCard = (marker, pattern) => `(() => {
  const card = [...document.querySelectorAll('.product-card, .card')]
    .find((c) => (c.innerText || '').includes(${JSON.stringify(marker)}));
  if (!card) return 'card not found';
  const button = [...card.querySelectorAll('button')]
    .find((b) => new RegExp(${JSON.stringify(pattern)}, 'i').test(b.textContent || ''));
  if (!button) return 'edit button not found';
  button.click();
  return 'clicked ' + (button.textContent || '').trim().slice(0, 20);
})()`;

const submit = (pattern) => `(() => {
  const modal = document.querySelector('.modal.show');
  if (!modal) return 'no open modal';
  const buttons = [...modal.querySelectorAll('button, input[type=submit]')]
    .filter((b) => !b.classList.contains('btn-close'));
  const found = buttons.find((b) => new RegExp(${JSON.stringify(pattern)}, 'i').test(b.textContent || b.value || ''));
  if (!found) return 'no button; modal has: ' + buttons.map((b) => (b.textContent || '').trim()).join(' | ');
  const wasDisabled = found.disabled;
  found.click();
  return (wasDisabled ? 'DISABLED, clicked anyway: ' : 'clicked ') + (found.textContent || '').trim().slice(0, 24);
})()`;

const fill = (id, value) => `(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  if (!el) return 'missing ' + ${JSON.stringify(id)};
  el.value = ${JSON.stringify(String(value))};
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`;

const modalState = `(() => {
  const modal = document.querySelector('.modal.show');
  if (!modal) return { open: false };
  return {
    open: true,
    title: (modal.querySelector('.modal-title') || modal).textContent.trim().slice(0, 40),
    invalid: [...modal.querySelectorAll('input, select, textarea')]
      .filter((el) => el.classList.contains('ng-invalid'))
      .map((el) => (el.id || el.name) + (el.required ? ' (required)' : '')),
  };
})()`;

async function api(path) {
  const response = await fetch(API + path, { headers: { Authorization: `Bearer ${TOKEN}` } });
  let body = null;
  try { body = await response.json(); } catch { /* no body */ }
  return { status: response.status, body };
}

const checks = [];
const record = (label, ok, detail = '') => {
  checks.push({ label, ok, detail });
  console.log(`   [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? '  ' + detail : ''}`);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url: BASE + '/' });
await wait(7000);
await evaluate(`localStorage.setItem('token', ${JSON.stringify(TOKEN)})`);
await evaluate(`localStorage.setItem('language', 'en')`);
await send('Runtime.discardConsoleEntries');
errors = [];

await send('Page.navigate', { url: BASE + '/products' });
await wait(11000);

// ---- 1. create a category through the form --------------------------------------
console.log(`\n=== 1. create the category "${CATEGORY_NAME}" ===`);
await evaluate(openModal('Create New Category|Krijo Kategori'));
await wait(2500);
console.log('   modal:', JSON.stringify(await evaluate(modalState)));
for (const [id, value] of [['categoryTitle', CATEGORY_NAME], ['imageFileName', 'ui-flow.jpg'],
                           ['altText', 'ui flow'], ['thumbnailPath', 'https://cdn/th.jpg'],
                           ['originalPath', 'https://cdn/or.jpg']]) {
  await evaluate(fill(id, value));
}
console.log('   submit:', await evaluate(submit('Create|Save|Krijo|Ruaj')));
await wait(4500);
console.log('   after :', JSON.stringify(await evaluate(modalState)));

const top = await api('/category/top');
const category = (top.body || []).find((item) => item.title === CATEGORY_NAME);
record('the category exists', !!category, category ? `id ${category.id}` : '');

// ---- 2. create a product inside it ----------------------------------------------
console.log(`\n=== 2. create the product ${PRODUCT_CODE} in it ===`);
if (category) {
  // Scope the click to the new category's own card. Clicking the first "View Products"
  // on the page selected a *child* of another category instead, so the product was
  // created somewhere else - the assertions below now check where it landed.
  console.log('   ' + await evaluate(`(() => {
    const card = [...document.querySelectorAll('.col-12')]
      .find((el) => el.querySelector('.parent-toggle') && (el.innerText || '').includes(${JSON.stringify(CATEGORY_NAME)}));
    if (!card) return 'the new category has no card';
    const toggle = card.querySelector('.parent-toggle');
    if (toggle) toggle.click();
    return 'expanded ${CATEGORY_NAME}';
  })()`));
  await wait(3000);
  console.log('   ' + await evaluate(`(() => {
    const card = [...document.querySelectorAll('.col-12')]
      .find((el) => (el.innerText || '').includes(${JSON.stringify(CATEGORY_NAME)}));
    const view = card ? [...card.querySelectorAll('button, a')]
      .find((el) => /View Products|Shiko Produktet/i.test(el.textContent || '')) : null;
    if (!view) return 'no View Products button in the new category';
    view.click();
    return 'clicked View Products';
  })()`));
  await wait(4500);

  await evaluate(openModal('Create New Product|Krijo Produkt'));
  await wait(2500);
  console.log('   modal:', JSON.stringify(await evaluate(modalState)));
  for (const [id, value] of [
    ['productCode', PRODUCT_CODE], ['productCutType', '1'],
    ['translationSlug_0', PRODUCT_CODE.toLowerCase()], ['translationDescription_0', 'UI flow product'],
    ['translationContent_0', '<p>from the form</p>'],
    ['dimensionHeight_0', 100], ['dimensionWidth_0', 200], ['dimensionLength_0', 300],
  ]) {
    await evaluate(fill(id, value));
  }
  console.log('   submit:', await evaluate(submit('Create|Save|Krijo|Ruaj')));
  await wait(5000);
  console.log('   after :', JSON.stringify(await evaluate(modalState)));

  const all = await api('/product/');
  const product = (all.body || []).find((item) => item.code === PRODUCT_CODE);
  record('the product exists', !!product, product ? `id ${product.id}` : '');
  if (product) {
    // ProductSchema excludes category_id, so the only honest way to ask where it landed
    // is to list the category's products and look for it there.
    const listing = await api(`/category/${category.id}?per_page=50&lang=en`);
    const codes = ((listing.body || {}).products || []).map((item) => item.code);
    record('it is in the category it was created from', codes.includes(PRODUCT_CODE),
           codes.length ? codes.join(', ') : '(that category is empty)');
    record('its translation came through', product.description === 'UI flow product',
           JSON.stringify(product.description));
    record('its dimension came through', (product.dimensions || []).length === 1,
           `${(product.dimensions || []).length} dimension(s)`);
  }

  // ---- 3. edit the product through the form --------------------------------------
  console.log('\n=== 3. edit that product ===');
  const edited = PRODUCT_CODE + '-X';
  console.log('   ' + await evaluate(editCard(PRODUCT_CODE, 'Edit|Ndrysho')));
  await wait(3000);
  console.log('   modal:', JSON.stringify(await evaluate(modalState)));
  await evaluate(fill('editProductCode', edited));
  console.log('   submit:', await evaluate(submit('Save|Ruaj')));
  await wait(5000);
  console.log('   after :', JSON.stringify(await evaluate(modalState)));

  const after = await api('/product/');
  const changed = (after.body || []).find((item) => item.code === edited);
  record('the edit was saved', !!changed, changed ? `code now ${changed.code}` : 'not found');
}

// ---- 4. edit a category through the form ----------------------------------------
// Two cases: the category created above (which has an image), and a second one created
// with no image at all - the dialog binds to plain component fields rather than into
// selectedCategory.image_asset, so it should be safe, and this is how that gets checked
// rather than assumed.
console.log('\n=== 4. edit a category ===');
const noImageName = `${CATEGORY_NAME} noimg`;

async function editCategory(marker, newTitle) {
  await send('Page.navigate', { url: BASE + '/products' });
  await wait(9000);
  console.log('   ' + await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.parent-row, .category-group, .card, .group-card, div')]
      .filter((el) => el.querySelector('.edit-btn') && (el.innerText || '').includes(${JSON.stringify(marker)}));
    const row = rows[rows.length - 1];
    if (!row) return 'row with an edit button not found';
    const button = row.querySelector('.edit-btn');
    button.click();
    return 'clicked ' + (button.textContent || '').trim().slice(0, 20);
  })()`));
  await wait(3000);
  console.log('   modal:', JSON.stringify(await evaluate(modalState)));
  await evaluate(fill('editCategoryTitle', newTitle));
  console.log('   submit:', await evaluate(submit('Save|Ruaj')));
  await wait(4500);
  console.log('   after :', JSON.stringify(await evaluate(modalState)));

  const listed = await api('/category/top');
  return (listed.body || []).find((item) => item.title === newTitle);
}

// 4a: the category created in step 1, which has an image
const renamed = await editCategory(CATEGORY_NAME, `${CATEGORY_NAME} edited`);
record('editing a category with an image was saved', !!renamed,
       renamed ? `id ${renamed.id}` : 'title unchanged');

// 4b: a category with no image at all
await send('Page.navigate', { url: BASE + '/products' });
await wait(9000);
await evaluate(openModal('Create New Category|Krijo Kategori'));
await wait(2500);
await evaluate(fill('categoryTitle', noImageName));
console.log(`\n   --- created "${noImageName}" with no image ---`);
console.log('   submit:', await evaluate(submit('Create|Save|Krijo|Ruaj')));
await wait(4000);
const plain = (await api('/category/top')).body?.find((item) => item.title === noImageName);
record('a category with no image can be created', !!plain, plain ? `id ${plain.id}` : '');

if (plain) {
  const renamedPlain = await editCategory(noImageName, `${noImageName} edited`);
  record('editing a category with no image was saved', !!renamedPlain,
         renamedPlain ? `id ${renamedPlain.id}` : 'title unchanged');
}

// ---- 5. tidy up, so the tool can be run again ------------------------------------
console.log('\n=== 5. removing what this run created ===');
for (const category of (await api('/category/top')).body || []) {
  if (category.title.startsWith(CATEGORY_NAME)) {
    const response = await fetch(`${API}/category/${category.id}`,
                                 { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
    console.log(`   deleted "${category.title}" -> ${response.status}`);
  }
}
for (const product of (await api('/product/')).body || []) {
  if ((product.code || '').startsWith('UI-')) {
    const response = await fetch(`${API}/product/delete/${product.id}`,
                                 { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
    console.log(`   deleted product ${product.code} -> ${response.status}`);
  }
}

console.log(`\nconsole errors: ${errors.length}`);
for (const error of errors.slice(0, 6)) console.log('   ' + error);
const failed = checks.filter((check) => !check.ok).length;
console.log(failed === 0 && errors.length === 0
  ? `\nRESULT: PASS (${checks.length} checks)`
  : `\nRESULT: FAIL (${failed} of ${checks.length} checks failed)`);
ws.close();
process.exit(0);
