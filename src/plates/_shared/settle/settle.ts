// The settle signal of a plate that starts a new run after each one ends (ADR 0007): such a plate
// never stays still on its own, so the claims instrument could not tell when to read it. The
// `runs` control stops it once k runs have completed, holding the last one; `completed runs`
// counts the runs that have ended, raised exactly once as each ends and never lowered; and `last
// completed run` holds what that run measured, never a run still in progress. A claim asks for
// k completed runs with `setup.params.runs` and reads the completed runs' values: the last
// run's, or a mean the plate keeps over the completed runs.
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

/** The control: stop after k completed runs; 0, the default, runs on for ever. */
export function runsParam(): RangeParam {
  return {
    kind: 'range', key: RUNS_KEY, label: 'Stop after runs', min: 0, max: MAX_RUNS, step: 1, value: 0,
    hint: '0: never stop. k: hold the plate on its k-th completed run, so its readouts stay still.',
  };
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
    const v = Number(this.params[RUNS_KEY] ?? 0);
    return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 0;
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
    const k = this.limit;
    const count = k ? `${fmt(this.n)} of ${fmt(k)}${this.stopped ? ', stopped' : ''}` : fmt(this.n);
    return [
      { label: COMPLETED_RUNS, value: count },
      { label: LAST_COMPLETED_RUN, value: this.summary },
    ];
  }
}
