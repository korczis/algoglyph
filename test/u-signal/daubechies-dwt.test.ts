// U-signal: daubechies-dwt runs exactly as before on every seeded input (test/u-signal/same-runs.ts),
// and on a reader's series it transforms that series: its first n samples, zero-padded.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../src/core/catalogue';
import { optionValue, tableOf } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Meter, type View } from '../../src/engines/signal/trace';
import { kernel as now } from '../../src/kernels/signal/daubechies-dwt';
import { kernel as before } from '../fixtures/u-signal-before/src/kernels/signal/daubechies-dwt';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('daubechies-dwt', now, before);

// The whole seeded run of the kernel alone, every view to its end, at the defaults and every option.
it('daubechies-dwt: every view of every seeded run, to the end, is the frozen kernel\'s', () => {
  const base: Params = Object.fromEntries(now.params!.map((d) => [d.key, d.value]));
  const corners = [base, ...now.params!.flatMap((d) => (d.kind === 'select' ? d.options.map((o) => ({ ...base, [d.key]: o.value })) : []))];
  const all = (k: typeof now, c: Params) => [...k.run({ ...c }, 7, new Meter())].filter((v) => v !== null);
  for (const c of corners) expect(all(now, c), JSON.stringify(c)).toEqual(all(before, c));
}, 120_000);

describe('daubechies-dwt on a reader\'s series', () => {
  const decl = ENTRIES.find((e) => e.id === 'daubechies-dwt')!.data[0];
  const views = (xs: number[], over: Params): View[] => {
    const table = tableOf(decl, xs.map((v) => [v]));
    const params: Params = { signal: optionValue(decl.id), wavelet: 'db1', levels: 1, keep: 8, n: '128', ...over };
    return [...now.run(params, 3, new Meter(), (id) => (id === decl.id ? table : null))].filter((v): v is View => v !== null);
  };
  const stat = (v: View, label: string) => v.stats.find((s) => s.label === label)?.value;

  it('splits the reader\'s samples, zero-padded to n: Haar\'s d1 energy computed independently', () => {
    const xs = Array.from({ length: 100 }, (_, i) => Math.sin(i * 0.9) + 0.01 * i);
    const vs = views(xs, {});
    const padded = Array.from({ length: 128 }, (_, i) => xs[i] ?? 0);
    let total = 0; let d1 = 0;
    for (let i = 0; i < 64; i++) {
      d1 += ((padded[2 * i] - padded[2 * i + 1]) / Math.SQRT2) ** 2;
      total += padded[2 * i] ** 2 + padded[2 * i + 1] ** 2;
    }
    expect(stat(vs[0], 'Energy in d1')).toBe(`${((100 * d1) / total).toFixed(2)} %`);
    const wave = vs[0].panels[1];
    expect(wave.kind === 'wave' ? Array.from(wave.series[0].y) : null).toEqual(padded);
    expect(stat(vs[vs.length - 1], 'Input')).toBe('your data, 100 samples');
    expect(Number(stat(vs[vs.length - 1], 'Perfect reconstruction, largest error'))).toBeLessThan(1e-9);
  });

  it('takes the first n of a longer series and says so', () => {
    const xs = Array.from({ length: 300 }, (_, i) => Math.cos(i * 0.3));
    const last = views(xs, { n: '256' }).at(-1)!;
    expect(stat(last, 'Input')).toBe('your data, 300 samples, the first 256 used');
    expect(stat(last, 'Coefficients kept')).toBe(`${Math.round(0.08 * 256)} of 256`);
  });
});
