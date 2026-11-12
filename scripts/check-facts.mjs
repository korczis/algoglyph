#!/usr/bin/env node
// The derived-facts gate (rule project.derived-facts): no number about the collection, no plate
// number and no link is typed by hand. Driven by config/derived-facts.yaml and the catalogue.
//
//   node scripts/check-facts.mjs           report; exit 1 on any finding
//   node scripts/check-facts.mjs --json    the findings as JSON
//   node scripts/check-facts.mjs --fixtures <dir>
//                                          scan every file under <dir> instead of the tree, each
//                                          judged as the path it has below <dir> (the fixtures
//                                          crates/algoglyph-cli/tests/equivalence.rs compares
//                                          with the Rust port)
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogue } from './lib/catalogue.mjs';
import { gate, loadPolicy, scan } from './lib/facts-gate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { errors, model } = loadCatalogue(ROOT);
if (errors.length) {
  console.error(`check-facts: the catalogue has ${errors.length} error(s); run npm run catalogue`);
  process.exit(2);
}

/** Every file under `dir`, scanned as its path below `dir`; links resolve in the repository. */
function fixtures(dir) {
  const policy = loadPolicy(ROOT);
  const list = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => join(d.parentPath, d.name).slice(dir.length + 1))
    .sort();
  // as in gate(): a path the repository ignores is local state, present by contract
  const ignored = (p) => [p, `${p}/`].some((q) => spawnSync('git',
    ['check-ignore', '-q', '--no-index', q], { cwd: ROOT }).status === 0);
  const exists = (p) => existsSync(join(ROOT, p)) || ignored(p);
  const found = list.flatMap((f) => scan(f, readFileSync(join(dir, f), 'utf8'),
    { policy, model, exists }));
  return { findings: found, files: list.length, exempt: policy.exempt ?? [] };
}

const at = process.argv.indexOf('--fixtures');
const { findings, files, exempt } = at > 0
  ? fixtures(resolve(process.argv[at + 1]))
  : gate(ROOT, model);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ findings, files, exempt }, null, 2));
} else {
  for (const f of findings) console.error(`FAIL ${f.check.padEnd(12)} ${f.file}:${f.line}  "${f.text}"`);
  for (const x of exempt) console.log(`exempt ${x.checks.join(',')} ${x.path} — ${x.because}`);
  console.log(`check-facts: ${files} file(s) scanned, ${findings.length} finding(s)`);
}
if (findings.length) {
  console.error('check-facts: derive the number (scripts/build-readme.mjs regions, src/core/facts.ts, the '
    + 'catalogue model) or cite the run or commit it was measured on; link plates by id.');
  process.exit(1);
}
