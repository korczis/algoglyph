// How fast a plate's run is drawn, derived from config/pacing.yaml and from the run itself
// (ADR 0008, rule project.viz-component-layer). One source for every engine and paced plate:
//   calm      the counted changes per frame that make a run of a given length last the kind's
//             target, within its ceiling and floor; the ceiling itself while the length is
//             still unknown (a run being recorded) and for an endless stream
//   paceParam the control: a multiplier of the calm rate (× calm, 1 by default), log slider
//   Pacer     one run's pace: whole changes per frame from a fractional rate, carried between
//             frames, so a frame applies 0, 1 or more whole changes and never a fraction of one
//   fitSize   the largest default input whose calm run fits the kind's fit_s
// Frames are counted at `fps`, never timed: a plate that pauses or drops frames keeps its count.
import model from 'virtual:pacing';
import { num, type Params, type RangeParam, type Stat } from './plate';

export type PaceKind = 'replay' | 'views' | 'stream';

interface KindConfig {
  target_s: number;
  run_s: [number, number];
  max_per_s: number;
  min_per_s: number;
  fit_s?: number;
}

export interface Pacing {
  version: 1;
  fps: number;
  hold_s: number;
  pace: { min: number; max: number; step: number };
  kinds: { replay: KindConfig; views: KindConfig; stream: { max_per_s: number } };
}

export const PACING = model as Pacing;
/** The frame rate the contract counts in. */
export const FPS = PACING.fps;
/** Frames a finished run stays on screen before a loop starts the next one. */
export const HOLD_FRAMES = Math.round(PACING.hold_s * FPS);

/**
 * What a plate says about its pace. A paced plate (an engine's, or a bespoke one using Pacer)
 * names its kind and the unit it counts (a stream may declare a rate below its ceiling, never
 * above: the ceiling is a maximum, not a target); an emergent stream (an integrator, a pattern that
 * needs many steps to appear) keeps its own controls, whose unit is simulated time, and says
 * why; a still plate draws one picture progressively and says what it draws.
 */
export type PaceDecl =
  | { kind: 'replay' | 'views'; unit: string }
  /** A stream runs at its kind's ceiling, or at `per_s` when it declares a calmer rate. */
  | { kind: 'stream'; unit: string; per_s?: number }
  | { kind: 'stream'; emergent: string }
  | { kind: 'still'; why: string };

/** A paced run as it stands, for the readout and for test/pacing.test.ts. */
export interface PaceReport {
  kind: PaceKind;
  unit: string;
  /** Changes applied per frame at the current pace (a fraction: one every 1/perFrame frames). */
  perFrame: number;
  /** The run's length in changes; null while it is still being recorded, and for a stream. */
  length: number | null;
  /** Seconds the whole run lasts at the current pace, at `fps`; null while the length is unknown. */
  seconds: number | null;
  /** The run has been drawn to its end. */
  done: boolean;
}

/** The calm rate, in changes per frame, of a run of `length` changes of this kind. */
export function calm(kind: PaceKind, length?: number | null): number {
  if (kind === 'stream') return PACING.kinds.stream.max_per_s / FPS;
  const k = PACING.kinds[kind];
  if (length === null || length === undefined || !Number.isFinite(length)) return k.max_per_s / FPS;
  const want = length / (k.target_s * FPS);
  return Math.min(k.max_per_s / FPS, Math.max(k.min_per_s / FPS, want));
}

/** Seconds a run of `length` changes lasts at the calm rate (1×). */
export function calmSeconds(kind: PaceKind, length: number): number {
  return length / calm(kind, length) / FPS;
}

/** Whether a run of `length` changes, at its calm rate, lasts no longer than the kind's fit_s. */
export function fits(kind: 'replay' | 'views', length: number): boolean {
  return calmSeconds(kind, length) <= (PACING.kinds[kind].fit_s ?? PACING.kinds[kind].run_s[1]);
}

/**
 * The largest input, of `candidates` (the default first, then smaller ones), whose calm run of
 * `lengthAt(n)` changes fits: an input too large to watch at the ceiling is replaced by the
 * largest one that can be. The default is kept when it fits.
 */
export function fitSize(kind: 'replay' | 'views', candidates: number[], lengthAt: (n: number) => number): number {
  for (const n of candidates) if (fits(kind, lengthAt(n))) return n;
  return candidates[candidates.length - 1];
}

