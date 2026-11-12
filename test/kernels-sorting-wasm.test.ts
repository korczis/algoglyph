// The sorting kernels of the wasm module (crates/algoglyph-kernels/src/sorting), as the array
// engine plays them through the generic adapter (src/kernels/sorting-wasm/). Every case is
// generated from catalogue/sorting-sidecar.yaml and the catalogue: a live entry the sidecar maps
// is tested under its own id without a line of test code.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENTRIES, type Entry } from '../src/core/catalogue';
import { input, OP, SHAPES, trace, type ArrayKernel, type Trace } from '../src/engines/array/trace';
import { KERNELS, kernelMeta, runKernel, scenarioChecksum, type RunOptions } from '../src/kernels/sorting-wasm/_abi';
import { CACHE, seedOf, sidecarKernel, traceOf, type WasmArrayKernel } from '../src/kernels/sorting-wasm/_adapter';
import { hashWords, TraceCache } from '../src/kernels/sorting-wasm/_cache';
import { kernelOf, recordsOf, SIDECAR } from '../src/kernels/sorting-wasm/_sidecar';

const fixture = JSON.parse(readFileSync('crates/algoglyph-kernels/src/sorting/fixture.json', 'utf8')) as
  Record<string, string>;
const modules = import.meta.glob<ArrayKernel>('../src/kernels/array/[!_]*.ts', { import: 'kernel', eager: true });
const fileKernel = (id: string) => modules[`../src/kernels/array/${id}.ts`];
const isWasm = (k: ArrayKernel | undefined): k is WasmArrayKernel => Boolean(k && 'kernelId' in k);

const mapped = [...new Set(SIDECAR.map((r) => r.id))];
const entries = mapped.map((id) => ENTRIES.find((e) => e.id === id)).filter((e): e is Entry => Boolean(e));
/** Live entries that keep their TypeScript kernel: the Rust kernels they map to are compared. */
const overlap = entries.filter((e) => e.status === 'live' && fileKernel(e.id) && !isWasm(fileKernel(e.id)));
/** Live array entries the wasm kernels play, each with the kernel the registry would load. */
const played = await Promise.all(entries
  .filter((e) => e.status === 'live' && e.engine === 'array' && !overlap.includes(e))
  .map(async (e) => ({ e, kernel: isWasm(fileKernel(e.id)) ? fileKernel(e.id) as WasmArrayKernel
    : await sidecarKernel(e.id) })));
const SIZES = [0, 1, 2, 3, 7, 16, 61, 128];
/** The native checksum as the module returns it: the top 53 bits of the FNV-1a. */
const native = (id: string) => Number(BigInt(`0x${fixture[id]}`) >> 11n);

