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
//   aux write s i k -> setAux(cell, k): structure s, cell i, at its cell of the auxiliary row
//                     (auxLayout). The array engine's auxiliary writes are therefore exactly
//                     the writes the Rust tracer counted.
//   aux clear s [f,t) -> clearAux(cell, cell) for each emptied cell: free and uncounted, since
//                     an emptied cell is not a write.
//   phase text     -> phase(text)         lane l     -> lane(l)
//   round r        -> round()             (the array engine numbers it r too: one call per word)
// The array engine's rounds, phases and lanes are therefore exactly the kernel's own; a round is
// named by the kind the kernel declares (an external sort's are passes over the data, every
// other kind's rounds, which a network may spend on a comparator layer or on a whole kernel
// launch), never by which kernel it is.
// Copying the array into the module costs n reads, recorded first: that is the adapter's own
// work, and the array engine shows it as a first pass.
//
// The auxiliary row: each structure gets its own lane, side by side in order of first
// appearance, never wrapping, on a row as wide as the structures need (reserveAux), so every
// cell is drawn exactly. Only past the array engine's widest row (AUX_CAP) is a lane folded
// into its share of the row by scale (auxLayout).
//
// A run truncated at the step limit is passed on as the array engine's own truncation (its
// event cap reached), so it never becomes a point of a growth fit.
import { AUX_CAP, EVENT_CAP, type ArrayKernel, type ArrayOps } from '../../engines/array/trace';
import { loadSorting, SOP, STRIDE, type KernelMeta, type RunOptions, type Sorting, type WasmRun } from './_abi';
import { hashWords, TraceCache } from './_cache';
import { kernelOf, maxNOf } from './_sidecar';

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
  const edges = hashWords((opt.edges ?? []).flat());
  return `${id}|cap${opt.maxSteps ?? 0}|seed${opt.seed ?? ''}|b${opt.base ?? 0}|k${opt.k ?? 0}`
    + `|t${opt.trace === false ? 0 : 1}|e${edges}|${hashWords(keys)}`;
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

/** One auxiliary structure's lane: `cells` cells of the row from `start`, for `width` cells of its own. */
export interface AuxLane { start: number; cells: number; width: number }

/** The row cell that shows cell `i` of a structure: its lane's, folded by scale when narrower. */
export const auxCell = (l: AuxLane, i: number) => l.start + Math.floor((i * l.cells) / l.width);

/**
 * Each auxiliary structure of a run (by its name's string id) on a row of `row` cells, in order
 * of first appearance, side by side. Total for every row of at least one cell and any number and
 * width of structures, and never outside the row:
 *   - they all fit: each as wide as itself, exactly;
 *   - there are no more structures than cells: each gets its share (at least one cell) and folds
 *     its cells into it by scale, and no two structures share a cell;
 *   - there are more structures than cells: each is folded into one cell, structure k of S into
 *     cell floor(k * row / S), so neighbours share a cell, deterministically.
 * A row of no cells (an empty array) has no lanes, and the replay then draws no auxiliary cell.
 */
export function auxLayout(r: WasmRun, row: number): Map<number, AuxLane> {
  const width = new Map<number, number>();
  const s = r.steps;
  for (let e = 0; e < s.length; e += STRIDE) {
    if ((s[e] & 15) !== SOP.auxWrite) continue;
    const p = s[e] >>> 8;
    width.set(p, Math.max(width.get(p) ?? 0, s[e + 1] + 1));
  }
  const lanes = new Map<number, AuxLane>();
  const n = Math.floor(row);
  if (!width.size || !(n >= 1)) return lanes;
  const entries = [...width.entries()];
  const count = entries.length;
  const total = entries.reduce((x, [, w]) => x + w, 0);
  if (count > n) {
    entries.forEach(([p, w], k) => lanes.set(p, { start: Math.floor((k * n) / count), cells: 1, width: w }));
    return lanes;
  }
  const fits = total <= n;
  // a share of the row each, at least one cell; the widest give back what the narrow took
  const cells = entries.map(([, w]) => (fits ? w : Math.max(1, Math.min(w, Math.floor((w * n) / total)))));
  let over = cells.reduce((x, c) => x + c, 0) - n;
  while (over > 0) {
    let i = 0;
    for (let j = 1; j < cells.length; j++) if (cells[j] > cells[i]) i = j;
    cells[i]--; // never below one: count <= n, so the sum reaches n before every lane is one cell
    over--;
  }
  let start = 0;
  entries.forEach(([p, w], i) => {
    lanes.set(p, { start, cells: cells[i], width: w });
    start += cells[i];
  });
  return lanes;
}

/**
 * Replay a Rust trace through ArrayOps (see the table at the top of this file). `emitted` is
 * the number of events the run has recorded before the replay (the copy into the module).
 */
