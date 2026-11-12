// The sorting kernels of the wasm module (crates/algoglyph-kernels/src/sorting), as the array
// engine plays them through the generic adapter (src/kernels/sorting-wasm/). Every case is
// generated from catalogue/sorting-sidecar.yaml, the module's manifest and the catalogue: a live
// entry the sidecar maps is tested under its own id without a line of test code.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ENTRIES, type Entry } from '../src/core/catalogue';
import { exponent } from '../src/engines/array';
import { input, SHAPES, trace, type ArrayKernel, type ArrayOps, type Trace } from '../src/engines/array/trace';
import { loadSorting, SOP, STRIDE, type RunOptions, type WasmRun } from '../src/kernels/sorting-wasm/_abi';
import {
  auxCell, auxLayout, replay, seedOf, sidecarKernel, traceCache, traceKey, traceOf,
} from '../src/kernels/sorting-wasm/_adapter';
import { defaultLimits, hashWords, TraceCache } from '../src/kernels/sorting-wasm/_cache';
import { kernelOf } from '../src/kernels/sorting-wasm/_sidecar';

interface SidecarRecord { id: string; kernel: string; existing?: boolean }
interface Manifest {
  abi: number; max_n: number;
  kernels: { id: string; stable: string; in_place: boolean; kind: string }[];
}
const RECORDS = (parse(readFileSync('catalogue/sorting-sidecar.yaml', 'utf8')) as { entries: SidecarRecord[] })
  .entries;
const MANIFEST = JSON.parse(readFileSync('crates/algoglyph-kernels/src/sorting/kernels.json', 'utf8')) as Manifest;
const fixture = JSON.parse(readFileSync('crates/algoglyph-kernels/src/sorting/fixture.json', 'utf8')) as
  Record<string, string>;
const S = await loadSorting();
const tsKernels = import.meta.glob<ArrayKernel>('../src/kernels/array/[!_]*.ts', { import: 'kernel', eager: true });
const fileKernel = (id: string) => tsKernels[`../src/kernels/array/${id}.ts`];
const recordsOf = (id: string) => RECORDS.filter((r) => r.id === id);

const mapped = [...new Set(RECORDS.map((r) => r.id))];
const entries = mapped.map((id) => ENTRIES.find((e) => e.id === id)).filter((e): e is Entry => Boolean(e));
/** Live entries that keep their TypeScript kernel: the Rust kernels they map to are compared. */
const overlap = entries.filter((e) => e.status === 'live' && fileKernel(e.id));
/** Live array entries the wasm kernels play, each with the kernel the registry would load. */
const played = await Promise.all(entries
  .filter((e) => e.status === 'live' && e.engine === 'array' && !fileKernel(e.id))
  .map(async (e) => ({ e, kernel: await sidecarKernel(e.id) })));
const SIZES = [0, 1, 2, 3, 7, 16, 61, 128];
/** The native checksum as the module returns it: the top 53 bits of the FNV-1a. */
const native = (id: string) => Number(BigInt(`0x${fixture[id]}`) >> 11n);

/** Rust's auxiliary structures at the end of a run, from its recorded writes and clears. */
function finalAux(r: WasmRun): Map<number, (number | undefined)[]> {
  const out = new Map<number, (number | undefined)[]>();
  for (let e = 0; e < r.steps.length; e += STRIDE) {
    const op = r.steps[e] & 15;
    const p = r.steps[e] >>> 8;
    if (op === SOP.auxWrite) {
      const cells = out.get(p) ?? [];
      cells[r.steps[e + 1]] = r.steps[e + 2];
      out.set(p, cells);
    } else if (op === SOP.auxClear) {
      const cells = out.get(p) ?? [];
      for (let i = r.steps[e + 1]; i < r.steps[e + 2]; i++) cells[i] = undefined;
      out.set(p, cells);
    }
  }
  return out;
}

/**
 * ArrayOps with the free auxiliary operations an array engine may offer (reserveAux, clearAux):
 * the auxiliary row as drawn, and the writes made to it.
 */
