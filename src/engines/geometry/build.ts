// Where a run is built: on the main thread for the first input (the plate must draw at once),
// and in a worker for every later one, so that looping never blocks a frame. Without a worker
// (tests, old browsers, a worker that failed) the later runs are built in place.
import type { Params } from '../../core/plate';
import { makeInput } from './input';
import { record, type GeometryKernel } from './trace';
import { fromEncoded, fromTrace, type Encoded, type Track } from './track';
import type { Job } from './worker';

let worker: Worker | null | undefined;
let nextJob = 1;
const waiting = new Map<number, (r: { enc?: Encoded; error?: string }) => void>();

function pool(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === 'undefined' ? null : new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
  if (worker) {
    worker.onmessage = (ev) => { const done = waiting.get(ev.data.job); waiting.delete(ev.data.job); done?.(ev.data); };
    worker.onerror = () => { worker = null; for (const [, done] of waiting) done({ error: 'worker failed' }); waiting.clear(); };
  }
  return worker;
}

export interface Request { id: string; kernel: GeometryKernel; shape: string; n: number; seed: number; params: Params }

export function buildNow(r: Request): Track {
  return fromTrace(record(r.kernel, makeInput(r.kernel.input, r.shape, r.n, r.seed, r.params), r.params, r.seed));
}

/** Build off the main thread when a worker is available; `done` receives the run. */
export function buildLater(r: Request, done: (t: Track) => void): void {
  const w = pool();
  if (!w) { done(buildNow(r)); return; }
  const job = nextJob++;
  waiting.set(job, (res) => done(res.enc ? fromEncoded(res.enc) : buildNow(r)));
  const msg: Job = { job, id: r.id, kind: r.kernel.input, shape: r.shape, n: r.n, seed: r.seed, params: { ...r.params } };
  w.postMessage(msg);
}
