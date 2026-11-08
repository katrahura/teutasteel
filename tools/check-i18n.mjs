/**
 * Checks the two translation tables against each other and against the templates.
 *
 * Run `npm run check:i18n` before a release. It fails on a missing key, an empty value, a different
 * set of interpolation placeholders, or a key used in a template that neither table defines.
 */
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const FILES = ['src/assets/i18n/al.json', 'src/assets/i18n/en.json'];
const problems = [];

const flatten = (value, prefix = '') => {
  const out = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      Object.assign(out, flatten(child, prefix ? `${prefix}.${key}` : key));
    }
  } else {
    out[prefix] = value;
  }
  return out;
};

const tables = {};
for (const file of FILES) {
  const language = file.includes('/en.') ? 'en' : 'al';
  tables[language] = flatten(JSON.parse(await fs.readFile(join(ROOT, file), 'utf8')));
}

const al = tables.al;
const en = tables.en;
for (const key of Object.keys(al)) if (!(key in en)) problems.push(`EN missing: ${key}`);
for (const key of Object.keys(en)) if (!(key in al)) problems.push(`AL missing: ${key}`);

const placeholders = (value) => {
  if (typeof value !== 'string') return [];
  return [
    ...(value.match(/\{\{\s*[^}]+\s*\}\}/g) || []),
    ...(value.match(/%[sd]/g) || []),
    ...(value.match(/\{[A-Za-z0-9_]+\}/g) || []),
  ].sort();
};

for (const key of Object.keys(al)) {
  if (!(key in en)) continue;
  if (typeof al[key] === 'string' && !al[key].trim()) problems.push(`AL empty: ${key}`);
  if (typeof en[key] === 'string' && !en[key].trim()) problems.push(`EN empty: ${key}`);
  const a = placeholders(al[key]);
  const e = placeholders(en[key]);
  if (JSON.stringify(a) !== JSON.stringify(e)) {
    problems.push(`placeholder mismatch: ${key} AL=${JSON.stringify(a)} EN=${JSON.stringify(e)}`);
  }
}

// Keys used literally in templates or components, excluding specs and dynamic prefixes.
const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (/\.(html|ts)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) {
      const text = await fs.readFile(path, 'utf8');
      for (const match of text.matchAll(/['"]([A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+)['"]/g)) {
        const key = match[1];
        if (key.startsWith('ADMIN.UNIT_') || key === 'CATEGORY.SOME_NEW_CATEGORY') continue;
        if (!(key in al)) problems.push(`used but not translated: ${key} (${path})`);
      }
    }
  }
};
await walk(join(ROOT, 'src/app'));

if (problems.length) {
  console.error(`Translation check failed with ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Translation check passed: ${Object.keys(al).length} keys in both languages, no missing values or placeholders.`);
}