function rowOps(keys: number[]) {
  const a = keys.slice();
  let row = new Array<number>(keys.length).fill(0);
  let writes = 0;
  const ops: ArrayOps & { reserveAux(c: number): void; clearAux(lo: number, hi: number): void } = {
    n: a.length,
    get: (i) => a[i],
    set: (i, v) => { a[i] = v; },
    swap: (i, j) => { [a[i], a[j]] = [a[j], a[i]]; },
    less: (x, y) => x < y,
    lessAt: (i, j) => a[i] < a[j],
    exch: (i, j) => { if (a[j] < a[i]) [a[i], a[j]] = [a[j], a[i]]; },
    aux: (k) => row[k],
    setAux: (k, v) => {
      if (!(k >= 0 && k < row.length)) throw new RangeError(`aux cell ${k} outside 0..${row.length - 1}`);
      row[k] = v; writes++;
    },
    range: () => {},
    reserveAux: (c) => { row = new Array<number>(Math.max(c, row.length)).fill(0); },
    clearAux: (lo, hi) => { for (let k = lo; k <= hi; k++) row[k] = 0; },
  };
  return { ops, row: () => row, writes: () => writes };
}

/** The lane checks of a layout on a row of `n` cells: inside the row, and shared only when it must be. */
function checkLanes(layout: Map<number, { start: number; cells: number; width: number }>, n: number, at: string) {
  const lanes = [...layout.values()].sort((x, y) => x.start - y.start);
  const shared = lanes.length > n;
  for (const [k, l] of lanes.entries()) {
    expect(l.cells, `${at}: a lane of at least one cell`).toBeGreaterThanOrEqual(1);
    expect(l.start, `${at}: inside the row`).toBeGreaterThanOrEqual(0);
    expect(l.start + l.cells, `${at}: inside the row`).toBeLessThanOrEqual(n);
    if (shared) expect(l.cells, `${at}: more structures than cells, one cell each`).toBe(1);
    else if (k) expect(l.start, `${at}: lanes do not overlap`).toBeGreaterThanOrEqual(lanes[k - 1].start + lanes[k - 1].cells);
    for (const i of [0, l.width - 1]) {
      expect(auxCell(l, i), at).toBeGreaterThanOrEqual(l.start);
      expect(auxCell(l, i), at).toBeLessThan(l.start + l.cells);
    }
  }
}

/**
 * The auxiliary-row checks of one kernel at every size and shape the harness uses: its lanes on
 * the array engine's row of n cells, the replay through the array engine itself (no cell outside
 * its row, the Rust output and aux write count), and, on a row with reserveAux and clearAux,
 * the drawn row against Rust's final auxiliary state.
 */
function checkAuxRow(id: string) {
  for (const n of SIZES) {
    for (const shape of SHAPES) {
      const at = `${shape} n=${n}`;
      const data = input(shape, n, 13 + n);
      const r = S.run(id, data, { seed: seedOf(data) });
      checkLanes(auxLayout(r, data.length), data.length, at);
      const t = trace({ run: (a: ArrayOps) => replay(a, r) }, data);
      expect(t.output, at).toEqual([...r.output]);
      if (n) expect(t.counts.auxWrites, at).toBe(r.counts.auxWrites);
      const m = rowOps(data);
      replay(m.ops, r);
      if (n) expect(m.writes(), at).toBe(r.counts.auxWrites);
      const want = new Array<number>(m.row().length).fill(0);
      const exact = auxLayout(r, Number.MAX_SAFE_INTEGER);
      for (const [p, cells] of finalAux(r)) {
        cells.forEach((k, i) => { if (k !== undefined && exact.get(p)) want[auxCell(exact.get(p)!, i)] = k; });
      }
      if (n) expect(m.row(), `${at}: the drawn row is Rust's final auxiliary state`).toEqual(want);
    }
  }
}

