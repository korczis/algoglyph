// Every exact count and every hard inequality the parallel shelf states in a bound
// (catalogue/entries/*.md, ADR 0006 §4), driven at several n and input shapes and compared with
// what the array engine counts for the plate: Comparisons, Array writes (an exchange is two
// writes, a copy one), Auxiliary writes (every cell of a drawn structure that changes), and the
// Rounds, Lanes and Phase readouts, counted from the kernel's own round(), lane() and phase()
// events (test/kernels-sorting-wasm.test.ts checks them equal to Rust's). Every kernel of the shelf
// is a wasm kernel, played as its sidecar record maps it (src/kernels/sorting-wasm) and replayed
// through the array engine. The processors are simulated one after another; a Rounds readout
// counts the steps every processor runs, never time.
// Parallel time (the PRAM and distributed bounds the entries cite) is not a readout and is not
// checked here; nor are the asymptotic bounds. That every kernel sorts every shape and size is
// test/kernels-sorting-wasm.test.ts ("leaves every input shape and size sorted, as an independent
// reference does"), and that the stable ones keep equal keys in order is its identity replay.
import { describe, expect, it } from 'vitest';
import { input, OP, SHAPES, trace, type Trace } from '../src/engines/array/trace';
import { loadSorting } from '../src/kernels/sorting-wasm/_abi';
import { seedOf, sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';

const IDS = ['enumeration-sort', 'samplesort', 'parallel-samplesort', 'psrs', 'ips4o', 'ps4o', 'parallel-merge-sort',
  'parallel-quicksort', 'parallel-radix-sort', 'parallel-counting-sort', 'gpu-radix-sort', 'gpu-merge-sort', 'terasort',
  'mapreduce-sort'];
const K = Object.fromEntries(await Promise.all(IDS.map(async (id) => [id, await sidecarKernel(id)] as const)));
const S = await loadSorting();

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  return permutations(n - 1).flatMap((p) => p.map((_, i) => i).concat(p.length)
    .map((i) => [...p.slice(0, i), n, ...p.slice(i)]));
}
/** Every word of length n over the keys 1..3: ties in every arrangement. */
function words(n: number): number[][] {
  return Array.from({ length: 3 ** n }, (_, x) => Array.from({ length: n }, (_, i) => 1 + (Math.floor(x / 3 ** i) % 3)));
}
/** Sizes an exact formula is checked at: every n to 64, every size of the plate's grid, and edges. */
const NS = [...new Set([...Array.from({ length: 65 }, (_, n) => n), ...Array.from({ length: 64 }, (_, i) => 8 * (i + 1)),
  100, 127, 129, 255, 257, 511])].sort((a, b) => a - b);
/** The inputs every inequality is checked on: all permutations and three-key words up to six keys,
 * and every plate shape at the plate's sizes, two seeds each. */
const CASES: number[][] = [
  ...[0, 1, 2, 3, 4, 5, 6].flatMap((n) => [...permutations(n), ...words(n)]),
  ...SHAPES.flatMap((shape) => [8, 16, 33, 64, 100, 128, 256, 512].flatMap((n) => [1, 2].map((s) => input(shape, n, 97 * s + n)))),
];
const at = (a: number[]) => `[${a.length > 8 ? `${a.length} keys` : a.join(',')}]`;

const run = (id: string, a: number[]): Trace => {
  const t = trace(K[id], a);
  expect(t.truncated, `${id} on ${a.length} keys`).toBe(false);
  return t;
};
/** The phases a run entered, by name, in order. */
const phases = (t: Trace) => {
  const out: string[] = [];
  for (let e = 0; e < t.length; e++) if (t.events[3 * e] === OP.phase) out.push(t.labels[t.events[3 * e + 1]]);
  return out;
};
/** Comparisons and array writes made inside each phase, in order, up to the phase's end or to the
 * first range it marks (a bucket handed to the recursion, whose base case enters no phase). */
