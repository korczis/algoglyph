// Bin packing against references written here: an exhaustive search for the optimum, the
// defining property of each heuristic replayed from its placements, and the known worst-case
// bounds checked on random small inputs.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { ALGORITHMS, CAPACITY, decreasing, EXACT_MAX, items, lowerBound, optimum, pack, SHAPES,
  type Packing } from '../src/plates/bin-packing/packing';
import { advance, binPacking, build } from '../src/plates/bin-packing/plate';
import { p5Stub } from './support/p5-stub';

const SIZES = [0, 1, 2, 5, 13, 64, 256];

/** The fewest bins by trying every assignment of items to bins (no pruning but capacity). */
function brute(sizes: number[], cap = CAPACITY): number {
  let best = sizes.length;
  const loads: number[] = [];
  const go = (i: number) => {
    if (loads.length >= best) return;
    if (i === sizes.length) { best = loads.length; return; }
    for (let b = 0; b < loads.length; b++) {
      if (loads[b] + sizes[i] > cap) continue;
      loads[b] += sizes[i];
      go(i + 1);
      loads[b] -= sizes[i];
    }
    loads.push(sizes[i]);
    go(i + 1);
    loads.pop();
  };
  go(0);
  return best;
}

/** Bin loads seen by each placement as it happened, from the placements alone. */
function replay(p: Packing, each: (loads: number[], i: number) => void): number[] {
  const loads: number[] = [];
  p.placements.forEach((q, i) => {
    each(loads, i);
    if (q.opened) {
      expect(q.bin).toBe(loads.length);
      loads.push(0);
    } else expect(q.bin).toBeLessThan(loads.length);
    loads[q.bin] += q.size;
  });
  return loads;
}

