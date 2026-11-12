// The generic adapter: any sorting kernel of the wasm module, played as an array-engine kernel.
// The kernel runs in Rust and hands back its trace as typed words (op code plus operands); the
// adapter replays those words through ArrayOps, so the array engine counts, records and draws
// them exactly as it does a TypeScript kernel, and every plate, lab, chart and growth fit
// works unchanged. Which kernel plays which entry is the catalogue's data, never a table here.
//
// How the Rust trace maps onto ArrayOps, one call per recorded step:
//   cmp i j        -> lessAt(i, j)        cmpv a b   -> less(a, b)
//   swap i j       -> swap(i, j)          set i key  -> set(i, key)
//   read i         -> get(i)              mark [f,t) -> range(f, t - 1)
//   aux write s i k -> setAux(cell, k): structure s, cell i, laid out on the auxiliary row in
//                     order of first appearance (wrapping at n). The array engine's auxiliary
//                     writes are therefore exactly the writes the Rust tracer counted.
//   phase, lane, round: no ArrayOps counterpart; they stay in the Rust trace.
// Copying the array into the module costs n reads, recorded first: that is the adapter's own
// work, and the array engine shows it as a first pass.
//
// A run that did not finish (truncated at the step limit, or not a sort) is passed on as the
// array engine's own truncation, so it never becomes a point of a growth fit.
import { EVENT_CAP, type ArrayKernel, type ArrayOps } from '../../engines/array/trace';
import { loadSorting, SOP, STRIDE, type KernelMeta, type RunOptions, type Sorting, type WasmRun } from './_abi';
import { hashWords, TraceCache } from './_cache';
import { kernelOf } from './_sidecar';

const sizeOf = (r: WasmRun) => r.steps.byteLength + r.output.byteLength + r.tags.byteLength
  + r.strings.reduce((s, x) => s + 2 * x.length, 0) + 256;

let cache: TraceCache<WasmRun> | undefined;
/** The trace cache of the loaded module's build. */
export function traceCache(s: Sorting): TraceCache<WasmRun> {
  if (cache?.build !== s.build) cache = new TraceCache<WasmRun>(s.build, sizeOf);
  return cache;
}

/** The Rust seed of an input: derived from the keys, so a run is a function of its input. */
export function seedOf(keys: ArrayLike<number>): number {
  let h = 0x9e3779b9;
  for (let i = 0; i < keys.length; i++) h = Math.imul(h ^ (keys[i] | 0), 0x85ebca6b) ^ (h >>> 15);
  return h >>> 0;
}

/** Everything a trace depends on, as its cache key (the cache itself is per module build). */
export function traceKey(id: string, keys: ArrayLike<number>, opt: RunOptions): string {
  return `${id}|cap${opt.maxSteps ?? 0}|seed${opt.seed ?? ''}|b${opt.base ?? 0}|k${opt.k ?? 0}|${hashWords(keys)}`;
}

/** Run (or recall) kernel `id` on `keys` with the array engine's event cap as its step limit. */
export function traceOf(s: Sorting, id: string, keys: Int32Array): WasmRun {
  const opt: RunOptions = { seed: seedOf(keys), maxSteps: EVENT_CAP };
  const key = traceKey(id, keys, opt);
  const c = traceCache(s);
  let r = c.get(key);
  if (!r) {
    r = s.run(id, keys, opt);
    c.put(key, r);
  }
  return r;
}

/** Replay a Rust trace through ArrayOps (see the table at the top of this file). */
export function replay(a: ArrayOps, r: WasmRun): void {
  const s = r.steps;
  const n = a.n;
  // each structure's first cell on the auxiliary row, and the cells it has used
  const start = new Map<number, number>();
  const width = new Map<number, number>();
  let used = 0;
  for (let e = 0; e < s.length; e += STRIDE) {
    const w0 = s[e];
    const p = w0 >>> 8;
    switch (w0 & 15) {
      case SOP.cmp: a.lessAt(p, s[e + 1]); break;
      case SOP.cmpv: a.less(s[e + 1], s[e + 2]); break;
      case SOP.swap: a.swap(p, s[e + 1]); break;
      case SOP.set: a.set(p, s[e + 1]); break;
      case SOP.read: a.get(p); break;
      case SOP.mark: if (s[e + 1] > p) a.range(p, s[e + 1] - 1); break;
      case SOP.auxWrite: {
        let at = start.get(p);
        if (at === undefined) { at = used; start.set(p, at); width.set(p, 0); }
        const i = s[e + 1];
        if (i + 1 > width.get(p)!) {
          used += i + 1 - width.get(p)!;
          width.set(p, i + 1);
        }
        a.setAux((at + i) % n, s[e + 2]);
        break;
      }
      default: break;
    }
  }
  if (r.truncated || r.outcome !== 'sorted') {
    // the array engine marks a trace truncated when it reaches its event cap: reach it. The
    // Rust run stopped at that same cap, so only its steps without an ArrayOps call remain.
    for (let pad = 0; pad <= EVENT_CAP; pad++) a.range(0, 0);
  }
}

export interface WasmArrayKernel extends ArrayKernel {
  /** The atlas kernel id. */
  readonly kernelId: string;
  readonly meta: KernelMeta;
  /** The last run's Rust result (outcome, note, the Rust counts), for readouts and tests. */
  last?: WasmRun;
}

/** Kernel `id` of a loaded module as an array-engine kernel. */
export function wasmKernel(s: Sorting, id: string): WasmArrayKernel {
  const meta = s.meta(id);
  if (!meta) throw new Error(`sorting-wasm: the module has no kernel ${id}`);
  const k: WasmArrayKernel = {
    goal: 'sort',
    kernelId: id,
    meta,
    run(a: ArrayOps) {
      const keys = new Int32Array(a.n);
      for (let i = 0; i < a.n; i++) keys[i] = a.get(i);
      k.last = traceOf(s, id, keys);
      replay(a, k.last);
    },
  };
  return k;
}

/**
 * The kernel of catalogue entry `entryId`, as the catalogue's sidecar mapping names it, with the
 * traces earlier visits stored read back first. The registry's sidecar fallback calls this.
 */
export async function sidecarKernel(entryId: string): Promise<WasmArrayKernel> {
  const id = kernelOf(entryId);
  if (!id) throw new Error(`sorting-wasm: no sidecar maps a kernel to ${entryId}`);
  const s = await loadSorting();
  const k = wasmKernel(s, id);
  await traceCache(s).prefetch(`${id}|`);
  return k;
}
