// The sorting kernels' C ABI as the browser calls it (crates/algoglyph-kernels/src/sorting/abi.rs):
// keys go into a buffer the module owns, a kernel runs by index, and the result comes back as
// typed arrays read through views onto the module's memory. No JSON, no binding generator.
// The module is instantiated on the first loadSorting(), which only the sorting adapter calls,
// so the wasm loads with the first sorting plate and with nothing else; a failed load is not
// remembered, so the next plate tries again.
import init from '../../wasm/algoglyph_kernels.wasm?init';

interface Exports {
  memory: WebAssembly.Memory;
  ag_sort_abi(): number;
  ag_sort_max_n(): number;
  ag_sort_max_edges(): number;
  ag_sort_count(): number;
  ag_sort_id(k: number): number;
  ag_sort_id_len(k: number): number;
  ag_sort_meta(k: number): number;
  ag_sort_version(): number;
  ag_sort_fingerprint(): number;
  ag_sort_input(n: number): number;
  ag_sort_edges(m: number): number;
  ag_sort_option_count(): number;
  ag_sort_option_name(i: number): number;
  ag_sort_option_name_len(i: number): number;
  ag_sort_reads(k: number): number;
  ag_sort_options(): number;
  ag_sort_run(k: number, n: number, m: number, seedHi: number, seedLo: number, maxSteps: number,
    trace: number): number;
  ag_sort_result(): number;
  ag_sort_steps(): number;
  ag_sort_output(): number;
  ag_sort_output_tags(): number;
  ag_sort_strings(): number;
  ag_sort_string_ends(): number;
  ag_sort_note(): number;
  ag_sort_release(): void;
  ag_sort_scenario(k: number): number;
}

/** The ABI layout this file reads (abi.rs ABI_VERSION); a module of another layout is refused. */
export const ABI = 4;
/** Step op codes: the low four bits of a step's first word (prelude.rs `op`). */
export const SOP = {
  cmp: 0, cmpv: 1, swap: 2, set: 3, read: 4, mark: 5, auxWrite: 6, phase: 7, lane: 8, round: 9,
  auxClear: 10,
} as const;
/** Words per step. */
export const STRIDE = 3;
const RESULT_LEN = 14;

export const STABILITY = ['yes', 'no', 'variant'] as const;
export const KINDS = ['comparison', 'distribution', 'network', 'external', 'special', 'joke'] as const;
export const OUTCOMES = ['sorted', 'truncated', 'not-a-sort', 'unsupported'] as const;

export interface KernelMeta {
  index: number;
  id: string;
  stable: (typeof STABILITY)[number];
  inPlace: boolean;
  kind: (typeof KINDS)[number];
  /** The tunable options the kernel's source reads (the module's ag_sort_reads). */
  options: string[];
}

export interface RunCounts {
  cmp: number; swap: number; write: number; read: number;
  /** Peak number of keys held in auxiliary structures at once. */
  aux: number;
  /** Keys stored into auxiliary cells: one recorded step each. */
  auxWrites: number;
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
  output: Int32Array;
  tags: Uint32Array;
  strings: string[];
}

export interface RunOptions {
  seed?: number;
  /**
   * Tunable options by the module's names (ag_sort_option_name), whole numbers; an option left
   * out, or 0, is the kernel's own default. A name the kernel does not read is refused.
   */
  options?: Readonly<Record<string, number>>;
  edges?: [number, number][];
  maxSteps?: number;
  trace?: boolean;
}

/** The loaded module: its kernels and the calls that run them. */
export interface Sorting {
  kernels: KernelMeta[];
  meta(id: string): KernelMeta | undefined;
  run(id: string, keys: ArrayLike<number>, opt?: RunOptions): WasmRun;
  scenario(id: string): number;
  /** The largest input and arc list the module accepts (exported by it, never restated). */
  maxN: number;
  maxEdges: number;
  /** The tunable options the module takes, in the order of its option words. */
  options: string[];
  /** What a cached trace is keyed by: the module's content hash and the ABI layout. */
  build: string;
}

// The content hash scripts/wasm.sh writes next to the module; the crate version and the
// sources' fingerprint stand in for it in a tree built before the hash existed.
const HASH = import.meta.glob<string>('../../wasm/algoglyph_kernels.wasm.sha256',
  { query: '?raw', import: 'default', eager: true });

