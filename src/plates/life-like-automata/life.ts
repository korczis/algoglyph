// Life-like cellular automata on a torus. A rule in B/S notation lists the neighbour counts
// (of the eight surrounding cells) at which a dead cell is born and a live cell survives;
// Conway's Game of Life is B3/S23. Each rule is stored as two 9-bit masks indexed by count.

export interface Rule {
  /** Bit n set: a dead cell with n live neighbours is born. */
  birth: number;
  /** Bit n set: a live cell with n live neighbours survives. */
  survive: number;
}

const RULE = /^B([0-8]*)\/S([0-8]*)$/i;

function mask(digits: string): number | null {
  let m = 0;
  for (const ch of digits) {
    const bit = 1 << Number(ch);
    if (m & bit) return null;
    m |= bit;
  }
  return m;
}

/** Parse "B3/S23"-style notation; null for anything else (repeated digits, 9, junk). */
export function parseRule(text: string): Rule | null {
  const m = RULE.exec(text.trim());
  if (!m) return null;
  const birth = mask(m[1]);
  const survive = mask(m[2]);
  if (birth === null || survive === null) return null;
  return { birth, survive };
}

export function ruleString(rule: Rule): string {
  const digits = (m: number) => [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((n) => m & (1 << n)).join('');
  return `B${digits(rule.birth)}/S${digits(rule.survive)}`;
}

/** Live cells as [x, y] offsets from the pattern's top-left corner. */
export type Pattern = [number, number][];

/** Parse a picture where 'O' is a live cell and any other character is dead. */
export function picture(rows: string[]): Pattern {
  const out: Pattern = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === 'O') out.push([x, y]);
  });
  return out;
}

export const PATTERNS: Record<string, Pattern> = {
  blinker: picture(['OOO']),
  block: picture(['OO', 'OO']),
  glider: picture(['.O.', '..O', 'OOO']),
  rPentomino: picture(['.OO', 'OO.', '.O.']),
  acorn: picture(['.O.....', '...O...', 'OO..OOO']),
  gosperGun: picture([
    '........................O...........',
    '......................O.O...........',
    '............OO......OO............OO',
    '...........O...O....OO............OO',
    'OO........O.....O...OO..............',
    'OO........O...O.OO....O.O...........',
    '..........O.....O.......O...........',
    '...........O...O....................',
    '............OO......................',
  ]),
};

export function bounds(pattern: Pattern): { w: number; h: number } {
  let w = 0;
  let h = 0;
  for (const [x, y] of pattern) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  return { w, h };
}

/** How many recent boards the period detector remembers. */
export const HISTORY = 8192;

export class Life {
  readonly w: number;
  readonly h: number;
  cells: Uint8Array;
  private spare: Uint8Array;
  /** Generations each live cell has survived (0 on the generation it was born). */
  readonly age: Uint16Array;
  /** Set to 1 where a cell dies; the caller clears it when it has drawn the traces. */
  readonly died: Uint8Array;
  generation = 0;
  population = 0;
  births = 0;
  deaths = 0;
  /** Smallest p with board(t) = board(t − p), once found; 0 while none is known. */
  period = 0;
  /** First generation of the cycle the board has entered, once a period is known. */
  cycleStart = 0;
  private readonly seen = new Map<string, number>();
  private readonly ring: string[] = new Array<string>(HISTORY);
  private readonly ringGen = new Float64Array(HISTORY);
  private stored = 0;
  private readonly left: Int32Array;
  private readonly right: Int32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.cells = new Uint8Array(w * h);
    this.spare = new Uint8Array(w * h);
    this.age = new Uint16Array(w * h);
    this.died = new Uint8Array(w * h);
    this.left = new Int32Array(w);
    this.right = new Int32Array(w);
    for (let x = 0; x < w; x++) {
      this.left[x] = (x - 1 + w) % w;
      this.right[x] = (x + 1) % w;
    }
  }

  index(x: number, y: number): number {
    const { w, h } = this;
    return (((y % h) + h) % h) * w + (((x % w) + w) % w);
  }

  get(x: number, y: number): number {
    return this.cells[this.index(x, y)];
  }

  set(x: number, y: number, alive: boolean): void {
    const i = this.index(x, y);
    this.cells[i] = alive ? 1 : 0;
    this.age[i] = 0;
  }

  place(pattern: Pattern, x0: number, y0: number): void {
    for (const [x, y] of pattern) this.set(x0 + x, y0 + y, true);
  }

  soup(density: number, rnd: () => number): void {
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = rnd() < density ? 1 : 0;
  }

  /** Forget the remembered boards: call after the board or the rule is changed by hand. */
  perturbed(): void {
    this.seen.clear();
    this.stored = 0;
    this.period = 0;
    this.cycleStart = 0;
    let n = 0;
    for (let i = 0; i < this.cells.length; i++) n += this.cells[i];
    this.population = n;
    this.remember(this.hash());
  }

  /** How many consecutive recent boards the detector currently compares against. */
  get remembered(): number {
    return Math.min(this.stored, HISTORY);
  }

  /** A 64-bit hash of the set of live cells, as a string key. */
  hash(): string {
    let h1 = 0x811c9dc5;
    let h2 = 0x2545f491;
    const c = this.cells;
    for (let i = 0; i < c.length; i++) {
      if (!c[i]) continue;
      h1 = Math.imul(h1 ^ i, 0x01000193);
      h2 = Math.imul(h2 ^ Math.imul(i, 0x9e3779b1), 0x85ebca6b);
      h2 ^= h2 >>> 15;
    }
    return `${h1 >>> 0}:${h2 >>> 0}`;
  }

  private remember(key: string): void {
    if (this.period === 0) {
      const at = this.seen.get(key);
      if (at !== undefined) {
        this.period = this.generation - at;
        this.cycleStart = at;
      }
    }
    const slot = this.stored % HISTORY;
    if (this.stored >= HISTORY) {
      const old = this.ring[slot];
      if (this.seen.get(old) === this.ringGen[slot]) this.seen.delete(old);
    }
    this.ring[slot] = key;
    this.ringGen[slot] = this.generation;
    this.seen.set(key, this.generation);
    this.stored++;
  }

  step(rule: Rule): void {
    const { w, h, left, right, age, died } = this;
    const src = this.cells;
    const dst = this.spare;
    const { birth, survive } = rule;
    let pop = 0;
    let born = 0;
    let gone = 0;
    for (let y = 0; y < h; y++) {
      const up = ((y - 1 + h) % h) * w;
      const row = y * w;
      const down = ((y + 1) % h) * w;
      for (let x = 0; x < w; x++) {
        const l = left[x];
        const r = right[x];
        const n = src[up + l] + src[up + x] + src[up + r] + src[row + l] + src[row + r]
          + src[down + l] + src[down + x] + src[down + r];
        const i = row + x;
        const was = src[i];
        const now = was ? (survive >> n) & 1 : (birth >> n) & 1;
        dst[i] = now;
        if (now) {
          pop++;
          if (was) {
            if (age[i] < 65535) age[i]++;
          } else {
            age[i] = 0;
            born++;
          }
        } else if (was) {
          died[i] = 1;
          gone++;
        }
      }
    }
    this.cells = dst;
    this.spare = src;
    this.generation++;
    this.population = pop;
    this.births = born;
    this.deaths = gone;
    this.remember(this.hash());
  }
}
