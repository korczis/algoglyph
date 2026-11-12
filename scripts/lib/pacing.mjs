// config/pacing.yaml, read and checked once (ADR 0008). The site gets the checked model through
// `virtual:pacing` (scripts/lib/vite-pacing.mjs); the tests read the same function, so a broken
// file fails the build, the dev server and the unit suite with the same messages.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export const PACING_FILE = 'config/pacing.yaml';
const KINDS = ['replay', 'views', 'stream'];

const positive = (x) => typeof x === 'number' && Number.isFinite(x) && x > 0;

/** Every error of a parsed pacing file, each naming its field; empty when the file is sound. */
export function checkPacing(m) {
  const errors = [];
  const need = (ok, field, what) => { if (!ok) errors.push(`${PACING_FILE}: ${field} ${what}`); };
  if (!m || typeof m !== 'object') return [`${PACING_FILE}: not a mapping`];
  need(m.version === 1, 'version', 'must be 1');
  need(positive(m.fps), 'fps', 'must be a positive number');
  need(typeof m.hold_s === 'number' && m.hold_s >= 0, 'hold_s', 'must be a number >= 0');
  const p = m.pace ?? {};
  need(positive(p.min) && positive(p.max) && positive(p.step), 'pace', 'needs positive min, max and step');
  need(!(p.min > 1) && !(p.max < 1), 'pace', 'must contain 1, the calm rate');
  const kinds = m.kinds ?? {};
  for (const k of Object.keys(kinds)) need(KINDS.includes(k), `kinds.${k}`, `is not one of ${KINDS.join(', ')}`);
  for (const k of KINDS) {
    const c = kinds[k];
    if (!c) { need(false, `kinds.${k}`, 'is missing'); continue; }
    need(positive(c.max_per_s), `kinds.${k}.max_per_s`, 'must be a positive number');
    if (k === 'stream') continue;
    need(positive(c.min_per_s), `kinds.${k}.min_per_s`, 'must be a positive number');
    need(!(c.min_per_s > c.max_per_s), `kinds.${k}.min_per_s`, 'must not exceed max_per_s');
    const w = c.run_s;
    const window = Array.isArray(w) && w.length === 2 && positive(w[0]) && positive(w[1]) && w[0] <= w[1];
    need(window, `kinds.${k}.run_s`, 'must be [lo, hi] with 0 < lo <= hi');
    need(positive(c.target_s), `kinds.${k}.target_s`, 'must be a positive number');
    if (window) need(c.target_s >= w[0] && c.target_s <= w[1], `kinds.${k}.target_s`, `must lie in run_s [${w[0]}, ${w[1]}]`);
    if (c.fit_s !== undefined && window) need(c.fit_s >= c.target_s && c.fit_s <= w[1], `kinds.${k}.fit_s`, 'must lie between target_s and run_s[1]');
  }
  return errors;
}

export function loadPacing(root = process.cwd()) {
  const file = join(root, PACING_FILE);
  let model;
  try {
    model = parse(readFileSync(file, 'utf8'));
  } catch (e) {
    return { errors: [`${PACING_FILE}: ${e.message}`], model: null, file };
  }
  return { errors: checkPacing(model), model, file };
}
