// U-signal: yin-pitch runs exactly as before on every seeded input (test/u-signal/same-runs.ts),
// and on a reader's series it tracks that series' pitch at 16 kHz, the plate's rate.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../src/core/catalogue';
import { optionValue, tableOf } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { FRAME, Meter, MUL, type View } from '../../src/engines/signal/trace';
import { kernel as now } from '../../src/kernels/signal/yin-pitch';
import { kernel as before } from '../fixtures/u-signal-before/src/kernels/signal/yin-pitch';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('yin-pitch', now, before);

// The whole seeded run of the kernel alone, every view to its end, at the defaults and every option.
it('yin-pitch: every view of every seeded run, to the end, is the frozen kernel\'s', () => {
  const base: Params = Object.fromEntries(now.params!.map((d) => [d.key, d.value]));
  const corners = [base, ...now.params!.flatMap((d) => (d.kind === 'select' ? d.options.map((o) => ({ ...base, [d.key]: o.value })) : []))];
  const all = (k: typeof now, c: Params) => [...k.run({ ...c }, 7, new Meter())].filter((v) => v !== null);
  for (const c of corners) expect(all(now, c), JSON.stringify(c)).toEqual(all(before, c));
}, 120_000);

describe('yin-pitch on a reader\'s series', () => {
  const decl = ENTRIES.find((e) => e.id === 'yin-pitch')!.data[0];
  const run = (xs: number[], over: Params = {}): { views: View[]; meter: Meter } => {
    const table = tableOf(decl, xs.map((v) => [v]));
    const meter = new Meter();
    const params: Params = { signal: optionValue(decl.id), f0: 196, glide: 7, vib: 30, snr: 25, thr: 0.1, w: '512', h2: 1, ...over };
    const views = [...now.run(params, 3, meter, (id) => (id === decl.id ? table : null))].filter((v): v is View => v !== null);
    return { views, meter };
  };
  const stat = (v: View, label: string) => v.stats.find((s) => s.label === label)?.value;
  // a 220 Hz tone with two harmonics, sampled at the 16 kHz the note states
  const tone = (n: number) => Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * 220 * i) / 16000;
    return Math.sin(t) + 0.5 * Math.sin(2 * t) + 0.25 * Math.sin(3 * t);
  });

  it('finds the reader\'s pitch in every frame, read at 16 kHz, with no true pitch claimed', () => {
    const { views, meter } = run(tone(4000));
    const frames = Math.floor((4000 - 512 - 400) / 256) + 1;
    expect(views.length).toBe(frames);
    expect(meter.snapshot()[FRAME]).toBe(frames);
    expect(meter.snapshot()[MUL]).toBe(frames * (512 * 400 + 2 * 400));
    for (const v of views) expect(Math.abs(parseFloat(stat(v, 'Detected')!) - 220)).toBeLessThan(0.5);
    const last = views.at(-1)!;
    expect(stat(last, 'Input')).toBe('your data, 4000 samples at 16000 Hz');
    expect(stat(last, 'True pitch')).toMatch(/^no reference/);
    expect(last.stats.some((s) => /error/i.test(s.label))).toBe(false);
  });

  it('takes the first 1.5 s of a longer series, and the window control still applies', () => {
    const { views } = run(tone(30000), { w: '256' });
    expect(views.length).toBe(Math.floor((24000 - 256 - 400) / 256) + 1);
    expect(stat(views.at(-1)!, 'Input')).toBe('your data, 30000 samples at 16000 Hz, the first 24000 used');
  });
});