/** The slider grid's values from `value` down to `min` in `step`s: fitSize's candidates. */
export function downFrom(value: number, min: number, step: number): number[] {
  const out: number[] = [];
  for (let n = value; n >= min - 1e-9; n -= step) out.push(Number(n.toFixed(10)));
  return out;
}

export const PACE_KEY = 'pace';

/** The pace control: a multiplier of the calm rate, 1× by default, on a log slider. */
export function paceParam(): RangeParam {
  const c = PACING.pace;
  return {
    kind: 'range', key: PACE_KEY, label: 'Pace (× calm)', min: c.min, max: c.max, step: c.step, value: 1,
    log: true, hint: 'At 1× a default run lasts about '
      + `${PACING.kinds.replay.target_s} s and shows at most ${PACING.kinds.replay.max_per_s} changes a second.`,
  };
}

/** The multiplier the pace control holds (1 when absent or not a positive number). */
export function paceOf(params: Params): number {
  const v = num(params, PACE_KEY);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

const sig = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : Number(x.toPrecision(2)).toString());

/**
 * One run's pace: its kind and unit, its length once known, and the fraction carried. A run whose
 * length is learnt only while it replays (one being computed or recorded) replays at the ceiling
 * until then, and from then on at the rate that lets what is left end when a calm run of that
 * length would have ended: the run as a whole lasts what its length asks.
 */
export class Pacer {
  length: number | null = null;
  private carry = 0;
  private frames = 0;
  private from = { at: 0, frame: 0 };
  /**
   * @param maxPerFrame the engine's own per-frame maximum (its old slider's top): the pace
   * control never asks more, so the heaviest frame is what the budget gate has always measured
   */
  /**
   * @param perS a stream's own calm rate in changes a second, below the ceiling (PaceDecl.per_s)
   */
  constructor(readonly kind: PaceKind, public unit: string, readonly maxPerFrame: number,
    readonly perS?: number) {}

  /** A new run, of `length` changes when known (null while it is being recorded). */
  start(length: number | null = null): void {
    this.length = length;
    this.carry = 0;
    this.frames = 0;
    this.from = { at: 0, frame: 0 };
  }

  /** The run's length has become known, `at` changes into it. */
  known(length: number, at: number): void {
    this.length = length;
    this.from = { at: Math.min(at, length), frame: this.frames };
  }

  /** The calm rate at 1×: the whole run's, or what is left of it once its length was learnt late. */
  private base(): number {
    if (this.kind === 'stream') return Math.min(calm('stream'), (this.perS ?? Infinity) / FPS);
    if (this.length === null || this.from.frame === 0) return calm(this.kind, this.length);
    const k = PACING.kinds[this.kind];
    const left = calmSeconds(this.kind, this.length) * FPS - this.from.frame;
    const rest = this.length - this.from.at;
    if (left <= 0) return k.max_per_s / FPS;
    return Math.min(k.max_per_s / FPS, Math.max(k.min_per_s / FPS, rest / left));
  }

  /** Changes per frame at the current pace. */
  perFrame(params: Params): number {
    return Math.min(this.maxPerFrame, this.base() * paceOf(params));
  }

  /** Whole changes this frame applies: the rate plus what earlier frames left over. */
  take(params: Params): number {
    this.frames++;
    this.carry += this.perFrame(params);
    const k = Math.floor(this.carry + 1e-9);
    this.carry = Math.max(0, this.carry - k);
    return k;
  }

  /** Seconds the whole run lasts at the current pace; null while its length is unknown. */
  seconds(params: Params): number | null {
    if (this.length === null || this.kind === 'stream') return null;
    return (this.from.frame + (this.length - this.from.at) / this.perFrame(params)) / FPS;
  }

  /** The readout: the multiplier, the rate it gives and how long the run lasts at it. */
  row(params: Params): Stat {
    const rate = `×${sig(paceOf(params))} · ${sig(this.perFrame(params) * FPS)} ${this.unit}/s`;
    if (this.kind === 'stream') return { label: 'Pace', value: rate };
    const s = this.seconds(params);
    if (s === null) return { label: 'Pace', value: `${rate} · run length still being recorded` };
    return { label: 'Pace', value: `${rate} · run ≈ ${sig(s)} s` };
  }

  report(done: boolean, params: Params): PaceReport {
    return {
      kind: this.kind, unit: this.unit, perFrame: this.perFrame(params), length: this.length,
      seconds: this.seconds(params), done,
    };
  }
}