async function instantiate(): Promise<Sorting> {
  const x = (await init({})).exports as unknown as Exports;
  const abi = typeof x.ag_sort_abi === 'function' ? x.ag_sort_abi() : 0;
  if (abi !== ABI) throw new Error(`sorting-wasm: the module speaks ABI ${abi}, this adapter ${ABI}`);
  const utf8 = new TextDecoder();
  const text = (ptr: number, len: number) => utf8.decode(new Uint8Array(x.memory.buffer, ptr, len));
  const options = Array.from({ length: x.ag_sort_option_count() },
    (_, i) => text(x.ag_sort_option_name(i), x.ag_sort_option_name_len(i)));
  const kernels: KernelMeta[] = Array.from({ length: x.ag_sort_count() }, (_, index) => {
    const m = x.ag_sort_meta(index);
    const reads = x.ag_sort_reads(index);
    return {
      index,
      id: text(x.ag_sort_id(index), x.ag_sort_id_len(index)),
      stable: STABILITY[m & 3],
      inPlace: Boolean(m & 4),
      kind: KINDS[m >>> 3],
      options: options.filter((_, i) => reads & (1 << i)),
    };
  });
  const byId = new Map(kernels.map((k) => [k.id, k]));
  const maxN = x.ag_sort_max_n();
  const maxEdges = x.ag_sort_max_edges();
  const v = x.ag_sort_version();
  const hash = Object.values(HASH)[0]?.trim().split(/\s/)[0]
    || `${v >>> 16}.${(v >>> 8) & 255}.${v & 255}+${x.ag_sort_fingerprint().toString(16)}`;

  function find(id: string): KernelMeta {
    const meta = byId.get(id);
    if (!meta) throw new Error(`sorting-wasm: the module has no kernel ${id}`);
    return meta;
  }

  function run(id: string, keys: ArrayLike<number>, opt: RunOptions = {}): WasmRun {
    const meta = find(id);
    const n = keys.length;
    const edges = opt.edges ?? [];
    // refused before anything is written: the module's buffers hold at most what it exports
    if (n > maxN) throw new RangeError(`sorting-wasm: ${n} keys, the module takes at most ${maxN}`);
    if (edges.length > maxEdges) {
      throw new RangeError(`sorting-wasm: ${edges.length} arcs, the module takes at most ${maxEdges}`);
    }
    // every call may grow (and so detach) the memory: a view is made after the call it follows
    const ip = x.ag_sort_input(n);
    if (!ip) throw new RangeError(`sorting-wasm: the module refused room for ${n} keys`);
    new Int32Array(x.memory.buffer, ip, n).set(keys);
    const ep = x.ag_sort_edges(edges.length);
    if (!ep) throw new RangeError(`sorting-wasm: the module refused room for ${edges.length} arcs`);
    const ev = new Uint32Array(x.memory.buffer, ep, 2 * edges.length);
    edges.forEach(([a, b], i) => { ev[2 * i] = a; ev[2 * i + 1] = b; });
    const words = new Uint32Array(options.length);
    for (const [name, value] of Object.entries(opt.options ?? {})) {
      const i = options.indexOf(name);
      if (i < 0 || !meta.options.includes(name)) {
        throw new RangeError(`sorting-wasm: ${id} does not read an option ${name} (it reads ${meta.options.join(', ') || 'none'})`);
      }
      if (!(Number.isInteger(value) && value >= 0 && value <= 0xffffffff)) {
        throw new RangeError(`sorting-wasm: option ${name} = ${value} is not a whole u32`);
      }
      words[i] = value;
    }
    new Uint32Array(x.memory.buffer, x.ag_sort_options(), options.length).set(words);
    const seed = opt.seed ?? 0x5eed1234;
    const code = x.ag_sort_run(meta.index, n, edges.length, Math.floor(seed / 2 ** 32) >>> 0, seed >>> 0,
      opt.maxSteps ?? 0, opt.trace === false ? 0 : 1);
    if (code < 0) throw new Error(`sorting-wasm: ${id} refused the call`);
    const buf = x.memory.buffer;
    const r = new Float64Array(buf, x.ag_sort_result(), RESULT_LEN);
    const [cmp, swap, write, read, aux, rounds, recorded, truncated, outcome, outLen, auxWrites,
      nStrings, noteLen, counted] = r;
    const ends = new Uint32Array(buf, x.ag_sort_string_ends(), nStrings);
    const sp = x.ag_sort_strings();
    const strings: string[] = [];
    for (let s = 0, at = 0; s < nStrings; at = ends[s++]) strings.push(text(sp + at, ends[s] - at));
    const out: WasmRun = {
      kernel: id,
      counts: { cmp, swap, write, read, aux, auxWrites, rounds },
      outcome: OUTCOMES[outcome],
      note: text(x.ag_sort_note(), noteLen),
      truncated: truncated === 1,
      counted,
      steps: new Int32Array(buf, x.ag_sort_steps(), recorded * STRIDE).slice(),
      output: new Int32Array(buf, x.ag_sort_output(), outLen).slice(),
      tags: new Uint32Array(buf, x.ag_sort_output_tags(), outLen).slice(),
      strings,
    };
    x.ag_sort_release();
    return out;
  }

  return {
    kernels,
    meta: (id) => byId.get(id),
    run,
    scenario: (id) => x.ag_sort_scenario(find(id).index),
    maxN,
    maxEdges,
    options,
    build: `${hash}|abi${abi}`,
  };
}

let pending: Promise<Sorting> | undefined;

/** The sorting module, instantiated once; a failed load is forgotten so that a retry can work. */
export function loadSorting(): Promise<Sorting> {
  pending ??= instantiate().catch((e: unknown) => {
    pending = undefined;
    throw e;
  });
  return pending;
}
