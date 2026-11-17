// U-signal: fft-butterfly runs exactly as before on every seeded input (test/u-signal/same-runs.ts),
// and on a reader's series it transforms the reader's first N samples: a cosine on bin 4 of a
// 32-point transform at 1000 samples a second peaks at 4 · 1000 / 32 = 125 Hz, and a series shorter
// than N is zero-padded, its energy unchanged (Parseval on the padded input).
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import { Meter, type View } from '../../src/engines/signal/trace';
import { kernel as now } from '../../src/kernels/signal/fft-butterfly';
import { kernel as before } from '../fixtures/u-signal-before/src/kernels/signal/fft-butterfly';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('fft-butterfly', now, before);

const series = (x: number[]) => (id: string): DataTable | null => (id === 'samples'
  ? { id, columns: [{ key: 'x', unit: '1' }], values: [Float64Array.from(x)], rows: x.length, canonical: '', digest: '' }
  : null);
const last = (x: number[], n: string): View => {
  let v: View | undefined;
  for (const s of now.run({ n, signal: optionValue('samples') }, 1, new Meter(), series(x))) if (s) v = s;
  return v!;
};
const stat = (v: View, label: string) => v.stats.find((s) => s.label === label)?.value;

describe('fft-butterfly on your data', () => {
  it('transforms the first N samples: a cosine on bin 4 of 32 peaks at 125 Hz', () => {
    const x = Array.from({ length: 50 }, (_, i) => Math.cos((2 * Math.PI * 4 * i) / 32));
    const v = last(x, '32');
    expect(stat(v, 'Input')).toBe('your data, 50 samples at 1000 Hz, the first 32 used');
    expect(stat(v, 'Peak frequency (measured)')).toBe('125.00 Hz');
  });

  it('zero-pads a short series: Parseval holds on the padded input', () => {
    const x = [3, -1, 4, 1, -5];
    const v = last(x, '16');
    expect(stat(v, 'Input')).toBe('your data, 5 samples at 1000 Hz');
    // Σ|x|² over the padded 16 samples is the five given: 9 + 1 + 16 + 1 + 25 = 52
    expect(stat(v, 'Parseval: Σ|x|² vs Σ|X|²/N')).toBe('52.0000 vs 52.0000');
  });
});
