// Miracle sort's plate: its check against the wasm kernel (counts, outcome, an untouched array),
// the repeated checks counted and charted, nothing ever written, and the plate headless at every
// extreme setting.
import { describe, expect, it } from 'vitest';
import plate from '../src/plates/miracle-sort/plate';
import { miracleCheck } from '../src/plates/miracle-sort/miracle';
import { items, Stepper, Tracer } from '../src/plates/_shared/kernel-mirror/tracer';
import { input, runSeed, SHAPES } from '../src/plates/_shared/sort-input/input';
import { extremes, headless, kernelRun, lead } from './support/esoteric';

/** Position of the first descent, counted by a plain loop (0: none). */
function firstDescent(a: readonly number[]): number {
  for (let i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return i;
  return 0;
}

describe('miracle sort check against the wasm kernel', () => {
  it('compares up to the first descent, writes nothing and reports what the kernel reports', () => {
    for (const shape of SHAPES) {
      for (const n of [0, 1, 2, 5, 64, 256]) {
        const keys = input(shape, n, runSeed(1, n));
        const a = items(keys);
        const t = new Tracer(0);
        const st = { descent: -1 };
        const outcome = new Stepper(miracleCheck(t, a, st), t).finish();
        const w = kernelRun('miracle-sort', keys, 0);
        expect(outcome, `${shape} n=${n}`).toBe(w.outcome);
        expect(a.key).toEqual(keys);
        expect(Array.from(w.output)).toEqual(keys);
        expect([t.counts.cmp, t.counts.swap, t.counts.write, t.counts.read])
          .toEqual([w.counts.cmp, w.counts.swap, w.counts.write, w.counts.read]);
        expect(t.steps).toBe(w.counted);
        const d = firstDescent(keys);
        expect(t.counts.cmp).toBe(d ? d : Math.max(0, n - 1));
        expect(outcome).toBe(d ? 'not-a-sort' : 'sorted');
      }
    }
  });
});

describe('miracle sort plate', () => {
  it('runs headless at every extreme setting', () => {
    for (const params of extremes(plate)) {
      const h = headless(plate, params);
      h.frames(80);
      expect(h.stats()['array against its input'], JSON.stringify(params)).toBe('unchanged (compared key by key)');
    }
  });

  it('checks again and again, the same comparisons each time, and never writes', () => {
    const h = headless(plate, { wait: 0, speed: '256' });
    h.frames(300);
    const s = h.stats();
    const checks = lead(s.checks);
    expect(checks).toBeGreaterThan(50);
    const keys = input('random', 24, runSeed(4242, 0));
    const d = firstDescent(keys);
    expect(lead(s['comparisons in the last check'])).toBe(d);
    expect(lead(s['comparisons, all checks'])).toBeGreaterThanOrEqual(checks * d);
    expect(lead(s['writes and swaps to the array'])).toBe(0);
    const [cmp, inv, wr] = h.chart()!.series;
    expect(new Set(cmp.points.map((q) => q[1]))).toEqual(new Set([d]));
    expect(new Set(inv.points.map((q) => q[1])).size).toBe(1);
    expect(new Set(wr.points.map((q) => q[1]))).toEqual(new Set([0]));
  });

  it('on Already sorted it finishes after one check of n − 1 comparisons', () => {
    const h = headless(plate, { shape: 'sorted', n: 40, speed: '16384' });
    h.frames(20);
    expect(lead(h.stats().checks)).toBe(1);
    expect(lead(h.stats()['comparisons, all checks'])).toBe(39);
    expect(h.stats().outcome).toBe('sorted (the input was)');
  });
});