describe('bin packing heuristics', () => {
  for (const algorithm of ALGORITHMS) {
    describe(algorithm, () => {
      it('places every item exactly once, never past capacity, and counts its fit tests', () => {
        for (const shape of SHAPES) {
          for (const n of SIZES) {
            const sizes = items(shape, n, 100 + n);
            const p = pack(algorithm, sizes);
            expect(p.placements.map((q) => q.item).sort((a, b) => a - b)).toEqual(sizes.map((_, i) => i));
            for (const q of p.placements) expect(q.size).toBe(sizes[q.item]);
            let tests = 0;
            const loads = replay(p, (open, i) => {
              const q = p.placements[i];
              tests += algorithm === 'next-fit' ? (i > 0 ? 1 : 0) : q.opened ? open.length : q.bin + 1;
            });
            expect(loads).toEqual(p.loads);
            expect(p.tests, `${shape} n=${n}`).toBe(tests);
            for (const l of loads) {
              expect(l).toBeGreaterThan(0);
              expect(l).toBeLessThanOrEqual(CAPACITY);
            }
            expect(loads.length).toBeGreaterThanOrEqual(lowerBound(sizes));
          }
        }
      });
    });
  }

  it('next fit only ever adds to its newest bin, and neighbouring bins overflow one bin together', () => {
    for (const shape of SHAPES) {
      const sizes = items(shape, 200, 7);
      const p = pack('next-fit', sizes);
      replay(p, (open, i) => {
        const q = p.placements[i];
        if (!q.opened) expect(q.bin).toBe(open.length - 1);
        else if (open.length) expect(open[open.length - 1] + q.size).toBeGreaterThan(CAPACITY);
      });
      for (let b = 1; b < p.loads.length; b++) expect(p.loads[b - 1] + p.loads[b]).toBeGreaterThan(CAPACITY);
      const total = sizes.reduce((a, b) => a + b, 0);
      expect(p.loads.length).toBeLessThan((2 * total) / CAPACITY + 1);
    }
  });

  it('first fit and first fit decreasing use the earliest bin with room', () => {
    for (const algorithm of ['first-fit', 'first-fit-decreasing'] as const) {
      for (const shape of SHAPES) {
        const p = pack(algorithm, items(shape, 150, 9));
        replay(p, (open, i) => {
          const q = p.placements[i];
          const first = open.findIndex((l) => l + q.size <= CAPACITY);
          expect(q.opened ? -1 : q.bin).toBe(first);
        });
      }
    }
  });

  it('first fit decreasing places the items largest first, stable, within n lg n comparisons', () => {
    for (const shape of SHAPES) {
      const sizes = items(shape, 97, 3);
      const p = pack('first-fit-decreasing', sizes);
      const order = p.placements.map((q) => q.item);
      const want = sizes.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map((x) => x[1]);
      expect(order).toEqual(want);
      expect(p.compares).toBe(decreasing(sizes).compares);
      expect(p.compares).toBeLessThanOrEqual(sizes.length * Math.ceil(Math.log2(sizes.length)));
    }
  });

  it('finds the exact optimum, and every heuristic stays inside its proven bound', () => {
    const rnd = mulberry32(2024);
    for (let trial = 0; trial < 300; trial++) {
      const n = 1 + Math.floor(rnd() * 9);
      const sizes = Array.from({ length: n }, () => 1 + Math.floor(rnd() * CAPACITY));
      const opt = brute(sizes);
      expect(optimum(sizes), JSON.stringify(sizes)).toBe(opt);
      expect(opt).toBeGreaterThanOrEqual(lowerBound(sizes));
      const nf = pack('next-fit', sizes).loads.length;
      const ff = pack('first-fit', sizes).loads.length;
      const ffd = pack('first-fit-decreasing', sizes).loads.length;
      for (const b of [nf, ff, ffd]) expect(b).toBeGreaterThanOrEqual(opt);
      expect(nf).toBeLessThanOrEqual(2 * opt - 1);
      expect(ff).toBeLessThanOrEqual(Math.floor(1.7 * opt));
      expect(ffd).toBeLessThanOrEqual((11 / 9) * opt + 6 / 9);
    }
    expect(() => optimum(new Array(EXACT_MAX + 1).fill(1))).toThrow(RangeError);
  });

  it('halves and crumbs cost next fit nearly twice the bins of first fit decreasing', () => {
    const sizes = items('halves', 256, 11);
    const nf = pack('next-fit', sizes).loads.length;
    const ffd = pack('first-fit-decreasing', sizes).loads.length;
    expect(nf).toBe(sizes.length / 2);
    expect(nf).toBeGreaterThan(1.8 * ffd);
  });
});

describe('bin packing plate', () => {
  it('replays every placement and recounts the fit tests the heuristics report', () => {
    for (const shape of SHAPES) {
      const run = build(shape, 120, 5);
      for (const lane of run.lanes) {
        while (lane.at < lane.packing.placements.length) advance(lane, 7);
        expect(lane.loads).toEqual(lane.packing.loads);
        expect(lane.tests).toBe(lane.packing.tests);
        expect(lane.curve[lane.curve.length - 1]).toEqual([120, lane.packing.loads.length]);
      }
      expect(run.exact).toBeNull();
      expect(build(shape, 8, 5).exact).toBe(brute(items(shape, 8, 5)));
    }
  });

  it('runs to the end of a run and into the next one, publishing its readouts', () => {
    const rows: string[][] = [];
    const params = Object.fromEntries(binPacking.params.map((d) => [d.key, d.value]));
    params.speed = 32;
    const sim = binPacking.create(p5Stub(), {
      width: 390, height: 219, params, seed: 1, rnd: mulberry32(1), theme: 'dark',
      bg: [0, 0, 0], fg: [255, 255, 255], thumbnail: false,
      palette: () => ({ id: 'x', label: 'x', stops: [[0, 0, 0], [255, 255, 255]] }),
      stats: (r) => rows.push(r.map((x) => x.value)), chart: () => {},
    });
    sim.setup();
    for (let f = 0; f < 200; f++) sim.draw();
    expect(rows.length).toBe(200);
    expect(rows.some((r) => r[0].startsWith('0 bins'))).toBe(true);
  });
});
