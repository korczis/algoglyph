// The one instrument for every entry's claims (ADR 0007, catalogue/schema/entry.yaml `claims`):
// run the plate headless with the claim's setup and seed until its readouts settle, read the
// named readout's first number and judge it against the claim's expectation. No entry has test
// code of its own; the evidence is this run, never an authored value.
import { GROUNDS, palette as lookupPalette } from '../../src/core/palette';
import { defaults, type Params, type PlateContext, type Stat } from '../../src/core/plate';
import { type Claim, DEFAULT_SEED, expectationText } from '../../src/core/claims';
import { mulberry32 } from '../../src/core/random';
import { COMPLETED_RUNS, RUNS_KEY } from '../../src/plates/_shared/settle/settle';
import { loadPlate } from '../../src/registry';
import { p5Stub } from './p5-stub';

export type { Claim } from '../../src/core/claims';

/** A run has settled when every readout has stayed the same for this many frames. */
export const SETTLE_FRAMES = 120;
/** A run that has not settled after this many frames is a failed claim, not a long wait. */
export const MAX_FRAMES = 20_000;

const NUMBER = /[-−]?\d[\d,]*(?:\.\d+)?(?:[eE][-+−]?\d+)?/g;

/** The n-th number (from 1) of a readout's text as displayed: thousands separators dropped, an
 * exponent read (toExponential and toPrecision print 3.2e-7), a percentage kept in percent, a
 * typographic minus read as a minus. A number written as a power of ten (1.5×10⁻³) is refused,
 * not misread. */
export function nthNumber(text: string, n: number): number | null {
  const all = [...text.matchAll(NUMBER)];
  const m = all[n - 1];
  if (!m || m.index === undefined) return null;
  if (/^\s*[×x]\s*10/.test(text.slice(m.index + m[0].length))) return null;
  return Number(m[0].replace(/,/g, '').replace(/−/g, '-'));
}

/** The first number of a readout's text as displayed (see nthNumber). */
export const firstNumber = (text: string): number | null => nthNumber(text, 1);

export interface Reading { value?: number; text?: string; frames: number; reason?: string }

/** Run entry `id`'s plate for `claim` and read its readout. A reason means no value was read. */
export async function read(id: string, claim: Claim): Promise<Reading> {
  const plate = await loadPlate(id);
  if (!plate) return { frames: 0, reason: `${id} has no plate` };
  const params: Params = defaults(plate);
  // a claim is about one run: a plate that starts a new input when done is held on the first
  if (plate.params.some((d) => d.key === 'loop')) params.loop = false;
  // and about its result, not its animation: the run replays at the pace control's top, which
  // changes how fast it is drawn and never what it computes (ADR 0008)
  const pace = plate.params.find((d) => d.key === 'pace');
  if (pace?.kind === 'range') params.pace = pace.max;
  for (const [k, v] of Object.entries(claim.setup?.params ?? {})) {
    // a setup written before ADR 0008 asks `speed` to finish fast: a paced plate already runs at
    // its pace control's top here, so the old key asks nothing more
    if (k === 'speed' && pace && !plate.params.some((d) => d.key === k)) continue;
    if (!plate.params.some((d) => d.key === k)) return { frames: 0, reason: `setup.params.${k} is not a parameter of ${id}` };
    params[k] = v as Params[string];
  }
  const seed = claim.setup?.seed ?? DEFAULT_SEED;
  const ground = GROUNDS.dark;
  let rows: Stat[] = [];
  const ctx: PlateContext = {
    width: 800, height: Math.round(800 / plate.aspect), params, seed, rnd: mulberry32(seed),
    theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => lookupPalette(String(params.palette ?? 'ember')),
    stats(r) { rows = r; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  let last = '';
  let still = 0;
  let frames = 0;
  // a paced run that reports its end has settled only once it has ended (src/core/pace.ts)
  const ended = () => { const r = sim.pace?.(); return !r || r.kind === 'stream' || r.done; };
  // a plate that starts a new run after each one ends settles only once it has stopped on the
  // k completed runs the setup asks for (`runs`), never in a pause between two runs
  // (src/plates/_shared/settle/settle.ts)
  const k = plate.params.some((d) => d.key === RUNS_KEY) ? Number(params[RUNS_KEY]) || 0 : 0;
  const completed = () => {
    if (k <= 0) return true;
    const row = rows.find((r) => r.label === COMPLETED_RUNS);
    return !!row && (firstNumber(row.value) ?? 0) >= k;
  };
  for (; frames < MAX_FRAMES && (still < SETTLE_FRAMES || !ended() || !completed()); frames++) {
    sim.draw();
    const now = JSON.stringify(rows);
    still = now === last ? still + 1 : 0;
    last = now;
  }
  if (still < SETTLE_FRAMES || !completed()) {
    return { frames, reason: `${id}'s readouts did not settle within ${MAX_FRAMES} frames${k > 0 ? ` (${k} completed runs asked)` : ''}` };
  }
  const row = rows.find((r) => r.label === claim.readout);
  if (!row) {
    return { frames, reason: `${id} publishes no readout "${claim.readout}"; it publishes: ${rows.map((r) => `"${r.label}"`).join(', ')}` };
  }
  const value = firstNumber(row.value);
  if (value === null) return { frames, text: row.value, reason: `readout "${claim.readout}" shows no number: ${row.value}` };
  const x = claim.expect;
  if (x.against === undefined) return { frames, value, text: row.value };
  // a comparison: the claim judges this readout's first number minus the other's chosen number
  const other = rows.find((r) => r.label === x.against);
  if (!other) {
    return { frames, reason: `${id} publishes no readout "${x.against}" to compare with; it publishes: ${rows.map((r) => `"${r.label}"`).join(', ')}` };
  }
  const n = x.against_number ?? 1;
  const b = nthNumber(other.value, n);
  if (b === null) return { frames, text: other.value, reason: `readout "${x.against}" has no number ${n}: ${other.value}` };
  // an exact difference the claim states (waves = chain + 1) is taken off before judging
  return { frames, value: value - b - (x.offset ?? 0), text: `${row.value} against ${other.value} (number ${n})` };
}

/** Whether a read value meets the claim's expectation (inclusive). */
export function holds(claim: Claim, value: number): boolean {
  const x = claim.expect;
  // against: `value` is the difference, judged around zero by tolerance, or by below or above
  if (x.against !== undefined && x.tolerance !== undefined) return Math.abs(value) <= x.tolerance;
  if (x.range) return value >= x.range[0] && value <= x.range[1];
  if (x.below !== undefined) return value < x.below;
  if (x.above !== undefined) return value > x.above;
  return Math.abs(value - (x.value as number)) <= (x.tolerance ?? 0);
}

/** The expectation in words, for a failure message: the page's own formatter. */
export const expected = expectationText;