function perPhase(t: Trace): { name: string; compares: number; writes: number }[] {
  const out: { name: string; compares: number; writes: number }[] = [];
  let open = false;
  for (let e = 0; e < t.length; e++) {
    const op = t.events[3 * e];
    if (op === OP.phase) { out.push({ name: t.labels[t.events[3 * e + 1]], compares: 0, writes: 0 }); open = true; }
    else if (op === OP.range) open = false;
    else if (!open) continue;
    else if (op === OP.compare) out.at(-1)!.compares++;
    else if (op === OP.write) out.at(-1)!.writes++;
    else if (op === OP.swap) out.at(-1)!.writes += 2;
  }
  return out;
}
/** Array writes made by each lane during the phase whose name starts with `phase`. */
function writesPerLane(t: Trace, phase: string): number[] {
  const w: number[] = [];
  let [inside, lane] = [false, -1];
  for (let e = 0; e < t.length; e++) {
    const op = t.events[3 * e];
    if (op === OP.phase) inside = t.labels[t.events[3 * e + 1]].startsWith(phase);
    else if (op === OP.lane) lane = t.events[3 * e + 1];
    else if (inside && op === OP.write) w[lane] = (w[lane] ?? 0) + 1;
  }
  return Array.from(w, (x) => x ?? 0);
}
/** Base-16 digits of max − min, at least one: the passes of the radix kernels. */
const hexDigits = (a: number[]) => {
  const range = Math.max(...a) - Math.min(...a);
  let d = 1;
  while (16 ** d <= range) d++;
  return d;
};
const ceilLg = (n: number) => (n < 2 ? 0 : Math.ceil(Math.log2(n)));
/** The input's element identities at the end of a wasm run: whether two equal keys crossed. */
function reordersEqualKeys(id: string, keys: number[]): boolean {
  const r = S.run(id, keys, { seed: seedOf(keys) });
  const tags = [...r.tags];
  return tags.some((x, i) => i > 0 && keys[x] === keys[tags[i - 1]] && x < tags[i - 1]);
}
/** Inputs searched for a witness: every three-key word up to seven keys, and Few distinct keys at
 * every plate size, twenty seeds each. */
const WITNESS_INPUTS = [...[2, 3, 4, 5, 6, 7].flatMap(words),
  ...Array.from({ length: 64 }, (_, i) => 8 * (i + 1)).flatMap((n) => Array.from({ length: 20 }, (_, s) => input('few-unique', n, s + 1)))];

