// The closest-pair plate's brute-force leaf size as a control: its default is the constant it
// replaced (3), it round-trips through a shared link, and at every leaf size the closest distance
// is the brute-force one while the distance computations stay within the divide and conquer's
// hard bound, n(L − 1)/2 for the leaves plus 7n for each combine level.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { defaults, type ParamDef, type RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { makeInput } from '../src/engines/geometry/input';
import { record } from '../src/engines/geometry/trace';
import { kernel } from '../src/kernels/geometry/closest-pair';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SEEDS = [4242, 7, 1];
const SHAPES = ['uniform', 'clustered', 'circle', 'disk', 'lattice'];

// Compared within one run: the explicit default against no param. A hash recorded on one machine is
// no guard: its inputs carry float64 from sin and cos, which may differ by an ulp on another CPU.

/** Combine levels: the depths at which the largest node, ⌈n/2^t⌉ points, is still above L. */
function levels(n: number, L: number): number {
  let t = 0;
  for (let m = n; m > L; m = Math.ceil(m / 2)) t++;
  return t;
}

/** The hard bound: leaves of s ≤ L points make s(s − 1)/2 ≤ s(L − 1)/2 distance computations,
 * n(L − 1)/2 in all, and each combine level at most 7 per point (the packing argument). */
const bound = (n: number, L: number) => (n * (L - 1)) / 2 + 7 * n * levels(n, L);

const claim = (readout: string, params: Record<string, number>): Claim => ({
  id: 'probe', statement: '', readout, expect: { value: 0 }, setup: { params },
});

describe('closest-pair defaults', () => {
  it('measure exactly what the fixed leaf size did', () => {
    const hash = (params: Record<string, number>) => {
      const h = createHash('sha256');
      for (const shape of SHAPES) {
        for (const n of [2, 3, 17, 160, 1000]) {
          for (const seed of SEEDS) {
            const t = record(kernel, makeInput('points', shape, n, seed), params, seed, false);
            h.update(JSON.stringify({ outcome: t.outcome, counts: t.counts }));
          }
        }
      }
      return h.digest('hex');
    };
    expect(hash({ leaf: 3 })).toBe(hash({}));
  });
});

describe('closest-pair leaf (brute-force leaf size)', () => {
  // 3 is also the top: at 2000 points every larger leaf makes more distance computations and more
  // counted work in all than the default's heaviest input (lattice, 50145 at L = 3, 51040 at L = 4,
  // 60427 at L = 16), so the range is narrowed to what costs no more than today
  it('is a range control 2..16 by 1 whose default is the old constant 3', async () => {
    const plate = await loadPlate('closest-pair');
    const d = plate!.params.find((p) => p.key === 'leaf') as RangeParam | undefined;
    expect(d).toBeDefined();
    expect({ kind: d!.kind, label: d!.label, min: d!.min, max: d!.max, step: d!.step, value: d!.value })
      .toEqual({ kind: 'range', label: 'Brute-force leaf size', min: 2, max: 16, step: 1, value: 3 });
  });

  it('round-trips through a shared link', async () => {
    const plate = await loadPlate('closest-pair');
    const defs: ParamDef[] = plate!.params;
    const back = parse(defs, serialise(defs, { ...defaults(plate!), leaf: 2 }, 7));
    expect(back.seed).toBe(7);
    expect(back.params.leaf).toBe(2);
  });

  it('finds the brute-force distance at every leaf size, within n(L − 1)/2 + 7n · levels', () => {
    for (const shape of SHAPES) {
      for (const n of [2, 3, 17, 160]) {
        for (const seed of SEEDS) {
          const input = makeInput('points', shape, n, seed);
          const P = input.points;
          let brute = Infinity;
          for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) brute = Math.min(brute, Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y));
          const counts = new Set<number>();
          for (const leaf of [2, 3]) {
            const t = record(kernel, input, { leaf }, seed, false);
            const at = `${shape} n=${n} seed=${seed} leaf=${leaf}`;
            expect((t.outcome.result as { d: number }).d, at).toBe(brute);
            expect(t.counts.dist, at).toBeLessThanOrEqual(bound(P.length, leaf));
            counts.add(t.counts.dist);
          }
          // the leaf size is felt: past a few points the work differs between leaf sizes
          if (P.length >= 17) expect(counts.size, `${shape} n=${n} seed=${seed}`).toBeGreaterThan(1);
        }
      }
    }
  });

  it('reads within the bound at L = 2 and L = 3 for the default 160 points', async () => {
    expect([bound(160, 2), bound(160, 3)]).toEqual([7920, 6880]);
    for (const leaf of [2, 3]) {
      const r = await read('closest-pair', claim('Distance computations', { leaf }));
      expect(r.reason, `leaf=${leaf}`).toBeUndefined();
      expect(r.value!, `leaf=${leaf}`).toBeLessThanOrEqual(bound(160, leaf));
    }
  }, 120_000);
});