describe('sorting wasm module', () => {
  it('holds exactly the kernels of its manifest and of the native fixture', () => {
    const ids = S.kernels.map((k) => k.id).sort();
    expect(ids).toEqual(MANIFEST.kernels.map((k) => k.id).sort());
    expect(ids).toEqual(Object.keys(fixture).filter((k) => k !== 'schema').sort());
    for (const r of RECORDS) expect(S.meta(r.kernel), `${r.id} -> ${r.kernel}`).toBeDefined();
  });

  it('declares what its manifest says, and the limits it exports', () => {
    for (const m of MANIFEST.kernels) {
      const k = S.meta(m.id)!;
      expect({ stable: k.stable, in_place: k.inPlace, kind: k.kind }, m.id)
        .toEqual({ stable: m.stable, in_place: m.in_place, kind: m.kind });
    }
    expect(S.maxN).toBe(MANIFEST.max_n);
    expect(S.build).toMatch(new RegExp(`\\|abi${MANIFEST.abi}$`));
  });

  it('reproduces the native fixture for every kernel', () => {
    expect(S.kernels.filter((k) => S.scenario(k.id) !== native(k.id)).map((k) => k.id)).toEqual([]);
  });

  it('gives no algorithm a second live plate', () => {
    const owner = new Map<string, string>();
    for (const e of entries.filter((x) => x.status === 'live')) {
      // an entry whose own code plays stands for all its records' kernels; a played one for its one
      const own = recordsOf(e.id).every((r) => r.existing);
      const kernels = own ? recordsOf(e.id).map((r) => r.kernel) : [kernelOf(e.id)!];
      if (!own) expect(kernels[0], `${e.id}: live, played by no kernel`).toBeDefined();
      for (const k of kernels) {
        expect(owner.get(k), `${k} plays ${owner.get(k)} and ${e.id}`).toBeUndefined();
        owner.set(k, e.id);
      }
    }
  });

  it('plays every wasm entry with the one kernel the sidecar maps to it', () => {
    for (const { e, kernel } of played) {
      expect(recordsOf(e.id).map((r) => r.kernel)).toEqual([kernel.kernelId]);
    }
  });

  it('refuses an input or an arc list larger than the module exports, before writing it', () => {
    expect(() => S.run('heapsort', new Int32Array(S.maxN + 1))).toThrow(RangeError);
    expect(() => S.run('topological-sort', [1, 2], { edges: new Array(S.maxEdges + 1) }))
      .toThrow(RangeError);
    // and the module is intact after the refusals
    expect([...S.run('heapsort', [3, 1, 2]).output]).toEqual([1, 2, 3]);
  });

  it('reads every run out of the module after the memory grew', () => {
    // a large run grows the module's memory, which detaches every view made before it
    const big = input('random', 1 << 16, 3);
    expect(S.run('heapsort', big, { trace: false }).output.length).toBe(big.length);
    const small = input('reversed', 33, 3);
    expect([...S.run('heapsort', small).output]).toEqual(small.slice().sort((x, y) => x - y));
  });

  it("passes a Rust run that did not finish on as the array engine's truncation", () => {
    const data = input('random', 64, 9);
    const cut = S.run('heapsort', data, { maxSteps: 40 });
    expect(cut.truncated).toBe(true);
    expect(trace({ run: (a: ArrayOps) => replay(a, cut) }, data, 0, 200).truncated).toBe(true);
    const done = S.run('heapsort', data);
    expect(trace({ run: (a: ArrayOps) => replay(a, done) }, data).truncated).toBe(false);
  });
});

/** Identities replayed from the trace in JS: which input position each cell holds at the end. */
function identities(r: WasmRun, keys: number[]): number[] {
  const at = keys.map((_, i) => i);
  const s = r.steps;
  for (let e = 0; e < s.length; e += STRIDE) {
    const op = s[e] & 15;
    const p = s[e] >>> 8;
    if (op === SOP.swap) [at[p], at[s[e + 1]]] = [at[s[e + 1]], at[p]];
    else if (op === SOP.set) {
      const tag = s[e + 2] & 0x7fffffff;
      // a write names the element it writes: its key must be that element's input key
      expect(keys[tag], `set ${p} <- element ${tag}`).toBe(s[e + 1]);
      at[p] = tag;
    }
  }
  return at;
}

