// Every live grid kernel of the catalogue, checked by one harness against independent
// references: brute force, enumeration, trial division and known sequences, never the code
// under test (rule project.no-fake-science).
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type p5 from 'p5';
import { GROUNDS, palette } from '../src/core/palette';
import type { Chart, Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { BUILD_EVENTS_PER_FRAME, engine, FLASH_FRAMES, Replay } from '../src/engines/grid';
import { OP, OP_COUNT, seeded, trace, Tracer, type GridKernel, type GridOps, type Trace } from '../src/engines/grid/trace';
import type { KnapsackData, KnapsackResult } from '../src/kernels/grid/knapsack-dp';
import type { LcsData, LcsResult } from '../src/kernels/grid/longest-common-subsequence';
import type { ChainData, ChainResult } from '../src/kernels/grid/matrix-chain';
import type { BstData, BstResult } from '../src/kernels/grid/optimal-bst';
import type { QueensResult } from '../src/kernels/grid/n-queens';
import type { SieveResult } from '../src/kernels/grid/sieve-of-eratosthenes';
import type { FibResult } from '../src/kernels/grid/fibonacci-memo';

const modules = import.meta.glob<GridKernel>('../src/kernels/grid/[!_]*.ts', { import: 'kernel', eager: true });
const live = ENTRIES.filter((e) => e.engine === 'grid' && e.status === 'live');
const kernelOf = (id: string) => modules[`../src/kernels/grid/${id}.ts`];
const SEEDS = [1, 7, 42, 1009];

/** A size grid over the kernel's control: its ends, its default and a few between. */
function sizes(k: GridKernel, cap = Infinity): number[] {
  const { min, max, step, value } = k.size;
  const top = Math.min(max, cap);
  const out = new Set([min, value, top, Math.round((min + top) / 2)]);
  for (let n = min; n <= top; n += Math.max(step, Math.ceil((top - min) / 6))) out.add(n);
  return [...out].filter((n) => n <= top).sort((a, b) => a - b);
}

function run<D, R>(id: string, n: number, seed: number): { data: D; t: Trace<R>; r: R } {
  const inst = (kernelOf(id) as GridKernel<D, R>).instance(n, seed);
  const t = trace(inst);
  expect(t.truncated, `${id} n=${n}`).toBe(false);
  return { data: inst.data, t, r: t.outcome!.result };
}

const isSubsequence = (s: string, of: string) => {
  let j = 0;
  for (const ch of of) if (j < s.length && s[j] === ch) j++;
  return j === s.length;
};

type Check = (n: number, seed: number) => void;

/** Events a kernel may record past a step's budget before its next yield. */
const SLACK = 256;
const OP_LIST = Array.from({ length: OP_COUNT }, (_, i) => i);

/** Counts a trace's events by op, row and cell, with plain loops and sets (no Tally). */
function recount(t: Trace) {
  const total = OP_LIST.map(() => 0);
  const byRow = OP_LIST.map(() => new Array<number>(t.rows).fill(0));
  const written = new Set<string>();
  const writtenByRow = new Array<number>(t.rows).fill(0);
  const crossed = new Set<string>();
  let hits = 0;
  for (let i = 0; i < t.length; i++) {
    const [op, r, c, v] = [t.events[4 * i], t.events[4 * i + 1], t.events[4 * i + 2], t.events[4 * i + 3]];
    total[op] += 1;
    if (r >= 0) byRow[op][r] += 1;
    const key = `${r},${c}`;
    if (op === OP.write && !written.has(key)) { written.add(key); writtenByRow[r] += 1; }
    if (op === OP.cross) crossed.add(key);
    if (op === OP.lookup && v === 1) hits += 1;
  }
  return { total, byRow, written, writtenByRow, crossed, hits };
}

let traced = 0;
/** The kernel, with every grid operation it performs counted in `traced`. */
function counting(k: GridKernel): GridKernel {
  const wrap = (g: GridOps): GridOps => new Proxy(g, {
    get(target, key) {
      const v = (target as unknown as Record<string | symbol, unknown>)[key];
      if (typeof v !== 'function') return v;
      return (...args: unknown[]) => { traced++; return (v as (...a: unknown[]) => unknown)(...args); };
    },
  });
  return { ...k, instance(n, seed) {
    const inst = k.instance(n, seed);
    return { ...inst, run: (g: GridOps) => inst.run(wrap(g)) };
  } };
}

/** A p5 that draws nothing: every method is a no-op, every constant its own name. */
const stubP5 = new Proxy({}, {
  get: (_t, k) => (typeof k === 'string' && k === k.toUpperCase() ? k : () => undefined),
}) as unknown as p5;

const defaultsOf = (plate: PlateCode): Params => Object.fromEntries(plate.params.map((d) => [d.key, d.value]));

/** Runs a plate for `frames` frames; reports the most operations traced in any one call. */
function drive(plate: PlateCode, params: Params, frames: number) {
  const stats: Stat[][] = [];
  const charts: Chart[] = [];
  const ctx: PlateContext = {
    width: 800, height: 450, params, seed: 3, rnd: () => 0.5, theme: 'dark',
    bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, palette: () => palette('abyss'),
    stats: (r) => { stats.push(r); }, chart: (c) => { charts.push(c); }, thumbnail: false,
  };
  let maxPerCall = 0;
  const call = (f: () => void) => {
    const before = traced;
    f();
    maxPerCall = Math.max(maxPerCall, traced - before);
    return traced - before;
  };
  let sim: ReturnType<PlateCode['create']> | undefined;
  call(() => { sim = plate.create(stubP5, ctx); });
  call(() => sim!.setup());
  const perFrame: number[] = [];
  for (let f = 0; f < frames; f++) perFrame.push(call(() => sim!.draw()));
  return { maxPerCall, perFrame, stats, charts };
}

/** One independent reference per entry; an entry without one fails the harness. */
const REFERENCES: Record<string, { sizes?: number; check: Check }> = {
  'fibonacci-memo': {
    check(n) {
      const { t, r } = run<{ n: number }, FibResult>('fibonacci-memo', n, 0);
      // F(n) by BigInt iteration and by Binet's closed form
      let [a, b] = [0n, 1n];
      for (let i = 0; i < n; i++) [a, b] = [b, a + b];
      expect(BigInt(r.memo)).toBe(a);
      expect(BigInt(r.naive)).toBe(a);
      const phi = (1 + Math.sqrt(5)) / 2;
      expect(r.memo).toBe(Math.round(phi ** n / Math.sqrt(5)));
      // naive calls obey C(k) = 1 + C(k-1) + C(k-2), C(0) = C(1) = 1, which is 2F(k+1) - 1
      const calls = [1, 1];
      for (let k = 2; k <= n; k++) calls.push(1 + calls[k - 1] + calls[k - 2]);
      expect(t.tally.inRow(OP.visit, 0)).toBe(calls[n]);
      expect(BigInt(calls[n])).toBe(2n * b - 1n);
      // memoised: one miss per argument, two calls per computed argument above 1: 2n - 1
      expect(t.tally.inRow(OP.visit, 1)).toBe(2 * n - 1);
      expect(t.tally.computedByRow[1]).toBe(n + 1);
      expect(t.tally.inRow(OP.write, 0) - t.tally.computedByRow[0]).toBe(calls[n] - (n + 1));
    },
  },
  'knapsack-dp': {
    check(n, seed) {
      const { data, r } = run<KnapsackData, KnapsackResult>('knapsack-dp', n, seed);
      let best = 0;
      for (let mask = 0; mask < 1 << n; mask++) {
        let w = 0; let v = 0;
        for (let i = 0; i < n; i++) if (mask & (1 << i)) { w += data.weights[i]; v += data.values[i]; }
        if (w <= data.capacity && v > best) best = v;
      }
      expect(r.best, `n=${n} seed=${seed}`).toBe(best);
      expect(new Set(r.items).size).toBe(r.items.length);
      expect(r.items.reduce((s, i) => s + data.weights[i], 0)).toBeLessThanOrEqual(data.capacity);
      expect(r.items.reduce((s, i) => s + data.values[i], 0)).toBe(best);
    },
  },
  'longest-common-subsequence': {
    sizes: 12,
    check(n, seed) {
      const { data, r } = run<LcsData, LcsResult>('longest-common-subsequence', n, seed);
      const { a, b } = data;
      let best = 0;
      for (let mask = 0; mask < 1 << a.length; mask++) {
        let s = '';
        for (let i = 0; i < a.length; i++) if (mask & (1 << i)) s += a[i];
        if (s.length > best && isSubsequence(s, b)) best = s.length;
      }
      expect(r.length, `${a} / ${b}`).toBe(best);
      expect(r.lcs.length).toBe(best);
      expect(isSubsequence(r.lcs, a)).toBe(true);
      expect(isSubsequence(r.lcs, b)).toBe(true);
    },
  },
  'matrix-chain': {
    sizes: 9,
    check(n, seed) {
      const { data, r } = run<ChainData, ChainResult>('matrix-chain', n, seed);
      const p = data.dims;
      const brute = (i: number, j: number): number => {
        if (i === j) return 0;
        let m = Infinity;
        for (let k = i; k < j; k++) m = Math.min(m, brute(i, k) + brute(k + 1, j) + p[i] * p[k + 1] * p[j + 1]);
        return m;
      };
      expect(r.cost, `dims ${p}`).toBe(brute(0, n - 1));
      // the reported order, evaluated on its own, costs what the table says
      let pos = 0;
      const s = r.order;
      const evaluate = (): { rows: number; cols: number; cost: number } => {
        if (s[pos] === '(') {
          pos++;
          const left = evaluate();
          expect(s[pos]).toBe(' ');
          pos++;
          const right = evaluate();
          expect(s[pos]).toBe(')');
          pos++;
          expect(left.cols).toBe(right.rows);
          return { rows: left.rows, cols: right.cols, cost: left.cost + right.cost + left.rows * left.cols * right.cols };
        }
        const m = /^A(\d+)/.exec(s.slice(pos))!;
        pos += m[0].length;
        const i = Number(m[1]) - 1;
        return { rows: p[i], cols: p[i + 1], cost: 0 };
      };
      const e = evaluate();
      expect(pos).toBe(s.length);
      expect([e.rows, e.cols, e.cost]).toEqual([p[0], p[n], r.cost]);
    },
  },
  'optimal-bst': {
    sizes: 9,
    check(n, seed) {
      const { data, r } = run<BstData, BstResult>('optimal-bst', n, seed);
      const f = data.freq;
      // every tree on keys lo..hi-1: the least sum of freq x (depth + 1)
      const brute = (lo: number, hi: number, depth: number): number => {
        if (lo >= hi) return 0;
        let m = Infinity;
        for (let root = lo; root < hi; root++) {
          m = Math.min(m, f[root] * (depth + 1) + brute(lo, root, depth + 1) + brute(root + 1, hi, depth + 1));
        }
        return m;
      };
      expect(r.cost, `freq ${f}`).toBe(brute(0, n, 0));
      // the reported tree is a binary search tree on 0..n-1 and costs what the table says
      const roots = r.parent.map((q, k) => [q, k]).filter(([q]) => q === -1);
      expect(roots.length).toBe(1);
      const left = new Array<number>(n).fill(-1);
      const right = new Array<number>(n).fill(-1);
      r.parent.forEach((q, k) => {
        if (q < 0) return;
        const side = k < q ? left : right;
        expect(side[q]).toBe(-1);
        side[q] = k;
      });
      const order: number[] = [];
      let cost = 0;
      const walk = (k: number, depth: number) => {
        if (k < 0) return;
        walk(left[k], depth + 1);
        order.push(k);
        cost += f[k] * (depth + 1);
        walk(right[k], depth + 1);
      };
      walk(roots[0][1], 0);
      expect(order).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(cost).toBe(r.cost);
    },
  },
  'n-queens': {
    check(n) {
      const { t, r } = run<{ n: number }, QueensResult>('n-queens', n, 0);
      // A000170, the number of ways to place n non-attacking queens
      const KNOWN = [1, 1, 0, 0, 2, 10, 4, 40, 92, 352, 724];
      expect(r.solutions.length, `n=${n}`).toBe(KNOWN[n]);
      expect(t.tally.count(OP.solution)).toBe(KNOWN[n]);
      const keys = new Set(r.solutions.map((s) => s.join(',')));
      expect(keys.size).toBe(r.solutions.length);
      for (const s of r.solutions) {
        expect(s.length).toBe(n);
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            expect(s[i]).not.toBe(s[j]);
            expect(Math.abs(s[i] - s[j])).not.toBe(j - i);
          }
        }
      }
      // replaying the trace, the board at each solution event is that solution
      const board = new Array<number>(n).fill(-1);
      let k = 0;
      for (let e = 0; e < t.length; e++) {
        const op = t.events[4 * e]; const row = t.events[4 * e + 1]; const col = t.events[4 * e + 2];
        if (op === OP.place) board[row] = col;
        else if (op === OP.remove) board[row] = -1;
        else if (op === OP.solution) expect(board).toEqual(r.solutions[k++]);
      }
      // every queen placed is eventually taken back: the search runs to the end of the tree
      expect(t.tally.count(OP.remove)).toBe(t.tally.count(OP.place));
    },
  },
  'sieve-of-eratosthenes': {
    check(n) {
      const { t, r } = run<{ limit: number }, SieveResult>('sieve-of-eratosthenes', n, 0);
      const prime = (k: number) => {
        if (k < 2) return false;
        for (let d = 2; d * d <= k; d++) if (k % d === 0) return false;
        return true;
      };
      const want = Array.from({ length: n + 1 }, (_, k) => k).filter(prime);
      expect(r.primes).toEqual(want);
      // crossings: for each prime p with p^2 <= N, the multiples p^2, p^2 + p, ... <= N
      const crossings = want.filter((p) => p * p <= n).reduce((s, p) => s + Math.floor((n - p * p) / p) + 1, 0);
      expect(t.tally.count(OP.cross)).toBe(crossings);
      expect(t.tally.crossedCells).toBe(n - 1 - want.length);
    },
  },
};

