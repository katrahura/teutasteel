/**
 * Colour-contrast audit (WCAG 2.1 AA) across the public pages.
 *
 * For every element that holds its own visible text it finds the effective
 * background - walking up until something opaque, and working out the colour a
 * gradient actually has under that text by projecting it onto the gradient line -
 * then computes the contrast ratio and compares it with the threshold for that text
 * size (4.5:1, or 3:1 for large text). Text over a photograph is reported rather
 * than guessed at.
 *
 * Needs Chrome with remote debugging, and something serving the build:
 *
 *   python -m http.server 4321 --bind 127.0.0.1   (from dist/teutasteel-website/browser)
 *   chrome --headless=new --remote-debugging-port=9222 --user-data-dir=<temp> about:blank
 *   node --experimental-websocket tools/contrast_audit.mjs
 *
 * SWEEP_BASE overrides the address being audited. A run should end with
 * "0 distinct contrast failure(s)".
 */
const DEBUG = 'http://127.0.0.1:9222';
const BASE = process.env.SWEEP_BASE || 'http://127.0.0.1:4321';
const ROUTES = ['/', '/products', '/about', '/contact', '/login'];
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

const audit = `(() => {
  const parse = (value) => {
    const match = String(value).match(/rgba?\\(([^)]+)\\)/);
    if (!match) return null;
    const parts = match[1].split(',').map((p) => parseFloat(p.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const luminance = (colour) => {
    const channel = (value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
  };
  const ratio = (a, b) => {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  const describe = (element) => {
    const name = element.tagName.toLowerCase();
    const cls = (element.getAttribute('class') || '').split(' ').filter(Boolean).slice(0, 2).join('.');
    return name + (cls ? '.' + cls : '');
  };

  const findings = [];
  const photos = new Set();

  for (const element of document.querySelectorAll('body *')) {
    // only elements that own text, and only visible ones
    const ownText = [...element.childNodes]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent.trim())
      .join(' ')
      .trim();
    if (!ownText) continue;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;

    const foreground = parse(style.color);
    if (!foreground || foreground.a === 0) continue;

    // effective background: first ancestor that is not fully transparent, and if it
    // paints a gradient, every colour stop in it (the worst one decides)
    let node = element;
    let background = null;
    let stops = [];
    let photo = null;
    let gradientAngle = 180;
    let gradientRect = null;
    while (node && node !== document.documentElement.parentElement) {
      const nodeStyle = getComputedStyle(node);
      const image = nodeStyle.backgroundImage;
      if (image && image !== 'none' && !stops.length) {
        const found = [...image.matchAll(/rgba?\\(([^)]+)\\)/g)].map((match) => parse(match[0])).filter(Boolean);
        const opaque = found.filter((colour) => colour.a >= 1);
        // the innermost background that actually paints decides what is behind the
        // text; an outer one only matters if this one is see-through
        if (found.length >= 2 && image.includes('gradient') && opaque.length >= 1) {
          stops = found;
          gradientAngle = parseFloat((image.match(/([\\d.]+)deg/) || [0, '180'])[1]);
          gradientRect = node.getBoundingClientRect();
        }
        const url = image.match(/url\\(["']?([^"')]+)/);
        if (url) photo = url[1].split('/').pop();
      }
      const candidate = parse(nodeStyle.backgroundColor);
      if (candidate && candidate.a > 0) {
        background = candidate;
        break;
      }
      if (stops.length) break;
      node = node.parentElement;
    }
    // text over a photograph cannot be judged from the computed style: report it
    // separately instead of pretending it sits on the white page behind
    if (photo && !background) {
      photos.add(\`\${describe(element)} over \${photo}\`);
      continue;
    }
    if (!background) background = { r: 255, g: 255, b: 255, a: 1 };
    const base = background.a >= 1 ? background : over(background, { r: 255, g: 255, b: 255, a: 1 });

    const fontSize = parseFloat(style.fontSize);
    const weight = parseInt(style.fontWeight, 10) || 400;
    const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
    const required = large ? 3 : 4.5;

    // over a gradient, work out the colour actually under this text by projecting
    // its centre onto the gradient line, rather than blaming the darkest stop
    let candidates;
    if (stops.length >= 2) {
      const radians = (gradientAngle * Math.PI) / 180;
      const ux = Math.sin(radians);
      const uy = -Math.cos(radians);
      const length = Math.abs(gradientRect.width * ux) + Math.abs(gradientRect.height * uy) || 1;
      const elementRect = element.getBoundingClientRect();
      const dx = elementRect.left + elementRect.width / 2 - (gradientRect.left + gradientRect.width / 2);
      const dy = elementRect.top + elementRect.height / 2 - (gradientRect.top + gradientRect.height / 2);
      const t = Math.min(1, Math.max(0, 0.5 + (dx * ux + dy * uy) / length));
      const first = stops[0];
      const last = stops[stops.length - 1];
      const mixed = {
        r: first.r + (last.r - first.r) * t,
        g: first.g + (last.g - first.g) * t,
        b: first.b + (last.b - first.b) * t,
        a: first.a + (last.a - first.a) * t,
      };
      candidates = [over(mixed, base)];
    } else if (stops.length) {
      candidates = stops.map((stop) => over(stop, base));
    } else {
      candidates = [base];
    }
    let worst = null;
    for (const candidate of candidates) {
      const value = ratio(over(foreground, candidate), candidate);
      if (!worst || value < worst.value) worst = { value, background: candidate };
    }

    if (worst.value + 0.01 < required) {
      findings.push({
        element: describe(element),
        text: ownText.slice(0, 30),
        colour: style.color,
        background: stops.length
          ? \`gradient stop \${Math.round(worst.background.r)},\${Math.round(worst.background.g)},\${Math.round(worst.background.b)}\`
          : \`inherited \${Math.round(base.r)},\${Math.round(base.g)},\${Math.round(base.b)}\`,
        size: Math.round(fontSize) + 'px/' + weight,
        large,
        ratio: Math.round(worst.value * 100) / 100,
        required,
      });
    }
  }

  // keep one row per colour/size combination: the same failure repeated 20 times
  // is noise, not twenty problems
  const seen = new Set();
  const unique = [];
  for (const finding of findings) {
    const key = [finding.colour, finding.background, finding.size].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }
  return { findings: unique, total: findings.length, photos: [...photos] };
})()`;

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
// the CSS is content-hashed, but a cached HTML document would still point at the
// previous bundle
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url: 'about:blank' });
await wait(1200);

let failures = 0;
for (const route of ROUTES) {
  await send('Page.navigate', { url: BASE + route });
  await wait(7000);
  const result = await evaluate(audit);
  console.log(`\n${route} — ${result.total} failing text element(s), ${result.findings.length} distinct`);  for (const finding of result.findings) {
    failures++;
    console.log(`   ${finding.ratio} (needs ${finding.required})  ${finding.element}  ${finding.size}  ${finding.colour} on ${finding.background}`);
    console.log(`      "${finding.text}"`);
  }
  if (result.photos && result.photos.length) {
    console.log('   text over a photograph (needs a pixel check):', result.photos.join(', '));
  }
}

console.log(`\nSUMMARY: ${failures} distinct contrast failure(s)`);
console.log(failures === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');
ws.close();
process.exit(0);
