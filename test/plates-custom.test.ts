import type p5 from 'p5';
import { describe, expect, it } from 'vitest';
import { PALETTES } from '../src/core/palette';
import type { Chart, Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { mulberry32, shuffle } from '../src/core/random';
import {
  cycle, diagnosticity, inconsistency, inconsistencyByRow, placeLabel, rank, standing, synthetic,
  type Matrix, type Rating,
}
  from '../src/plates/ach-matrix/ach';
import { machine, sortExternally } from '../src/plates/balanced-multiway-merge/merge';
import { chartGate } from '../src/plates/_shared/publish';
import { ProbeMap } from '../src/plates/_shared/sorted-search/probe-map';
import { binarySearch, query, sortedKeys } from '../src/plates/_shared/sorted-search/search';
import { RingQueue, tick as queueTick, traffic } from '../src/plates/circular-queue/ring';
import { Isam } from '../src/plates/indexed-sequential-access/isam';
import { interpolationSearch } from '../src/plates/interpolation-search/interpolate';
import { josephus } from '../src/plates/josephus-circle/josephus';
import { heap, johnsonTrotter } from '../src/plates/permutation-generation/perm';
import { ruler, type Order } from '../src/plates/ruler-drawing/ruler';
import { SequentialList, draw, zipf } from '../src/plates/sequential-search/sequential';
import { SkipList } from '../src/plates/skip-list/skiplist';
import { apply, hanoi, pegs, type Move } from '../src/plates/towers-of-hanoi/hanoi';

describe('ring-buffer queue', () => {
  it('behaves like an unbounded FIFO while it has room, refuses when full', () => {
    const rnd = mulberry32(7);
    for (const cap of [1, 2, 5, 16]) {
      const q = new RingQueue(cap);
      const ref: number[] = [];
      for (let k = 0; k < 2000; k++) {
        if (rnd() < 0.55) {
          const ok = q.enqueue(k);
          expect(ok).toBe(ref.length < cap);
          if (ok) ref.push(k);
        } else {
          expect(q.dequeue()).toBe(ref.shift());
        }
        expect(q.size).toBe(ref.length);
        expect(q.toArray()).toEqual(ref);
      }
    }
  });

  it('accounts for every arrival and every poll', () => {
    const t = traffic(8);
    const rnd = mulberry32(3);
    for (let k = 0; k < 5000; k++) queueTick(t, rnd, 0.6, 0.5);
    expect(t.enqueued - t.dequeued).toBe(t.queue.size);
    expect(t.enqueued + t.rejected).toBeGreaterThan(0);
    // every completed lap of the tail wrote 8 slots
    expect(t.wraps).toBe(Math.floor(t.enqueued / 8));
  });
});

describe('Josephus', () => {
  function brute(n: number, m: number): { order: number[]; survivor: number } {
    const people = Array.from({ length: n }, (_, i) => i);
    const order: number[] = [];
    let at = 0;
    while (people.length > 1) {
      at = (at + m - 1) % people.length;
      order.push(people.splice(at, 1)[0]);
    }
    return { order, survivor: people[0] };
  }

  it('matches the closed form for M = 2', () => {
    for (let n = 1; n <= 300; n++) {
      const top = 2 ** Math.floor(Math.log2(n));
      expect(josephus(n, 2).survivor + 1).toBe(2 * (n - top) + 1);
    }
  });

  it('matches a brute-force array simulation for every M', () => {
    for (let n = 1; n <= 60; n++) {
      for (let m = 1; m <= 9; m++) {
        const got = josephus(n, m);
        const want = brute(n, m);
        expect(got.order).toEqual(want.order);
        expect(got.survivor).toBe(want.survivor);
        expect(got.links).toBe((n - 1) * (m - 1));
      }
    }
  });
});

describe('ruler', () => {
  const trailingZeros = (x: number) => {
    let z = 0;
    while (x % 2 === 0) {
      x /= 2;
      z++;
    }
    return z;
  };

  it('marks every position once, at height one more than its trailing zero bits', () => {
    for (const order of ['inorder', 'preorder', 'bottom-up'] as Order[]) {
      for (let n = 1; n <= 9; n++) {
        const marks = [...ruler(n, order)];
        expect(marks.length).toBe(2 ** n - 1);
        expect(new Set(marks.map((m) => m.x)).size).toBe(2 ** n - 1);
        for (const m of marks) expect(m.h).toBe(trailingZeros(m.x) + 1);
      }
    }
  });

  it('in order draws left to right; bottom-up draws by height; the recursion makes 2ⁿ⁺¹ − 1 calls', () => {
    const n = 7;
    const inorder = [...ruler(n, 'inorder')];
    expect(inorder.map((m) => m.x)).toEqual(Array.from({ length: 2 ** n - 1 }, (_, i) => i + 1));
    const up = [...ruler(n, 'bottom-up')].map((m) => m.h);
    expect(up).toEqual([...up].sort((a, b) => a - b));
    const pre = [...ruler(n, 'preorder')];
    expect(pre[0]).toMatchObject({ x: 2 ** (n - 1), h: n, depth: 0 });
    expect(Math.max(...pre.map((m) => m.depth))).toBe(n - 1);
  });

  /** Drain a generator and return what it returns. */
  function total(n: number, order: Order): number {
    const g = ruler(n, order);
    for (;;) {
      const r = g.next();
      if (r.done) return r.value;
    }
  }

  it('counts exactly 2ⁿ⁺¹ − 1 calls for the recursive orders, and none bottom-up', () => {
    for (let n = 1; n <= 10; n++) {
      // one call per node of the full binary call tree: 2ⁿ − 1 marks plus 2ⁿ leaves at height 0
      expect(total(n, 'inorder')).toBe(2 ** (n + 1) - 1);
      expect(total(n, 'preorder')).toBe(2 ** (n + 1) - 1);
      expect(total(n, 'bottom-up')).toBe(0);
      expect([...ruler(n, 'bottom-up')].every((m) => m.calls === 0)).toBe(true);
    }
  });
});

describe('towers of Hanoi', () => {
  /** The classic iterative solution: the smallest disc cycles one way on odd moves, the other
   * move is the only legal one not involving it. */
  function iterative(n: number): [number, number][] {
    const st = pegs(n);
    const out: [number, number][] = [];
    const dir = n % 2 === 0 ? 1 : 2; // peg step for disc 1 so that the tower ends on peg 2
    let small = 0;
    for (let k = 1; k < 2 ** n; k++) {
      if (k % 2 === 1) {
        const to = (small + dir) % 3;
        out.push([small, to]);
        st[to].push(st[small].pop()!);
        small = to;
      } else {
        const [a, b] = [0, 1, 2].filter((x) => x !== small);
        const ta = st[a][st[a].length - 1] ?? Infinity;
        const tb = st[b][st[b].length - 1] ?? Infinity;
        const [from, to] = ta < tb ? [a, b] : [b, a];
        out.push([from, to]);
        st[to].push(st[from].pop()!);
      }
    }
    return out;
  }

  it('takes 2ⁿ − 1 legal moves and ends with the tower on the target peg', () => {
    for (let n = 1; n <= 12; n++) {
      const st = pegs(n);
      const moves = [...hanoi(n)];
      expect(moves.length).toBe(2 ** n - 1);
      for (const m of moves) apply(st, m);
      expect(st[2]).toEqual(pegs(n)[0]);
      expect(st[0].length + st[1].length).toBe(0);
    }
  });

  it('agrees with the independent iterative solution', () => {
    for (let n = 1; n <= 10; n++) {
      expect([...hanoi(n)].map((m) => [m.from, m.to])).toEqual(iterative(n));
    }
  });

  it('refuses an illegal move', () => {
    const st = pegs(3);
    apply(st, { disc: 1, from: 0, to: 2, depth: 0 });
    const bad: Move = { disc: 2, from: 0, to: 2, depth: 0 };
    expect(() => apply(st, bad)).toThrow();
  });
});

describe('permutation generation', () => {
  const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
  const diff = (a: number[], b: number[]) => a.map((x, i) => (x !== b[i] ? i : -1)).filter((i) => i >= 0);

  for (const [name, gen] of [['Heap', heap], ['Johnson–Trotter', johnsonTrotter]] as const) {
    it(`${name}: n! distinct permutations, each one exchange from the last`, () => {
      for (let n = 1; n <= 7; n++) {
        const steps = [...gen(n)];
        expect(steps.length).toBe(fact(n));
        expect(new Set(steps.map((s) => s.perm.join(','))).size).toBe(fact(n));
        for (const s of steps) expect([...s.perm].sort()).toEqual(Array.from({ length: n }, (_, k) => k));
        for (let k = 1; k < steps.length; k++) {
          const d = diff(steps[k - 1].perm, steps[k].perm);
          expect(d).toEqual([Math.min(steps[k].i, steps[k].j), Math.max(steps[k].i, steps[k].j)]);
          if (name === 'Johnson–Trotter') expect(d[1] - d[0]).toBe(1);
        }
      }
    });
  }
});

describe('balanced multiway merge', () => {
  it('refuses fewer than two ways, which would never finish', () => {
    expect(() => machine([3, 1, 2], 1, 1)).toThrow(RangeError);
    expect(() => machine([3, 1, 2], 0, 2)).toThrow(RangeError);
    expect(() => machine([3, 1, 2], 1, 2)).not.toThrow();
  });

  it('outputs a sorted permutation of the input in ⌈log_P(runs)⌉ merge passes', () => {
    const rnd = mulberry32(11);
    for (const [n, m, p] of [[1, 4, 2], [37, 5, 2], [240, 10, 3], [500, 7, 4], [64, 8, 8], [33, 40, 3]]) {
      const input = Array.from({ length: n }, () => Math.floor(rnd() * 1000));
      const { output, s } = sortExternally(input, m, p);
      expect(output).toEqual([...input].sort((a, b) => a - b));
      let r = Math.ceil(n / m);
      const want = [r];
      while (r > 1) {
        r = Math.ceil(r / p);
        want.push(r);
      }
      expect(s.runsAfter).toEqual(want);
      expect(s.pass).toBe(want.length - 1);
      expect(s.writes).toBe(n * want.length);
    }
  });
});

describe('searches', () => {
  const rnd = mulberry32(5);

  it('binary and interpolation search agree with indexOf, hits and misses', () => {
    for (const spread of ['uniform', 'logarithmic'] as const) {
      for (const n of [1, 2, 3, 10, 100, 777]) {
        const keys = sortedKeys(n, spread, rnd);
        expect(new Set(keys).size).toBe(n);
        for (let k = 0; k < 300; k++) {
          const q = query(keys, 0.5, rnd);
          const want = keys.indexOf(q);
          expect(binarySearch(keys, q).index).toBe(want);
          expect(interpolationSearch(keys, q).index).toBe(want);
        }
      }
    }
  });

  it('binary search probes at most ⌊lg n⌋ + 1 times, inside its interval', () => {
    for (const n of [1, 7, 8, 100, 1024]) {
      const keys = sortedKeys(n, 'uniform', rnd);
      for (let k = 0; k < 200; k++) {
        const r = binarySearch(keys, query(keys, 0.5, rnd));
        expect(r.probes.length).toBeLessThanOrEqual(Math.floor(Math.log2(n)) + 1);
        r.probes.forEach((p, i) => {
          expect(p).toBeGreaterThanOrEqual(r.bounds[i][0]);
          expect(p).toBeLessThanOrEqual(r.bounds[i][1]);
        });
      }
    }
  });

  it('interpolation search finds a key with duplicates and probes few times on uniform keys', () => {
    const dup = [1, 1, 2, 2, 2, 5, 9, 9];
    for (const q of [1, 2, 5, 9]) expect(dup[interpolationSearch(dup, q).index]).toBe(q);
    for (const q of [0, 3, 10]) expect(interpolationSearch(dup, q).index).toBe(-1);
    const keys = sortedKeys(4096, 'uniform', rnd);
    let probes = 0;
    for (let k = 0; k < 500; k++) probes += interpolationSearch(keys, query(keys, 1, rnd)).probes.length;
    expect(probes / 500).toBeLessThan(5); // lg lg 4096 ≈ 3.6, against lg 4096 = 12 for binary
  });

  it('interpolation search loses to binary search on log-spread keys', () => {
    const keys = sortedKeys(1024, 'logarithmic', rnd);
    let interp = 0;
    let binary = 0;
    for (let k = 0; k < 500; k++) {
      const q = query(keys, 0.75, rnd);
      interp += interpolationSearch(keys, q).probes.length;
      binary += binarySearch(keys, q).probes.length;
    }
    expect(interp).toBeGreaterThan(2 * binary);
  });

  it('the disc moved by Hanoi move k is the ruler mark at k', () => {
    const tz = (k: number) => {
      let z = 0;
      while (k % 2 === 0) {
        k /= 2;
        z++;
      }
      return z;
    };
    [...hanoi(9)].forEach((m, i) => expect(m.disc).toBe(tz(i + 1) + 1));
  });

  it('sequential search finds what indexOf finds and keeps the list a permutation', () => {
    for (const strategy of ['static', 'move-to-front', 'transpose'] as const) {
      const keys = shuffle(Array.from({ length: 50 }, (_, i) => i * 3), rnd);
      const list = new SequentialList([...keys], strategy);
      for (let k = 0; k < 500; k++) {
        const q = Math.floor(rnd() * 160);
        const before = [...list.keys];
        const r = list.search(q);
        expect(r.index).toBe(before.indexOf(q));
        expect(r.probes).toBe(r.index < 0 ? before.length : r.index + 1);
        if (r.index > 0 && strategy === 'move-to-front') expect(list.keys[0]).toBe(q);
        if (r.index > 0 && strategy === 'transpose') expect(list.keys[r.index - 1]).toBe(q);
        expect([...list.keys].sort((a, b) => a - b)).toEqual([...keys].sort((a, b) => a - b));
      }
    }
  });

  it('draws Zipf ranks with the right frequencies', () => {
    const cdf = zipf(10, 1);
    const counts = new Array(10).fill(0);
    for (let k = 0; k < 40000; k++) counts[draw(cdf, rnd)]++;
    const h = [...Array(10)].reduce((s, _, r) => s + 1 / (r + 1), 0);
    for (let r = 0; r < 10; r++) expect(counts[r] / 40000).toBeCloseTo(1 / (r + 1) / h, 1);
  });
});

describe('skip list', () => {
  it('holds exactly what a Set holds, sorted, each level a sub-list of the one below', () => {
    const rnd = mulberry32(9);
    for (const p of [0.5, 0.25]) {
      const sl = new SkipList(12, p, mulberry32(2));
      const ref = new Set<number>();
      for (let k = 0; k < 3000; k++) {
        const key = Math.floor(rnd() * 400);
        const op = rnd();
        if (op < 0.5) expect(sl.insert(key).inserted).toBe(!ref.has(key));
        else if (op < 0.75) expect(sl.remove(key)).toBe(ref.has(key));
        else expect(sl.search(key).found).toBe(ref.has(key));
        if (op < 0.5) ref.add(key);
        else if (op < 0.75) ref.delete(key);
        expect(sl.size).toBe(ref.size);
      }
      expect(sl.keys()).toEqual([...ref].sort((a, b) => a - b));
      for (let lv = 1; lv < sl.level; lv++) {
        const below = new Set(sl.lane(lv - 1));
        for (const x of sl.lane(lv)) expect(below.has(x)).toBe(true);
      }
    }
  });

  it('searches in far fewer comparisons than a scan', () => {
    const sl = new SkipList(16, 0.5, mulberry32(4));
    for (let k = 0; k < 4096; k++) sl.insert(k * 2);
    let cmp = 0;
    const rnd = mulberry32(8);
    for (let k = 0; k < 500; k++) cmp += sl.search(Math.floor(rnd() * 8192)).cmp;
    expect(cmp / 500).toBeLessThan(60); // a scan would average about 2048
  });
});

describe('probe map', () => {
  it('stays within its limit on interpolation search over log-spread keys, counting exactly', () => {
    const rnd = mulberry32(17);
    const keys = sortedKeys(1024, 'logarithmic', rnd);
    const limit = 512;
    const pm = new ProbeMap(keys.length, limit);
    const ref = new Map<string, number>();
    for (let k = 0; k < 4000; k++) {
      const probes = interpolationSearch(keys, query(keys, 0.75, rnd)).probes;
      pm.record(probes);
      probes.forEach((idx, d) => ref.set(`${d}:${idx}`, (ref.get(`${d}:${idx}`) ?? 0) + 1));
    }
    // unbounded, these searches visit far more distinct points than the limit
    expect(ref.size).toBeGreaterThan(limit);
    expect(pm.points).toBe(limit);
    expect(pm.moves).toBeLessThanOrEqual(limit);
    // every visit to a point the map refused is counted once, and only those visits
    let refused = 0;
    for (const [k, v] of ref) {
      const [d, idx] = k.split(':').map(Number);
      if (pm.count(d, idx) === 0) refused += v;
    }
    expect(pm.pointVisitsDropped).toBe(refused);
    for (let k = 0; k < pm.points; k++) {
      expect(pm.hits[k]).toBe(ref.get(`${pm.step[k]}:${pm.pos[k]}`));
      expect(pm.count(pm.step[k], pm.pos[k])).toBe(pm.hits[k]);
    }
  });

  it('holds the whole decision tree of binary search, which is small', () => {
    const rnd = mulberry32(3);
    const keys = sortedKeys(255, 'uniform', rnd);
    const pm = new ProbeMap(keys.length, 2048);
    for (let k = 0; k < 5000; k++) pm.record(binarySearch(keys, query(keys, 1, rnd)).probes);
    // a perfect tree of 255 positions: every position probed at one fixed step, 254 parent links
    expect(pm.points).toBe(255);
    expect(pm.moves).toBe(254);
    expect(pm.pointVisitsDropped + pm.moveVisitsDropped).toBe(0);
  });
});

describe('indexed sequential access', () => {
  it('finds exactly the stored keys after inserts into overflow chains', () => {
    const rnd = mulberry32(13);
    const start = sortedKeys(200, 'uniform', rnd);
    const isam = new Isam(start, 8, 0.75);
    const ref = new Set(start);
    expect(isam.pages.length).toBe(Math.ceil(200 / 6));
    for (let k = 0; k < 600; k++) {
      // a hot spot: most inserts land in a narrow band, so a few chains grow long
      const key = rnd() < 0.7 ? 500 + Math.floor(rnd() * 60) : Math.floor(rnd() * 2000);
      expect(isam.insert(key)).toBe(!ref.has(key));
      ref.add(key);
    }
    expect(isam.size).toBe(ref.size);
    expect(isam.keys()).toEqual([...ref].sort((a, b) => a - b));
    for (let q = -5; q < 2005; q++) {
      const r = isam.search(q);
      expect(r.found).toBe(ref.has(q));
      expect(r.pageReads).toBeLessThanOrEqual(1 + isam.overflow[r.page].length);
      expect(r.indexProbes).toBeLessThanOrEqual(Math.floor(Math.log2(isam.index.length)) + 1);
    }
    expect(isam.longestChain()).toBeGreaterThan(1);
    for (const pg of isam.pages) expect(pg.length).toBeLessThanOrEqual(8);
  });
});

describe('analysis of competing hypotheses', () => {
  // three hypotheses, four items of evidence, scored by hand:
  //        H1   H2   H3   weight
  //  E1    C    I    II   1
  //  E2    N    I    C    1.5
  //  E3    I    CC   C    0.5
  //  E4    C    C    C    1     (fits everything: not diagnostic)
  // H1: E3 I × 0.5 = 0.5;  H2: E1 I + E2 I × 1.5 = 2.5;  H3: E1 II × 1 = 2
  const m: Matrix = {
    hypotheses: ['H1', 'H2', 'H3'],
    evidence: [
      { label: 'E1', weight: 1 }, { label: 'E2', weight: 1.5 },
      { label: 'E3', weight: 0.5 }, { label: 'E4', weight: 1 },
    ],
    cells: [[1, -1, -2], [0, -1, 1], [-1, 2, 1], [1, 1, 1]],
  };

  it('scores weighted inconsistency and ranks the least contradicted first', () => {
    expect(inconsistency(m)).toEqual([0.5, 2.5, 2]);
    expect(rank(inconsistency(m))).toEqual([0, 2, 1]);
    expect(inconsistency(m, 1)).toEqual([0, 1, 2]);
    expect(rank([1, 1, 0])).toEqual([2, 0, 1]);
  });

  it('a row that fits every hypothesis alike is not diagnostic and changes no score', () => {
    expect(m.cells.map((r) => diagnosticity(r))).toEqual([3, 2, 3, 0]);
    expect(inconsistency(m, 3)).toEqual(inconsistency(m, 4));
  });

  it('reports shared places as ties instead of ordering them', () => {
    expect(standing([1, 1, 0], 2)).toEqual({ place: 1, tied: false });
    expect(standing([1, 1, 0], 0)).toEqual({ place: 2, tied: true });
    expect(standing([2, 2, 3], 1)).toEqual({ place: 1, tied: true });
    expect(placeLabel(standing([2, 2, 3], 0))).toBe('tied 1st');
    expect(placeLabel(standing([2, 2, 3], 2))).toBe('3rd');
    expect(placeLabel(standing([0.5, 2.5, 2], 0))).toBe('1st');
  });

  it('prefix scores agree with scoring each prefix afresh', () => {
    const byRow = inconsistencyByRow(m);
    for (let r = 0; r <= m.evidence.length; r++) expect(byRow[r]).toEqual(inconsistency(m, r));
  });

  it('cycles ratings through all five values', () => {
    let r: Rating = -2;
    const seen: Rating[] = [];
    for (let k = 0; k < 5; k++) {
      seen.push(r);
      r = cycle(r);
    }
    expect(seen).toEqual([-2, -1, 0, 1, 2]);
    expect(r).toBe(-2);
  });

  it('on synthetic cases with little noise the true hypothesis usually ranks first', () => {
    const rnd = mulberry32(21);
    let first = 0;
    for (let k = 0; k < 200; k++) {
      const truth = Math.floor(rnd() * 4);
      const s = synthetic(rnd, 4, 15, truth, 0.1);
      if (rank(inconsistency(s))[0] === truth) first++;
    }
    expect(first).toBeGreaterThan(160);
  });
});

describe('custom plates run headless', () => {
  const ids = ['circular-queue', 'josephus-circle', 'ruler-drawing', 'towers-of-hanoi',
    'permutation-generation', 'balanced-multiway-merge', 'binary-search', 'interpolation-search',
    'sequential-search', 'skip-list', 'indexed-sequential-access', 'ach-matrix'];
  const plates = import.meta.glob<PlateCode>('../src/plates/*/plate.ts', { import: 'default' });

  // a p5 stand-in: every drawing call is a no-op that is counted, every constant a placeholder
  let calls = 0;
  const stub = new Proxy({}, { get: () => () => void calls++ }) as unknown as p5;
  /** Drawing calls a single frame may make at the largest parameters. */
  const FRAME_BUDGET = 15000;

  function context(code: PlateCode, thumbnail: boolean, seed: number) {
    const params: Params = {};
    for (const d of code.params) params[d.key] = d.value;
    const stats: Stat[][] = [];
    const charts: Chart[] = [];
    const ctx: PlateContext = {
      width: 390, height: 260, params, seed, rnd: mulberry32(seed), theme: 'dark',
      bg: [0, 0, 0], fg: [255, 255, 255], palette: () => PALETTES[0], thumbnail,
      stats: (rows) => stats.push(rows), chart: (c) => charts.push(c),
    };
    return { ctx, params, stats, charts };
  }

  for (const id of ids) {
    it(`${id}: setup, many frames, pointer and every select option, without throwing`, async () => {
      const code = await plates[`../src/plates/${id}/plate.ts`]();
      expect(code.id).toBe(id);
      for (const [thumbnail, fastest] of [[true, false], [false, false], [false, true]]) {
        const { ctx, params, stats } = context(code, thumbnail, 42);
        // the fastest setting exercises the most steps per frame
        if (fastest) for (const d of code.params) if (d.kind === 'range' && d.key === 'speed') params.speed = d.max;
        const sim = code.create(stub, ctx);
        sim.setup();
        for (let f = 0; f < (thumbnail ? (code.thumbnailFrames ?? 90) : 400); f++) {
          sim.draw();
          if (f % 50 === 7) sim.pressed?.(120, 140);
        }
        if (!thumbnail && !fastest) {
          expect(stats.length).toBeGreaterThan(0);
          const first = JSON.stringify(stats[0]);
          expect(stats.some((s) => JSON.stringify(s) !== first), 'readouts change as it runs').toBe(true);
        }
      }
      for (const d of code.params) {
        if (d.kind !== 'select' || d.key === 'palette') continue;
        for (const o of d.options) {
          const { ctx, params } = context(code, false, 7);
          params[d.key] = o.value;
          const sim = code.create(stub, ctx);
          sim.setup();
          for (let f = 0; f < 60; f++) sim.draw();
        }
      }
      {
        // every range at its maximum: the heaviest picture the controls allow stays in budget
        const { ctx, params } = context(code, false, 11);
        for (const d of code.params) if (d.kind === 'range') params[d.key] = d.max;
        const sim = code.create(stub, ctx);
        sim.setup();
        let worst = 0;
        for (let f = 0; f < 300; f++) {
          calls = 0;
          sim.draw();
          worst = Math.max(worst, calls);
        }
        expect(worst, `${id} drawing calls in one frame`).toBeLessThan(FRAME_BUDGET);
      }
      for (const d of code.params) {
        if (d.kind !== 'range' || !d.rebuild) continue;
        for (const v of [d.min, d.max]) {
          const { ctx, params } = context(code, false, 9);
          params[d.key] = v;
          const sim = code.create(stub, ctx);
          sim.setup();
          for (let f = 0; f < 30; f++) sim.draw();
        }
      }
    });
  }
});

describe('ruler readouts', () => {
  const stub = new Proxy({}, { get: () => () => undefined }) as unknown as p5;

  async function run(order: string): Promise<Stat[][]> {
    const code = (await import('../src/plates/ruler-drawing/plate')).default;
    const params: Params = {};
    for (const d of code.params) params[d.key] = d.value;
    params.order = order;
    params.n = 5;
    params.speed = 8;
    params.loop = false;
    const stats: Stat[][] = [];
    const ctx: PlateContext = {
      width: 390, height: 260, params, seed: 1, rnd: mulberry32(1), theme: 'dark',
      bg: [0, 0, 0], fg: [255, 255, 255], palette: () => PALETTES[0], thumbnail: false,
      stats: (rows) => stats.push(rows), chart: () => {},
    };
    const sim = code.create(stub, ctx);
    sim.setup();
    for (let f = 0; f < 30; f++) sim.draw();
    return stats;
  }

  it('the bottom-up order reports no calls, since it makes none', async () => {
    const stats = await run('bottom-up');
    expect(stats.length).toBeGreaterThan(0);
    for (const rows of stats) expect(rows.some((r) => /call/i.test(r.label))).toBe(false);
  });

  it('a recursive order reports exactly 2ⁿ⁺¹ − 1 calls once drawing ends', async () => {
    const last = (await run('inorder')).at(-1)!;
    expect(last.find((r) => r.label === 'Calls made in all')?.value).toBe(String(2 ** 6 - 1));
  });
});

describe('chart gate and restarts', () => {
  const stub = new Proxy({}, { get: () => () => undefined }) as unknown as p5;

  function mount(code: PlateCode, set: Params) {
    const params: Params = {};
    for (const d of code.params) params[d.key] = d.value;
    Object.assign(params, set);
    const charts: Chart[] = [];
    const ctx: PlateContext = {
      width: 390, height: 260, params, seed: 5, rnd: mulberry32(5), theme: 'dark',
      bg: [0, 0, 0], fg: [255, 255, 255], palette: () => PALETTES[0], thumbnail: false,
      stats: () => {}, chart: (c) => charts.push(c),
    };
    const sim = code.create(stub, ctx);
    sim.setup();
    return { sim, params, charts };
  }

  it('a reset gate opens on the next frame and once more after', () => {
    const g = chartGate(30);
    g.mark();
    expect(g.open()).toBe(true);
    expect(g.open()).toBe(false);
    g.reset();
    expect(g.open()).toBe(true);
    for (let f = 0; f < 29; f++) expect(g.open()).toBe(false);
    expect(g.open()).toBe(true);
    for (let f = 0; f < 60; f++) expect(g.open()).toBe(false);
  });

  it('a looped merge replaces the last run\'s chart with the new, empty one', async () => {
    const code = (await import('../src/plates/balanced-multiway-merge/plate')).default;
    const { sim, charts } = mount(code, { records: 20, memory: 4, ways: 2, speed: 60, loop: true });
    let restartAt = -1;
    for (let f = 0; f < 400 && restartAt < 0; f++) {
      const before = charts.length;
      sim.draw();
      const c = charts.at(-1);
      if (charts.length > before && c && c.series[0].points.length === 0) restartAt = f;
    }
    expect(restartAt).toBeGreaterThan(0);
  });

  it('a looped ACH case survives a change of size without a remount and clears its chart', async () => {
    const code = (await import('../src/plates/ach-matrix/plate')).default;
    const { sim, params, charts } = mount(code, { e: 12, h: 5, speed: 0.5, loop: true });
    for (let f = 0; f < 40; f++) sim.draw();
    params.e = 3;
    params.h = 2;
    let cleared = false;
    for (let f = 0; f < 400; f++) {
      const before = charts.length;
      sim.draw();
      const c = charts.at(-1);
      if (charts.length > before && c && c.series.length === 2 && c.series[0].points.length === 1) cleared = true;
    }
    expect(cleared).toBe(true);
    expect(diagnosticity(undefined)).toBe(0);
  });
});
