// Barnes–Hut gravity in 2D: a quadtree rebuilt every step, each node carrying its total mass and
// centre of mass, and softened forces that treat a distant cell as one body when s / d < θ.
// Pure numerics: no p5, no DOM.

export interface Bodies {
  n: number;
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  ax: Float64Array;
  ay: Float64Array;
  m: Float64Array;
}

export function bodies(n: number): Bodies {
  return {
    n,
    x: new Float64Array(n),
    y: new Float64Array(n),
    vx: new Float64Array(n),
    vy: new Float64Array(n),
    ax: new Float64Array(n),
    ay: new Float64Array(n),
    m: new Float64Array(n),
  };
}

/** Coincident bodies cannot be separated by splitting; below this depth a leaf keeps a list. */
export const MAX_DEPTH = 48;

export class QuadTree {
  /** Number of nodes in use; node 0 is the root. */
  nodes = 0;
  /** Deepest node created by the last build. */
  depthReached = 0;
  cx = new Float64Array(0);
  cy = new Float64Array(0);
  /** Half the side of the node's square. */
  half = new Float64Array(0);
  mass = new Float64Array(0);
  comX = new Float64Array(0);
  comY = new Float64Array(0);
  /** Index of the first of four contiguous children, or −1 for a leaf. */
  child = new Int32Array(0);
  /** Head of the leaf's body list, or −1. */
  first = new Int32Array(0);
  count = new Int32Array(0);
  depth = new Int32Array(0);
  /** Next body in the same leaf, or −1. */
  next = new Int32Array(0);
  private capacity = 0;

  private grow(need: number): void {
    if (need <= this.capacity) return;
    let cap = Math.max(64, this.capacity);
    while (cap < need) cap *= 2;
    const f64 = (a: Float64Array) => {
      const b = new Float64Array(cap);
      b.set(a.subarray(0, this.nodes));
      return b;
    };
    const i32 = (a: Int32Array) => {
      const b = new Int32Array(cap);
      b.set(a.subarray(0, this.nodes));
      return b;
    };
    this.cx = f64(this.cx);
    this.cy = f64(this.cy);
    this.half = f64(this.half);
    this.mass = f64(this.mass);
    this.comX = f64(this.comX);
    this.comY = f64(this.comY);
    this.child = i32(this.child);
    this.first = i32(this.first);
    this.count = i32(this.count);
    this.depth = i32(this.depth);
    this.capacity = cap;
  }

  private node(cx: number, cy: number, half: number, depth: number): number {
    this.grow(this.nodes + 1);
    const k = this.nodes++;
    this.cx[k] = cx;
    this.cy[k] = cy;
    this.half[k] = half;
    this.child[k] = -1;
    this.first[k] = -1;
    this.count[k] = 0;
    this.depth[k] = depth;
    if (depth > this.depthReached) this.depthReached = depth;
    return k;
  }

  isLeaf(k: number): boolean {
    return this.child[k] < 0;
  }

  build(b: Bodies): void {
    const { n, x, y, m } = b;
    if (this.next.length < n) this.next = new Int32Array(n);
    this.nodes = 0;
    this.depthReached = 0;
    this.grow(Math.max(64, 2 * n));
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      if (x[i] < x0) x0 = x[i];
      if (x[i] > x1) x1 = x[i];
      if (y[i] < y0) y0 = y[i];
      if (y[i] > y1) y1 = y[i];
    }
    if (n === 0) x0 = x1 = y0 = y1 = 0;
    const half = Math.max(x1 - x0, y1 - y0) * 0.5 * (1 + 1e-9) + 1e-12;
    this.node((x0 + x1) / 2, (y0 + y1) / 2, half, 0);
    for (let i = 0; i < n; i++) this.insert(i, x, y);

    // children are always created after their parent, so a reverse sweep is bottom-up
    for (let k = this.nodes - 1; k >= 0; k--) {
      let M = 0;
      let sx = 0;
      let sy = 0;
      const c = this.child[k];
      if (c < 0) {
        for (let i = this.first[k]; i >= 0; i = this.next[i]) {
          M += m[i];
          sx += m[i] * x[i];
          sy += m[i] * y[i];
        }
      } else {
        for (let q = c; q < c + 4; q++) {
          M += this.mass[q];
          sx += this.mass[q] * this.comX[q];
          sy += this.mass[q] * this.comY[q];
        }
      }
      this.mass[k] = M;
      this.comX[k] = M > 0 ? sx / M : this.cx[k];
      this.comY[k] = M > 0 ? sy / M : this.cy[k];
    }
  }

  private insert(i: number, xs: Float64Array, ys: Float64Array): void {
    const x = xs[i];
    const y = ys[i];
    let k = 0;
    for (;;) {
      const c = this.child[k];
      if (c >= 0) {
        k = c + (x >= this.cx[k] ? 1 : 0) + (y >= this.cy[k] ? 2 : 0);
        continue;
      }
      if (this.count[k] === 0 || this.depth[k] >= MAX_DEPTH) {
        this.next[i] = this.first[k];
        this.first[k] = i;
        this.count[k]++;
        return;
      }
      // an occupied leaf above the depth cap holds exactly one body: split and push it down
      const j = this.first[k];
      const h = this.half[k] / 2;
      const d = this.depth[k] + 1;
      const base = this.nodes;
      const cx = this.cx[k];
      const cy = this.cy[k];
      this.node(cx - h, cy - h, h, d);
      this.node(cx + h, cy - h, h, d);
      this.node(cx - h, cy + h, h, d);
      this.node(cx + h, cy + h, h, d);
      this.child[k] = base;
      this.first[k] = -1;
      this.count[k] = 0;
      const q = base + (xs[j] >= cx ? 1 : 0) + (ys[j] >= cy ? 2 : 0);
      this.next[j] = -1;
      this.first[q] = j;
      this.count[q] = 1;
    }
  }
}