for (const { e, kernel } of played) {
  const id = kernel.kernelId;
  describe(e.id, () => {
    it('leaves every input shape and size sorted, as an independent reference does', () => {
      for (const shape of SHAPES) {
        for (const n of SIZES) {
          const data = input(shape, n, 1000 + n);
          const t = trace(kernel, data);
          expect(t.truncated, `${shape} n=${n}`).toBe(false);
          expect(kernel.last!.outcome, `${shape} n=${n}`).toBe('sorted');
          expect(t.output, `${shape} n=${n}`).toEqual(data.slice().sort((x, y) => x - y));
        }
      }
    });

    it('replays its trace into exactly the output and the counts of the Rust run, aux writes included', () => {
      for (const shape of SHAPES) {
        const t = trace(kernel, input(shape, 97, 5));
        const r = kernel.last!;
        expect(t.output, shape).toEqual([...r.output]);
        expect(t.counts.compares, shape).toBe(r.counts.cmp);
        expect(t.counts.swaps, shape).toBe(r.counts.swap);
        expect(t.counts.writes - 2 * t.counts.swaps, shape).toBe(r.counts.write);
        expect(t.counts.auxWrites, shape).toBe(r.counts.auxWrites);
      }
    });

    it('draws each auxiliary structure in its own lane, and ends on Rust\'s final auxiliary state', () => {
      checkAuxRow(id);
    });

    it('reproduces its native fixture in wasm', () => {
      expect(S.scenario(id)).toBe(native(id));
    });

    it(`is tagged in-place exactly when its kernel declares it (${kernel.meta.inPlace})`, () => {
      expect(e.tags.includes('in-place')).toBe(kernel.meta.inPlace);
      if (kernel.meta.inPlace) {
        // in place: what it holds aside stays logarithmic (a fixed cache of 512 is allowed)
        const r = S.run(id, input('random', 1024, 2), { trace: false });
        expect(r.counts.aux).toBeLessThanOrEqual(512 + 16 * Math.log2(1024));
      }
    });

    if (e.tags.includes('stable') || kernel.meta.stable === 'yes') {
      it('keeps equal keys in their input order (stable), by identities replayed from its trace', () => {
        expect(kernel.meta.stable).toBe('yes');
        for (const seed of [7, 8, 9]) {
          const keys = input('few-unique', 97, seed);
          const r = S.run(id, keys, { seed: seedOf(keys) });
          expect(r.truncated).toBe(false);
          const at = identities(r, keys);
          expect(at.map((i) => keys[i])).toEqual([...r.output]);
          for (let i = 1; i < at.length; i++) {
            if (keys[at[i - 1]] === keys[at[i]]) expect(at[i - 1], `${seed} @${i}`).toBeLessThan(at[i]);
          }
        }
      });
    }

    if (e.tags.includes('non-comparison')) {
      it('makes no key comparison', () => {
        expect(trace(kernel, input('random', 200, 3)).counts.compares).toBe(0);
      });
    }
  });
}

