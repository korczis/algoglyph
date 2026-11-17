// U-signal: noise-colours runs exactly as before on every seeded input (test/u-signal/same-runs.ts),
// and on a reader's series it measures that series' slope at 8 kHz, the plate's rate.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../src/core/catalogue';
import { optionValue, tableOf } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { gaussian, mulberry32 } from '../../src/core/random';
import { FRAME, Meter, type View } from '../../src/engines/signal/trace';
import { kernel as now } from '../../src/kernels/signal/noise-colours';
import { kernel as before } from '../fixtures/u-signal-before/src/kernels/signal/noise-colours';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('noise-colours', now, before);

// The whole seeded run of the kernel alone, every view to its end, at the defaults and every option.
it('noise-colours: every view of every seeded run, to the end, is the frozen kernel\'s', () => {
  const base: Params = Object.fromEntries(now.params!.map((d) => [d.key, d.value]));
  const corners = [base, ...now.params!.flatMap((d) => (d.kind === 'select' ? d.options.map((o) => ({ ...base, [d.key]: o.value })) : []))];
  const all = (k: typeof now, c: Params) => [...k.run({ ...c }, 7, new Meter())].filter((v) => v !== null);
  for (const c of corners) expect(all(now, c), JSON.stringify(c)).toEqual(all(before, c));
}, 120_000);

describe('noise-colours on a reader\'s series', () => {
  const decl = ENTRIES.find((e) => e.id === 'noise-colours')!.data[0];
  const run = (xs: number[]): { views: View[]; meter: Meter } => {
    const table = tableOf(decl, xs.map((v) => [v]));
    const meter = new Meter();
    const views = [...now.run({ signal: optionValue(decl.id), rows: 16, leak: 0.998 }, 3, meter,
      (id) => (id === decl.id ? table : null))].filter((v): v is View => v !== null);
    return { views, meter };
  };
  const stat = (v: View, label: string) => v.stats.find((s) => s.label === label)?.value;
  const slope = (v: View) => parseFloat(stat(v, 'your data slope (measured)')!);
  const white = (n: number) => { const r = mulberry32(11); return Array.from({ length: n }, () => gaussian(r)); };

  it('averages the reader\'s frames block by block and fits a flat slope to white noise', () => {
    const { views, meter } = run(white(8192));
    const frames = (8192 - 1024) / 512 + 1;
    expect(views.length).toBe(4);
    expect(meter.snapshot()[FRAME]).toBe(frames);
    const last = views.at(-1)!;
    expect(stat(last, 'Frames averaged')).toBe(String(frames));
    expect(Math.abs(slope(last))).toBeLessThan(1);
    expect(stat(last, 'Input')).toBe('your data, 8192 samples at 8000 Hz');
    expect(stat(last, 'your data slope (measured)')).toMatch(/no reference\)$/);
  });

  it('reads a random walk as falling about 6 dB per octave', () => {
    let s = 0;
    const walk = white(16384).map((v) => (s += v));
    const last = run(walk).views.at(-1)!;
    expect(slope(last)).toBeGreaterThan(-6.5);
    expect(slope(last)).toBeLessThan(-5.5);
  });

  it('takes the first 48 blocks of a longer series and says so', () => {
    const { views } = run(white(100000));
    expect(views.length).toBe(48);
    expect(stat(views.at(-1)!, 'Frames averaged')).toBe(String((48 * 2048 - 1024) / 512 + 1));
    expect(stat(views.at(-1)!, 'Input')).toBe('your data, 100000 samples at 8000 Hz, the first 98304 used');
  });
});