const stack = new Int32Array(4 * (MAX_DEPTH + 4));

/**
 * Softened acceleration on body i from the tree, written to out[0], out[1]. A cell is taken as a
 * single mass at its centre of mass when side / distance < θ and it does not contain the body;
 * otherwise it is opened. Returns the number of interactions (bodies plus accepted cells).
 */
export function treeAccel(t: QuadTree, b: Bodies, i: number, theta: number, G: number,
  eps: number, out: Float64Array): number {
  const xi = b.x[i];
  const yi = b.y[i];
  const e2 = eps * eps;
  let ax = 0;
  let ay = 0;
  let interactions = 0;
  let top = 0;
  stack[top++] = 0;
  while (top > 0) {
    const k = stack[--top];
    if (t.mass[k] === 0) continue;
    const c = t.child[k];
    if (c < 0) {
      for (let j = t.first[k]; j >= 0; j = t.next[j]) {
        if (j === i) continue;
        const dx = b.x[j] - xi;
        const dy = b.y[j] - yi;
        const r2 = dx * dx + dy * dy + e2;
        const f = (G * b.m[j]) / (r2 * Math.sqrt(r2));
        ax += dx * f;
        ay += dy * f;
        interactions++;
      }
      continue;
    }
    const dx = t.comX[k] - xi;
    const dy = t.comY[k] - yi;
    const d2 = dx * dx + dy * dy;
    const s = 2 * t.half[k];
    const inside = Math.abs(xi - t.cx[k]) <= t.half[k] && Math.abs(yi - t.cy[k]) <= t.half[k];
    if (!inside && s * s < theta * theta * d2) {
      const r2 = d2 + e2;
      const f = (G * t.mass[k]) / (r2 * Math.sqrt(r2));
      ax += dx * f;
      ay += dy * f;
      interactions++;
    } else {
      stack[top++] = c;
      stack[top++] = c + 1;
      stack[top++] = c + 2;
      stack[top++] = c + 3;
    }
  }
  out[0] = ax;
  out[1] = ay;
  return interactions;
}

/** Accelerations of every body from a freshly built tree; returns the total interactions. */
export function accelerate(t: QuadTree, b: Bodies, theta: number, G: number,
  eps: number): number {
  t.build(b);
  const out = new Float64Array(2);
  let total = 0;
  for (let i = 0; i < b.n; i++) {
    total += treeAccel(t, b, i, theta, G, eps, out);
    b.ax[i] = out[0];
    b.ay[i] = out[1];
  }
  return total;
}

/** One kick-drift-kick leapfrog step; ax, ay must hold the current accelerations. */
export function leapfrog(t: QuadTree, b: Bodies, dt: number, theta: number, G: number,
  eps: number): number {
  const { n, x, y, vx, vy, ax, ay } = b;
  for (let i = 0; i < n; i++) {
    vx[i] += 0.5 * dt * ax[i];
    vy[i] += 0.5 * dt * ay[i];
    x[i] += dt * vx[i];
    y[i] += dt * vy[i];
  }
  const interactions = accelerate(t, b, theta, G, eps);
  for (let i = 0; i < n; i++) {
    vx[i] += 0.5 * dt * ax[i];
    vy[i] += 0.5 * dt * ay[i];
  }
  return interactions;
}

/** Direct-summation softened acceleration on body i (the reference the tree approximates). */
export function directAccel(b: Bodies, i: number, G: number, eps: number,
  out: Float64Array): void {
  const e2 = eps * eps;
  let ax = 0;
  let ay = 0;
  for (let j = 0; j < b.n; j++) {
    if (j === i) continue;
    const dx = b.x[j] - b.x[i];
    const dy = b.y[j] - b.y[i];
    const r2 = dx * dx + dy * dy + e2;
    const f = (G * b.m[j]) / (r2 * Math.sqrt(r2));
    ax += dx * f;
    ay += dy * f;
  }
  out[0] = ax;
  out[1] = ay;
}
