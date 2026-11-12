// Where the esoteric sorting plates' claims get their figures (catalogue/entries/*.md `claims`,
// read by test/claims.test.ts): an exact claim's value is the plate's own theory at the claim's
// setup, and a randomized claim's tolerance is four standard errors of the mean over the claim's
// completed runs, from the exact variance averaged over the inputs, plus the readouts' rounding;
// never a width chosen after the run. The variances are checked against independent runs.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from '../src/core/claims';
import { input, runSeed } from '../src/plates/_shared/sort-input/input';
import { factorial, harmonic } from '../src/plates/_shared/theory/combinatorics';
import { bbsRun, shufflesVariance as bbsVariance } from '../src/plates/bogobogosort/bogobogosort';
import { bogoRun, shufflesVariance as bogoVariance } from '../src/plates/bogosort/bogosort';
import { bozoRun, swapsVariance } from '../src/plates/bozosort/bozosort';
import { slowComparisons } from '../src/plates/slowsort/slowsort';
import { stoogeComparisons } from '../src/plates/stooge-sort/stooge';

interface Entry { id: string; claims: Claim[] }
const { model } = loadCatalogue(process.cwd()) as { model: { entries: Entry[] } };
const claimOf = (id: string): Claim => {
  const e = model.entries.find((x) => x.id === id);
  expect(e?.claims.length, id).toBe(1);
  return e!.claims[0];
};
const param = (c: Claim, k: string) => c.setup?.params?.[k];

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  return permutations(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n, ...p.slice(i)]));
}

/** The variance of one run's count given its input, averaged over the inputs of n distinct keys. */
const meanVariance = (n: number, variance: (keys: number[]) => number) => {
  const all = permutations(n);
  return all.reduce((s, p) => s + variance(p), 0) / all.length;
};

function sampleVariance(xs: number[]): number {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
}

/** Independent runs on one input: the sample variance of their counts. */
function simulated(runs: number, count: (seed: number) => number): number {
  return sampleVariance(Array.from({ length: runs }, (_, k) => count(runSeed(77, k))));
}

/** Each randomized claim: the variance of one run averaged over its inputs, the readouts' unit. */
const RANDOMIZED: { id: string; variance: (n: number) => number; unit: number }[] = [
  { id: 'bogosort', variance: (n) => meanVariance(n, bogoVariance), unit: 0.1 },
  { id: 'bozosort', variance: (n) => meanVariance(n, swapsVariance), unit: 0.1 },
  { id: 'bogobogosort', variance: (n) => meanVariance(n, bbsVariance), unit: 0.1 },
  {
    id: 'stalin-sort', unit: 0.01,
    // the survivors of distinct keys are their left-to-right maxima: key i is one with
    // probability 1/i, independently, so their variance is Σ (1/i)(1 − 1/i) = H_n − Σ 1/i²
    variance: (n) => {
      let v = 0;
      for (let i = 1; i <= n; i++) v += 1 / i - 1 / (i * i);
      return v;
    },
  },
];

describe('the esoteric randomized claims', () => {
  for (const r of RANDOMIZED) {
    it(`${r.id}: the tolerance is four standard errors over its completed runs, plus rounding`, () => {
      const c = claimOf(r.id);
      const n = Number(param(c, 'n'));
      const runs = Number(param(c, 'runs'));
      expect(param(c, 'shape'), r.id).toBe('random');
      expect(runs, r.id).toBeGreaterThanOrEqual(100);
      const se = Math.sqrt(r.variance(n) / runs);
      // the two readouts are each rounded to `unit`: their difference may be off by one unit
      const tol = c.expect.tolerance as number;
      expect(tol, r.id).toBeGreaterThanOrEqual(4 * se + r.unit - 1e-9);
      expect(tol, r.id).toBeLessThanOrEqual(4 * se + 2 * r.unit);
    });
  }

  it('the stalin claim compares with H_n, 4.74 at its n', () => {
    expect(harmonic(Number(param(claimOf('stalin-sort'), 'n'))).toFixed(2)).toBe('4.74');
  });
});

describe('the variances, against independent runs', () => {
  // the sample variance of a heavy-tailed count wanders by several percent at these sizes
  const close = (sim: number, exact: number) => expect(Math.abs(sim / exact - 1)).toBeLessThan(0.15);

  it('bogosort: n!(n! − 1) for distinct keys, 0 when sorted', () => {
    expect(bogoVariance([1, 2, 3, 4])).toBe(0);
    expect(bogoVariance([2, 1, 3, 4])).toBe(24 * 23);
    expect(bogoVariance([2, 1, 1, 2])).toBe(6 * 5);
    close(simulated(6000, (s) => { const x = bogoRun([4, 3, 2, 1], s); x.stepper.finish(); return x.state.shuffles; }), 24 * 23);
  });

  it('bozosort: from the chain\'s second moment', () => {
    expect(swapsVariance([1, 2, 3, 4])).toBe(0);
    for (const keys of [[4, 3, 2, 1], [2, 1, 3, 4, 5]]) {
      close(simulated(6000, (s) => { const x = bozoRun(keys, s); x.stepper.finish(); return x.state.swaps; }), swapsVariance(keys));
    }
  });

  it('bogobogosort: the failing prefixes\' V_m add', () => {
    expect(bbsVariance([1, 2, 3, 4])).toBe(0);
    for (const keys of [[4, 3, 2, 1], [1, 2, 4, 3]]) {
      close(simulated(6000, (s) => { const x = bbsRun(keys, s); x.stepper.finish(); return x.state.shuffles; }), bbsVariance(keys));
    }
  });

  it('every input of the claims\' size is covered by the average', () => {
    expect(permutations(5).length).toBe(factorial(5));
    expect(new Set(permutations(5).map((p) => p.join())).size).toBe(factorial(5));
    // a Random permutation is one of them
    expect([...input('random', 5, runSeed(4242, 0))].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('the esoteric exact claims', () => {
  it('slowsort and stooge sort: the recurrence at the claim\'s n', () => {
    const s = claimOf('slowsort');
    expect(s.expect.value).toBe(slowComparisons(Number(param(s, 'n'))));
    const t = claimOf('stooge-sort');
    expect(t.expect.value).toBe(stoogeComparisons(Number(param(t, 'n'))));
  });

  it('worstsort: n! − 1 on sorted keys at one level', () => {
    const c = claimOf('worstsort');
    expect([param(c, 'shape'), param(c, 'levels')]).toEqual(['sorted', '1']);
    expect(c.expect.value).toBe(factorial(Number(param(c, 'n'))) - 1);
  });

  it('burnt pancake sort: 3n − 2 on a sorted stack, every burnt side up', () => {
    const c = claimOf('burnt-pancake-sort');
    expect([param(c, 'shape'), param(c, 'orient')]).toEqual(['sorted', 'up']);
    expect(c.expect.value).toBe(3 * Number(param(c, 'n')) - 2);
  });
});
