// Where a run is built. Every build is sliced: the kernel is a generator, resumed for a few
// milliseconds of work per frame while the plate keeps drawing, so no frame ever carries a whole
// run. A rebuild may also go to a worker, which only makes it sooner: a worker that is missing,
// fails, or loses its reply falls back to the sliced build. Thumbnails, which render a few
// frames off screen, build at once.
import type { Params } from '../../core/plate';
import { makeInput } from './input';
import type { Pt } from './trace';
import { record, Recording, type Box, type GeometryKernel, type Mark } from './trace';
import { fromEncoded, fromPacked, fromTrace, type Encoded, type Packed, type Track } from './track';
import type { Job } from './worker';

/** Main-thread time a frame spends on background work (builds, then scaling runs). */
export const SLICE_MS = 2;
const NONE: Packed = { data: new Float64Array(0), strings: [] };
/** A worker reply later than this is treated as lost. */
const WORKER_TIMEOUT_MS = 15_000;

export interface Request {
  id: string; kernel: GeometryKernel; shape: string; n: number; seed: number; params: Params;
  /** A reader's points on the grid (ADR 0010), replacing the seeded ones. */
  points?: Pt[];
  /** The stride a previous run of the same settings ended with. */
  stride?: number;
}

export interface Partial { base: Mark[]; view: Box; frame: Packed; steps: number }

export interface Build {
  /** The finished run, once there is one. */
  readonly track: Track | null;
  /** Advance the build until `deadline` (performance.now()). */
  pump(deadline: number): void;
  /** What has been recorded so far, for drawing while the build runs. */
  partial(): Partial;
  /** The frame stride the build ended with (1 when unknown). */
  readonly stride: number;
}

const recordingOf = (r: Request, recording = true) =>
  new Recording(r.kernel, makeInput(r.kernel.input, r.shape, r.n, r.seed, r.params, r.points), r.params, r.seed, recording, recording, r.stride);

/** The whole run at once (thumbnails and tests). */
export function buildNow(r: Request): Track {
  return fromTrace(record(r.kernel, makeInput(r.kernel.input, r.shape, r.n, r.seed, r.params, r.points), r.params, r.seed, true, r.stride));
}

class Sliced implements Build {
  track: Track | null = null;
  private readonly rec: Recording;
  constructor(r: Request) { this.rec = recordingOf(r); }
  get stride(): number { return this.rec.stride; }
  pump(deadline: number): void {
    if (this.track || !this.rec.until(deadline)) return;
    const rec = this.rec;
    const o = rec.result;
    this.track = fromPacked({ base: rec.base, view: rec.view, final: rec.work, rows: o.rows ?? [], chart: o.chart, frames: rec.packedFrames });
  }
  partial(): Partial {
    const f = this.rec.packedFrames;
    return { base: this.rec.base, view: this.rec.view, frame: f[f.length - 1]?.packed ?? NONE, steps: f.length };
  }
}

let worker: Worker | null | undefined;
let nextJob = 1;
const waiting = new Map<number, (enc: Encoded | null) => void>();

function failAll(): void {
  const all = [...waiting.values()];
  waiting.clear();
  for (const done of all) done(null);
}

function pool(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === 'undefined' ? null : new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
  if (worker) {
    worker.onmessage = (ev) => {
      const done = waiting.get(ev.data?.job);
      waiting.delete(ev.data?.job);
      done?.(ev.data?.enc ?? null);
    };
    // a reply that cannot be read, or a worker that dies, sends every waiting build back to slicing
    worker.onmessageerror = () => failAll();
    worker.onerror = () => { worker?.terminate(); worker = null; failAll(); };
  }
  return worker;
}

class Remote implements Build {
  track: Track | null = null;
  private fallback: Sliced | null = null;
  constructor(private readonly r: Request, w: Worker) {
    const job = nextJob++;
    const timer = setTimeout(() => { if (waiting.delete(job)) this.fail(); }, WORKER_TIMEOUT_MS);
    waiting.set(job, (enc) => {
      clearTimeout(timer);
      if (enc) { this.track = fromEncoded(enc); this.ended = enc.stride; } else this.fail();
    });
    const msg: Job = { job, id: r.id, kind: r.kernel.input, shape: r.shape, n: r.n, seed: r.seed, params: { ...r.params }, points: r.points, stride: r.stride ?? 1 };
    try { w.postMessage(msg); } catch { waiting.delete(job); clearTimeout(timer); this.fail(); }
  }
  private ended = 0;
  get stride(): number { return this.fallback?.stride ?? (this.ended || this.r.stride || 1); }
  private fail(): void { if (!this.track && !this.fallback) this.fallback = new Sliced(this.r); }
  pump(deadline: number): void {
    if (this.fallback && !this.track) {
      this.fallback.pump(deadline);
      this.track = this.fallback.track;
    }
  }
  partial(): Partial {
    return this.fallback?.partial() ?? { base: [], view: { x0: 0, y0: 0, x1: 1, y1: 1 }, frame: NONE, steps: 0 };
  }
}

/** Start a build: sliced on the main thread, or in a worker when `remote` and one is available. */
export function startBuild(r: Request, remote: boolean): Build {
  const w = remote ? pool() : null;
  return w ? new Remote(r, w) : new Sliced(r);
}

/**
 * The scaling curve: one run per size, each sliced across frames, counted not timed, so the
 * points and the fitted exponent depend only on the seed and the settings.
 */
export class Scaling {
  readonly points: [number, number][] = [];
  private queue: number[];
  private rec: Recording | null = null;
  constructor(private readonly kernel: GeometryKernel, sizes: number[], private readonly shape: string,
    private readonly seed: number, private readonly params: Params) {
    this.queue = sizes.slice();
  }
  get done(): boolean { return this.queue.length === 0; }
  /** Advance until `deadline`; always at least one step, so a late frame still progresses. */
  pump(deadline: number): void {
    while (this.queue.length) {
      const n = this.queue[0];
      this.rec ??= recordingOf({ id: '', kernel: this.kernel, shape: this.shape, n, seed: this.seed + n, params: this.params }, false);
      if (!this.rec.until(deadline)) return;
      this.points.push([n, this.rec.work[this.kernel.counters[0][0]] ?? 0]);
      this.rec = null;
      this.queue.shift();
      if (performance.now() >= deadline) return;
    }
  }
}