describe('sorting wasm module', () => {
  it('holds exactly the kernels of the native fixture, and the sidecar names only those', () => {
    expect(KERNELS.map((k) => k.id).sort()).toEqual(Object.keys(fixture).filter((k) => k !== 'schema').sort());
    for (const r of SIDECAR) expect(kernelMeta(r.kernel), `${r.id} -> ${r.kernel}`).toBeDefined();
  });

  it('reproduces the native fixture for every kernel', () => {
    const differ = KERNELS.filter((k) => scenarioChecksum(k.id) !== native(k.id)).map((k) => k.id);
    expect(differ).toEqual([]);
  });

  it('agrees with the sidecar on stability and kind', () => {
    for (const r of SIDECAR) {
      const m = kernelMeta(r.kernel)!;
      if (r.kernel_stable) expect(m.stable, r.kernel).toBe(r.kernel_stable);
      if (r.kernel_kind) expect(m.kind, r.kernel).toBe(r.kernel_kind);
    }
  });

  it('gives no algorithm a second live plate', () => {
    const owner = new Map<string, string>();
    for (const e of entries.filter((x) => x.status === 'live')) {
      const kernels = overlap.includes(e) ? recordsOf(e.id).map((r) => r.kernel) : [kernelOf(e.id)!];
      for (const k of kernels) {
        expect(owner.get(k), `${k} plays ${owner.get(k)} and ${e.id}`).toBeUndefined();
        owner.set(k, e.id);
      }
    }
  });

  it('plays every wasm entry with the kernel the sidecar maps to it', () => {
    for (const { e, kernel } of played) expect(kernel.kernelId).toBe(kernelOf(e.id));
  });

  it('reads every run out of the module after the memory grew', () => {
    // a large run grows the module's memory, which detaches every view made before it
    const big = input('random', 1 << 16, 3);
    expect(runKernel('heapsort', big, { trace: false }).output.length).toBe(big.length);
    const small = input('reversed', 33, 3);
    expect([...runKernel('heapsort', small).output]).toEqual(small.slice().sort((x, y) => x - y));
    expect([...runKernel('heapsort', input('random', 1 << 17, 4), { trace: false }).output.slice(0, 3)])
      .toEqual([1, 2, 3]);
  });
});

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

    it('replays its trace into exactly the output and the counts of the Rust run', () => {
      for (const shape of SHAPES) {
        const t = trace(kernel, input(shape, 97, 5));
        const r = kernel.last!;
        expect(t.output, shape).toEqual([...r.output]);
        expect(t.counts.compares, shape).toBe(r.counts.cmp);
        expect(t.counts.swaps, shape).toBe(r.counts.swap);
        expect(t.counts.writes - 2 * t.counts.swaps, shape).toBe(r.counts.write);
      }
    });

    it('reproduces its native fixture in wasm', () => {
      expect(scenarioChecksum(id)).toBe(native(id));
    });

    if (e.tags.includes('stable') || kernel.meta.stable === 'yes') {
      it('keeps equal keys in their input order (stable)', () => {
        expect(kernel.meta.stable).toBe('yes');
        for (const seed of [7, 8, 9]) {
          const keys = input('few-unique', 97, seed);
          const r = runKernel(id, keys, { seed: seedOf(keys), trace: false });
          for (let i = 1; i < r.output.length; i++) {
            if (r.output[i - 1] === r.output[i]) expect(r.tags[i - 1]).toBeLessThan(r.tags[i]);
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

// ---------------------------------------------------------------------------------------------
// The entries that keep their TypeScript kernel, counted against the Rust kernels the sidecar
// maps to them, on the same inputs. The Rust kernel's documented options (k: gap sequence,
// heap arity…; base: digit base) are searched for a setting that reproduces the TypeScript
// counts exactly. A pair with no such setting is a different implementation of the method;
// DIVERGES records why, and the test keeps that record true: once a pair matches, its record
// must go.

type Counts = { compares: number; swaps: number; writes: number; aux: number };
const EQUIV_N = 64;
const SETTINGS: RunOptions[] = [{}, ...[1, 2, 3, 4].map((k) => ({ k })), ...[2, 4, 16, 256].map((base) => ({ base }))];

/** The TypeScript kernel's counts; aux is the number of distinct auxiliary cells it wrote. */
function tsCounts(t: Trace): Counts {
  const cells = new Set<number>();
  for (let e = 0; e < t.length; e++) if (t.events[3 * e] === OP.auxWrite) cells.add(t.events[3 * e + 1]);
  return { compares: t.counts.compares, swaps: t.counts.swaps, writes: t.counts.writes - 2 * t.counts.swaps,
    aux: cells.size };
}

/** The Rust kernel's counts; aux is the peak number of keys its auxiliary structures held. */
function rustCounts(id: string, keys: number[], opt: RunOptions): Counts {
  const r = runKernel(id, keys, { ...opt, seed: seedOf(keys), trace: false });
  return { compares: r.counts.cmp, swaps: r.counts.swap, writes: r.counts.write, aux: r.counts.aux };
}

const DIVERGES: Record<string, string> = {
  'bubble-sort/bubble-sort': 'the Rust kernel is the plain form with no early exit; the TS kernel stops after a pass without exchanges',
  'bubble-sort/optimized-bubble-sort': 'the Rust kernel also ends each pass at the last exchange of the one before; the TS kernel only stops early',
  'quicksort/quicksort': "the Rust kernel partitions around the middle key with Hoare's scheme; the TS kernel around the rightmost key",
  'quicksort-three-way/three-way-quicksort': 'the Rust kernel picks a random pivot per partition; the TS kernel a fixed one',
  'mergesort-top-down/top-down-merge-sort': 'the Rust kernel skips a merge whose halves are already in order (Sedgewick & Wayne)',
  'mergesort-natural/natural-merge-sort': 'the Rust kernel merges pairs of runs per pass, copying only the smaller run; the TS kernel merges through a full auxiliary copy',
  'counting-sort/counting-sort': 'the same counts and writes; the Rust aux peak also holds the count table C, the TS kernel does not draw it',
  'lsd-radix-sort/radix-sort': 'the Rust kernel is the textbook form, a counting sort per decimal digit, with the count table in its aux',
  'msd-radix-sort/msd-radix-sort': 'the Rust kernel finishes sub-ranges of at most 15 keys by insertion sort (CUTOFF = 15); the TS kernel recurses to the last digit',
};

for (const e of overlap) {
  describe(e.id, () => {
    for (const r of recordsOf(e.id)) {
      const pair = `${e.id}/${r.kernel}`;
      const data = SHAPES.map((shape) => input(shape, EQUIV_N, 11));
      const ts = data.map((d) => tsCounts(trace(fileKernel(e.id)!, d)));
      const setting = SETTINGS.find((opt) => data.every((d, i) => {
        const rc = rustCounts(r.kernel, d, opt);
        return rc.compares === ts[i].compares && rc.swaps === ts[i].swaps && rc.writes === ts[i].writes
          && rc.aux === ts[i].aux;
      }));
      if (DIVERGES[pair]) {
        it(`counts unlike the Rust kernel ${r.kernel}: ${DIVERGES[pair]}`, () => {
          expect(setting, `${pair} now matches with ${JSON.stringify(setting)}: drop its DIVERGES record`)
            .toBeUndefined();
        });
      } else {
        it(`counts exactly like the Rust kernel ${r.kernel} (compares, swaps, writes, aux) on every shape`, () => {
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
  it('recalls a run from memory, keyed by kernel and input', () => {
    const keys = new Int32Array(input('random', 40, 77));
    const a = traceOf('heapsort', keys);
    expect(traceOf('heapsort', keys)).toBe(a);
    expect(traceOf('heapsort', new Int32Array(input('random', 40, 78)))).not.toBe(a);
    expect(CACHE.stats().values).toBeGreaterThan(0);
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
