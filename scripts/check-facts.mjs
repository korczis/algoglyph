#!/usr/bin/env node
// The derived-facts gate (rule project.derived-facts): no number about the collection, no plate
// number and no link is typed by hand. Driven by config/derived-facts.yaml and the catalogue.
//
//   node scripts/check-facts.mjs           report; exit 1 on any finding
//   node scripts/check-facts.mjs --json    the findings as JSON
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogue } from './lib/catalogue.mjs';
import { gate } from './lib/facts-gate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { errors, model } = loadCatalogue(ROOT);
if (errors.length) {
  console.error(`check-facts: the catalogue has ${errors.length} error(s); run npm run catalogue`);
  process.exit(2);
}
const { findings, files, exempt } = gate(ROOT, model);
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
