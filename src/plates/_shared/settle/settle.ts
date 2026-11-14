// The settle signal of a plate that starts a new run after each one ends (ADR 0007): such a plate
// never stays still on its own, so the claims instrument could not tell when to read it. The
// `runs` control stops it once k runs have completed, holding the last one; `completed runs`
// counts the runs that have ended, raised exactly once as each ends and never lowered; and `last
// completed run` holds what that run measured, never a run still in progress. A claim asks for
// k completed runs with `setup.params.runs` and reads the completed runs' values: the last
// run's, or a mean the plate keeps over the completed runs.
//
// A stream (an integrator, a cellular automaton) never ends a run, so for it a run is one block
// of its own unit: a simulated second, a step, a generation. The same control, given the unit
// (`runsParam({ unit })`), stops it after k blocks; `StreamStop` clamps the plate's per-frame loop
// so that it stops exactly on the k-th block, however many units a frame asks, and its
// `completed runs` counts the blocks run. At 0, the default, it never clamps a frame.
import { fmt } from '../live-chart/series';
import type { Params, RangeParam, Stat } from '../../../core/plate';

/** The key of the control that stops a plate after k completed runs (0: never). */
export const RUNS_KEY = 'runs';
/** The readout that counts completed runs: the settle signal a claim waits on. */
export const COMPLETED_RUNS = 'completed runs';
/** The readout of what the last completed run measured. */
export const LAST_COMPLETED_RUN = 'last completed run';

/** The most runs the control asks for: past it, a reader wants the plate to run on. */
const MAX_RUNS = 1000;

/** A stream's run: one block of its own unit, named as the control's label shows it. */
export interface StreamRun {
  /** What one run is, in the label "Stop after (unit)": 'simulated s', 'steps', 'generations'. */
  unit: string;
  /** The most runs the control asks for: past it, a reader wants the stream to run on. */
  max: number;
  /** What a run is in the plate's own terms, when the unit alone does not say it. */
  note?: string;
}

/**
 * The control: stop after k completed runs; 0, the default, runs on for ever. Given a stream's
 * run, the same control counts runs as blocks of that unit and its label names the unit.
 */
export function runsParam(stream?: StreamRun): RangeParam {
  if (stream) {
    return {
      kind: 'range', key: RUNS_KEY, label: `Stop after (${stream.unit})`, min: 0, max: stream.max,
      step: 1, value: 0,
      hint: `0: never stop. k: stop after k ${stream.unit}, so its readouts stay still.`
        + (stream.note ? ` ${stream.note}` : ''),
    };
  }
  return {
    kind: 'range', key: RUNS_KEY, label: 'Stop after runs', min: 0, max: MAX_RUNS, step: 1, value: 0,
    hint: '0: never stop. k: hold the plate on its k-th completed run, so its readouts stay still.',
  };
}

/** The live control's k, or 0 when the plate runs on. */
function limitOf(params: Params): number {
  const v = Number(params[RUNS_KEY] ?? 0);
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 0;
}

/** The `completed runs` row: the count first, as a claim reads it. */
function countRow(n: number, k: number, stopped: boolean): Stat {
  const value = k ? `${fmt(n)} of ${fmt(k)}${stopped ? ', stopped' : ''}` : fmt(n);
  return { label: COMPLETED_RUNS, value };
}

/** One plate's completed runs, read against the live `runs` control. */
export class RunCounter {
  private n = 0;
  private summary = '–';

  constructor(private readonly params: Params) {}

  /** Runs that have ended. */
  get count(): number {
    return this.n;
  }

  /** The control's k, or 0 when the plate runs on. */
  get limit(): number {
    return limitOf(this.params);
  }

  /** k runs have completed: start no new one (read live, so a raised limit lets the plate on). */
  get stopped(): boolean {
    const k = this.limit;
    return k > 0 && this.n >= k;
  }

  /** A run has ended: count it, once, with what it measured. */
  complete(summary: string): void {
    this.n++;
    this.summary = summary;
  }

  /** The settle readouts: the count first, as a claim reads it, then the last completed run. */
  rows(): Stat[] {
    return [
      countRow(this.n, this.limit, this.stopped),
      { label: LAST_COMPLETED_RUN, value: this.summary },
    ];
  }
}

/**
 * A stream's completed runs: the units it has stepped, in whole ticks of its own (a step, a
 * generation, a microsecond of simulated time), counted against the live `runs` control, one run
 * being `block` ticks. The plate asks `allow` how many of the ticks a frame wants may run, steps
 * that many and reports them with `advance`: it never steps past the k-th block, and a frame
 * never runs more than it asked, so the stop adds no work to a frame.
 */
export class StreamStop {
  private done = 0;

  constructor(private readonly params: Params, readonly block: number) {}

  /** Ticks stepped since the stream started. */
  get elapsed(): number {
    return this.done;
  }

  /** Whole runs (blocks) stepped. */
  get count(): number {
    return Math.floor(this.done / this.block);
  }

  /** The control's k, or 0 when the stream runs on. */
  get limit(): number {
    return limitOf(this.params);
  }

  /** k blocks have been stepped: step no more (read live, so a raised limit lets it on). */
  get stopped(): boolean {
    const k = this.limit;
    return k > 0 && this.done >= k * this.block;
  }

  /** Of the `want` ticks a frame asks, those that may run before the stop: `want` at 0. */
  allow(want: number): number {
    const k = this.limit;
    if (!k) return want;
    return Math.max(0, Math.min(want, k * this.block - this.done));
  }

  /** `n` ticks have been stepped. */
  advance(n: number): void {
    this.done += n;
  }

  /** A new stream (the plate's setup). */
  reset(): void {
    this.done = 0;
  }

  /** The settle readout: the runs stepped, as a restarting plate shows its completed runs. */
  rows(): Stat[] {
    return [countRow(this.count, this.limit, this.stopped)];
  }
}
