// Perfect-maze generation and breadth-first flooding as step machines. A cell's `open` mask
// holds the passages carved out of it: N=1, E=2, S=4, W=8.

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const DIRS = [N, E, S, W] as const;
const DX: Record<number, number> = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
const DY: Record<number, number> = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
const OPP: Record<number, number> = { [N]: S, [E]: W, [S]: N, [W]: E };

export interface Grid {
  cols: number;
  rows: number;
  open: Uint8Array;
  visited: Uint8Array;
}

export function grid(cols: number, rows: number): Grid {
  return { cols, rows, open: new Uint8Array(cols * rows), visited: new Uint8Array(cols * rows) };
}

function neighbour(g: Grid, i: number, d: number): number {
  const x = (i % g.cols) + DX[d];
  const y = Math.floor(i / g.cols) + DY[d];
  if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return -1;
  return y * g.cols + x;
}

function carve(g: Grid, i: number, d: number, j: number): void {
  g.open[i] |= d;
  g.open[j] |= OPP[d];
}

/** Carving steps; each yields the cell it touched. */
export function* backtracker(g: Grid, rnd: () => number, start = 0): Generator<number> {
  const stack = [start];
  g.visited[start] = 1;
  while (stack.length) {
    const i = stack[stack.length - 1];
    const options = DIRS.filter((d) => {
      const j = neighbour(g, i, d);
      return j >= 0 && !g.visited[j];
    });
    if (!options.length) {
      stack.pop();
      yield i;
      continue;
    }
    const d = options[Math.floor(rnd() * options.length)];
    const j = neighbour(g, i, d);
    carve(g, i, d, j);
    g.visited[j] = 1;
    stack.push(j);
    yield j;
  }
}

export function* prim(g: Grid, rnd: () => number, start = 0): Generator<number> {
  const frontier: [number, number][] = [];
  const add = (i: number) => {
    for (const d of DIRS) {
      const j = neighbour(g, i, d);
      if (j >= 0 && !g.visited[j]) frontier.push([i, d]);
    }
  };
  g.visited[start] = 1;
  add(start);
  while (frontier.length) {
    const k = Math.floor(rnd() * frontier.length);
    const [i, d] = frontier[k];
    frontier[k] = frontier[frontier.length - 1];
    frontier.pop();
    const j = neighbour(g, i, d);
    if (g.visited[j]) continue;
    carve(g, i, d, j);
    g.visited[j] = 1;
    add(j);
    yield j;
  }
}

export interface Flood {
  dist: Int32Array;
  queue: Int32Array;
  head: number;
  tail: number;
  max: number;
  far: number;
}

export function flood(g: Grid, source: number): Flood {
  const dist = new Int32Array(g.cols * g.rows).fill(-1);
  const queue = new Int32Array(g.cols * g.rows);
  dist[source] = 0;
  queue[0] = source;
  return { dist, queue, head: 0, tail: 1, max: 0, far: source };
}

/** Expand one cell of the BFS; false once the queue is empty. */
export function floodStep(g: Grid, f: Flood): boolean {
  if (f.head >= f.tail) return false;
  const i = f.queue[f.head++];
  for (const d of DIRS) {
    if (!(g.open[i] & d)) continue;
    const j = neighbour(g, i, d);
    if (f.dist[j] >= 0) continue;
    f.dist[j] = f.dist[i] + 1;
    if (f.dist[j] > f.max) {
      f.max = f.dist[j];
      f.far = j;
    }
    f.queue[f.tail++] = j;
  }
  return true;
}

/** Walk downhill in the distance field from `from` back to the source. */
export function path(g: Grid, f: Flood, from: number): number[] {
  const out = [from];
  let i = from;
  while (f.dist[i] > 0) {
    for (const d of DIRS) {
      if (!(g.open[i] & d)) continue;
      const j = neighbour(g, i, d);
      if (f.dist[j] === f.dist[i] - 1) {
        i = j;
        break;
      }
    }
    out.push(i);
  }
  return out;
}

export function passages(g: Grid): number {
  let edges = 0;
  for (let i = 0; i < g.open.length; i++) edges += (g.open[i] & E ? 1 : 0) + (g.open[i] & S ? 1 : 0);
  return edges;
}
