// Burnt pancake sort's plate: the mirror against the wasm kernel on random orientations (output,
// final tags, counts), every start ending in order with every burnt side down within 3n flips,
// the flips recounted by replaying the swaps and turns, and the plate headless.
import { describe, expect, it } from 'vitest';
import { calm } from '../src/core/pace';
import plate from '../src/plates/burnt-pancake-sort/plate';
import { countUp, pancakeRun } from '../src/plates/burnt-pancake-sort/pancake';
import { SOP, STRIDE } from '../src/kernels/sorting-wasm/_abi';
import { DISTINCT, input, isSorted, runSeed, SHAPES } from '../src/plates/_shared/sort-input/input';
import { extremes, headless, kernelRun, lead, S } from './support/esoteric';

/** The pace that runs `k` kernel steps a frame (the old speed select's values). */
const steps = (k: number) => k / calm('stream');

describe('burnt pancake mirror against the wasm kernel', () => {
  it('ends with the kernel\'s stack, tags and counts', () => {
    for (const shape of SHAPES) {
      for (const n of [0, 1, 2, 3, 12, 40, 100]) {
        const seed = runSeed(6, n);
        const keys = input(shape, n, seed);
        const r = pancakeRun(keys, seed, 'random');
        const outcome = r.stepper.finish();
        const w = kernelRun('burnt-pancake-sort', keys, seed);
        expect(outcome, `${shape} n=${n}`).toBe(w.outcome);
        expect(r.a.key).toEqual(Array.from(w.output));
        expect(r.a.tag).toEqual(Array.from(w.tags));
        const c = r.stepper.t.counts;
        expect([c.cmp, c.swap, c.write, c.read]).toEqual([w.counts.cmp, w.counts.swap, w.counts.write, w.counts.read]);
        expect(r.stepper.t.steps).toBe(w.counted);
      }
    }
  });
});

describe('burnt pancake sort', () => {
  it('every start ends in order, burnt sides down, within 3n flips', () => {
    for (const orient of ['random', 'up', 'down'] as const) {
      for (const shape of DISTINCT) {
        for (const n of [1, 2, 5, 12, 40]) {
          const seed = runSeed(8, n);
          const r = pancakeRun(input(shape, n, seed), seed, orient);
          expect(r.stepper.finish()).toBe('sorted');
          expect(isSorted(r.a.key)).toBe(true);
          expect(countUp(r.a)).toBe(0);
          expect(r.state.flips, `${orient} ${shape} n=${n}`).toBeLessThanOrEqual(3 * n);
          if (orient === 'up') expect(r.state.upAtStart).toBe(n);
          if (orient === 'down') expect(r.state.upAtStart).toBe(0);
        }
      }
    }
  });

  it('counts as many flips as the kernel\'s own trace marks', () => {
    for (const n of [3, 12, 30]) {
      const seed = runSeed(10, n);
      const keys = input('random', n, seed);
      const r = pancakeRun(keys, seed, 'random');
      r.stepper.finish();
      const w = S.run('burnt-pancake-sort', keys, { seed, trace: true });
      expect(w.truncated).toBe(false);
      let marks = 0;
      for (let e = 0; e < w.steps.length; e += STRIDE) {
        if ((w.steps[e] & 15) === SOP.mark && w.strings[w.steps[e + 2]] === 'flip') marks++;
      }
      expect(r.state.flips).toBe(marks);
    }
  });
});

describe('burnt pancake plate', () => {
  it('runs headless at every extreme setting', () => {
    for (const params of extremes(plate)) {
      const h = headless(plate, { pace: steps(16384), ...params });
      for (let f = 0; f < 20000 && (h.stats()['last stack'] ?? '–') === '–'; f++) h.frames(1);
      expect(h.stats()['last stack'], JSON.stringify(params)).toBe('in order, every burnt side down (checked)');
    }
  });

  it('charts each stack\'s flips, equal to the same stacks sorted independently', () => {
    const h = headless(plate, { pace: steps(256) });
    h.frames(600);
    const stacks = lead(h.stats()['stacks sorted']);
    expect(stacks).toBeGreaterThan(3);
    const flips = h.chart()!.series[0].points;
    for (let k = 0; k < stacks; k++) {
      const seed = runSeed(4242, k);
      const r = pancakeRun(input('random', 12, seed), seed, 'random');
      r.stepper.finish();
      expect(flips[k]).toEqual([k + 1, r.state.flips]);
    }
  });
});
