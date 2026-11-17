// U-stochastic: dempster-shafer runs exactly as before on its seeded sources
// (test/u-stochastic/same-runs.ts, and here the whole run to its end), and on a reader's sources
// it combines those. Checked against references that share no code with the kernel: Zadeh's
// example (two sources almost sure of different hypotheses, sharing 0.01 on a third: K = 0.9999
// and all the mass on the third), total conflict left undefined, and Dempster's rule written
// here over sets of hypothesis names rather than bit masks.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now, type DempsterResult } from '../../src/kernels/stochastic/dempster-shafer';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/dempster-shafer';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('dempster-shafer', now, before);

// same-runs.ts records the first 30 drawn frames, the first source's hold; the whole seeded run,
// every recorded frame and the result, is compared too
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  // one piece per step, so where the run yields (the draws made by each) is compared as well as what it records
  const pieces: number[] = [];
  while (!r.done) { r.step(Infinity, 1); pieces.push(r.counts.draws); }
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts, pieces });
};
describe('U-stochastic: dempster-shafer\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults and at both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

/** The columns in declared order, as sets of hypothesis names. */
const SETS = [['H1'], ['H2'], ['H3'], ['H1', 'H2'], ['H1', 'H3'], ['H2', 'H3'], ['H1', 'H2', 'H3']];
const KEYS = ['h1', 'h2', 'h3', 'h12', 'h13', 'h23', 'theta'];

const sources = (rows: number[][]) => (id: string): DataTable | null => (id === 'sources'
  ? {
    id, columns: KEYS.map((key) => ({ key, unit: '1' })),
    values: KEYS.map((_, j) => Float64Array.from(rows.map((r) => r[j]))), rows: rows.length, canonical: '', digest: '',
  }
  : null);

function run(rows: number[][]): { last: Frame; result: DempsterResult } {
  const r = new Runner(now, { evidence: optionValue('sources') }, 7, sources(rows));
  while (!r.done) r.step(1000);
  return { last: r.frames[r.frames.length - 1], result: r.result! };
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';

/** Dempster's rule over named sets: a map from a sorted, comma-joined set to its mass. */
function rule(rows: number[][]): { mass: Map<string, number> | null; k: number } {
  const norm = (r: number[]) => {
    const t = r.reduce((a, b) => a + b, 0);
    return new Map(SETS.map((x, j) => [x.join(','), r[j] / t] as [string, number]).filter(([, v]) => v > 0));
  };
  let m = norm(rows[0]);
  let k = 0;
  for (const r of rows.slice(1)) {
    const next = new Map<string, number>();
    k = 0;
    for (const [a, va] of m) for (const [b, vb] of norm(r)) {
      const meet = a.split(',').filter((h) => b.split(',').includes(h)).join(',');
      if (meet) next.set(meet, (next.get(meet) ?? 0) + va * vb); else k += va * vb;
    }
    if (k >= 1 - 1e-12) return { mass: null, k };
    for (const [x, v] of next) next.set(x, v / (1 - k));
    m = next;
  }
  return { mass: m, k };
}
const bel = (m: Map<string, number>, x: string[]) => [...m].reduce((s, [y, v]) => (y.split(',').every((h) => x.includes(h)) ? s + v : s), 0);
const pl = (m: Map<string, number>, x: string[]) => [...m].reduce((s, [y, v]) => (y.split(',').some((h) => x.includes(h)) ? s + v : s), 0);

describe('dempster-shafer on your sources', () => {
  it('Zadeh\'s example: K = 0.9999 and all the mass on the hypothesis neither source favoured', () => {
    const { last, result } = run([[0.99, 0.01, 0, 0, 0, 0, 0], [0, 0.01, 0.99, 0, 0, 0, 0]]);
    expect(value(last, 'Input')).toBe('your data, 2 sources');
    expect(value(last, 'Conflict K of the last combination')).toBe('0.9999');
    expect(result.combined![2]).toBeCloseTo(1, 12);
    expect(value(last, 'Leading hypothesis {H2}')).toBe('Bel 1.000, Pl 1.000');
  });

  it('total conflict leaves the combination undefined', () => {
    const { last, result } = run([[1, 0, 0, 0, 0, 0, 0], [0, 0, 5, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 1]]);
    expect(result.undefinedAt).toBe(1);
    expect(value(last, 'Combination')).toMatch(/^undefined/);
  });

  it('combines your sources by Dempster\'s rule, each row scaled to sum to 1 and a row of zeros on Θ', () => {
    const rows = [[3, 0, 1, 2, 0, 0, 4], [0, 0, 0, 0, 0, 0, 0], [0.2, 0.1, 0, 0, 0.3, 0.1, 0.3], [0, 5, 0, 1, 0, 2, 2]];
    const ref = rule(rows.map((r) => (r.some(Boolean) ? r : [0, 0, 0, 0, 0, 0, 1])));
    const { last, result } = run(rows);
    const m = result.combined!;
    SETS.forEach((x, j) => expect(m[[1, 2, 4, 3, 5, 6, 7][j]], x.join(',')).toBeCloseTo(ref.mass!.get(x.join(',')) ?? 0, 12));
    expect(value(last, 'Conflict K of the last combination')).toBe(ref.k.toFixed(4));
    expect(value(last, 'Mass left on Θ')).toBe((ref.mass!.get('H1,H2,H3') ?? 0).toFixed(4));
    const lead = ['H1', 'H2', 'H3'].reduce((a, b) => (bel(ref.mass!, [b]) > bel(ref.mass!, [a]) ? b : a));
    expect(value(last, `Leading hypothesis {${lead}}`)).toBe(`Bel ${bel(ref.mass!, [lead]).toFixed(3)}, Pl ${pl(ref.mass!, [lead]).toFixed(3)}`);
  });
});
