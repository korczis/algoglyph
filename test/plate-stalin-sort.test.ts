// Stalin sort's plate: the mirror against the wasm kernel (survivors, outcome, counts), the
// survivors a sorted subsequence of the input that keeps exactly its non-strict left-to-right
// maxima, H_n as their mean on random permutations, and the plate headless.
import { describe, expect, it } from 'vitest';
import plate from '../src/plates/stalin-sort/plate';
import { stalinRun, survivors } from '../src/plates/stalin-sort/stalin';
import { input, runSeed, SHAPES } from '../src/plates/_shared/sort-input/input';
import { harmonic } from '../src/plates/_shared/theory/combinatorics';
import { extremes, headless, kernelRun, lead } from './support/esoteric';

/** The keys a running maximum keeps (each at least every key before it), by a plain loop. */
function records(a: readonly number[]): number[] {
  const out: number[] = [];
  for (const x of a) if (!out.length || x >= out[out.length - 1]) out.push(x);
  return out;
}

describe('stalin sort mirror against the wasm kernel', () => {
  it('keeps the kernel\'s survivors with the kernel\'s counts and outcome', () => {
    for (const shape of SHAPES) {
      for (const n of [0, 1, 2, 3, 17, 256, 512]) {
        const keys = input(shape, n, runSeed(2, n));
        const r = stalinRun(keys);
        const outcome = r.stepper.finish();
        const w = kernelRun('stalin-sort', keys, 0);
        expect(outcome, `${shape} n=${n}`).toBe(w.outcome);
        expect(survivors(r)).toEqual(Array.from(w.output));
        const c = r.stepper.t.counts;
        expect([c.cmp, c.swap, c.write, c.read]).toEqual([w.counts.cmp, w.counts.swap, w.counts.write, w.counts.read]);
        expect(r.stepper.t.steps).toBe(w.counted);
        // the survivors: exactly the running maxima, a sorted subsequence of the input
        expect(survivors(r)).toEqual(records(keys));
        expect(r.state.kept + [...r.state.fate].filter((f) => f === -1).length).toBe(n);
      }
    }
  });

  it('keeps H_n keys on average over random permutations', () => {
    const n = 64;
    let sum = 0;
    const runs = 3000;
    for (let k = 0; k < runs; k++) {
      const r = stalinRun(input('random', n, runSeed(9, k)));
      r.stepper.finish();
      sum += r.state.kept;
    }
    // the variance of the number of records is below H_n, so 4 standard errors stay under 4·sqrt(H_n/runs)
    expect(Math.abs(sum / runs - harmonic(n))).toBeLessThan(4 * Math.sqrt(harmonic(n) / runs));
  });
});

describe('stalin sort plate', () => {
  it('runs headless at every extreme setting', () => {
    for (const params of extremes(plate)) {
      const h = headless(plate, { speed: '16384', ...params });
      for (let f = 0; f < 20000 && (h.stats()['last result'] ?? '–') === '–'; f++) h.frames(1);
      expect(h.stats()['last result'], JSON.stringify(params)).toMatch(/sorted subsequence of the input \(checked\)/);
    }
  });

  it('counts survivors that equal the running maxima of the same inputs', () => {
    const h = headless(plate, { speed: '1024' });
    h.frames(400);
    const s = h.stats();
    const runs = lead(s['finished runs']);
    expect(runs).toBeGreaterThan(3);
    let sum = 0;
    for (let k = 0; k < runs; k++) sum += records(input('random', 64, runSeed(4242, k))).length;
    expect(lead(s['mean survivors per run'])).toBeCloseTo(sum / runs, 2);
    const mean = h.chart()!.series.find((x) => x.name.startsWith('mean'))!;
    expect(mean.points[mean.points.length - 1]).toEqual([64, expect.closeTo(sum / runs, 9)]);
  });
});
