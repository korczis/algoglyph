// U-signal: window-leakage runs exactly as before on every seeded input (test/u-signal/same-runs.ts).
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import { Meter, type View } from '../../src/engines/signal/trace';
import { windowOf } from '../../src/kernels/signal/_fft';
import { kernel as now } from '../../src/kernels/signal/window-leakage';
import { kernel as before } from '../fixtures/u-signal-before/src/kernels/signal/window-leakage';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('window-leakage', now, before);

// On a reader's series the plate measures what it can know: a cosine on bin 10 of 64 samples at
// 64 Hz falls into bin 10 at unit amplitude under any window, and Hann leaks nothing 10 bins away.
describe('window-leakage on your data', () => {
  const series = (x: number[]) => (id: string): DataTable | null =>
    (id === 'samples' ? { values: [Float64Array.from(x)] } as DataTable : null);
  const last = (n: string, x: number[]): View => {
    let v: View | null = null;
    for (const s of now.run({ window: 'hann', weak: -50, gap: 6, n, signal: optionValue('samples') }, 1, new Meter(), series(x))) if (s) v = s;
    return v!;
  };
  const stat = (v: View, label: string) => v.stats.find((s) => s.label === label)?.value;

  it('reads the series at the window length, takes the first N and finds the tone on its bin', () => {
    const tone = Array.from({ length: 100 }, (_, i) => Math.cos((2 * Math.PI * 10 * i) / 64));
    const v = last('64', tone);
    expect(stat(v, 'Input')).toBe('your data, 100 samples at 64 Hz, the first 64 used');
    expect(stat(v, 'Peak bin (measured, DC aside)')).toBe('bin 10, 0.00 dB');
    expect(stat(v, 'Leakage 10 bins from the peak')).toBe('below −160 dB');
    expect(stat(v, 'Highest side lobe (measured)')).toBe('-31.5 dB');
  });

  it('zero-pads a short series to the window length', () => {
    const v = last('128', Array.from({ length: 40 }, (_, i) => Math.cos((2 * Math.PI * 10 * i) / 40)));
    expect(stat(v, 'Input')).toBe('your data, 40 samples at 128 Hz');
    expect(v.panels[0].kind === 'wave' && v.panels[0].title).toContain('Your first 40 samples, zero-padded to 128');
    // the reference: a direct DFT of the 40 samples and 88 zeros under the 128-sample Hann window
    const w = windowOf('hann', 128);
    const x = Array.from({ length: 128 }, (_, i) => (i < 40 ? Math.cos((2 * Math.PI * 10 * i) / 40) : 0));
    const bin = (k: number) => 2 * Math.hypot(...[Math.cos, Math.sin].map((f) =>
      x.reduce((sum, v, i) => sum + v * w[i] * f((2 * Math.PI * k * i) / 128), 0))) / w.reduce((p, q) => p + q, 0);
    expect(stat(v, 'Peak bin (measured, DC aside)')).toBe(`bin 32, ${(20 * Math.log10(bin(32))).toFixed(2)} dB`);
    expect(stat(v, 'Leakage 10 bins from the peak')).toBe(`${(20 * Math.log10(bin(42) / bin(32))).toFixed(1)} dB`);
  });
});
