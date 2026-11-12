// Every exact count and every hard inequality the radix shelf states in a bound
// (catalogue/entries/*.md, ADR 0006 §4), driven at several n and input shapes and compared with
// what the engines count for the plate. Ten of the eleven are array-engine plates: Comparisons,
// Array writes (an exchange is two writes, a copy one) and Auxiliary writes. Counting sort, LSD and
// MSD radix sort and binary quicksort play their TypeScript kernels (src/kernels/array/<id>.ts);
// the other six play the wasm kernel their sidecar record maps (src/kernels/sorting-wasm), replayed
// through the same engine, whose Auxiliary writes count every cell of the drawn strip that changes.
// Three-way radix quicksort is a string-engine plate (src/kernels/string): Character comparisons
// and Swaps.
// The keys are the plate's: input(shape, n, seed) draws 1..n (Few distinct keys 1..4, Organ pipe
// odd keys up to n), so every digit count below is read from the input itself, never assumed.
// Asymptotic bounds (n log_R n, n·w, n log(b / log n)) are not checked here; that every kernel
// sorts every shape and size is test/kernels-array.test.ts ("leaves every input shape and size in
// the order its goal promises"), test/kernels-sorting-wasm.test.ts ("leaves every input shape and
// size sorted, as an independent reference does") and test/kernels-string.test.ts.
import { describe, expect, it } from 'vitest';
import { apply, input, inversions, OP, SHAPES, trace, type ArrayKernel, type Trace } from '../src/engines/array/trace';
import { sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';
import { input as stringInput } from '../src/engines/string/inputs';
import { OP as SOP, trace as stringTrace } from '../src/engines/string/trace';
import { kernel as threeWay } from '../src/kernels/string/three-way-radix-quicksort';

const files = import.meta.glob<ArrayKernel>('../src/kernels/array/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = async (id: string): Promise<ArrayKernel> => files[`../src/kernels/array/${id}.ts`] ?? sidecarKernel(id);
const K = Object.fromEntries(await Promise.all([
  'counting-sort', 'lsd-radix-sort', 'msd-radix-sort', 'binary-quicksort', 'american-flag-sort', 'skasort',
  'spreadsort', 'burstsort', 'kirkpatrick-reisch-sort', 'postman-sort',
].map(async (id) => [id, await kernelOf(id)] as const)));

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  return permutations(n - 1).flatMap((p) => p.map((_, i) => i).concat(p.length)
    .map((i) => [...p.slice(0, i), n, ...p.slice(i)]));
}
/** Every word of length n over the keys 1..3: ties in every arrangement. */
function words(n: number): number[][] {
  return Array.from({ length: 3 ** n }, (_, x) => Array.from({ length: n }, (_, i) => 1 + (Math.floor(x / 3 ** i) % 3)));
}
/**
 * The inputs every inequality is checked on: all permutations and all three-key words up to six
 * keys, and every plate input shape at four sizes and two seeds.
 */
const CASES: number[][] = [
  ...[0, 1, 2, 3, 4, 5, 6].flatMap((n) => [...permutations(n), ...words(n)]),
  ...SHAPES.flatMap((shape) => [16, 33, 64, 128].flatMap((n) => [1, 2].map((s) => input(shape, n, 97 * s + n)))),
];
/** Every plate shape at every size to 300 and at the plate's largest, seeded by the size. */
const SWEEP: number[][] = SHAPES.flatMap((shape) => [...Array.from({ length: 301 }, (_, n) => n), 511, 512]
  .map((n) => input(shape, n, n)));
/** The plate shapes whose keys are a permutation of 1..n. */
const PERMUTED = ['random', 'nearly-sorted', 'reversed', 'sorted'] as const;
/** Every permutation shape at every plate size to 512, seeded by the size. */
const PERMS: number[][] = PERMUTED.flatMap((shape) => Array.from({ length: 513 }, (_, n) => input(shape, n, n)));
const ALL = Array.from({ length: 1025 }, (_, n) => n);
const SEEDS = [4242, 1, 2, 3, 4, 5];

const run = (id: string, a: number[]): Trace => {
  const t = trace(K[id], a);
  expect(t.truncated, `${id} on ${a.length} keys`).toBe(false);
  return t;
};
const counts = (id: string, a: number[]) => {
  const c = run(id, a).counts;
  return [c.compares, c.writes, c.auxWrites];
};
const at = (a: number[]) => `[${a.length > 8 ? `${a.length} keys` : a.join(',')}]`;
const max = (a: number[]) => a.reduce((m, x) => Math.max(m, x), 0);
const distinct = (a: number[]) => new Set(a).size;
const isPermutation = (a: number[]) => a.slice().sort((x, y) => x - y).every((x, i) => x === i + 1);
/** Base-4 digits of the largest key: the passes of LSD radix sort and the levels of MSD. */
const digits4 = (a: number[]) => { let d = 0; for (let m = max(a); m > 0; m >>= 2) d++; return d; };
/** Keys per 256-key block (keys sharing every byte but the lowest), as byte radix sorts see them. */
const blocks = (a: number[]) => {
  const b = new Map<number, number[]>();
  for (const x of a) b.set(x >> 8, [...(b.get(x >> 8) ?? []), x]);
  return [...b.values()];
};
/** Comparisons of an exchange insertion sort: every exchange, and the comparison that stops it. */
function insertionCompares(seq: number[]): number {
  const a = seq.slice();
  let c = 0;
  for (let i = 1; i < a.length; i++) {
    let j = i;
    while (j > 0) {
      c++;
      if (!(a[j - 1] > a[j])) break;
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      j--;
    }
  }
  return c;
}
/** The number of cycles of a permutation of 1..n, fixed points included. */
function cycles(a: number[]): number {
  const seen = new Array<boolean>(a.length).fill(false);
  let c = 0;
  for (let i = 0; i < a.length; i++) {
    if (seen[i]) continue;
    c++;
    for (let j = i; !seen[j]; j = a[j] - 1) seen[j] = true;
  }
  return c;
}
/** The keys moved by each exchange of a run, tracked by identity: true when equal keys cross. */
function exchangeReorders(id: string, keys: number[]): boolean {
  const t = run(id, keys);
  const who = keys.map((_, i) => i);
  for (let e = 0; e < t.length; e++) {
    const [op, i, j] = [t.events[3 * e], t.events[3 * e + 1], t.events[3 * e + 2]];
    expect(op === OP.write, `${id} writes a copy, so identities cannot be tracked by exchanges`).toBe(false);
    if (op === OP.swap) [who[i], who[j]] = [who[j], who[i]];
  }
  return who.some((x, k) => k > 0 && keys[x] === keys[who[k - 1]] && x < who[k - 1]);
}
/** Each range the kernel marks, with the array as it stood there and the exchanges made until the next mark. */
function marked(t: Trace): { lo: number; hi: number; keys: number[]; swaps: number }[] {
  const a = t.input.slice();
  const aux = new Array<number>(t.auxN).fill(0);
  const out: { lo: number; hi: number; keys: number[]; swaps: number }[] = [];
  for (let e = 0; e < t.length; e++) {
    const [op, i, j] = [t.events[3 * e], t.events[3 * e + 1], t.events[3 * e + 2]];
    if (op === OP.range) out.push({ lo: i, hi: j, keys: a.slice(i, j + 1), swaps: 0 });
    else if (op === OP.swap && out.length) out[out.length - 1].swaps++;
    apply(a, aux, t.events, e);
  }
  return out;
}

describe('sorting/radix: exact bounds against counted runs', () => {
  it('counting-sort: no comparison, exactly n array writes and n auxiliary writes on every input', () => {
    for (const a of [...CASES, ...SWEEP]) expect(counts('counting-sort', a), at(a)).toEqual([0, a.length, a.length]);
  });

  it('lsd-radix-sort: d passes for the d base-4 digits of the largest key, n array and n auxiliary writes each', () => {
    for (const a of [...CASES, ...SWEEP]) {
      const d = digits4(a);
      expect(counts('lsd-radix-sort', a), at(a)).toEqual([0, d * a.length, d * a.length]);
      // one marked pass over the whole array per digit
      expect(marked(run('lsd-radix-sort', a)).length, at(a)).toBe(a.length ? d : 0);
    }
    // the plate's largest key: 512 and 511 have five base-4 digits, Few distinct keys' 4 has two
    expect(SHAPES.map((s) => counts('lsd-radix-sort', input(s, 512, 4242))[1]))
      .toEqual([2560, 2560, 2560, 1024, 2560, 2560]);
  });

  it('msd-radix-sort: a key is written once for every digit at which it still shares its bin; at most LSD\'s d·n', () => {
    // level j sorts the bins of keys that agree on their top j digits; a bin of one key is done
    const msd = (a: number[]) => {
      const d = digits4(a);
      let w = 0;
      for (let j = 0; j < d; j++) {
        const shift = 2 * (d - j);
        const size = new Map<number, number>();
        for (const x of a) size.set(x >> shift, (size.get(x >> shift) ?? 0) + 1);
        w += a.filter((x) => size.get(x >> shift)! >= 2).length;
      }
      return w;
    };
    for (const a of [...CASES, ...SWEEP]) {
      const w = msd(a);
      expect(counts('msd-radix-sort', a), at(a)).toEqual([0, w, w]);
      expect(w, at(a)).toBeLessThanOrEqual(digits4(a) * a.length);
    }
    // Random permutation at 512 keys: key 512 is alone after the first digit, four writes short
    expect(counts('msd-radix-sort', input('random', 512, 4242))).toEqual([0, 2556, 2556]);
    expect(counts('lsd-radix-sort', input('random', 512, 4242))[1]).toBe(2560);
  });

  it('binary-quicksort: no comparison; each partition makes exactly one exchange per 1-bit key in the 0-bit keys\' zone', () => {
    for (const a of [...CASES, ...SWEEP]) {
      const t = run('binary-quicksort', a);
      expect([t.counts.compares, t.counts.writes, t.counts.auxWrites], at(a)).toEqual([0, 2 * t.counts.swaps, 0]);
      // walk the recursion as the kernel does, reading each partition's keys from the trace
      const parts = marked(t);
      let next = 0;
      const visit = (lo: number, hi: number, bit: number) => {
        if (hi <= lo || bit < 0) return;
        const p = parts[next++];
        expect([p.lo, p.hi], at(a)).toEqual([lo, hi]);
        const zeros = p.keys.filter((x) => ((x >> bit) & 1) === 0).length;
        const ones = p.keys.slice(0, zeros).filter((x) => ((x >> bit) & 1) === 1).length;
        expect(p.swaps, `${at(a)} [${lo}, ${hi}] bit ${bit}`).toBe(ones);
        visit(lo, lo + zeros - 1, bit - 1);
        visit(lo + zeros, hi, bit - 1);
      };
      visit(0, a.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, max(a))))));
      expect(next, at(a)).toBe(parts.length);
    }
  });

  it('binary-quicksort: no write on Already sorted, ⌊n/2⌋ exchanges on Reversed; reorders the two 1s of [2, 1, 1]', () => {
    for (const n of ALL) {
      expect(counts('binary-quicksort', input('sorted', n, 1)), `sorted n=${n}`).toEqual([0, 0, 0]);
      expect(run('binary-quicksort', input('reversed', n, 1)).counts.swaps, `reversed n=${n}`).toBe(Math.floor(n / 2));
    }
    expect(exchangeReorders('binary-quicksort', [2, 1, 1])).toBe(true);
  });

  it('american-flag-sort: only exchanges; no write on Already sorted; no comparison on a permutation of 16 keys or more but 257–270', () => {
    for (const a of [...CASES, ...SWEEP, ...PERMS]) {
      const c = run('american-flag-sort', a).counts;
      expect([c.writes, c.auxWrites], at(a)).toEqual([2 * c.swaps, 0]);
    }
    // Already sorted: under 16 keys the whole input goes to insertion sort, n − 1 comparisons;
    // from 16 on, only a block of 2 to 15 keys does, m − 1 for its m
    for (const n of ALL) {
      const a = input('sorted', n, 1);
      const piles = blocks(a).filter((b) => b.length >= 2 && b.length < 16).reduce((s, b) => s + b.length - 1, 0);
      expect(counts('american-flag-sort', a).slice(0, 2), `sorted n=${n}`).toEqual([n >= 16 ? piles : Math.max(0, n - 1), 0]);
    }
    // a pile of 2 to 15 keys goes to insertion sort; on 1..n only the block 256..n can be one
    for (const a of PERMS) {
      const n = a.length;
      expect(run('american-flag-sort', a).counts.compares === 0, at(a)).toBe(n < 2 || (n >= 16 && !(n >= 257 && n <= 270)));
    }
    expect(counts('american-flag-sort', input('random', 512, 4242))).toEqual([0, 1516, 0]);
  });

  it('skasort: only exchanges, one for every key of every byte pass, already placed or not', () => {
    for (const a of [...CASES, ...SWEEP, ...PERMS]) {
      const t = run('skasort', a);
      const c = t.counts;
      expect([c.writes, c.auxWrites], at(a)).toEqual([2 * c.swaps, 0]);
      const passes = marked(t).reduce((s, p) => s + p.keys.length, 0);
      expect(c.swaps, at(a)).toBeGreaterThanOrEqual(passes);
      if (c.compares === 0) expect(c.swaps, at(a)).toBe(passes);
    }
    // on 1..n, n > 16: a pass on the second-lowest byte once n reaches 256, then one on the lowest
    // byte for every block of more than 16 keys; a block of 2 to 16 is left to the comparison sort
    for (const a of PERMS.filter((x) => x.length > 16)) {
      const n = a.length;
      const bs = blocks(a).map((b) => b.length);
      const c = run('skasort', a).counts;
      expect(c.compares === 0, at(a)).toBe(bs.every((m) => m === 1 || m > 16));
      if (c.compares === 0) expect(c.swaps, at(a)).toBe((n >= 256 ? n : 0) + bs.filter((m) => m > 16).reduce((s, m) => s + m, 0));
    }
    const sorted = counts('skasort', input('sorted', 512, 1));
    expect(sorted).toEqual([0, 2046, 0]);
    for (const s of SEEDS) expect(counts('skasort', input('random', 512, s)), `seed ${s}`).toEqual(sorted);
  });

  it('spreadsort: on 16 keys or more one scan of 2(n − 1) + f comparisons, f to the first descent; on 1..n, n − c exchanges for c cycles', () => {
    for (const a of [...CASES, ...SWEEP, ...PERMS]) {
      const t = run('spreadsort', a);
      const c = t.counts;
      expect([c.writes, c.auxWrites], at(a)).toEqual([2 * c.swaps, 0]);
      const n = a.length;
      if (n < 16) {
        // below the threshold the kit's introsort, which is an exchange insertion sort up to 16 keys
        expect([c.compares, c.swaps], at(a)).toEqual([insertionCompares(a), inversions(a)]);
        continue;
      }
      let f = 1;
      while (f < n && !(a[f] < a[f - 1])) f++;
      expect(c.compares, at(a)).toBe(2 * (n - 1) + Math.min(f, n - 1));
      if (isPermutation(a)) expect(c.swaps, at(a)).toBe(n - cycles(a));
    }
    for (const n of ALL.filter((x) => x >= 16)) {
      expect(counts('spreadsort', input('sorted', n, 1)), `sorted n=${n}`).toEqual([3 * (n - 1), 0, 0]);
    }
    expect(counts('spreadsort', input('sorted', 512, 1))[0]).toBe(1533);
  });

  it('burstsort: exactly n array writes; its comparisons are the insertion sorts of its containers', () => {
    // up to 32 keys one container holds them all; past that the trie bursts down to the lowest byte
    // wherever a block of 256 keys holds more than 32, and there every container holds equal keys
    const containers = (a: number[]) => (a.length <= 32 ? insertionCompares(a)
      : blocks(a).reduce((s, b) => s + (b.length > 32 ? b.length - distinct(b) : insertionCompares(b)), 0));
    for (const a of [...CASES, ...SWEEP, ...PERMS]) {
      const c = run('burstsort', a).counts;
      expect([c.compares, c.writes], at(a)).toEqual([containers(a), a.length < 2 ? 0 : a.length]);
    }
    expect(counts('burstsort', input('few-unique', 512, 4242))[0]).toBe(512 - 4);
    expect(counts('burstsort', input('random', 512, 4242))[0]).toBe(0);
  });

  it('kirkpatrick-reisch-sort: 2n − 1 − g comparisons for g groups of the 16-bit level, n array writes, 3n auxiliary writes', () => {
    // level 32: one group (every key's high half is the same), n − 1 comparisons to find its
    // minimum; level 16: the group's high half and the other n − 1 keys, grouped by their high byte
    const groups = (a: number[]) => {
      const rest = a.slice();
      rest.splice(rest.indexOf(Math.min(...rest)), 1);
      return 1 + distinct(rest.map((x) => x >> 8));
    };
    for (const a of [...CASES, ...SWEEP]) {
      const n = a.length;
      const t = run('kirkpatrick-reisch-sort', a);
      if (n < 2) { expect(counts('kirkpatrick-reisch-sort', a), at(a)).toEqual([0, 0, 0]); continue; }
      expect(counts('kirkpatrick-reisch-sort', a), at(a)).toEqual([2 * n - 1 - groups(a), n, 3 * n]);
      expect([t.marks.phases, t.labels], at(a)).toEqual([3, [
        'split 32-bit keys into 16-bit halves', 'split 16-bit keys into 8-bit halves', 'counting sort on 8-bit keys']]);
    }
    expect(SHAPES.map((s) => counts('kirkpatrick-reisch-sort', input(s, 512, 4242))[0]))
      .toEqual([1019, 1019, 1019, 1021, 1020, 1019]);
  });

  it('postman-sort: no comparison and exactly n array writes; n auxiliary writes when the keys span one decimal digit', () => {
    for (const a of [...CASES, ...SWEEP]) {
      const [c, w, x] = counts('postman-sort', a);
      expect([c, w], at(a)).toEqual([0, a.length]);
      if (a.length >= 2) expect(x, at(a)).toBeGreaterThanOrEqual(a.length);
      if (a.length >= 2 && max(a) - Math.min(...a) < 10) expect(x, at(a)).toBe(a.length);
    }
    expect(counts('postman-sort', input('few-unique', 512, 4242))).toEqual([0, 512, 512]);
    expect(counts('postman-sort', input('random', 512, 4242))).toEqual([0, 512, 1528]);
  });

  it('three-way-radix-quicksort: a partition of m strings makes m − 1 character comparisons and at most m − 1 swaps', () => {
    for (const n of [4, 5, 7, 14, 33, 64]) {
      for (const seed of [4242, 1, 2, 3, 4, 5, 6, 7]) {
        const x = stringInput('words', n, '', seed);
        const t = stringTrace(threeWay, x);
        expect(t.truncated).toBe(false);
        const parts: { m: number; compares: number; swaps: number }[] = [];
        const ev = t.events.toArray();
        for (const e of ev) {
          if (e.o === SOP.note) {
            const m = /^partition rows (\d+)\.\.(\d+)/.exec(e.s ?? '');
            if (m) parts.push({ m: Number(m[2]) - Number(m[1]) + 1, compares: 0, swaps: 0 });
          } else if (e.o === SOP.tick && parts.length) {
            if (t.counters[e.i] === 'compare') parts[parts.length - 1].compares += e.v;
            else parts[parts.length - 1].swaps += e.v;
          }
        }
        const where = `n=${n} seed ${seed}`;
        expect(parts[0].m, where).toBe(n);
        for (const p of parts) {
          expect(p.compares, where).toBe(p.m - 1);
          expect(p.swaps, where).toBeLessThanOrEqual(p.m - 1);
        }
        const [compares, swaps] = t.counts;
        expect(compares, where).toBe(parts.reduce((s, p) => s + p.m - 1, 0));
        expect(swaps, where).toBeLessThanOrEqual(compares);
      }
    }
  });
});
