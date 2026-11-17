// U-stochastic: var-cvar runs exactly as before on every seeded loss model
// (test/u-stochastic/same-runs.ts), and on a reader's losses it reads those losses. Checked
// against references that share no code with the kernel: on the losses 0.0, 0.1, …, 99.9 shifted
// by −20 and shuffled, the 99% value at risk is the 990th smallest, 78.9, and the shortfall the
// mean of the eleven at or beyond it, 79.4, in closed form; at 90% the ten batches' standard
// errors are recomputed here from the batches by index.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now } from '../../src/kernels/stochastic/var-cvar';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/var-cvar';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('var-cvar', now, before);

// same-runs.ts records the first 30 drawn frames; the whole seeded run, every recorded frame, the
// result and the counts, is compared too, at the defaults, every option and both ends of every range
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  while (!r.done) r.step(1e9);
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts });
};
describe('U-stochastic: var-cvar\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults, every option and both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) {
      if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
      else if (d.kind === 'select') for (const o of d.options) corners.push({ [d.key]: o.value });
    }
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

const series = (x: number[]) => (id: string): DataTable | null => (id === 'losses'
  ? { id, columns: [{ key: 'loss', unit: '1' }], values: [Float64Array.from(x)], rows: x.length, canonical: '', digest: '' }
  : null);

function last(x: number[], level: string): Frame {
  const r = new Runner(now, { scenario: optionValue('losses'), level }, 7, series(x));
  while (!r.done) r.step(1000);
  return r.frames[r.frames.length - 1];
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';
const numbers = (s: string) => (s.replace(/,/g, '').match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('var-cvar on your losses', () => {
  // i·7919 mod 1000 runs through 0…999 once each, out of order
  const x = Array.from({ length: 1000 }, (_, i) => ((i * 7919) % 1000) / 10 - 20);

  it('the 99% value at risk and shortfall of your losses, in closed form', () => {
    const f = last(x, '0.99');
    expect(value(f, 'Input')).toBe('your data, 1,000 losses, in their order');
    // a batch of 100 holds 2 losses at or beyond its own 99% quantile: too few for an error
    expect(value(f, 'Value at risk 99.0%')).toBe('78.900');
    expect(value(f, 'Expected shortfall')).toBe('79.400');
    expect(value(f, 'Losses read')).toBe('1,000 of 1,000; 11 at or beyond VaR averaged');
    expect(value(f, 'Largest loss')).toBe('79.900');
    expect(f.draws).toBe(0);
  });

  it('at 90% the batches carry standard errors, recomputed here batch by batch', () => {
    const f = last(x, '0.9');
    const tail = (b: number[]) => {
      const s = [...b].sort((u, v) => u - v);
      const v = s[Math.ceil(0.9 * s.length) - 1];
      const t = s.filter((y) => y >= v);
      return { v, es: t.reduce((a, y) => a + y, 0) / t.length };
    };
    const per = Array.from({ length: 10 }, (_, j) => tail(x.filter((_, i) => i % 10 === j)));
    const se = (ys: number[]) => {
      const m = ys.reduce((a, y) => a + y, 0) / ys.length;
      return Math.sqrt(ys.reduce((a, y) => a + (y - m) ** 2, 0) / (ys.length - 1) / ys.length);
    };
    const whole = tail(x);
    const [v, vse] = numbers(value(f, 'Value at risk 90.0%'));
    const [es, esse] = numbers(value(f, 'Expected shortfall'));
    expect(v).toBeCloseTo(whole.v, 3);
    expect(es).toBeCloseTo(whole.es, 3);
    expect(vse).toBeCloseTo(se(per.map((q) => q.v)), 3);
    expect(esse).toBeCloseTo(se(per.map((q) => q.es)), 3);
  });

  it('the losses are read in their order: an early frame sees only the first of them', () => {
    const r = new Runner(now, { scenario: optionValue('losses'), level: '0.99' }, 7, series(x));
    while (!r.done) r.step(1000);
    // the first frame reads the first 25 losses (a fortieth); its largest is theirs
    expect(value(r.frames[0], 'Losses read')).toMatch(/^25 of 1,000;/);
    expect(value(r.frames[0], 'Largest loss')).toBe((Math.max(...x.slice(0, 25))).toFixed(3));
  });
});
