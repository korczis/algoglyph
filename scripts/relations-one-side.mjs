#!/usr/bin/env node
// Declare every link once. A pair of entries that each declare the other (catalogue --check refuses
// it, see twoSidedPairs in scripts/lib/catalogue.mjs) keeps one declaration by this rule:
//   1. a typed relation wins over a v1 `related` item: the related item is dropped;
//   2. two `related` items: the entry whose id sorts first keeps it, the other drops it;
//   3. two typed relations: left alone and reported (a person decides which one holds).
// The reverse of the kept link is derived, so every page shows the same links before and after.
// Re-run it after a merge instead of resolving a two-sided pair by hand. `--check` only reports.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { splitFrontMatter, twoSidedPairs } from './lib/catalogue.mjs';

const root = process.cwd();
const dir = join(root, 'catalogue', 'entries');
const check = process.argv.includes('--check');

const files = new Map();
for (const f of readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
  const text = readFileSync(join(dir, f), 'utf8');
  const fm = parse(splitFrontMatter(text)?.head ?? '') ?? {};
  files.set(fm.id, {
    file: join(dir, f), text,
    related: Array.isArray(fm.related) ? fm.related : [],
    typed: new Map((fm.relations ?? []).map((r) => [r.target, r.type])),
  });
}
const entries = [...files].map(([id, e]) => ({
  id, declared: [...e.related.map((t) => ({ type: 'related_to', target: t })),
    ...[...e.typed].map(([target, type]) => ({ type, target }))],
}));

/** Remove one item from an entry's `related:` list in its front matter text, keeping the rest. */
function dropRelated(text, target) {
  const { head, body } = splitFrontMatter(text);
  const m = /\nrelated:((?:\n {2}- [^\n]+)+)/.exec(`\n${head}`);
  if (!m) throw new Error(`no related list holds ${target}`);
  const items = m[1].split('\n').slice(1);
  const kept = items.filter((l) => l.trim() !== `- ${target}`);
  if (kept.length !== items.length - 1) throw new Error(`related lists ${target} other than once`);
  const block = kept.length ? `\nrelated:\n${kept.join('\n')}` : '';
  const next = `\n${head}`.replace(m[0], block).slice(1);
  return `---\n${next}\n---\n${body}`;
}

const pairs = twoSidedPairs(entries);
const changed = [];
const undecided = [];
for (const [a, b] of pairs) {
  const A = files.get(a);
  const B = files.get(b);
  const aTyped = A.typed.has(b);
  const bTyped = B.typed.has(a);
  let drop;
  if (aTyped && bTyped) { undecided.push(`${a} ${A.typed.get(b)} ${b} / ${b} ${B.typed.get(a)} ${a}`); continue; }
  if (aTyped) drop = [b, a];
  else if (bTyped) drop = [a, b];
  else drop = [b, a]; // both related: the id sorting first (a) keeps it
  const [from, target] = drop;
  const e = files.get(from);
  e.text = dropRelated(e.text, target);
  changed.push(`${from} drops related ${target}`);
}

if (check) {
  for (const p of pairs) console.log(`two-sided: ${p[0]} ${p[1]}`);
  console.log(`relations-one-side: ${pairs.length} two-sided pair(s)`);
  process.exit(pairs.length ? 1 : 0);
}
for (const e of files.values()) {
  if (e.text !== readFileSync(e.file, 'utf8')) writeFileSync(e.file, e.text);
}
for (const c of changed) console.log(c);
for (const u of undecided) console.log(`left for a person (two typed relations): ${u}`);
console.log(`relations-one-side: ${changed.length} declaration(s) dropped, ${undecided.length} left`);
process.exit(undecided.length ? 1 : 0);
