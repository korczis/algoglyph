// Langton's ant and its multi-colour generalisation (turmites) on a torus. A rule such as "RL"
// has one letter per cell colour: an ant on colour k turns by letter k (R right, L left, N no
// turn, U u-turn), advances the cell to colour k + 1 (mod the number of letters) and steps
// forward. "RL" is Langton's original ant: turn right on white, left on black, flip the cell.

/** Heading change per letter, in quarter turns clockwise. */
const TURN: Record<string, number> = { N: 0, R: 1, U: 2, L: 3 };
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** Ant 0's moves remembered for the highway detector. */
export const MOVES = 8192;

const TURMITE = /^[LRNU]{2,12}$/;

/** Parse a turmite string into quarter-turns per colour; null if it is not one. */
export function parseTurmite(text: string): number[] | null {
  const t = text.trim().toUpperCase();
  if (!TURMITE.test(t)) return null;
  return [...t].map((c) => TURN[c]);
}

export interface Ant {
  x: number;
  y: number;
  /** 0 up, 1 right, 2 down, 3 left. */
  dir: number;
}

export interface Highway {
  /** Steps after which ant 0's motion repeats. */
  period: number;
  /** Displacement per period, in cells. */
  dx: number;
  dy: number;
  /** Step at which the repeating motion began (exact while it lies in the move memory). */
  since: number;
}

export class Turmite {
  readonly w: number;
  readonly h: number;
  readonly colours: number;
  readonly grid: Uint8Array;
  readonly visited: Uint8Array;
  /** Set to 1 where an ant stepped; the caller clears it when it has drawn the glow. */
  readonly touched: Uint8Array;
  readonly ants: Ant[];
  steps = 0;
  visitedCount = 0;
  /** Cells whose colour is not 0. */
  coloured = 0;
  private readonly turns: Int8Array;
  private readonly moves = new Uint8Array(MOVES);

  constructor(w: number, h: number, turns: number[], ants: Ant[]) {
    this.w = w;
    this.h = h;
    this.turns = Int8Array.from(turns);
    this.colours = turns.length;
    this.grid = new Uint8Array(w * h);
    this.visited = new Uint8Array(w * h);
    this.touched = new Uint8Array(w * h);
    this.ants = ants.map((a) => ({ x: a.x, y: a.y, dir: a.dir & 3 }));
    for (const a of this.ants) this.visit(a.y * w + a.x);
  }

  private visit(i: number): void {
    if (!this.visited[i]) {
      this.visited[i] = 1;
      this.visitedCount++;
    }
    this.touched[i] = 1;
  }

  /** Paint one cell (wrapping), keeping the colour count right. */
  paint(x: number, y: number, colour: number): void {
    const { w, h } = this;
    const i = (((y % h) + h) % h) * w + (((x % w) + w) % w);
    const was = this.grid[i];
    const now = colour % this.colours;
    this.coloured += (now ? 1 : 0) - (was ? 1 : 0);
    this.grid[i] = now;
  }

  colourAt(x: number, y: number): number {
    const { w, h } = this;
    return this.grid[(((y % h) + h) % h) * w + (((x % w) + w) % w)];
  }

  /** Every ant takes one step, in order. */
  step(): void {
    const { w, h, grid, turns, colours } = this;
    for (let k = 0; k < this.ants.length; k++) {
      const a = this.ants[k];
      const i = a.y * w + a.x;
      const c = grid[i];
      a.dir = (a.dir + turns[c]) & 3;
      const next = c + 1 === colours ? 0 : c + 1;
      grid[i] = next;
      if (c === 0) this.coloured++;
      else if (next === 0) this.coloured--;
      a.x += DX[a.dir];
      a.y += DY[a.dir];
      if (a.x < 0) a.x += w;
      else if (a.x >= w) a.x -= w;
      if (a.y < 0) a.y += h;
      else if (a.y >= h) a.y -= h;
      if (k === 0) this.moves[this.steps % MOVES] = a.dir;
      this.visit(a.y * w + a.x);
    }
    this.steps++;
  }

  private move(s: number): number {
    return this.moves[s % MOVES];
  }

  /**
   * The smallest period of ant 0's recent moves that carries it somewhere: its last
   * max(3p, minRun) moves repeat with period p and one period has a non-zero displacement.
   */
  highway(maxPeriod = 1024, minRun = 240): Highway | null {
    const t = this.steps;
    const memory = Math.min(t, MOVES);
    for (let p = 1; p <= maxPeriod; p++) {
      const run = Math.max(3 * p, minRun);
      if (run > memory) break;
      let ok = true;
      for (let s = t - 1; s >= t - run + p; s--) {
        if (this.move(s) !== this.move(s - p)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      let dx = 0;
      let dy = 0;
      for (let s = t - p; s < t; s++) {
        dx += DX[this.move(s)];
        dy += DY[this.move(s)];
      }
      if (dx === 0 && dy === 0) continue;
      let since = t - run;
      while (since > t - memory && this.move(since - 1) === this.move(since - 1 + p)) since--;
      return { period: p, dx, dy, since };
    }
    return null;
  }
}