describe('sorting wasm auxiliary rows of every mapped array kernel, live or not', () => {
  // the live ones are checked again under their entry's id above; a planned one is checked here,
  // so it cannot hide a layout bug until the day it goes live
  const live = new Set(played.map((x) => x.kernel.kernelId));
  const pending = RECORDS.filter((r) => !r.existing && !live.has(r.kernel)
    && ENTRIES.find((e) => e.id === r.id)?.engine === 'array');
  for (const r of pending) {
    it(`${r.kernel}: lanes inside the row at every size, and Rust's final auxiliary state`, () => checkAuxRow(r.kernel));
  }

  it('lays out any number and width of structures on any row, never outside it', () => {
    // a synthetic run: aux writes only, structure p of width w
    const run = (widths: number[]): WasmRun => {
      const steps: number[] = [];
      widths.forEach((w, p) => { for (let i = 0; i < w; i++) steps.push(SOP.auxWrite | (p << 8), i, 1); });
      return { steps: new Int32Array(steps) } as unknown as WasmRun;
    };
    for (const row of [1, 2, 3, 5, 8, 97]) {
      for (const widths of [[1], [3], [1, 1, 1], [2, 1, 4], [1000, 1, 1], [5, 5, 5, 5, 5, 5, 5, 5, 5], [1, 2, 3, 4, 5, 6, 7]]) {
        const layout = auxLayout(run(widths), row);
        expect(layout.size, `${row} ${widths}`).toBe(widths.length);
        checkLanes(layout, row, `row ${row}, widths ${widths}`);
      }
    }
    expect(auxLayout(run([3, 2]), 0).size, 'a row of no cells has no lanes').toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// The entries that keep their TypeScript kernel, counted against the Rust kernels the sidecar
// maps to them, on the same inputs and like with like: compares, swaps, array writes and
// auxiliary writes, both sides counted by the array engine (the Rust trace replayed through the
// same ArrayOps). The Rust kernel's documented options (k: gap sequence, heap arity…; base:
// digit base) are searched for a setting that reproduces the TypeScript counts exactly. A pair
// with no such setting is a different implementation of the method: DIVERGES records why, and
// the test bounds how far it may be (each count within RATIO on random keys, and the same growth
// exponent within SLOPE), and keeps the record true: once a pair matches, its record must go.

type Counts = { compares: number; swaps: number; writes: number; auxWrites: number };
const EQUIV_N = 64;
const RATIO = 4;
const SLOPE = 0.3;
const SETTINGS: RunOptions[] = [{}, ...[1, 2, 3, 4].map((k) => ({ k })), ...[2, 4, 16, 256].map((base) => ({ base }))];

const fromTrace = (t: Trace): Counts => ({
  compares: t.counts.compares, swaps: t.counts.swaps, writes: t.counts.writes - 2 * t.counts.swaps,
  auxWrites: t.counts.auxWrites,
});
const tsCounts = (id: string, data: number[]) => fromTrace(trace(fileKernel(id)!, data));
function rustCounts(kernel: string, data: number[], opt: RunOptions): Counts {
  const r = S.run(kernel, data, { ...opt, seed: seedOf(data) });
  return fromTrace(trace({ run: (a: ArrayOps) => replay(a, r) }, data));
}
const work = (c: Counts) => c.compares + c.writes + 2 * c.swaps + c.auxWrites;
const SCALE = [32, 64, 128, 256];
const slope = (f: (d: number[]) => Counts) => exponent(SCALE.map((n) => [n, work(f(input('random', n, n)))]));

const DIVERGES: Record<string, string> = {
  'bubble-sort/bubble-sort': 'the Rust kernel is the plain form with no early exit; the TS kernel stops after a pass without exchanges',
  'bubble-sort/optimized-bubble-sort': 'the Rust kernel also ends each pass at the last exchange of the one before; the TS kernel only stops early',
  'quicksort/quicksort': "the Rust kernel partitions around the middle key with Hoare's scheme; the TS kernel around the rightmost key",
  'quicksort-three-way/three-way-quicksort': 'the Rust kernel picks a random pivot per partition; the TS kernel a fixed one',
  'mergesort-top-down/top-down-merge-sort': 'the Rust kernel skips a merge whose halves are already in order (Sedgewick & Wayne)',
  'mergesort-natural/natural-merge-sort': 'the Rust kernel merges pairs of runs per pass, copying only the smaller run; the TS kernel merges through a full auxiliary copy',
  'counting-sort/counting-sort': 'the same compares and writes; the Rust aux writes also count its count table C, one increment per key, which the TS kernel keeps outside its trace',
  'lsd-radix-sort/radix-sort': 'the Rust kernel is the textbook form, a counting sort per decimal digit',
  'msd-radix-sort/msd-radix-sort': 'the Rust kernel finishes sub-ranges of at most 15 keys by insertion sort (CUTOFF = 15); the TS kernel recurses to the last digit',
};

for (const e of overlap) {
  describe(e.id, () => {
    for (const r of recordsOf(e.id)) {
      const pair = `${e.id}/${r.kernel}`;
      const data = SHAPES.map((shape) => input(shape, EQUIV_N, 11));
      const ts = data.map((d) => tsCounts(e.id, d));
      const setting = SETTINGS.find((opt) => data.every((d, i) => {
        const rc = rustCounts(r.kernel, d, opt);
        return rc.compares === ts[i].compares && rc.swaps === ts[i].swaps && rc.writes === ts[i].writes
          && rc.auxWrites === ts[i].auxWrites;
      }));
      if (DIVERGES[pair]) {
        it(`counts unlike the Rust kernel ${r.kernel}, within bounds: ${DIVERGES[pair]}`, () => {
          expect(setting, `${pair} now matches with ${JSON.stringify(setting)}: drop its DIVERGES record`)
            .toBeUndefined();
          const d = input('random', EQUIV_N, 11);
          const [a, b] = [tsCounts(e.id, d), rustCounts(r.kernel, d, {})];
          for (const key of ['compares', 'swaps', 'writes', 'auxWrites'] as const) {
            if (!a[key] || !b[key]) { expect(a[key] + b[key], `${key}: zero on one side only`).toBe(0); continue; }
            expect(Math.max(a[key], b[key]) / Math.min(a[key], b[key]), `${key} ${a[key]} vs ${b[key]}`)
              .toBeLessThanOrEqual(RATIO);
          }
          const [sa, sb] = [slope((x) => tsCounts(e.id, x)), slope((x) => rustCounts(r.kernel, x, {}))];
          expect(Math.abs(sa - sb), `growth n^${sa.toFixed(2)} vs n^${sb.toFixed(2)}`).toBeLessThanOrEqual(SLOPE);
        });
      } else {
        it(`counts exactly like the Rust kernel ${r.kernel} (compares, swaps, writes, aux writes) on every shape`, () => {
          const rows = data.map((d, i) => ({ shape: SHAPES[i], ts: ts[i], rust: rustCounts(r.kernel, d, setting ?? {}) }));
          expect(setting, JSON.stringify(rows)).toBeDefined();
        });
      }
    }
  });
}

it('keeps no divergence record for a pair the sidecar no longer maps', () => {
  const pairs = new Set(overlap.flatMap((e) => recordsOf(e.id).map((r) => `${e.id}/${r.kernel}`)));
  expect(Object.keys(DIVERGES).filter((p) => !pairs.has(p))).toEqual([]);
});

describe('sorting trace cache', () => {
  it('recalls a run from memory, keyed by kernel, input and every option', () => {
    const keys = new Int32Array(input('random', 40, 77));
    const a = traceOf(S, 'heapsort', keys);
    expect(traceOf(S, 'heapsort', keys)).toBe(a);
    expect(traceOf(S, 'heapsort', new Int32Array(input('random', 40, 78)))).not.toBe(a);
    expect(traceCache(S).stats().values).toBeGreaterThan(0);
    expect(traceCache(S).build).toBe(S.build);
    const base = traceKey('k', [1, 2], { seed: 1, maxSteps: 9 });
    for (const opt of [{ trace: false }, { edges: [[0, 1]] as [number, number][] }, { base: 2 }, { k: 3 }]) {
      expect(traceKey('k', [1, 2], { seed: 1, maxSteps: 9, ...opt }), JSON.stringify(opt)).not.toBe(base);
    }
    expect(hashWords([1, 2, 3])).not.toBe(hashWords([1, 2, 4]));
    expect(hashWords([1, 2, 3])).not.toBe(hashWords([1, 2, 3, 0]));
  });

  it('evicts the least recently used past its byte bound', () => {
    const c = new TraceCache<string>('test', (v) => v.length,
      { memoryBytes: 10, persistBytes: 0, persistTotal: 0, prefetchBytes: 0 });
    c.put('a', 'xxxx');
    c.put('b', 'yyyy');
    c.get('a');
    c.put('c', 'zzzz');
    expect([c.get('a'), c.get('b'), c.get('c')]).toEqual(['xxxx', undefined, 'zzzz']);
    expect(c.stats().bytes).toBeLessThanOrEqual(10);
  });

  it('bounds its tiers, the memory tier tighter on a narrow screen', () => {
    const g = globalThis as Record<string, unknown>;
    const wide = defaultLimits();
    g.matchMedia = () => ({ matches: true });
    try {
      expect(defaultLimits().memoryBytes).toBeLessThan(wide.memoryBytes);
    } finally {
      delete g.matchMedia;
    }
    expect(wide.persistTotal).toBeLessThanOrEqual(32 << 20);
  });

  it('works the same with storage blocked', async () => {
    const g = globalThis as Record<string, unknown>;
    const saved = Object.getOwnPropertyDescriptors(g);
    const blocked = { get() { throw new Error('SecurityError'); }, configurable: true };
    Object.defineProperty(g, 'indexedDB', blocked);
    Object.defineProperty(g, 'localStorage', blocked);
    try {
      const c = new TraceCache<string>('blocked', (v) => v.length);
      c.put('k', 'value');
      expect(c.get('k')).toBe('value');
      expect(await c.prefetch('k')).toBe(0);
    } finally {
      for (const k of ['indexedDB', 'localStorage']) {
        if (saved[k]) Object.defineProperty(g, k, saved[k]);
        else delete g[k];
      }
    }
  });
});