describe('sorting/parallel: exact bounds against counted runs', () => {
  it('enumeration-sort: n(n − 1) comparisons, n array writes and n auxiliary writes on every input, in 2 rounds of n lanes', () => {
    for (const n of NS.filter((x) => x >= 2 && x <= 472)) {
      for (const shape of SHAPES) {
        const t = run('enumeration-sort', input(shape, n, n));
        expect([t.counts.compares, t.counts.writes, t.counts.auxWrites, t.marks.rounds, t.marks.lanes, t.marks.phases], `${shape} n=${n}`)
          .toEqual([n * (n - 1), n, n, 2, n, 2]);
      }
    }
    expect(run('enumeration-sort', input('sorted', 472, 1)).counts.compares).toBe(222312);
  });

  it('samplesort: sequential, no round and no lane; up to 32 keys insertion sort alone; equal keys get buckets that are never split again', () => {
    for (const a of CASES) {
      const t = run('samplesort', a);
      expect([t.marks.rounds, t.marks.lanes], at(a)).toEqual([0, 0]);
      if (a.length <= 32) expect([t.marks.phases, t.counts.auxWrites], at(a)).toEqual([0, 0]);
      expect(t.marks.phases % 2, at(a)).toBe(0);
    }
    for (let n = 2; n <= 32; n++) expect([run('samplesort', input('sorted', n, 1)).counts.compares, run('samplesort', input('sorted', n, 1)).counts.writes], `n=${n}`).toEqual([n - 1, 0]);
    // keys 1..4: a key equal to a splitter is final, so at most three distributions, six phases
    for (const n of NS.filter((x) => x > 32)) {
      for (const seed of [1, 2, 3]) expect(run('samplesort', input('few-unique', n, seed)).marks.phases, `n=${n}`).toBeLessThanOrEqual(6);
    }
    expect([run('samplesort', input('few-unique', 512, 4242)).counts.compares, run('samplesort', input('random', 512, 4242)).counts.compares]).toEqual([1968, 6390]);
  });

  it('parallel-samplesort: 4 rounds of 4 lanes; classification is exactly 2 comparisons per key; n array writes', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const shape of SHAPES) {
        const t = run('parallel-samplesort', input(shape, n, n));
        expect([t.marks.rounds, t.marks.lanes, t.marks.phases, t.counts.writes], `${shape} n=${n}`).toEqual([4, 4, 5, n]);
        const per = perPhase(t);
        expect(per.find((p) => p.name.startsWith('classify'))!.compares, `${shape} n=${n}`).toBe(2 * n);
        expect(per.find((p) => p.name.startsWith('exchange'))!.compares, `${shape} n=${n}`).toBe(0);
      }
    }
    expect(writesPerLane(run('parallel-samplesort', input('random', 512, 4242)), 'concatenate')).toEqual([138, 144, 114, 116]);
  });

  it('psrs: 5 rounds of 4 lanes, p² = 16 regular samples, n + 3 auxiliary writes; on a permutation every processor receives fewer than 2n/p keys', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const shape of SHAPES) {
        const t = run('psrs', input(shape, n, n));
        expect([t.marks.rounds, t.marks.lanes, t.marks.phases, t.counts.auxWrites], `${shape} n=${n}`).toEqual([5, 4, 6, n + 3]);
      }
      // regular sampling reads p keys of every non-empty block
      const block = Math.ceil(n / 4);
      const blocks = Array.from({ length: 4 }, (_, l) => Math.min(n, (l + 1) * block) - Math.min(n, l * block)).filter((x) => x > 0).length;
      const t = run('psrs', input('random', n, n));
      let [reads, inside] = [0, false];
      for (let e = 0; e < t.length; e++) {
        const op = t.events[3 * e];
        if (op === OP.phase) inside = t.labels[t.events[3 * e + 1]].startsWith('phase 2');
        else if (inside && op === OP.read) reads++;
      }
      expect(reads, `n=${n}`).toBe(4 * blocks);
      if (n % 8 === 0) expect(reads, `n=${n}`).toBe(16);
      expect(run('psrs', input('sorted', n, 1)).counts.writes, `n=${n}`).toBe(n);
    }
    // distinct keys, n a multiple of p² (here p = 4): every processor's share below twice n/p
    for (let n = 16; n <= 512; n += 16) {
      for (const shape of ['random', 'nearly-sorted', 'reversed', 'sorted'] as const) {
        for (const seed of [1, 2, 3, 4, 5]) {
          const loads = writesPerLane(run('psrs', input(shape, n, seed)), 'phase 6');
          expect(loads.reduce((x, y) => x + y, 0), `${shape} n=${n}`).toBe(n);
          expect(Math.max(...loads), `${shape} n=${n}`).toBeLessThan((2 * n) / 4);
        }
      }
    }
    expect(writesPerLane(run('psrs', input('random', 512, 4242)), 'phase 6')).toEqual(PSRS_LOADS_512);
  });

  it('ips4o: up to 32 keys insertion sort alone; above, 2 rounds per bucketing, 15 lanes, and the distribution re-classifies every key at the classification\'s cost', () => {
    for (const a of CASES) {
      const t = run('ips4o', a);
      if (a.length <= 32) {
        expect([t.marks.rounds, t.marks.lanes, t.marks.phases], at(a)).toEqual([0, 0, 0]);
        continue;
      }
      const per = perPhase(t);
      const cls = per.filter((p) => p.name.endsWith('classification (branch-free decision tree)'));
      const dist = per.filter((p) => p.name.endsWith('in-place distribution (cycle leader)'));
      expect([t.marks.rounds, t.marks.lanes], at(a)).toEqual([2 * cls.length, 15]);
      expect(dist.map((p) => p.compares), at(a)).toEqual(cls.map((p) => p.compares));
    }
    // three steps down the tree and at most one equality test: 3 to 4 comparisons per key at depth 0
    for (const shape of SHAPES) {
      for (const n of [33, 64, 100, 256, 512]) {
        const c = perPhase(run('ips4o', input(shape, n, n))).find((p) => p.name === 'depth 0: classification (branch-free decision tree)')!.compares;
        expect(c, `${shape} n=${n}`).toBeGreaterThanOrEqual(3 * n);
        expect(c, `${shape} n=${n}`).toBeLessThanOrEqual(4 * n);
      }
    }
    expect([run('ips4o', input('random', 512, 4242)).marks.rounds, run('ps4o', input('random', 512, 4242)).marks.rounds]).toEqual([16, 16]);
    // Already sorted is already bucketed: no write at all
    for (const n of NS) expect(run('ips4o', input('sorted', n, 1)).counts.writes, `n=${n}`).toBe(0);
  });

  it('ps4o: up to 32 keys insertion sort alone; above, 2 rounds of 4 lanes per bucketing, and the oracle spares the distribution every comparison', () => {
    for (const a of CASES) {
      const t = run('ps4o', a);
      if (a.length <= 32) {
        expect([t.marks.rounds, t.marks.lanes, t.marks.phases], at(a)).toEqual([0, 0, 0]);
        continue;
      }
      const per = perPhase(t);
      const cls = per.filter((p) => p.name.endsWith('classification into the oracle'));
      expect([t.marks.rounds, t.marks.lanes], at(a)).toEqual([2 * cls.length, 4]);
      for (const p of per.filter((x) => x.name.endsWith('distribution into the temporary array'))) expect(p.compares, at(a)).toBe(0);
    }
    for (const shape of SHAPES) {
      for (const n of [33, 64, 100, 256, 512]) {
        const c = perPhase(run('ps4o', input(shape, n, n))).find((p) => p.name === 'depth 0: classification into the oracle')!.compares;
        expect(c, `${shape} n=${n}`).toBeGreaterThanOrEqual(3 * n);
        expect(c, `${shape} n=${n}`).toBeLessThanOrEqual(4 * n);
      }
    }
  });

  it('parallel-merge-sort: one local-sort round and ⌈lg b⌉ merge rounds for b blocks of ⌈n/4⌉; on Already sorted n − 1 comparisons and no write', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const block = Math.ceil(n / 4);
      const b = Math.ceil(n / block);
      for (const shape of SHAPES) {
        const t = run('parallel-merge-sort', input(shape, n, n));
        expect([t.marks.rounds, t.marks.lanes, t.marks.phases], `${shape} n=${n}`).toEqual([1 + ceilLg(b), b, 1 + ceilLg(b)]);
      }
      const s = run('parallel-merge-sort', input('sorted', n, 1));
      expect([s.counts.compares, s.counts.writes, s.counts.auxWrites], `n=${n}`).toEqual([n - 1, 0, 0]);
      if (n % 8 === 0) expect([s.marks.rounds, s.marks.lanes], `n=${n}`).toEqual([3, 4]);
      // the last round is one merge, done by one lane
      const t = run('parallel-merge-sort', input('random', n, n));
      const lanes = new Set<number>();
      let last = false;
      for (let e = 0; e < t.length; e++) {
        const op = t.events[3 * e];
        if (op === OP.phase) { last = t.labels[t.events[3 * e + 1]] === `round ${ceilLg(b)}: merge pairs of runs`; lanes.clear(); }
        else if (last && op === OP.lane) lanes.add(t.events[3 * e + 1]);
      }
      if (b > 1) expect([...lanes], `n=${n}`).toEqual([0]);
    }
  });

  it('parallel-quicksort: one round per level of the recursion, one lane per segment of a round; each partition compares every key of its segment with the pivot once', () => {
    for (const a of CASES) {
      const t = run('parallel-quicksort', a);
      const ph = phases(t);
      const segs = ph.map((x) => Number(/: (\d+) segments/.exec(x)![1]));
      expect([t.marks.rounds, t.marks.lanes], at(a)).toEqual([ph.length, Math.max(...segs)]);
      // a partition: its range mark, then exactly one comparison per key of the segment
      let open = -1;
      let c = 0;
      const close = () => { if (open >= 0) expect(c, at(a)).toBe(open); open = -1; };
      for (let e = 0; e < t.length; e++) {
        const op = t.events[3 * e];
        if (op === OP.lane || op === OP.round || op === OP.phase) close();
        else if (op === OP.range) { close(); open = t.events[3 * e + 2] - t.events[3 * e + 1] + 1; c = 0; }
        else if (op === OP.compare) c++;
      }
      close();
      // a segment's children hold fewer distinct keys than it does: no more rounds than distinct keys
      if (a.length) expect(t.marks.rounds, at(a)).toBeLessThanOrEqual(new Set(a).size);
    }
    for (const n of NS.filter((x) => x >= 1 && x <= 16)) expect([run('parallel-quicksort', input('random', n, n)).marks.rounds], `n=${n}`).toEqual([1]);
    for (const n of NS.filter((x) => x > 16)) {
      for (const seed of [1, 2, 3]) expect(run('parallel-quicksort', input('few-unique', n, seed)).marks.rounds, `n=${n}`).toBeLessThanOrEqual(4);
    }
    expect([run('parallel-quicksort', input('random', 512, 4242)).marks.rounds, run('parallel-quicksort', input('random', 512, 4242)).marks.lanes]).toEqual([12, 20]);
    expect(run('parallel-quicksort', input('few-unique', 512, 4242)).marks.rounds).toBe(4);
  });

  it('parallel-radix-sort and gpu-radix-sort: no comparison; one pass per base-16 digit of max − min, 2 and 3 rounds per pass', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const shape of SHAPES) {
        const a = input(shape, n, n);
        const d = hexDigits(a);
        const p = run('parallel-radix-sort', a);
        expect([p.counts.compares, p.marks.rounds, p.marks.lanes, p.counts.writes], `${shape} n=${n}`).toEqual([0, 2 * d, 4, d * n]);
        expect(p.counts.auxWrites, `${shape} n=${n}`).toBeLessThanOrEqual(d * n);
        // the global prefix sum of every pass is a phase without a round
        expect(p.marks.phases, `${shape} n=${n}`).toBe(3 * d + 1);
        const g = run('gpu-radix-sort', a);
        expect([g.counts.compares, g.marks.rounds, g.marks.lanes, g.counts.writes], `${shape} n=${n}`).toEqual([0, 3 * d, Math.ceil(n / 64), 2 * d * n]);
        expect(g.counts.auxWrites, `${shape} n=${n}`).toBeLessThanOrEqual(d * n);
      }
    }
    expect([run('parallel-radix-sort', input('random', 512, 4242)).marks.rounds, run('gpu-radix-sort', input('random', 512, 4242)).marks.rounds]).toEqual([6, 9]);
  });

  it('parallel-counting-sort: no comparison, 2 rounds of 4 lanes, exactly n array writes and n auxiliary writes on every input', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const shape of SHAPES) {
        const t = run('parallel-counting-sort', input(shape, n, n));
        expect([t.counts.compares, t.marks.rounds, t.marks.lanes, t.counts.writes, t.counts.auxWrites, t.marks.phases], `${shape} n=${n}`).toEqual([0, 2, 4, n, n, 4]);
      }
    }
  });

  it('gpu-merge-sort: one launch for the tiles of 32 and one per doubling of the runs; every launch writes all n keys; the tile sort compares the same pairs on every input', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const launches = 1 + Math.max(0, ceilLg(Math.ceil(n / 32)));
      const tileCompares = new Set<number>();
      for (const shape of SHAPES) {
        const t = run('gpu-merge-sort', input(shape, n, n));
        expect([t.marks.rounds, t.marks.phases, t.counts.writes, t.counts.auxWrites], `${shape} n=${n}`).toEqual([launches, launches, launches * n, launches * n]);
        expect(t.marks.lanes, `${shape} n=${n}`).toBe(Math.max(Math.floor(Math.min(n, 32) / 2), n > 32 ? Math.ceil(n / 16) : 0));
        tileCompares.add(perPhase(t)[0].compares);
      }
      expect(tileCompares.size, `n=${n}`).toBe(1);
    }
    // a tile of 32 keys: the bitonic network's (n/2)·k(k + 1)/2 = 240 comparators for k = 5
    expect(perPhase(run('gpu-merge-sort', input('random', 32, 1)))[0].compares).toBe(240);
    expect(perPhase(run('gpu-merge-sort', input('random', 512, 4242)))[0].compares).toBe(16 * 240);
  });

  it('terasort: 3 rounds of 4 lanes, 2 comparisons per key in the map, n array writes and n + 3 auxiliary writes', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const shape of SHAPES) {
        const t = run('terasort', input(shape, n, n));
        expect([t.marks.rounds, t.marks.lanes, t.marks.phases, t.counts.writes, t.counts.auxWrites], `${shape} n=${n}`).toEqual([3, 4, 5, n, n + 3]);
        expect(perPhase(t).find((p) => p.name.startsWith('map'))!.compares, `${shape} n=${n}`).toBe(2 * n);
      }
    }
    // equal keys cannot be split between reducers: Few distinct keys leaves one reducer empty
    expect(writesPerLane(run('terasort', input('few-unique', 512, 4242)), 'merge/reduce')).toEqual([0, 131, 129, 252]);
  });

  it('mapreduce-sort: 3 rounds of 4 lanes; no comparison before the reduce tasks\' sort; on Already sorted n minus the non-empty partitions', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const shape of SHAPES) {
        const t = run('mapreduce-sort', input(shape, n, n));
        expect([t.marks.rounds, t.marks.lanes, t.marks.phases, t.counts.writes, t.counts.auxWrites], `${shape} n=${n}`).toEqual([3, 4, 4, n, n]);
        for (const p of perPhase(t).filter((x) => !x.name.startsWith('sort'))) expect(p.compares, `${shape} n=${n}`).toBe(0);
      }
      // keys 1..n in four equal key ranges
      const parts = new Set(Array.from({ length: n }, (_, i) => Math.floor((i * 4) / n))).size;
      expect(run('mapreduce-sort', input('sorted', n, 1)).counts.compares, `n=${n}`).toBe(n - parts);
      // on a permutation every reduce task receives exactly the keys of its interval
      const sizes = [0, 1, 2, 3].map((r) => Array.from({ length: n }, (_, i) => Math.floor((i * 4) / n)).filter((x) => x === r).length);
      const got = writesPerLane(run('mapreduce-sort', input('random', n, n)), 'sort');
      expect([0, 1, 2, 3].map((r) => got[r] ?? 0), `n=${n}`).toEqual(sizes);
    }
    expect(run('mapreduce-sort', input('sorted', 512, 1)).counts.compares).toBe(508);
  });

  it('a witness of reordered equal keys for every kernel whose manifest says unstable and whose run shows it', () => {
    const found = Object.fromEntries(['samplesort', 'parallel-samplesort', 'psrs', 'ips4o', 'parallel-quicksort', 'terasort',
      'mapreduce-sort', 'gpu-merge-sort', 'parallel-merge-sort'].map((id) => [id, WITNESS_INPUTS.some((a) => reordersEqualKeys(id, a))]));
    expect(found).toEqual({
      samplesort: false, 'parallel-samplesort': false, psrs: false, ips4o: true, 'parallel-quicksort': true, terasort: false,
      'mapreduce-sort': false, 'gpu-merge-sort': true, 'parallel-merge-sort': false,
    });
  });
});

/** What the four processors of PSRS receive on Random permutation at 512 keys (seed 4242). */
const PSRS_LOADS_512 = [121, 135, 124, 132];
