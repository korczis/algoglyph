// Worstsort's plate: the mirror against the wasm kernel for every n the kernel takes (and its
// refusal past five), the other levels against a plain recursive transcription of Lerma's
// definition, the bubble sort's comparisons and swaps against what the list itself determines,
// and the plate headless at every extreme setting.
import { describe, expect, it } from 'vitest';
import { calm } from '../src/core/pace';
import plate from '../src/plates/worstsort/plate';
import {
  bubbleCost, bubbleItems, kernelLevels, permutations, worstRun, type Val,
} from '../src/plates/worstsort/worstsort';
import { input, runSeed, SHAPES } from '../src/plates/_shared/sort-input/input';
import { factorial } from '../src/plates/_shared/theory/combinatorics';
import { extremes, headless, kernelRun, lead } from './support/esoteric';

/** The pace that runs `k` kernel steps a frame (the old speed select's values). */
const steps = (k: number) => k / calm('stream');

/** Lerma's badsort, transcribed plainly (recursion, no generators): the independent reference. */
function reference(keys: number[], k: number): { out: number[]; cmp: number } {
  let cmp = 0;
  const lex = (a: Val, b: Val): number => {
    if (!Array.isArray(a) && !Array.isArray(b)) {
      cmp++;
      return Math.sign(a.key - b.key);
    }
    const x = a as Val[];
    const y = b as Val[];
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const o = lex(x[i], y[i]);
      if (o) return o;
    }
    return Math.sign(x.length - y.length);
  };
  const bad = (l: Val[], level: number): Val[] => {
    if (level === 0) {
      const a = l.slice();
      for (let p = 0; p < a.length; p++) {
        let swapped = false;
        for (let i = 0; i + 1 < a.length - p; i++) {
          if (lex(a[i], a[i + 1]) > 0) {
            [a[i], a[i + 1]] = [a[i + 1], a[i]];
            swapped = true;
          }
        }
        if (!swapped) break;
      }
      return a;
    }
    return bad(permutations(l), level - 1)[0] as Val[];
  };
  const out = bad(keys.map((key, tag) => ({ key, tag })), k) as { key: number }[];
  return { out: out.map((x) => x.key), cmp };
}

describe('worstsort mirror against the wasm kernel', () => {
  it('ends with the kernel\'s output and counts for every n it takes, and refuses six', () => {
    for (const shape of SHAPES) {
      for (const n of [0, 1, 2, 3, 4, 5, 6]) {
        const keys = input(shape, n, runSeed(4, n));
        const r = worstRun(keys);
        const outcome = r.stepper.finish();
        const w = kernelRun('worstsort', keys, 0);
        expect(outcome, `${shape} n=${n}`).toBe(w.outcome);
        expect(r.keys).toEqual(Array.from(w.output));
        const c = r.stepper.t.counts;
        expect([c.cmp, c.swap, c.write, c.read]).toEqual([w.counts.cmp, w.counts.swap, w.counts.write, w.counts.read]);
        expect(r.stepper.t.steps).toBe(w.counted);
        expect(outcome).toBe(n > 5 ? 'truncated' : 'sorted');
      }
    }
  });
});

describe('worstsort levels', () => {
  it('matches a plain transcription of the definition at every feasible level', () => {
    for (const [n, k] of [[2, 0], [2, 1], [2, 2], [2, 3], [3, 0], [3, 1], [3, 2], [4, 1], [5, 0], [5, 1]]) {
      const keys = input('random', n, runSeed(12, n * 10 + k));
      const r = worstRun(keys, k);
      expect(r.stepper.finish()).toBe('sorted');
      const ref = reference(keys, k);
      expect(r.keys, `n=${n} k=${k}`).toEqual(ref.out);
      expect(r.stepper.t.counts.cmp, `n=${n} k=${k}`).toBe(ref.cmp);
      expect(r.keys).toEqual([...keys].sort((a, b) => a - b));
    }
    expect(kernelLevels(2)).toBe(2);
    expect(kernelLevels(5)).toBe(1);
    expect(bubbleItems(3, 2)).toBe(720);
    expect(bubbleItems(4, 2)).toBe(Infinity);
  });

  it('the bubble sort does exactly what its list determines: swaps = inversions, passes', () => {
    for (const shape of ['random', 'reversed', 'sorted', 'few-unique'] as const) {
      for (const [n, k] of [[3, 1], [4, 1], [5, 1], [3, 2]]) {
        const r = worstRun(input(shape, n, runSeed(14, n)), k);
        const st = r.state;
        // the list as handed to the bubble sort, rebuilt from the definition
        let list: Val[] = input(shape, n, runSeed(14, n)).map((key, tag) => ({ key, tag }));
        for (let l = 0; l < k; l++) list = permutations(list);
        const cost = bubbleCost(list);
        r.stepper.finish();
        expect(st.list!.length).toBe(n === 3 && k === 2 ? 720 : factorial(n));
        expect(st.swaps, `${shape} n=${n} k=${k}`).toBe(cost.inversions);
        expect(st.lex).toBe(cost.lex[cost.lex.length - 1]);
        expect(st.passLex).toEqual(cost.lex);
      }
    }
  });
});

describe('worstsort plate', () => {
  it('runs headless at every extreme setting and finishes a run', () => {
    for (const params of extremes(plate)) {
      const h = headless(plate, { pace: steps(16384), ...params });
      for (let f = 0; f < 4000 && !/^[1-9]/.test(h.stats()['runs finished'] ?? ''); f++) h.frames(1);
      expect(h.stats()['runs finished'], JSON.stringify(params)).toMatch(/^[1-9].*sorted \(checked\)/);
    }
  });

  it('says so when the levels asked are beyond reach, and runs the kernel\'s f(n) instead', () => {
    const h = headless(plate, { n: 5, levels: '2' });
    h.frames(2);
    expect(h.stats().levels).toMatch(/^1 = f\(n\) \(asked 2: a list of astronomically many items is beyond reach\)$/);
  });

  it('counts what the kernel counts on the same input', async () => {
    const h = headless(plate, { n: 4, pace: steps(16384) });
    await new Promise((r) => setTimeout(r, 0));
    for (let f = 0; f < 400 && !/^[1-9]/.test(h.stats()['runs finished'] ?? ''); f++) h.frames(1);
    const s = h.stats();
    const w = kernelRun('worstsort', input('random', 4, runSeed(4242, 0)), 0);
    expect(lead(s['key comparisons, counted live'])).toBe(w.counts.cmp);
    expect(s['kernel (wasm) on this input']).toBe(`${w.counts.cmp.toLocaleString('en-US')} key comparisons, sorted`);
    const [counted, exact] = h.chart()!.series;
    expect(counted.points[counted.points.length - 1]).toEqual(exact.points[exact.points.length - 1]);
  });
});
