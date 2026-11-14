// Incremental Delaunay triangulation (Bowyer–Watson) on an integer lattice: the site's one
// triangulation, drawn by the bowyer-watson-delaunay plate and used by euclidean-mst's kernel.
//
// Robustness: every vertex lies on the lattice [0, side)², side at most LATTICE, so coordinate
// differences stay below 2^12. The orientation determinant is then below 2^25 and every term of
// the in-circle determinant below 2^50, so both are evaluated exactly in double precision: a tie
// (collinear or cocircular points) comes out as exactly zero and is decided by a fixed rule, never
// by rounding. A smaller side only makes the numbers smaller; a larger one would lose exactness.
//
// The super-triangle is pushed to infinity: one symbolic vertex INF closes every hull edge
// into a ghost triangle whose "circumcircle" is the open half-plane beyond that edge (plus the
// open edge itself). That is the limit of a finite super-triangle whose corners recede, without
// the classic failure of a finite one, whose circles bulge across hull edges and lose them.

/** The largest lattice side on which both predicates stay exact, and the default. */
export const LATTICE = 4096;
export const INF = -1;

/** Twice the signed area of (a, b, c): positive when counter-clockwise (y up). Exact. */
export function orient(ax: number, ay: number, bx: number, by: number, cx: number,
  cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** Positive when d lies strictly inside the circle through counter-clockwise a, b, c. Exact. */
export function inCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
  dx: number, dy: number): number {
  const adx = ax - dx;
  const ady = ay - dy;
  const bdx = bx - dx;
  const bdy = by - dy;
  const cdx = cx - dx;
  const cdy = cy - dy;
  const al = adx * adx + ady * ady;
  const bl = bdx * bdx + bdy * bdy;
  const cl = cdx * cdx + cdy * cdy;
  return al * (bdx * cdy - bdy * cdx) + bl * (cdx * ady - cdy * adx)
    + cl * (adx * bdy - ady * bdx);
}

/** Circumcentre of a, b, c (floating point; used for drawing and the Voronoi dual only). */
export function circumcentre(ax: number, ay: number, bx: number, by: number, cx: number,
  cy: number): [number, number] {
  const bxr = bx - ax;
  const byr = by - ay;
  const cxr = cx - ax;
  const cyr = cy - ay;
  const d = 2 * (bxr * cyr - byr * cxr);
  const b2 = bxr * bxr + byr * byr;
  const c2 = cxr * cxr + cyr * cyr;
  return [ax + (cyr * b2 - byr * c2) / d, ay + (bxr * c2 - cxr * b2) / d];
}

