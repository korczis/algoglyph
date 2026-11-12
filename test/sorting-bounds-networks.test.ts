// Every exact count and every hard inequality the network shelf states in a bound
// (catalogue/entries/*.md, ADR 0006 §4), driven at several n and input shapes and compared with
// what the array engine counts for the plate: Comparisons, Array writes (an exchange is two
// writes, a copy one), Auxiliary writes and the Rounds readout (the kernel's own round() calls:
// a comparator layer, a column-sorting step, a kernel launch or a vector instruction, each as the
// kernel names it). Batcher's merge exchange and the perfect-shuffle merge play their TypeScript
// kernels (src/kernels/array/<id>.ts), which mark no rounds; the others play the wasm kernel their
// sidecar record maps (src/kernels/sorting-wasm), replayed through the same engine.
// A comparator network is read off its trace: the comparisons a run makes, in order, split at
// its round marks. That it is a network (the same comparators on every input of n keys, each
// one exchanging exactly when its keys are out of order, the comparators of a round disjoint)
// is checked here, and so is the zero-one principle's premise: the network read off a run sorts
// every input of zeros and ones of that size.
// Asymptotic bounds (~, O, the cited depths) are not checked here; that every kernel sorts every
// shape and size is test/kernels-array.test.ts ("leaves every input shape and size in the order
// its goal promises") and test/kernels-sorting-wasm.test.ts ("leaves every input shape and size
// sorted, as an independent reference does").
import { describe, expect, it } from 'vitest';
import { EVENT_CAP, input, OP, SHAPES, trace, type ArrayKernel, type Trace } from '../src/engines/array/trace';
import { loadSorting } from '../src/kernels/sorting-wasm/_abi';
import { seedOf, sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';

const files = import.meta.glob<ArrayKernel>('../src/kernels/array/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = async (id: string): Promise<ArrayKernel> => files[`../src/kernels/array/${id}.ts`] ?? sidecarKernel(id);
const IDS = ['aks-sorting-network', 'batcher-merge-exchange', 'bitonic-sort', 'gpu-bitonic-sort', 'columnsort',
  'perfect-shuffle-merge', 'pairwise-sorting-network', 'shear-sort', 'simd-sorting-network', 'zig-zag-sort'];
const K: Record<string, ArrayKernel> = Object.fromEntries(await Promise.all(IDS.map(async (id) => [id, await kernelOf(id)] as const)));
const S = await loadSorting();

/** Sizes an exact formula is checked at: every n to 64, then the plate's grid and its edges. */
const NS = [...Array.from({ length: 65 }, (_, n) => n), 72, 100, 127, 128, 129, 200, 255, 256, 257, 384, 511, 512];
const POW2 = Array.from({ length: 10 }, (_, k) => 2 ** k);
const run = (id: string, a: number[]): Trace => {
  const t = trace(K[id], a);
  expect(t.truncated, `${id} on ${a.length} keys`).toBe(false);
  return t;
};
const counts = (id: string, a: number[]) => {
  const c = run(id, a).counts;
  return [c.compares, c.writes, c.auxWrites];
};
const ceilLg = (n: number) => (n < 2 ? 0 : Math.ceil(Math.log2(n)));
const floorLg = (n: number) => (n < 1 ? 0 : Math.floor(Math.log2(n)));
const tri = (k: number) => (k * (k + 1)) / 2;
/** Batcher's odd-even merge sort on n = 2^k keys: (k² − k + 4)·2^(k−2) − 1 comparators (Knuth 5.3.4). */
const oddEven = (k: number) => (k === 0 ? 0 : (k * k - k + 4) * 2 ** (k - 2) - 1);

type Comparator = [number, number];
/** A run read as a network: its comparisons in order (lower index first), split at its round marks. */
function network(t: Trace): Comparator[][] {
  const rounds: Comparator[][] = [[]];
  for (let e = 0; e < t.length; e++) {
    const [op, i, j] = [t.events[3 * e], t.events[3 * e + 1], t.events[3 * e + 2]];
    if (op === OP.round && rounds.at(-1)!.length) rounds.push([]);
    else if (op === OP.compare) {
      expect(i, 'a comparison of two positions').toBeGreaterThanOrEqual(0);
      rounds.at(-1)!.push([Math.min(i, j), Math.max(i, j)]);
    }
  }
  return rounds.filter((r) => r.length);
}
/** Apply a network: every comparator puts the smaller key at its lower index; the exchanges it makes. */
function apply(net: Comparator[], keys: number[]): number {
  let x = 0;
  for (const [i, j] of net) if (keys[i] > keys[j]) { [keys[i], keys[j]] = [keys[j], keys[i]]; x++; }
  return x;
}
const flat = (r: Comparator[][]) => r.flat();
const sameComparators = (a: Comparator[], b: Comparator[]) => a.length === b.length && a.every(([i, j], k) => b[k][0] === i && b[k][1] === j);

/**
 * A kernel that is a comparator network at n keys: the same comparators on every shape and seed,
 * each exchanging exactly when its keys are out of order (the run's output, its exchanges, and
 * no other write), the comparators of each marked round disjoint, and for n up to 12 every 0-1
 * input sorted.
 */
function isNetwork(id: string, n: number): Comparator[][] {
  const net = network(run(id, input('random', n, 4242)));
  for (const shape of SHAPES) {
    for (const seed of [1, 2]) {
      const a = input(shape, n, seed + n);
      const t = run(id, a);
      expect(sameComparators(flat(network(t)), flat(net)), `${id} ${shape} n=${n}`).toBe(true);
      const b = a.slice();
      const x = apply(flat(net), b);
      expect([t.output, t.counts.swaps, t.counts.writes, t.counts.auxWrites], `${id} ${shape} n=${n}`).toEqual([b, x, 2 * x, 0]);
    }
  }
  // a kernel that marks no rounds (the TypeScript merge exchange) is read as one sequence
  for (const round of run(id, input('random', n, 4242)).marks.rounds ? net : []) {
    const used = round.flat();
    expect(new Set(used).size, `${id} n=${n}: a round's comparators are disjoint`).toBe(used.length);
  }
  if (n <= 12) {
    for (let bits = 0; bits < 2 ** n; bits++) {
      const v = Array.from({ length: n }, (_, i) => (bits >> i) & 1);
      apply(flat(net), v);
      expect(v.every((x, i) => i === 0 || v[i - 1] <= x), `${id} n=${n}: 0-1 input ${bits}`).toBe(true);
    }
  }
  return net;
}
/** Equal keys reordered: by the wasm run's output identities, or by a TypeScript kernel's tagged keys. */
function reordersEqualKeys(id: string, keys: number[]): boolean {
  if (files[`../src/kernels/array/${id}.ts`]) {
    const items = keys.map((k, i) => 1000 * k + i);
    const t = trace(K[id], items, 0, EVENT_CAP, (x, y) => Math.floor(x / 1000) < Math.floor(y / 1000));
    return t.output.some((x, i) => i > 0 && Math.floor(x / 1000) === Math.floor(t.output[i - 1] / 1000) && x < t.output[i - 1]);
  }
  const tags = [...S.run(id, keys, { seed: seedOf(keys) }).tags];
  return tags.some((x, i) => i > 0 && keys[x] === keys[tags[i - 1]] && x < tags[i - 1]);
}
/** Comparators per matching of the AKS simplification's halver tree: ⌊len/2⌋ for every segment of two keys or more. */
const halvers = (len: number): number => (len < 2 ? 0 : Math.floor(len / 2) + halvers(len - Math.floor(len / 2)) + halvers(Math.floor(len / 2)));

describe('sorting/networks: exact bounds against counted runs', () => {
  it('bitonic, pairwise, AKS, zig-zag and shear sort are comparator networks: the same comparators on every input, disjoint in each round', () => {
    for (const id of ['bitonic-sort', 'pairwise-sorting-network', 'aks-sorting-network', 'zig-zag-sort', 'shear-sort']) {
      for (const n of [2, 3, 5, 8, 9, 12, 16, 17, 33, 64, 100, 128]) isNetwork(id, n);
    }
  });

  it('Batcher\'s merge exchange is a comparator network, and its comparators are those of the AKS and zig-zag cleanups', () => {
    for (const n of [2, 3, 5, 8, 9, 12, 16, 17, 33, 64, 100, 128, 257, 512]) {
      const net = flat(isNetwork('batcher-merge-exchange', n));
      for (const id of ['aks-sorting-network', 'zig-zag-sort']) {
        const all = flat(network(run(id, input('random', n, 3))));
        expect(sameComparators(all.slice(all.length - net.length), net), `${id} n=${n}`).toBe(true);
      }
    }
  });

  it('bitonic-sort: n = 2^k costs (n/2)·k(k + 1)/2 comparators; every n ≥ 2 takes ⌈lg n⌉(⌈lg n⌉ + 1)/2 rounds, a missing key dropping its comparators', () => {
    for (const n of POW2) {
      const k = Math.log2(n);
      for (const shape of SHAPES) {
        const t = run('bitonic-sort', input(shape, n, 4242));
        expect([t.counts.compares, t.marks.rounds], `${shape} n=${n}`).toEqual([(n / 2) * tri(k), tri(k)]);
      }
    }
    let last = 0;
    for (const n of NS.filter((x) => x >= 2)) {
      const t = run('bitonic-sort', input('random', n, n));
      const K2 = ceilLg(n);
      expect(t.marks.rounds, `n=${n}`).toBe(tri(K2));
      expect(t.counts.compares, `n=${n}`).toBeLessThanOrEqual(2 ** (K2 - 1) * tri(K2));
      expect(t.counts.compares, `n=${n}`).toBeGreaterThan(last);
      last = t.counts.compares;
    }
    // what the plate reads at 100 keys: the depth of the 128-key network, with fewer comparators
    expect([counts('bitonic-sort', input('random', 100, 4242))[0], run('bitonic-sort', input('random', 100, 4242)).marks.rounds]).toEqual([1334, 28]);
    expect(counts('bitonic-sort', input('sorted', 512, 4242))).toEqual([11520, 0, 0]);
  });

  it('pairwise network and merge exchange: the same comparator count at every n, (k² − k + 4)·2^(k−2) − 1 at n = 2^k; pairwise in ⌈lg n⌉(⌈lg n⌉ + 1)/2 rounds', () => {
    for (let n = 0; n <= 1024; n++) {
      const a = input('random', n, n);
      const [p, m] = [run('pairwise-sorting-network', a), run('batcher-merge-exchange', a)];
      expect(p.counts.compares, `n=${n}`).toBe(m.counts.compares);
      expect(p.marks.rounds, `n=${n}`).toBe(n < 2 ? 0 : tri(ceilLg(n)));
      if (POW2.includes(n) || n === 1024) expect(m.counts.compares, `n=${n}`).toBe(oddEven(Math.log2(n)));
    }
    expect(oddEven(9)).toBe(9727);
    // a size that is not a power of two: fewer comparators than the network of the next one
    expect([counts('batcher-merge-exchange', input('random', 100, 4242))[0], counts('batcher-merge-exchange', input('random', 128, 4242))[0]]).toEqual([1077, 1471]);
    // the pairs first (distances 1, 2, …, 256), then the repairs
    const ph = run('pairwise-sorting-network', input('random', 512, 4242)).labels;
    expect(ph.slice(0, 10).map((x) => x.replace(/^round \d+: /, '').replace(/\d+$/, 'd'))).toEqual([...new Array(9).fill('pairs at distance d'), 'repair at distance d']);
    // fewer comparators than bitonic sort at every power of two from 4 keys on, in as many rounds
    for (const n of POW2.filter((x) => x >= 4)) {
      expect(counts('pairwise-sorting-network', input('random', n, 1))[0], `n=${n}`).toBeLessThan(counts('bitonic-sort', input('random', n, 1))[0]);
    }
  });

  it('aks-sorting-network: three matchings per halver level, ⌈lg n⌉ levels, then the merge exchange: 3⌈lg n⌉ + ⌈lg n⌉(⌈lg n⌉ + 1)/2 rounds', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const a = input('random', n, n);
      const t = run('aks-sorting-network', a);
      const L = ceilLg(n);
      expect(t.marks.rounds, `n=${n}`).toBe(3 * L + tri(L));
      expect(t.counts.compares, `n=${n}`).toBe(3 * halvers(n) + run('batcher-merge-exchange', a).counts.compares);
    }
    for (const n of POW2.filter((x) => x >= 2)) expect(halvers(n), `n=${n}`).toBe((n / 2) * Math.log2(n));
    expect([counts('aks-sorting-network', input('random', 512, 4242))[0], run('aks-sorting-network', input('random', 512, 4242)).marks.rounds])
      .toEqual([3 * 256 * 9 + 9727, 72]);
  });

  it('zig-zag-sort: six rounds for every neighbouring pair at each level, then the merge exchange', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const L = floorLg(n);
      let zz = 0;
      for (let i = 1; i <= L; i++) zz += 6 * (2 ** i - 1);
      expect(run('zig-zag-sort', input('random', n, n)).marks.rounds, `n=${n}`).toBe(zz + tri(ceilLg(n)));
    }
    expect(run('zig-zag-sort', input('random', 512, 4242)).marks.rounds).toBe(6123);
  });

  it('shear-sort: on an r × c mesh (c = ⌈√n⌉, r = ⌈n/c⌉) (P + 1)c + P·r rounds for P = ⌈lg r⌉; on n = s², (2P + 1)·s²(s − 1)/2 comparators', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const c = Math.ceil(Math.sqrt(n) - 1e-9);
      const r = Math.ceil(n / c);
      const P = ceilLg(r);
      expect(run('shear-sort', input('random', n, n)).marks.rounds, `n=${n}`).toBe((P + 1) * c + P * r);
    }
    for (let s = 2; s <= 22; s++) {
      const P = ceilLg(s);
      expect(counts('shear-sort', input('random', s * s, s))[0], `s=${s}`).toBe(((2 * P + 1) * s * s * (s - 1)) / 2);
    }
    expect(run('shear-sort', input('random', 512, 4242)).marks.rounds).toBe(253);
  });

  it('gpu-bitonic-sort: bitonic sort\'s comparators at every n, in one launch up to 32 keys and (K − 4)(K − 3)/2 launches for 2^K ≥ 32', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const a = input('random', n, n);
      const t = run('gpu-bitonic-sort', a);
      const K2 = ceilLg(n);
      expect(t.counts.compares, `n=${n}`).toBe(run('bitonic-sort', a).counts.compares);
      expect(t.marks.rounds, `n=${n}`).toBe(K2 <= 5 ? 1 : ((K2 - 4) * (K2 - 3)) / 2);
      for (const shape of SHAPES) expect(run('gpu-bitonic-sort', input(shape, n, 7)).marks.rounds, `${shape} n=${n}`).toBe(t.marks.rounds);
    }
    expect(run('gpu-bitonic-sort', input('random', 512, 4242)).marks.rounds).toBe(15);
    // every shared-memory launch loads all n keys into its tiles: n·max(1, K − 4) auxiliary writes
    for (const n of NS.filter((x) => x >= 2)) {
      expect(run('gpu-bitonic-sort', input('random', n, n)).counts.auxWrites, `n=${n}`).toBe(n * Math.max(1, ceilLg(n) - 4));
    }
  });

  it('columnsort: four rounds of column sorts and nine phases at every n ≥ 2, on a matrix with s | r and r ≥ 2(s − 1)²', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      for (const shape of SHAPES) {
        const t = run('columnsort', input(shape, n, n));
        expect([t.marks.rounds, t.marks.phases], `${shape} n=${n}`).toEqual([4, 9]);
        const [r, s] = /^matrix (\d+) x (\d+)$/.exec(t.labels[0])!.slice(1).map(Number);
        expect(r % s === 0 && r >= 2 * (s - 1) ** 2 && r * s >= n && r % 2 === 0, `${shape} n=${n}: ${r} x ${s}`).toBe(true);
        expect(t.marks.lanes, `${shape} n=${n}`).toBe(s + 1);
      }
    }
    expect(run('columnsort', input('random', 512, 4242)).labels[0]).toBe('matrix 84 x 7');
  });

  it('simd-sorting-network: four lanes, and its vector instructions depend on n alone: 5N/16 + 5((k − 3)N/4 + 1) for N = 2^k ≥ 16', () => {
    for (const n of NS.filter((x) => x >= 2)) {
      const rounds = SHAPES.map((shape) => run('simd-sorting-network', input(shape, n, n)).marks.rounds);
      expect(new Set(rounds).size, `n=${n}`).toBe(1);
      expect(run('simd-sorting-network', input('random', n, n)).marks.lanes, `n=${n}`).toBe(4);
    }
    for (const N of POW2.filter((x) => x >= 16)) {
      const k = Math.log2(N);
      expect(run('simd-sorting-network', input('random', N, 1)).marks.rounds, `N=${N}`).toBe((5 * N) / 16 + 5 * (((k - 3) * N) / 4 + 1));
    }
    expect(run('simd-sorting-network', input('random', 512, 4242)).marks.rounds).toBe(4005);
    // 32 in-register sorts of five instructions, then 769 merges of two registers of five each
    expect([5 * 32, 6 * 128 + 1]).toEqual([160, 769]);
    expect(counts('simd-sorting-network', input('random', 512, 4242))[0]).toBe(10506);
  });

  it('perfect-shuffle-merge: the same comparisons on every input; at n = 2^k Batcher\'s count, n·k(k − 1) auxiliary writes and as many array writes plus the exchanges', () => {
    for (const n of [...Array.from({ length: 65 }, (_, i) => i), 100, 128, 200, 256]) {
      const comps = (t: Trace) => { const c: number[] = []; for (let e = 0; e < t.length; e++) if (t.events[3 * e] === OP.compare) c.push(t.events[3 * e + 1], t.events[3 * e + 2]); return c; };
      const base = comps(run('perfect-shuffle-merge', input('random', n, 1)));
      for (const shape of SHAPES) expect(comps(run('perfect-shuffle-merge', input(shape, n, 2))), `${shape} n=${n}`).toEqual(base);
    }
    for (const n of POW2.filter((x) => x >= 2 && x <= 256)) {
      const k = Math.log2(n);
      for (const shape of SHAPES) {
        const t = run('perfect-shuffle-merge', input(shape, n, 4242));
        expect([t.counts.compares, t.counts.auxWrites, t.counts.writes], `${shape} n=${n}`)
          .toEqual([oddEven(k), n * k * (k - 1), n * k * (k - 1) + 2 * t.counts.swaps]);
      }
    }
    expect(counts('perfect-shuffle-merge', input('sorted', 256, 4242))).toEqual([3839, 14336, 14336]);
  });

  it('no auxiliary write in the in-place networks; no write at all on Already sorted', () => {
    for (const id of ['aks-sorting-network', 'batcher-merge-exchange', 'bitonic-sort', 'pairwise-sorting-network', 'shear-sort', 'zig-zag-sort']) {
      for (const n of [0, 1, 2, 7, 16, 33, 100, 256]) {
        expect(counts(id, input('sorted', n, 1)), `${id} n=${n}`).toEqual([counts(id, input('random', n, 1))[0], 0, 0]);
      }
    }
  });

  it('every network on the shelf reorders equal keys: none is stable', () => {
    for (const id of IDS) {
      const witness = [...[1, 2, 3, 4, 5].map((s) => input('few-unique', 64, s)), ...[1, 2, 3].map((s) => input('few-unique', 100, s))]
        .find((a) => reordersEqualKeys(id, a));
      expect(witness, id).toBeDefined();
    }
  });
});
