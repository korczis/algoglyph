// U-stochastic: page-hinkley runs exactly as before on its seeded stream
// (test/u-stochastic/same-runs.ts), and on a reader's stream it tests that stream. Checked
// against a closed form that shares no code with the kernel: on a hundred zeros then a hundred
// ones, the running mean after the step at a = 100 is (t − a + 1)/(t + 1), so each increment is
// a/(t + 1) − δ and the climb by sample T is a·(H(T + 1) − H(a)) − δ·(T − a + 1), harmonic numbers;
// the first T where it passes λ is the alarm, and the climb at T = 199 the peak.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now } from '../../src/kernels/stochastic/page-hinkley';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/page-hinkley';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('page-hinkley', now, before);

// same-runs.ts records the first 30 drawn frames; the whole seeded run, every recorded frame, the
// result and the counts, is compared too, at the defaults, every option and both ends of every range
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  while (!r.done) r.step(1e9);
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts });
};
describe('U-stochastic: page-hinkley\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults, every option and both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) {
      if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
      else if (d.kind === 'select') for (const o of d.options) corners.push({ [d.key]: o.value });
    }
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

const series = (x: number[]) => (id: string): DataTable | null => (id === 'stream'
  ? { id, columns: [{ key: 'x', unit: '1' }], values: [Float64Array.from(x)], rows: x.length, canonical: '', digest: '' }
  : null);

function frames(x: number[], delta: number, lambda: number): Frame[] {
  const r = new Runner(now, { stream: optionValue('stream'), delta, lambda }, 7, series(x));
  while (!r.done) r.step(1000);
  return r.frames;
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';
const first = (s: string) => Number(s.replace(/,/g, '').match(/-?\d+(\.\d+)?/)![0]);

describe('page-hinkley on your stream', () => {
  const a = 100;
  const x = Array.from({ length: 200 }, (_, i) => (i < a ? 0 : 1));
  const H = (k: number) => { let h = 0; for (let j = 1; j <= k; j++) h += 1 / j; return h; };
  const climb = (T: number, delta: number) => a * (H(T + 1) - H(a)) - delta * (T - a + 1);

  it('alarms where the closed-form climb first passes λ, and peaks at its top', () => {
    const delta = 0.5; const lambda = 10;
    let alarm = a;
    while (climb(alarm, delta) <= lambda) alarm++;
    const fs = frames(x, delta, lambda);
    const end = fs[fs.length - 1];
    expect(value(end, 'Input')).toBe('your data, 200 samples, in their order');
    expect(value(end, 'Alarm')).toBe(`at sample ${alarm}`);
    expect(Math.abs(first(value(end, 'Peak of m_t − min m')) - climb(199, delta))).toBeLessThan(0.006);
    expect(value(end, 'Running mean')).toBe('0.500');
    expect(value(end, 'Detection')).toMatch(/^none: /);
    expect(end.draws).toBe(0);
  });

  it('before the step the statistic stays at zero, and a λ above the peak never alarms', () => {
    const fs = frames(x, 0.5, 30);
    const before = fs.find((f) => value(f, 'Samples seen') === '100')!;
    expect(value(before, 'Statistic')).toBe('0.00 (λ 30)');
    expect(value(fs[fs.length - 1], 'Alarm')).toBe('none yet');
  });
});
