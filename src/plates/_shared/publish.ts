// Code shared by several bespoke plates lives under src/plates/_shared/, outside any one plate's
// directory, so that retiring an entry never breaks another. It holds no plate (no plate.ts).

/** A gate for building a chart: true at most once every `every` frames, and only after `mark()`
 * has recorded new data since the last time it opened. The stage throttles what it renders;
 * this keeps a plate from copying its histories on frames whose chart would be dropped. */
export interface ChartGate {
  mark(): void;
  open(): boolean;
  /** A new run began: open on the next frame, and once more after that in case the stage's
   * own throttle dropped the first chart, so the previous run's chart never lingers. */
  reset(): void;
}

export function chartGate(every = 30): ChartGate {
  let frames = every;
  let dirty = false;
  let again = 0;
  return {
    mark() {
      dirty = true;
    },
    open() {
      frames++;
      if (!dirty || frames < every) return false;
      frames = 0;
      dirty = again > 0;
      if (again > 0) again--;
      return true;
    },
    reset() {
      frames = every;
      dirty = true;
      again = 1;
    },
  };
}
