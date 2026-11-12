// The sorting wasm module as a bespoke plate reads it: synchronously, once it has arrived. A
// plate's frame cannot wait for a promise, so the first call starts the load and returns
// undefined; every later frame gets the module, and a plate shows what needs it (a kernel sweep,
// a total to run towards) from then on. A failed load is retried no sooner than RETRY_MS later,
// never every frame, and never reported as an error: the plate's own mirror keeps running.
import { loadSorting, type RunOptions, type Sorting, type WasmRun } from '../../../kernels/sorting-wasm/_abi';

const RETRY_MS = 10_000;
let ready: Sorting | undefined;
let pending = false;
let failedAt = -Infinity;

/** The loaded module, or undefined while it loads (the first call starts the load). */
export function sortingNow(): Sorting | undefined {
  if (ready || pending) return ready;
  const now = typeof performance === 'undefined' ? Date.now() : performance.now();
  if (now - failedAt < RETRY_MS) return undefined;
  pending = true;
  loadSorting().then((s) => {
    ready = s;
    pending = false;
  }, () => {
    pending = false;
    failedAt = typeof performance === 'undefined' ? Date.now() : performance.now();
  });
  return undefined;
}

/** One count-only run of kernel `id` (no trace recorded): output, outcome and counts. */
export function countOnly(s: Sorting, id: string, keys: ArrayLike<number>, opt: RunOptions = {}): WasmRun {
  return s.run(id, keys, { ...opt, trace: false });
}

export type { Sorting, WasmRun };
