// U-stochastic: drift-divergence runs exactly as before on its seeded windows
// (test/u-stochastic/same-runs.ts), and on a reader's series it compares the series' halves.
// Checked against closed forms that share no code with the kernel: on a hundred zeros then a
// hundred ones in two bins, the reference's counts are (100, 0); with half a count added to each
// bin, p = (100.5, 0.5)/101, and the last window, all ones, has q = (0.5, 100.5)/101, so
// PSI = 2·(100/101)·ln 201, KL(q ‖ p) = (100/101)·ln 201, and JS follows from m = (½, ½). The first
// window is the reference itself (every divergence zero), the middle one half and half.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now } from '../../src/kernels/stochastic/drift-divergence';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/drift-divergence';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('drift-divergence', now, before);

// same-runs.ts records the first 30 drawn frames; the whole seeded run, every recorded frame, the
// result and the counts, is compared too, at the defaults, every option and both ends of every range
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  while (!r.done) r.step(1e9);
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts });
};
describe('U-stochastic: drift-divergence\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults, every option and both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) {
      if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
      else if (d.kind === 'select') for (const o of d.options) corners.push({ [d.key]: o.value });
    }
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

const series = (x: number[]) => (id: string): DataTable | null => (id === 'series'
  ? { id, columns: [{ key: 'x', unit: '1' }], values: [Float64Array.from(x)], rows: x.length, canonical: '', digest: '' }
  : null);

function frames(x: number[], bins: number): Frame[] {
  const r = new Runner(now, { windows: optionValue('series'), bins }, 7, series(x));
  while (!r.done) r.step(1000);
  return r.frames;
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';
const first = (s: string) => Number(s.replace(/,/g, '').match(/-?\d+(\.\d+)?/)![0]);

describe('drift-divergence on your series', () => {
  const x = Array.from({ length: 200 }, (_, i) => (i < 100 ? 0 : 1));
  const fs = frames(x, 2);

  it('the last window against the reference, in closed form', () => {
    const end = fs[fs.length - 1];
    const L = Math.log(201);
    const p = [100.5 / 101, 0.5 / 101];
    const jsBits = (p.reduce((s, v) => s + v * Math.log(2 * v), 0)) / Math.LN2;
    expect(value(end, 'Input')).toBe('your data, 200 samples: the first 100 the reference');
    expect(first(value(end, 'PSI'))).toBeCloseTo(2 * (100 / 101) * L, 4);
    expect(first(value(end, 'KL(current ‖ reference)'))).toBeCloseTo((100 / 101) * L, 4);
    expect(first(value(end, 'Jensen–Shannon'))).toBeCloseTo(jsBits, 4);
    expect(value(end, 'Current window')).toBe('samples 101–200 of 200; its mean 1.000 from the reference\'s');
    expect(end.draws).toBe(0);
  });

  it('the first window is the reference itself, and the middle one is half and half', () => {
    expect(value(fs[0], 'PSI')).toBe('0.0000');
    expect(value(fs[0], 'Jensen–Shannon')).toBe('0.0000 bits');
    const mid = fs.find((f) => value(f, 'Step') === '40 of 80')!;
    const p = [100.5 / 101, 0.5 / 101];
    const q = [0.5, 0.5];
    const psi = p.reduce((s, v, i) => s + (q[i] - v) * Math.log(q[i] / v), 0);
    expect(first(value(mid, 'PSI'))).toBeCloseTo(psi, 4);
    expect(value(mid, 'Current window')).toBe('samples 51–150 of 200; its mean 0.500 from the reference\'s');
  });
});