/** Smallest interior angle of a triangle, in radians. */
export function minAngle(ax: number, ay: number, bx: number, by: number, cx: number,
  cy: number): number {
  const a2 = (bx - cx) ** 2 + (by - cy) ** 2;
  const b2 = (ax - cx) ** 2 + (ay - cy) ** 2;
  const c2 = (ax - bx) ** 2 + (ay - by) ** 2;
  // the smallest angle is opposite the shortest side
  const [s, u, v] = a2 <= b2 && a2 <= c2 ? [a2, b2, c2] : b2 <= c2 ? [b2, a2, c2] : [c2, a2, b2];
  const cos = (u + v - s) / (2 * Math.sqrt(u * v));
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

export interface Insertion {
  vertex: number;
  /** Vertex triples of the real triangles removed (the cavity), flattened. */
  removed: number[];
  /** Vertex triples of the real triangles created (the fan around the new vertex). */
  created: number[];
  /** Triangles stepped through while locating the point. */
  walk: number;
  /** Triangles tested against the point while growing the cavity. */
  tested: number;
}

/**
 * Triangles are stored as vertex triples (counter-clockwise) with, for each corner k, the
 * neighbour across the edge opposite that corner. Dead slots are recycled.
 */
export class Delaunay {
  readonly xs: number[] = [];
  readonly ys: number[] = [];
  readonly tv: number[] = [];
  readonly tn: number[] = [];
  readonly alive: boolean[] = [];
  private readonly free: number[] = [];
  private readonly mark: number[] = [];
  private stamp = 0;
  private last = -1;
  private ready = false;
  /** Insertions after the first triangle, and their summed walk and conflict tests. */
  insertions = 0;
  visited = 0;
  duplicates = 0;

  /** `side`: the lattice is [0, side)², an integer from 1 to LATTICE. */
  constructor(readonly side: number = LATTICE) {
    if (!Number.isInteger(side) || side < 1 || side > LATTICE) {
      throw new RangeError(
        `Delaunay: a lattice side of ${side} is not an integer from 1 to ${LATTICE}`);
    }
  }

  get vertices(): number {
    return this.xs.length;
  }

  /** Insert a lattice point; returns null for a duplicate. Throws outside the lattice. */
  insert(x: number, y: number): Insertion | null {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.side
      || y >= this.side) {
      throw new RangeError(`Delaunay: (${x}, ${y}) is not a point of the ${this.side}² lattice`);
    }
    if (!this.ready) return this.insertFlat(x, y);
    return this.insertVertex(x, y);
  }

  /** Before three points span the plane: collect collinear points, then seed the mesh. */
  private insertFlat(x: number, y: number): Insertion | null {
    const n = this.xs.length;
    for (let i = 0; i < n; i++) {
      if (this.xs[i] === x && this.ys[i] === y) {
        this.duplicates++;
        return null;
      }
    }
    const id = n;
    this.xs.push(x);
    this.ys.push(y);
    if (n < 2) return { vertex: id, removed: [], created: [], walk: 0, tested: 0 };
    const o = orient(this.xs[0], this.ys[0], this.xs[1], this.ys[1], x, y);
    if (o === 0) return { vertex: id, removed: [], created: [], walk: 0, tested: 0 };
    const [a, b] = o > 0 ? [0, 1] : [1, 0];
    const t = this.alloc(a, b, id);
    const g0 = this.alloc(b, a, INF);
    const g1 = this.alloc(id, b, INF);
    const g2 = this.alloc(a, id, INF);
    // t's edges: opposite a is (b, id), opposite b is (id, a), opposite id is (a, b)
    this.link(t, 0, g1, 2);
    this.link(t, 1, g2, 2);
    this.link(t, 2, g0, 2);
    // ghosts share the edges to INF: g0 = (b, a, INF), g1 = (id, b, INF), g2 = (a, id, INF)
    this.link(g0, 0, g2, 1);
    this.link(g0, 1, g1, 0);
    this.link(g1, 1, g2, 0);
    this.ready = true;
    this.last = t;
    // the collinear points collected so far go in through the ordinary insertion; this point
    // created every triangle there now is, and none existed before it to be removed
    let walk = 0;
    let tested = 0;
    for (let i = 2; i < n; i++) {
      const ins = this.insertVertex(this.xs[i], this.ys[i], i);
      if (ins) {
        walk += ins.walk;
        tested += ins.tested;
      }
    }
    return { vertex: id, removed: [], created: this.triangles(), walk, tested };
  }

  private alloc(a: number, b: number, c: number): number {
    const t = this.free.length ? (this.free.pop() as number) : this.alive.length;
    this.tv[3 * t] = a;
    this.tv[3 * t + 1] = b;
    this.tv[3 * t + 2] = c;
    this.tn[3 * t] = this.tn[3 * t + 1] = this.tn[3 * t + 2] = -1;
    this.alive[t] = true;
    this.mark[t] = 0;
    return t;
  }

  private link(t: number, k: number, u: number, j: number): void {
    this.tn[3 * t + k] = u;
    this.tn[3 * u + j] = t;
  }

  ghost(t: number): boolean {
    return this.tv[3 * t] === INF || this.tv[3 * t + 1] === INF || this.tv[3 * t + 2] === INF;
  }

  /** Is (x, y) inside the circumcircle of t (for a ghost: beyond its hull edge)? */
  conflict(t: number, x: number, y: number): boolean {
    const v = this.tv;
    const a = v[3 * t];
    const b = v[3 * t + 1];
    const c = v[3 * t + 2];
    const X = this.xs;
    const Y = this.ys;
    if (a !== INF && b !== INF && c !== INF) {
      return inCircle(X[a], Y[a], X[b], Y[b], X[c], Y[c], x, y) > 0;
    }
    // rotate so that the hull edge (p, q) comes first and INF last
    const [p, q] = a === INF ? [b, c] : b === INF ? [c, a] : [a, b];
    const o = orient(X[p], Y[p], X[q], Y[q], x, y);
    if (o !== 0) return o > 0;
    // on the hull edge's line: in conflict only strictly between its endpoints
    return (x - X[p]) * (X[q] - X[p]) + (y - Y[p]) * (Y[q] - Y[p]) > 0
      && (x - X[q]) * (X[p] - X[q]) + (y - Y[q]) * (Y[p] - Y[q]) > 0;
  }

  /** Visibility walk to a triangle whose closure holds (x, y); a ghost when outside the hull. */
  private locate(x: number, y: number): { t: number; steps: number } {
    let t = this.last;
    if (t < 0 || !this.alive[t]) t = this.alive.findIndex((a, i) => a && !this.ghost(i));
    const v = this.tv;
    const X = this.xs;
    const Y = this.ys;
    const cap = 4 * this.alive.length + 16;
    for (let steps = 1; steps <= cap; steps++) {
      if (this.ghost(t)) return { t, steps };
      let next = -1;
      for (let j = 0; j < 3; j++) {
        // rotate the first edge tried so the walk cannot be steered into a fixed pattern
        const k = (j + steps) % 3;
        const a = v[3 * t + (k + 1) % 3];
        const b = v[3 * t + (k + 2) % 3];
        if (orient(X[a], Y[a], X[b], Y[b], x, y) < 0) {
          next = this.tn[3 * t + k];
          break;
        }
      }
      if (next < 0) return { t, steps };
      t = next;
    }
    // unreachable for a Delaunay triangulation (the visibility walk is acyclic there); kept
    // as a guard: brute force over every triangle
    for (let u = 0; u < this.alive.length; u++) {
      if (!this.alive[u] || this.ghost(u)) continue;
      const a = v[3 * u];
      const b = v[3 * u + 1];
      const c = v[3 * u + 2];
      if (orient(X[a], Y[a], X[b], Y[b], x, y) >= 0 && orient(X[b], Y[b], X[c], Y[c], x, y) >= 0
        && orient(X[c], Y[c], X[a], Y[a], x, y) >= 0) return { t: u, steps: cap + u };
    }
    const g = this.alive.findIndex((a, i) => a && this.ghost(i) && this.conflict(i, x, y));
    return { t: g, steps: cap + this.alive.length };
  }

  /** `known` is the id of a vertex already stored (collected while the points were flat). */
  private insertVertex(x: number, y: number, known = -1): Insertion | null {
    const { t: start, steps } = this.locate(x, y);
    const v = this.tv;
    if (!this.ghost(start)) {
      for (let k = 0; k < 3; k++) {
        const w = v[3 * start + k];
        if (this.xs[w] === x && this.ys[w] === y) {
          this.duplicates++;
          return null;
        }
      }
    }
    const id = known >= 0 ? known : this.xs.length;
    if (known < 0) {
      this.xs.push(x);
      this.ys.push(y);
    }

    // grow the cavity: every triangle whose circumcircle strictly contains the point. That set
    // is connected and contains the located triangle, so a search from it finds all of it.
    const inside = ++this.stamp;
    const seen = ++this.stamp;
    const cavity = [start];
    this.mark[start] = inside;
    let tested = 1;
    for (let i = 0; i < cavity.length; i++) {
      const t = cavity[i];
      for (let k = 0; k < 3; k++) {
        const u = this.tn[3 * t + k];
        if (this.mark[u] === inside || this.mark[u] === seen) continue;
        tested++;
        if (this.conflict(u, x, y)) {
          this.mark[u] = inside;
          cavity.push(u);
        } else this.mark[u] = seen;
      }
    }

    const removed: number[] = [];
    const boundary: number[] = [];
    for (const t of cavity) {
      if (!this.ghost(t)) removed.push(v[3 * t], v[3 * t + 1], v[3 * t + 2]);
      for (let k = 0; k < 3; k++) {
        const u = this.tn[3 * t + k];
        if (this.mark[u] === inside) continue;
        boundary.push(v[3 * t + (k + 1) % 3], v[3 * t + (k + 2) % 3], u);
      }
    }
    for (const t of cavity) {
      this.alive[t] = false;
      this.free.push(t);
    }

    // star the cavity from the new vertex: one triangle (a, b, id) per boundary edge (a, b)
    const byFirst = new Map<number, number>();
    const fan: number[] = [];
    const created: number[] = [];
    for (let i = 0; i < boundary.length; i += 3) {
      const a = boundary[i];
      const b = boundary[i + 1];
      const out = boundary[i + 2];
      const t = this.alloc(a, b, id);
      fan.push(t);
      byFirst.set(a, t);
      // the outside neighbour's corner opposite this edge is its vertex that is neither a nor b
      for (let j = 0; j < 3; j++) {
        const w = v[3 * out + j];
        if (w !== a && w !== b) {
          this.link(t, 2, out, j);
          break;
        }
      }
      if (a !== INF && b !== INF) {
        created.push(a, b, id);
        this.last = t;
      }
    }
    for (const t of fan) {
      // edge (b, id) of (a, b, id) is edge (id, b) of the fan triangle that starts at b
      const u = byFirst.get(v[3 * t + 1]) as number;
      this.link(t, 0, u, 1);
    }

    this.insertions++;
    this.visited += steps + tested;
    return { vertex: id, removed, created, walk: steps, tested };
  }

  /** Live real triangles as vertex triples, flattened. */
  triangles(): number[] {
    const out: number[] = [];
    for (let t = 0; t < this.alive.length; t++) {
      if (!this.alive[t] || this.ghost(t)) continue;
      out.push(this.tv[3 * t], this.tv[3 * t + 1], this.tv[3 * t + 2]);
    }
    return out;
  }

  /**
   * Every real edge once, flattened as (a, b, left, right): the triangle on its left and the one
   * on its right, right = -1 on the hull. Pass `out` to reuse an array across frames.
   */
  edges(out: number[] = []): number[] {
    out.length = 0;
    for (let t = 0; t < this.alive.length; t++) {
      if (!this.alive[t] || this.ghost(t)) continue;
      for (let k = 0; k < 3; k++) {
        const u = this.tn[3 * t + k];
        const hullEdge = this.ghost(u);
        if (!hullEdge && u < t) continue;
        out.push(this.tv[3 * t + (k + 1) % 3], this.tv[3 * t + (k + 2) % 3], t, hullEdge ? -1 : u);
      }
    }
    return out;
  }

  /** Counts read from the mesh: triangles, edges (each once), hull edges (ghost triangles). */
  counts(): { triangles: number; edges: number; hull: number } {
    let triangles = 0;
    let hull = 0;
    let edges = 0;
    for (let t = 0; t < this.alive.length; t++) {
      if (!this.alive[t]) continue;
      if (this.ghost(t)) {
        hull++;
        continue;
      }
      triangles++;
      for (let k = 0; k < 3; k++) {
        const u = this.tn[3 * t + k];
        if (this.ghost(u) || u > t) edges++;
      }
    }
    // collinear points only: the triangulation is the path through them
    if (!this.ready) edges = Math.max(0, this.xs.length - 1);
    return { triangles, edges, hull };
  }
}
