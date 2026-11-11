// Best-first search on a weighted 4-connected grid as a step machine. Entering a cell costs
// cost[cell] (Infinity is a wall). One machine covers Dijkstra (no heuristic), A* (g + w·h)
// and greedy best-first (h only); the heuristic is Manhattan distance times the cheapest cell.

export type Kind = 'dijkstra' | 'astar' | 'greedy';

export interface Terrain {
  w: number;
  h: number;
  cost: Float64Array;
  minCost: number;
}

class Heap {
  private keys: number[] = [];
  private vals: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, val: number): void {
    const k = this.keys;
    const v = this.vals;
    k.push(key);
    v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (k[parent] <= k[i]) break;
      [k[parent], k[i]] = [k[i], k[parent]];
      [v[parent], v[i]] = [v[i], v[parent]];
      i = parent;
    }
  }

  pop(): number {
    const k = this.keys;
    const v = this.vals;
    const top = v[0];
    const lk = k.pop() as number;
    const lv = v.pop() as number;
    if (k.length) {
      k[0] = lk;
      v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

export type Status = 'running' | 'found' | 'failed';

export class Search {
  readonly g: Float64Array;
  readonly parent: Int32Array;
  readonly closed: Uint8Array;
  readonly open: Uint8Array;
  expanded = 0;
  status: Status = 'running';
  private readonly heap = new Heap();

  constructor(readonly t: Terrain, readonly start: number, readonly goal: number,
    readonly kind: Kind, readonly weight = 1) {
    const n = t.w * t.h;
    this.g = new Float64Array(n).fill(Infinity);
    this.parent = new Int32Array(n).fill(-1);
    this.closed = new Uint8Array(n);
    this.open = new Uint8Array(n);
    this.g[start] = 0;
    this.open[start] = 1;
    this.heap.push(this.priority(start), start);
  }

  heuristic(i: number): number {
    const dx = Math.abs((i % this.t.w) - (this.goal % this.t.w));
    const dy = Math.abs(Math.floor(i / this.t.w) - Math.floor(this.goal / this.t.w));
    return (dx + dy) * this.t.minCost;
  }

  private priority(i: number): number {
    if (this.kind === 'dijkstra') return this.g[i];
    if (this.kind === 'greedy') return this.heuristic(i);
    return this.g[i] + this.weight * this.heuristic(i);
  }

  /** Expand one node. */
  step(): Status {
    if (this.status !== 'running') return this.status;
    while (this.heap.size) {
      const i = this.heap.pop();
      if (this.closed[i]) continue;
      this.closed[i] = 1;
      this.open[i] = 0;
      this.expanded++;
      if (i === this.goal) {
        this.status = 'found';
        return this.status;
      }
      const { w, h, cost } = this.t;
      const x = i % w;
      const y = Math.floor(i / w);
      const nbs = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1,
        y < h - 1 ? i + w : -1];
      for (const j of nbs) {
        if (j < 0 || this.closed[j] || !Number.isFinite(cost[j])) continue;
        const ng = this.g[i] + cost[j];
        if (ng < this.g[j]) {
          this.g[j] = ng;
          this.parent[j] = i;
          this.open[j] = 1;
          this.heap.push(this.priority(j), j);
        }
      }
      return this.status;
    }
    this.status = 'failed';
    return this.status;
  }

  run(): Status {
    while (this.step() === 'running') { /* expand */ }
    return this.status;
  }

  frontier(): number {
    let n = 0;
    for (let i = 0; i < this.open.length; i++) n += this.open[i];
    return n;
  }

  path(): number[] {
    if (this.status !== 'found') return [];
    const out = [this.goal];
    while (out[out.length - 1] !== this.start) out.push(this.parent[out[out.length - 1]]);
    return out.reverse();
  }
}

/** Seeded value noise, three octaves, in [0, 1]. */
export function terrain(w: number, h: number, rnd: () => number, roughness: number,
  wallLevel: number): { heights: Float64Array; terrain: Terrain } {
  const heights = new Float64Array(w * h);
  let amp = 1;
  let total = 0;
  for (const cell of [16, 8, 4]) {
    const gw = Math.ceil(w / cell) + 2;
    const gh = Math.ceil(h / cell) + 2;
    const lattice = Float64Array.from({ length: gw * gh }, () => rnd());
    const smooth = (u: number) => u * u * (3 - 2 * u);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx = x / cell;
        const gy = y / cell;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const u = smooth(gx - x0);
        const v = smooth(gy - y0);
        const a = lattice[y0 * gw + x0];
        const b = lattice[y0 * gw + x0 + 1];
        const c = lattice[(y0 + 1) * gw + x0];
        const d = lattice[(y0 + 1) * gw + x0 + 1];
        heights[y * w + x] += amp * (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < heights.length; i++) {
    heights[i] /= total;
    lo = Math.min(lo, heights[i]);
    hi = Math.max(hi, heights[i]);
  }
  const cost = new Float64Array(w * h);
  for (let i = 0; i < heights.length; i++) {
    heights[i] = (heights[i] - lo) / (hi - lo || 1);
    cost[i] = heights[i] >= wallLevel ? Infinity : 1 + roughness * heights[i] * heights[i] * 9;
  }
  return { heights, terrain: { w, h, cost, minCost: 1 } };
}
