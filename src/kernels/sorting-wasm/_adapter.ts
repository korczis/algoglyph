// The generic adapter: any sorting kernel of the wasm module, played as an array-engine kernel.
// The kernel runs in Rust and hands back its trace as typed words (op code plus operands); the
// adapter replays those words through ArrayOps, so the array engine counts, records and draws
// them exactly as it does a TypeScript kernel, and every plate, lab, chart and growth fit
// works unchanged. Which kernel plays which entry is the sidecar's data, never a table here.
//
// How the Rust trace maps onto ArrayOps:
//   cmp i j      -> lessAt(i, j)        cmpv a b   -> less(a, b)
//   swap i j     -> swap(i, j)          set i key  -> set(i, key)
//   read i       -> get(i)              mark [f,t) -> range(f, t - 1)
//   aux snapshot -> setAux on every cell of the auxiliary row whose key changed (the live
//                   structures laid out side by side in order of appearance, clipped at n)
//   phase, lane, round: no ArrayOps counterpart; they stay in the Rust trace.
// Copying the array into the module costs n reads, recorded first: that is the adapter's
// own work, and the array engine shows it as a first pass.
import { EVENT_CAP, type ArrayKernel, type ArrayOps } from '../../engines/array/trace';
import { BUILD, kernelMeta, runKernel, SOP, STRIDE, type KernelMeta, type WasmRun } from './_abi';
import { hashWords, TraceCache } from './_cache';
import { kernelOf } from './_sidecar';

const sizeOf = (r: WasmRun) => r.steps.byteLength + r.pool.byteLength + r.output.byteLength
  + r.tags.byteLength + r.strings.reduce((s, x) => s + 2 * x.length, 0) + 256;

/** Every trace this page computed, and the ones earlier visits stored. */
export const CACHE = new TraceCache<WasmRun>(BUILD, sizeOf);

/** The Rust seed of an input: derived from the keys, so a run is a function of its input. */
export function seedOf(keys: ArrayLike<number>): number {
  let h = 0x9e3779b9;
  for (let i = 0; i < keys.length; i++) h = Math.imul(h ^ (keys[i] | 0), 0x85ebca6b) ^ (h >>> 15);
  return h >>> 0;
}

/** Run (or recall) kernel `id` on `keys` with the array engine's event cap as its step limit. */
export function traceOf(id: string, keys: Int32Array): WasmRun {
  const key = `${id}|${hashWords(keys)}`;
  let r = CACHE.get(key);
  if (!r) {
    r = runKernel(id, keys, { seed: seedOf(keys), maxSteps: EVENT_CAP });
    CACHE.put(key, r);
  }
  return r;
}

/** The auxiliary row the array engine draws: the live structures side by side. */
class AuxRow {
  private row: Int32Array;
  private order: number[] = [];
  private span = new Map<number, [number, number]>();
  private total = 0;
  constructor(private readonly a: ArrayOps) { this.row = new Int32Array(a.n); }

  snapshot(name: number, pool: Int32Array, off: number, len: number): void {
    let at = this.order.indexOf(name);
    if (at < 0) {
      if (!len) return;
      at = this.order.push(name) - 1;
    }
    let start = 0;
    for (let i = 0; i < at; i++) start += this.span.get(this.order[i])![1];
    if (len) this.span.set(name, [off, len]);
    else { this.span.delete(name); this.order.splice(at, 1); }
    const n = this.row.length;
    let k = start;
    let total = start;
    for (let i = at; i < this.order.length; i++) {
      const [o, l] = this.span.get(this.order[i])!;
      total += l;
      for (let j = 0; j < l && k < n; j++, k++) this.write(k, pool[o + j]);
    }
    for (const end = Math.min(this.total, n); k < end; k++) this.write(k, 0);
    this.total = total;
  }

  private write(k: number, v: number): void {
    if (this.row[k] !== v) {
      this.row[k] = v;
      this.a.setAux(k, v);
    }
  }
}

/** Replay a Rust trace through ArrayOps (see the table at the top of this file). */
export function replay(a: ArrayOps, r: WasmRun): void {
  const s = r.steps;
  const aux = new AuxRow(a);
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
      case SOP.aux: aux.snapshot(p, r.pool, s[e + 1], s[e + 2]); break;
      default: break;
    }
  }
}

export interface WasmArrayKernel extends ArrayKernel {
  /** The atlas kernel id. */
  readonly kernelId: string;
  readonly meta: KernelMeta;
  /** The last run's Rust result (outcome, note, the Rust counts), for readouts and tests. */
  last?: WasmRun;
}

/** Kernel `id` of the wasm module as an array-engine kernel. */
export function wasmKernel(id: string): WasmArrayKernel {
  const meta = kernelMeta(id);
  if (!meta) throw new Error(`sorting-wasm: the module has no kernel ${id}`);
  const k: WasmArrayKernel = {
    goal: 'sort',
    kernelId: id,
    meta,
    run(a: ArrayOps) {
      const keys = new Int32Array(a.n);
      for (let i = 0; i < a.n; i++) keys[i] = a.get(i);
      k.last = traceOf(id, keys);
      replay(a, k.last);
    },
  };
  return k;
}

/**
 * The kernel of catalogue entry `entryId`, as the sidecar maps it, with the traces earlier
 * visits stored read back first. The file src/kernels/array/<entryId>.ts exports this.
 */
export async function sidecarKernel(entryId: string): Promise<WasmArrayKernel> {
  const id = kernelOf(entryId);
  if (!id) throw new Error(`sorting-wasm: catalogue/sorting-sidecar.yaml maps no kernel to ${entryId}`);
  const k = wasmKernel(id);
  await CACHE.prefetch(`${id}|`);
  return k;
}
