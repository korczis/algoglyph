// fibonacci-sphere's readouts (wave 7b). D6: the mean edge chord was shown against "4/3 for
// random points", the mean distance between two independent uniform points on the unit sphere.
// That is the continuum's mean; the baseline for these vertices is a random assignment of them
// to the same n lattice points, and a uniformly random bijection sends each edge to a uniformly
// random pair of distinct points, so its expected edge chord is exactly the mean chord over the
// lattice's pairs. At small n that mean lies well above 4/3, and an edge chord between the two
// read as worse than random when it is better. The lattice is computed here from its formula
// (height 1 - (2i + 1)/n, turn by the golden angle), not from the kernel.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph } from '../src/engines/graph/graph';
import { repeatedLabels, settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const RANDOM = 'Mean chord of a random assignment';

function lattice(n: number): [number, number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const h = 1 - (2 * i + 1) / n;
    const r = Math.sqrt(1 - h * h);
    const turn = i * Math.PI * (3 - Math.sqrt(5));
    return [r * Math.cos(turn), h, r * Math.sin(turn)];
  });
}

const chord = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The mean chord over the lattice's n(n - 1)/2 pairs of distinct points. */
function latticeMean(n: number): number {
  const p = lattice(n);
  let sum = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) sum += chord(p[i], p[j]);
  return sum / ((n * (n - 1)) / 2);
}

function* permutations(n: number): Generator<number[]> {
  const a = Array.from({ length: n }, (_, i) => i);
  const c = new Array<number>(n).fill(0);
  yield a.slice();
  for (let i = 0; i < n;) {
    if (c[i] < i) {
      const j = i % 2 ? c[i] : 0;
      [a[j], a[i]] = [a[i], a[j]];
      yield a.slice();
      c[i]++;
      i = 0;
    } else { c[i] = 0; i++; }
  }
}

const value = (rows: { label: string; value: string }[], label: string) =>
  rows.find((r) => r.label === label)?.value;

describe('fibonacci-sphere compares the edge chord with a random assignment (D6)', () => {
  it('at n 8, small-world, seed 4242 the edge chord lies above 4/3 and below the baseline',
    async () => {
      const rows = await settledRows('fibonacci-sphere', { shape: 'small-world', n: 8 } as never,
        DEFAULT_SEED);
      const shown = rows.map((r) => `${r.label}: ${r.value}`).join(' | ');
      const edge = Number.parseFloat(value(rows, 'Mean edge chord') ?? 'NaN');
      expect(edge, shown).toBeGreaterThan(4 / 3);
      expect(edge, shown).toBeLessThan(latticeMean(8));
      expect(value(rows, RANDOM), shown).toBe(latticeMean(8).toFixed(3));
      expect(rows.map((r) => r.value).join(' '), shown).not.toContain('4/3');
      expect(repeatedLabels(rows)).toEqual([]);
    });

  for (const shape of ['small-world', 'communities', 'geometric', 'grid']) {
    for (const n of [4, 16, 160, 400]) {
      it(`shows the lattice's mean pairwise chord: ${shape}, n ${n}`, async () => {
        const rows = await settledRows('fibonacci-sphere', { shape, n } as never, DEFAULT_SEED);
        // the vertex count the input built (a grid rounds n to its rows and columns)
        const vertices = Number.parseInt(value(rows, 'Graph') ?? 'NaN', 10);
        expect(vertices).toBe(makeGraph(shape as never, n, DEFAULT_SEED, 16 / 9).n);
        expect(value(rows, RANDOM)).toBe(latticeMean(vertices).toFixed(3));
      });
    }
  }

  it('is the expected edge chord over every assignment of the vertices to the points', () => {
    for (const n of [4, 6, 7]) for (const seed of [DEFAULT_SEED, 7]) {
      const g = makeGraph('small-world', n, seed, 16 / 9);
      const p = lattice(g.n);
      let sum = 0; let count = 0;
      for (const slot of permutations(g.n)) {
        let s = 0;
        for (let e = 0; e < g.m; e++) s += chord(p[slot[g.eu[e]]], p[slot[g.ev[e]]]);
        sum += s / g.m;
        count++;
      }
      expect(count).toBe([1, 2, 3, 4, 5, 6, 7].slice(0, g.n).reduce((a, b) => a * b, 1));
      expect(sum / count).toBeCloseTo(latticeMean(g.n), 12);
    }
  });
});
