// D8 (wave 7b): label-propagation and louvain-leiden each carried their own Fisher–Yates shuffle,
// the same draws in the same order as src/core/random.ts `shuffle`. A graph kernel shuffles
// through that one function; derived from the tree, so a new kernel is judged at once.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { mulberry32, shuffle } from '../src/core/random';

const KERNELS = resolve('src/kernels/graph');
// j = floor(rnd() * (i + 1)), the draw of a Fisher–Yates step, however the generator is reached
const DRAW = /Math\.floor\(\s*[\w.]*rnd\(\)\s*\*\s*\(\s*\w+\s*\+\s*1\s*\)\s*\)/;

describe('graph kernels shuffle through core/random (D8)', () => {
  it('no graph kernel carries its own Fisher–Yates', () => {
    const own = readdirSync(KERNELS).filter((f) => f.endsWith('.ts'))
      .filter((f) => DRAW.test(readFileSync(join(KERNELS, f), 'utf8')));
    expect(own).toEqual([]);
  });

  // The loop label-propagation and louvain-leiden carried, verbatim: shuffling through `shuffle`
  // changes no draw, so every run of either kernel is unchanged. Compared within one run.
  function inline(n: number, rnd: () => number): number[] {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  it('draws the same permutation in the same order as the loops it replaces', () => {
    for (const seed of [DEFAULT_SEED, 7, 1]) for (let n = 0; n <= 300; n++) {
      const a = mulberry32(seed + n); const b = mulberry32(seed + n);
      expect(shuffle(Array.from({ length: n }, (_, i) => i), a)).toEqual(inline(n, b));
      expect(a(), `the generator is left where the loop left it (n ${n})`).toBe(b());
    }
  });
});