export function replay(a: ArrayOps, r: WasmRun, emitted = 0): void {
  const s = r.steps;
  // a row as wide as the structures need (reserveAux), so every cell is drawn exactly; folded
  // only past the array engine's widest row
  const wanted = auxLayout(r, Number.MAX_SAFE_INTEGER);
  const total = [...wanted.values()].reduce((x, l) => x + l.width, 0);
  const row = Math.max(a.n, Math.min(total, AUX_CAP));
  if (row > a.n) a.reserveAux(row);
  const lanes = row >= total ? wanted : auxLayout(r, row);
  // live source cells behind each row cell, so a folded cell is emptied only when all are
  const live = new Map<number, Uint8Array>();
  const behind = new Int32Array(row);
  let events = emitted;
  for (let e = 0; e < s.length; e += STRIDE) {
    const w0 = s[e];
    const p = w0 >>> 8;
    switch (w0 & 15) {
      case SOP.cmp: a.lessAt(p, s[e + 1]); events++; break;
      case SOP.cmpv: a.less(s[e + 1], s[e + 2]); events++; break;
      case SOP.swap: a.swap(p, s[e + 1]); events++; break;
      case SOP.set: a.set(p, s[e + 1]); events++; break;
      case SOP.read: a.get(p); events++; break;
      case SOP.mark: if (s[e + 1] > p) { a.range(p, s[e + 1] - 1); events++; } break;
      case SOP.phase: a.phase(r.strings[p] ?? ''); events++; break;
      case SOP.lane: a.lane(s[e + 1]); events++; break;
      case SOP.round: a.round(); events++; break;
      case SOP.auxWrite: {
        const lane = lanes.get(p);
        if (!lane) break; // no row to draw on (an empty array)
        const i = s[e + 1];
        const cell = auxCell(lane, i);
        let on = live.get(p);
        if (!on) { on = new Uint8Array(lane.width); live.set(p, on); }
        if (!on[i]) { on[i] = 1; behind[cell]++; }
        a.setAux(cell, s[e + 2]);
        events++;
        break;
      }
      case SOP.auxClear: {
        const lane = lanes.get(p);
        const on = live.get(p);
        if (!lane || !on) break;
        for (let i = s[e + 1]; i < s[e + 2]; i++) {
          if (!on[i]) continue;
          on[i] = 0;
          const cell = auxCell(lane, i);
          if (--behind[cell] === 0) { a.clearAux(cell, cell); events++; }
        }
        break;
      }
      default: break;
    }
  }
  if (r.truncated) {
    // the array engine marks a trace truncated at its event cap: reach it. The Rust run stopped
    // at that same cap, so only its steps without an ArrayOps call are left to pad.
    for (let pad = Math.max(0, EVENT_CAP - events); pad >= 0; pad--) a.range(0, 0);
  }
}

const NO_STEPS = new Int32Array(0);

/** What one round of a kernel of this kind is called (ArrayKernel.roundUnit). */
export const ROUND_UNIT: Record<KernelMeta['kind'], string> = {
  comparison: 'Rounds', distribution: 'Rounds', network: 'Rounds', external: 'Passes',
  special: 'Rounds', joke: 'Rounds',
};

export interface WasmArrayKernel extends ArrayKernel {
  /** The atlas kernel id. */
  readonly kernelId: string;
  readonly meta: KernelMeta;
  /** The last run's Rust result (outcome, note, counts, output; not its steps), for readouts and tests. */
  last?: WasmRun;
}

/**
 * Kernel `id` of a loaded module as an array-engine kernel, playing at most `maxN` keys when its
 * measured rebuild cost bounds it (the sidecar's max_n, through the catalogue model).
 */
export function wasmKernel(s: Sorting, id: string, maxN?: number): WasmArrayKernel {
  const meta = s.meta(id);
  if (!meta) throw new Error(`sorting-wasm: the module has no kernel ${id}`);
  const k: WasmArrayKernel = {
    goal: 'sort',
    kernelId: id,
    meta,
    roundUnit: ROUND_UNIT[meta.kind],
    ...(maxN ? { maxN } : {}),
    run(a: ArrayOps) {
      const keys = new Int32Array(a.n);
      for (let i = 0; i < a.n; i++) keys[i] = a.get(i);
      const r = traceOf(s, id, keys);
      // what the run reported, without its steps: a lab of many kernels keeps every kernel's
      // last run, and the steps are already in the array engine's own trace
      k.last = { ...r, steps: NO_STEPS };
      replay(a, r, a.n);
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
  const k = wasmKernel(s, id, maxNOf(entryId));
  await traceCache(s).prefetch(`${id}|`);
  return k;
}
