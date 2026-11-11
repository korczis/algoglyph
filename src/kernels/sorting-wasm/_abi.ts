// The sorting kernels' C ABI as the browser calls it (crates/algoglyph-kernels/src/sorting/abi.rs):
// keys go into a buffer the module owns, a kernel runs by index, and the result comes back as
// typed arrays read through views onto the module's memory. No JSON, no binding generator.
// This module is imported only by the sorting adapter, so the wasm loads with the first
// sorting plate and with nothing else.
import init from '../../wasm/algoglyph_kernels.wasm?init';

interface Exports {
  memory: WebAssembly.Memory;
  ag_sort_count(): number;
  ag_sort_id(k: number): number;
  ag_sort_id_len(k: number): number;
  ag_sort_meta(k: number): number;
  ag_sort_version(): number;
  ag_sort_fingerprint(): number;
  ag_sort_input(n: number): number;
  ag_sort_edges(m: number): number;
  ag_sort_run(k: number, n: number, m: number, seedHi: number, seedLo: number, base: number,
    kp: number, maxSteps: number, trace: number): number;
  ag_sort_result(): number;
  ag_sort_steps(): number;
  ag_sort_pool(): number;
  ag_sort_output(): number;
  ag_sort_output_tags(): number;
  ag_sort_strings(): number;
  ag_sort_string_ends(): number;
  ag_sort_note(): number;
  ag_sort_release(): void;
  ag_sort_scenario(k: number): number;
}

/** Step op codes: the low four bits of a step's first word (prelude.rs `op`). */
export const SOP = {
  cmp: 0, cmpv: 1, swap: 2, set: 3, read: 4, mark: 5, aux: 6, phase: 7, lane: 8, round: 9,
} as const;
/** Words per step. */
export const STRIDE = 3;

export const STABILITY = ['yes', 'no', 'variant'] as const;
export const KINDS = ['comparison', 'distribution', 'network', 'external', 'special', 'joke'] as const;
export const OUTCOMES = ['sorted', 'truncated', 'not-a-sort', 'unsupported'] as const;

export interface KernelMeta {
  index: number;
  id: string;
  stable: (typeof STABILITY)[number];
  inPlace: boolean;
  kind: (typeof KINDS)[number];
}

export interface RunCounts {
  cmp: number; swap: number; write: number; read: number;
  /** Peak number of keys held in auxiliary structures at once. */
  aux: number;
  rounds: number;
}

/** One run, copied out of the module: it survives the next call. */
export interface WasmRun {
  kernel: string;
  counts: RunCounts;
  outcome: (typeof OUTCOMES)[number];
  note: string;
  truncated: boolean;
  /** Steps counted, recorded or not. */
  counted: number;
  /** steps * STRIDE words; see SOP. */
  steps: Int32Array;
  pool: Int32Array;
  output: Int32Array;
  tags: Uint32Array;
  strings: string[];
}

export interface RunOptions {
  seed?: number;
  base?: number;
  k?: number;
  edges?: [number, number][];
  maxSteps?: number;
  trace?: boolean;
}

const x = (await init({})).exports as unknown as Exports;
const utf8 = new TextDecoder();
const text = (ptr: number, len: number) => utf8.decode(new Uint8Array(x.memory.buffer, ptr, len));

/** Every kernel the module holds, by registry index. */
export const KERNELS: KernelMeta[] = Array.from({ length: x.ag_sort_count() }, (_, index) => {
  const m = x.ag_sort_meta(index);
  return {
    index,
    id: text(x.ag_sort_id(index), x.ag_sort_id_len(index)),
    stable: STABILITY[m & 3],
    inPlace: Boolean(m & 4),
    kind: KINDS[m >>> 3],
  };
});
const BY_ID = new Map(KERNELS.map((k) => [k.id, k]));

export function kernelMeta(id: string): KernelMeta | undefined {
  return BY_ID.get(id);
}

const v = x.ag_sort_version();
/** The crate version and the sources' fingerprint: what a cached trace is keyed by. */
export const BUILD = `${v >>> 16}.${(v >>> 8) & 255}.${v & 255}+${x.ag_sort_fingerprint().toString(16)}`;

/** Run kernel `id` on `keys` (integers in the i32 range; tags are the positions). */
export function runKernel(id: string, keys: ArrayLike<number>, opt: RunOptions = {}): WasmRun {
  const meta = BY_ID.get(id);
  if (!meta) throw new Error(`sorting-wasm: no kernel ${id}`);
  const n = keys.length;
  // every call may grow (and so detach) the memory: a view is made after the call it follows
  const ip = x.ag_sort_input(n);
  new Int32Array(x.memory.buffer, ip, n).set(keys);
  const edges = opt.edges ?? [];
  const ep = x.ag_sort_edges(edges.length);
  const ev = new Uint32Array(x.memory.buffer, ep, 2 * edges.length);
  edges.forEach(([a, b], i) => { ev[2 * i] = a; ev[2 * i + 1] = b; });
  const seed = opt.seed ?? 0x5eed1234;
  const code = x.ag_sort_run(meta.index, n, edges.length, Math.floor(seed / 2 ** 32) >>> 0, seed >>> 0,
    opt.base ?? 0, opt.k ?? 0, opt.maxSteps ?? 0, opt.trace === false ? 0 : 1);
  if (code < 0) throw new Error(`sorting-wasm: ${id} refused the call`);
  const buf = x.memory.buffer;
  const r = new Float64Array(buf, x.ag_sort_result(), 14);
  const [cmp, swap, write, read, aux, rounds, recorded, truncated, outcome, outLen, poolLen,
    nStrings, noteLen, counted] = r;
  const ends = new Uint32Array(buf, x.ag_sort_string_ends(), nStrings);
  const sp = x.ag_sort_strings();
  const strings: string[] = [];
  for (let s = 0, at = 0; s < nStrings; at = ends[s++]) strings.push(text(sp + at, ends[s] - at));
  const run: WasmRun = {
    kernel: id,
    counts: { cmp, swap, write, read, aux, rounds },
    outcome: OUTCOMES[outcome],
    note: text(x.ag_sort_note(), noteLen),
    truncated: truncated === 1,
    counted,
    steps: new Int32Array(buf, x.ag_sort_steps(), recorded * STRIDE).slice(),
    pool: new Int32Array(buf, x.ag_sort_pool(), poolLen).slice(),
    output: new Int32Array(buf, x.ag_sort_output(), outLen).slice(),
    tags: new Uint32Array(buf, x.ag_sort_output_tags(), outLen).slice(),
    strings,
  };
  x.ag_sort_release();
  return run;
}

/** The native fixture's scenario run inside the module (top 53 bits of its FNV-1a). */
export function scenarioChecksum(id: string): number {
  const meta = BY_ID.get(id);
  if (!meta) throw new Error(`sorting-wasm: no kernel ${id}`);
  return x.ag_sort_scenario(meta.index);
}
