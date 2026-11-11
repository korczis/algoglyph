// Every probe the search plates have made, as (step, position) points with a hit count, and the
// moves between successive probes. Both are bounded: once `limit` distinct points (or moves) are
// held, new ones are counted as dropped and not stored, so a frame never draws more than
// `limit` circles and `limit` lines however long the plate runs. Keys are numeric.

export class ProbeMap {
  readonly step: Int32Array;
  readonly pos: Int32Array;
  readonly hits: Int32Array;
  readonly moveStep: Int32Array;
  readonly moveFrom: Int32Array;
  readonly moveTo: Int32Array;
  points = 0;
  moves = 0;
  dropped = 0;
  private readonly pointAt = new Map<number, number>();
  private readonly moveSeen = new Set<number>();

  /** `n` is the array length the positions index into. */
  constructor(readonly n: number, readonly limit: number) {
    this.step = new Int32Array(limit);
    this.pos = new Int32Array(limit);
    this.hits = new Int32Array(limit);
    this.moveStep = new Int32Array(limit);
    this.moveFrom = new Int32Array(limit);
    this.moveTo = new Int32Array(limit);
  }

  /** Record one search's probes, in order. */
  record(probes: readonly number[]): void {
    const n = this.n;
    for (let d = 0; d < probes.length; d++) {
      const key = d * n + probes[d];
      const at = this.pointAt.get(key);
      if (at !== undefined) this.hits[at]++;
      else if (this.points < this.limit) {
        this.step[this.points] = d;
        this.pos[this.points] = probes[d];
        this.hits[this.points] = 1;
        this.pointAt.set(key, this.points++);
      } else this.dropped++;
      if (d === 0) continue;
      const move = (d * n + probes[d - 1]) * n + probes[d];
      if (this.moveSeen.has(move)) continue;
      if (this.moves < this.limit) {
        this.moveSeen.add(move);
        this.moveStep[this.moves] = d;
        this.moveFrom[this.moves] = probes[d - 1];
        this.moveTo[this.moves++] = probes[d];
      } else this.dropped++;
    }
  }

  /** Hits of the point (step, position), 0 when it is not stored. */
  count(step: number, pos: number): number {
    const at = this.pointAt.get(step * this.n + pos);
    return at === undefined ? 0 : this.hits[at];
  }
}
