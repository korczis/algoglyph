// U-stochastic: bootstrap-ci runs exactly as before on every seeded population
// (test/u-stochastic/same-runs.ts), and on a reader's sample it bootstraps that sample. Checked
// against references that share no code with the kernel: the sample mean computed here, and the
// bootstrap standard error against the plug-in s·√((n − 1)/n)/√n it estimates, within the
// resampling noise of b resamples; a constant sample has a zero-width interval at its value.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import { Runner, type Frame } from '../../src/engines/stochastic/trace';
import { kernel as now } from '../../src/kernels/stochastic/bootstrap-ci';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/bootstrap-ci';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('bootstrap-ci', now, before);

const sample = (x: number[]) => (id: string): DataTable | null => (id === 'sample'
  ? { id, columns: [{ key: 'x', unit: '1' }], values: [Float64Array.from(x)], rows: x.length, canonical: '', digest: '' }
  : null);

/** The last frame of the run on `x` at `b` resamples. */
function last(x: number[], b: number): Frame {
  const r = new Runner(now, { population: optionValue('sample'), b }, 7, sample(x));
  while (!r.done) r.step(1000);
  return r.frames[r.frames.length - 1];
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';
const first = (s: string) => Number(s.replace(/[−–]/g, '-').match(/-?\d+(\.\d+)?(e-?\d+)?/)![0]);

describe('bootstrap-ci on your sample', () => {
  const x = Array.from({ length: 50 }, (_, i) => Math.sin(i * 1.7) * 3 + i / 10);
  const n = x.length;
  const m = x.reduce((a, v) => a + v, 0) / n;
  const s2 = x.reduce((a, v) => a + (v - m) ** 2, 0) / (n - 1);

  it('resamples your sample: its mean, and the standard error of the mean it estimates', () => {
    const f = last(x, 4000);
    expect(value(f, 'Input')).toBe('your data, 50 values');
    expect(first(value(f, 'Sample mean'))).toBeCloseTo(m, 3);
    // the bootstrap estimates the plug-in SE s·√((n − 1)/n)/√n; 4000 resamples leave about 1/√(2·4000) ≈ 1.1% noise
    const plugIn = Math.sqrt(s2 * (n - 1) / n) / Math.sqrt(n);
    expect(Math.abs(first(value(f, 'Bootstrap standard error')) / plugIn - 1)).toBeLessThan(0.05);
    expect(value(f, 'Population mean')).toMatch(/^none/);
  });

  it('a constant sample has a zero-width interval at its value', () => {
    const f = last(Array.from({ length: 12 }, () => 2.5), 400);
    expect(value(f, '90% percentile interval')).toBe('2.5000 – 2.5000');
    expect(first(value(f, 'Bootstrap standard error'))).toBe(0);
  });
});
