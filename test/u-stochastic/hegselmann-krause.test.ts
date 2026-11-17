// U-stochastic: hegselmann-krause runs exactly as before on its seeded opinions
// (test/u-stochastic/same-runs.ts), and on a reader's opinions it moves those agents. Checked
// against references that share no code with the kernel: by hand, {0.1, 0.12}, {0.5} and
// {0.9, 0.95} at ε = 0.05 meet at their means in one step and freeze in the next; and a naive
// all-pairs update (every agent against every other, no sorting, no windows) run here to the
// same fixed point as the plate on sixty spread opinions.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now } from '../../src/kernels/stochastic/hegselmann-krause';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/hegselmann-krause';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('hegselmann-krause', now, before);

// same-runs.ts records the first 30 drawn frames; the whole seeded run, every recorded frame, the
// result and the counts, is compared too, at the defaults, every option and both ends of every range
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  while (!r.done) r.step(1e9);
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts });
};
describe('U-stochastic: hegselmann-krause\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults, every option and both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) {
      if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
      else if (d.kind === 'select') for (const o of d.options) corners.push({ [d.key]: o.value });
    }
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

const series = (x: number[]) => (id: string): DataTable | null => (id === 'opinions'
  ? { id, columns: [{ key: 'opinion', unit: '1' }], values: [Float64Array.from(x)], rows: x.length, canonical: '', digest: '' }
  : null);

function last(x: number[], eps: number): Frame {
  const r = new Runner(now, { opinions: optionValue('opinions'), eps }, 7, series(x));
  while (!r.done) r.step(1000);
  return r.frames[r.frames.length - 1];
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';

describe('hegselmann-krause on your opinions', () => {
  it('three camps by hand: each meets at its mean and freezes', () => {
    const f = last([0.1, 0.12, 0.5, 0.9, 0.95], 0.05);
    expect(value(f, 'Input')).toBe('your data, 5 opinions, one agent each');
    expect(value(f, 'Step')).toBe('2 (frozen)');
    expect(value(f, 'Groups')).toBe('3; largest holds 2 agents');
    expect(value(f, 'Opinion range')).toBe('0.110 – 0.925');
    expect(f.draws).toBe(0);
  });

  it('the same fixed point as a naive all-pairs update', () => {
    const x0 = Array.from({ length: 60 }, (_, i) => ((i * 37) % 60) / 59);
    const eps = 0.1;
    let x = x0;
    let steps = 0;
    for (; steps < 60; steps++) {
      const next = x.map((v) => { const near = x.filter((w) => Math.abs(w - v) <= eps); return near.reduce((a, w) => a + w, 0) / near.length; });
      const move = Math.max(...next.map((v, i) => Math.abs(v - x[i])));
      x = next;
      if (move < 1e-12) { steps++; break; }
    }
    const s = [...x].sort((a, b) => a - b);
    let groups = 1;
    for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] > 1e-3) groups++;
    const f = last(x0, eps);
    expect(value(f, 'Step')).toBe(`${steps} (frozen)`);
    expect(value(f, 'Groups')).toMatch(new RegExp(`^${groups}; `));
    expect(value(f, 'Opinion range')).toBe(`${s[0].toFixed(3)} – ${s[s.length - 1].toFixed(3)}`);
  });
});