describe('grid kernels', () => {
  it('every live grid entry has its kernel and every kernel its entry', () => {
    const files = Object.keys(modules).map((f) => f.replace(/^.*\/(.*)\.ts$/, '$1')).sort();
    expect(files).toEqual(live.map((e) => e.id).sort());
  });

  for (const e of live) {
    const kernel = kernelOf(e.id);
    const ref = REFERENCES[e.id];
    describe(e.id, () => {
      it('has an independent reference', () => expect(ref, `${e.id} needs a reference check`).toBeDefined());

      it('matches its reference on every size and seed', () => {
        for (const n of sizes(kernel, ref?.sizes)) for (const seed of SEEDS) ref?.check(n, seed);
      });

      it('replays deterministically, and its tally is the count of its events', () => {
        for (const n of sizes(kernel)) {
          const a = trace(kernel.instance(n, 5));
          const b = trace(kernel.instance(n, 5));
          expect(a.truncated).toBe(false);
          expect(b.length).toBe(a.length);
          expect(Array.from(b.events.subarray(0, 4 * b.length))).toEqual(Array.from(a.events.subarray(0, 4 * a.length)));
          const re = recount(a);
          expect(a.tally.total).toEqual(re.total);
          OP_LIST.forEach((op) => expect(Array.from(a.tally.byRow[op]), `op ${op} by row`).toEqual(re.byRow[op]));
          expect(a.tally.computed).toBe(re.written.size);
          expect(Array.from(a.tally.computedByRow)).toEqual(re.writtenByRow);
          expect(a.tally.hits).toBe(re.hits);
          expect(a.tally.crossedCells).toBe(re.crossed.size);
          for (const m of kernel.readouts) expect(Number.isFinite(m.of(a.tally)), m.name).toBe(true);
        }
      });

      it('traces a bounded number of events per step, to the same trace', () => {
        const n = kernel.size.max;
        const whole = trace(kernel.instance(n, 5));
        const t = new Tracer(kernel.instance(n, 5));
        while (!t.done) expect(t.step(1000)).toBeLessThanOrEqual(1000 + SLACK);
        const r = t.result();
        expect(r.length).toBe(whole.length);
        expect(Array.from(r.events.subarray(0, 4 * r.length))).toEqual(Array.from(whole.events.subarray(0, 4 * whole.length)));
      });

      it('never traces more than one frame budget in create, setup or one draw', () => {
        const plate = engine.plate({ id: e.id, title: e.title, group: 'g' }, counting(kernel));
        const params = { ...defaultsOf(plate), n: kernel.size.max, speed: 2000, loop: true };
        const run = drive(plate, params, 800);
        expect(run.maxPerCall, `${e.id}: events traced in one call`).toBeLessThanOrEqual(BUILD_EVENTS_PER_FRAME + SLACK);
        expect(run.stats.some((rows) => rows.some((x) => x.label === 'Result')), 'reaches its result').toBe(true);
      });

      it('measures every chart size without hitting the operation cap', () => {
        if (kernel.chart.kind !== 'scaling') return;
        for (const n of kernel.chart.ns) expect(trace(kernel.instance(n, 3)).truncated, `n=${n}`).toBe(false);
      });

      it('builds a plate with its id', () => {
        expect(engine.plate({ id: e.id, title: e.title, group: 'g' }, kernel).id).toBe(e.id);
      });
    });
  }
});

