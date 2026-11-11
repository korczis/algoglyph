// Code shared by several bespoke plates lives under src/plates/_shared/, outside any one plate's
// directory, so that retiring an entry never breaks another. It holds no plate (no plate.ts).

/** A gate for building a chart: true at most once every `every` frames, and only after `mark()`
 * has recorded new data since the last time it opened. The stage throttles what it renders;
 * this keeps a plate from copying its histories on frames whose chart would be dropped. */
export function chartGate(every = 30): { mark(): void; open(): boolean } {
  let frames = every;
  let dirty = false;
  return {
    mark() {
      dirty = true;
    },
    open() {
      frames++;
      if (!dirty || frames < every) return false;
      frames = 0;
      dirty = false;
      return true;
    },
  };
}