describe('grid kernels against known growth', () => {
  const has = (id: string) => live.some((e) => e.id === id);

  it.runIf(has('fibonacci-memo'))('naive calls grow by the golden ratio, memoised calls linearly', () => {
    const k = kernelOf('fibonacci-memo');
    const calls = (n: number, row: number) => trace(k.instance(n, 0)).tally.inRow(OP.visit, row);
    expect(calls(24, 0) / calls(23, 0)).toBeCloseTo((1 + Math.sqrt(5)) / 2, 3);
    expect(calls(24, 1) - calls(23, 1)).toBe(2);
  });

  it.runIf(has('matrix-chain'))('the matrix-chain table tries n(n-1)(n+1)/6 splits', () => {
    for (const n of [2, 5, 9, 16]) {
      const t = trace(kernelOf('matrix-chain').instance(n, 1));
      // each split reads two cells; the traceback reads the corner once
      expect(t.tally.count(OP.read)).toBe((2 * (n - 1) * n * (n + 1)) / 6 + 1);
    }
  });

  it.runIf(has('n-queens'))('a seed-free kernel replays its trace instead of tracing it again', () => {
    const k = kernelOf('n-queens');
    expect(seeded(k)).toBe(false);
    const plate = engine.plate({ id: 'n-queens', title: 'q', group: 'g' }, counting(k));
    expect(plate.params.find((d) => d.key === 'loop')?.label).toBe('Replay when done');
    const before = traced;
    const run = drive(plate, { ...defaultsOf(plate), speed: 2000, loop: true }, 600);
    const results = run.stats.filter((rows) => rows.some((x) => x.label === 'Result')).length;
    const restarts = run.stats.filter((rows, i) => i > 0 && rows.some((x) => x.label === 'Progress' && x.value.startsWith('0%'))
      && run.stats[i - 1].some((x) => x.label === 'Result')).length;
    expect(results).toBeGreaterThan(0);
    expect(restarts, 'it restarted').toBeGreaterThan(0);
    expect(traced - before, 'traced once').toBe(trace(k.instance(8, 0)).length);
  });

  it('a kernel whose input depends on the seed offers new input', () => {
    for (const e of live) {
      const k = kernelOf(e.id);
      const label = engine.plate({ id: e.id, title: e.title, group: 'g' }, k).params.find((d) => d.key === 'loop')?.label;
      const differs = JSON.stringify(k.instance(k.size.value, 11).data) !== JSON.stringify(k.instance(k.size.value, 12).data);
      expect(label, e.id).toBe(differs ? 'New input when done' : 'Replay when done');
    }
  });

  it.runIf(has('n-queens'))('the per-row chart numbers rows as the board labels them', () => {
    const k = kernelOf('n-queens');
    const plate = engine.plate({ id: 'n-queens', title: 'q', group: 'g' }, k);
    const run = drive(plate, { ...defaultsOf(plate), speed: 2000, loop: false }, 60);
    const chart = run.charts[run.charts.length - 1];
    const labels = k.instance(8, 0).rowLabels!;
    const placed = trace(k.instance(8, 0)).tally;
    for (const s of chart.series) {
      expect(s.points.map((q) => q[0])).toEqual(labels.map(Number));
    }
    // the top row is where the search starts: its label is 1 and it holds the first placement
    expect(chart.series.find((s) => s.name === 'Queens placed')!.points[0]).toEqual([Number(labels[0]), placed.inRow(OP.place, 0)]);
    expect(labels[0]).toBe('1');
  });

  it.runIf(has('n-queens'))('the solution frame lasts a fixed number of frames, not events', () => {
    const k = kernelOf('n-queens');
    const inst = k.instance(6, 0);
    const t = trace(inst);
    const rp = new Replay(inst, t);
    let e = 0;
    while (t.events[4 * e] !== OP.solution) e++;
    rp.advance(e + 1);
    rp.advance(200);
    expect(rp.solutionFlash).toBe(FLASH_FRAMES);
    for (let f = 0; f < FLASH_FRAMES; f++) rp.tick();
    expect(rp.solutionFlash).toBe(0);
  });

  it.runIf(has('optimal-bst'))('the optimal tree is reported as a weighted cost, its root 0-based', () => {
    for (const seed of SEEDS) {
      const { data, t, r } = run<BstData, BstResult>('optimal-bst', 7, seed);
      expect(r.parent[r.root]).toBe(-1);
      const total = data.freq.reduce((s, f) => s + f, 0);
      expect(t.outcome!.summary).toBe(`weighted cost ${r.cost}, ${(r.cost / total).toFixed(2)} comparisons per search on average, root key ${r.root}`);
    }
  });

  it('the lab never traces more than one frame budget in one call', () => {
    const dp = live.filter((e) => e.labs.includes('dynamic-programming'));
    if (dp.length < 2) return;
    const lab = engine.lab('dynamic-programming', dp.map((e) => ({ info: { id: e.id, title: e.title, group: 'g' }, kernel: counting(kernelOf(e.id)) })));
    const params = { ...defaultsOf(lab), n: (lab.params[0] as { max: number }).max, speed: 2000, loop: true };
    const run = drive(lab, params, 400);
    expect(run.maxPerCall).toBeLessThanOrEqual(BUILD_EVENTS_PER_FRAME + SLACK);
    expect(run.stats[run.stats.length - 1].every((x) => /finished #/.test(x.value) || /operations/.test(x.value))).toBe(true);
  });

  it.runIf(has('n-queens'))('eight queens: 92 solutions', () => {
    const t = trace(kernelOf('n-queens').instance(8, 0));
    expect(t.tally.count(OP.solution)).toBe(92);
  });
});
