import { dots, line, type GeometryKernel, type Mark, type Pt } from '../../engines/geometry/trace';

/** d inside the circle through a, b, c (counter-clockwise): positive. Exact on integer input. */
function inCircle(a: Pt, b: Pt, c: Pt, d: Pt): number {
  const ax = a.x - d.x; const ay = a.y - d.y;
  const bx = b.x - d.x; const by = b.y - d.y;
  const cx = c.x - d.x; const cy = c.y - d.y;
  return (ax * ax + ay * ay) * (bx * cy - by * cx) - (bx * bx + by * by) * (ax * cy - ay * cx)
    + (cx * cx + cy * cy) * (ax * by - ay * bx);
}

function circumcentre(a: Pt, b: Pt, c: Pt): Pt {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const a2 = a.x * a.x + a.y * a.y; const b2 = b.x * b.x + b.y * b.y; const c2 = c.x * c.x + c.y * c.y;
  return { x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d, y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d };
}

// Lawson's incremental Delaunay triangulation, inserting points in x order so that each new
// point lies outside the hull built so far: it is joined to every hull edge it can see, and each
// edge opposite it is flipped while the point across lies inside its triangle's circumcircle.
// The Voronoi diagram is the dual: one vertex per triangle (its circumcentre), one edge per
// triangulation edge.
export const kernel: GeometryKernel = {
  task: 'delaunay',
  input: 'points',
  shapes: ['uniform', 'clustered', 'disk', 'lattice'],
  n: { min: 3, max: 350, value: 90, step: 1 },
  counters: [['incircle', 'In-circle tests'], ['orient', 'Orientation tests'], ['flip', 'Edge flips'], ['compare', 'Sort comparisons']],
  scaling: [32, 64, 128, 256, 512, 1024, 2048],
  *run(g) {
    const P = g.input.points;
    const n = P.length;
    g.base(dots(P, { a: 170, r: 2.2 }));
    const order = P.map((_, i) => i).sort((a, b) => (g.less(P[a].x, P[b].x) ? -1 : g.less(P[b].x, P[a].x) ? 1 : g.less(P[a].y, P[b].y) ? -1 : 1));
    const tri = new Map<number, number>(); // edge a→b → the third vertex of the triangle on its left
    const add = (a: number, b: number, c: number) => { tri.set(a * n + b, c); tri.set(b * n + c, a); tri.set(c * n + a, b); };
    const del = (a: number, b: number, c: number) => { tri.delete(a * n + b); tri.delete(b * n + c); tri.delete(c * n + a); };
    const edges = (): Mark[] => {
      const out: Mark[] = [];
      for (const [k] of tri) {
        const a = Math.floor(k / n); const b = k % n;
        if (a < b || !tri.has(b * n + a)) out.push(line(P[a], P[b], { c: 0.75, w: 1, a: 200 }));
      }
      return out;
    };
    const legalize = function* (a: number, b: number, p: number): Generator<unknown, void> {
      const d = tri.get(b * n + a);
      if (d === undefined) return;
      g.count('incircle');
      if (inCircle(P[a], P[b], P[p], P[d]) <= 0) return;
      g.count('flip');
      del(a, b, p); del(b, a, d);
      add(a, d, p); add(d, b, p);
      g.frame(() => [...edges(), line(P[p], P[d], { c: 0.05, w: 2.5 })], 'flip an illegal edge');
      yield;
      yield* legalize(a, d, p);
      yield* legalize(d, b, p);
    };
    const next = new Int32Array(n).fill(-1);
    const prev = new Int32Array(n).fill(-1);
    let m = 2;
    while (m < n && g.orient(P[order[0]], P[order[1]], P[order[m]]) === 0) m++;
    if (m < n) {
      const apex = order[m];
      const left = g.orient(P[order[0]], P[order[1]], P[apex]) > 0;
      for (let i = 0; i + 1 < m; i++) {
        const a = order[i]; const b = order[i + 1];
        if (left) add(a, b, apex); else add(b, a, apex);
      }
      const ring = left ? [...order.slice(0, m), apex] : [...order.slice(0, m).reverse(), apex];
      ring.forEach((v, i) => { next[v] = ring[(i + 1) % ring.length]; prev[ring[(i + 1) % ring.length]] = v; });
      g.frame(edges, 'first triangles');
      for (let k = m + 1; k < n; k++) {
        const q = order[k];
        const sees = (u: number) => g.orient(P[u], P[next[u]], P[q]) < 0;
        let u = order[k - 1];
        if (!sees(u) && !sees(prev[u])) {
          // fall back to a walk round the hull for a visible edge
          let w = next[u];
          while (w !== u && !sees(w)) w = next[w];
          u = w;
        } else if (!sees(u)) u = prev[u];
        let L = u; let R = next[u];
        while (sees(prev[L]) && prev[L] !== R) L = prev[L];
        while (sees(R) && next[R] !== L) R = next[R];
        const fan: [number, number][] = [];
        for (let e = L; e !== R; e = next[e]) fan.push([e, next[e]]);
        for (const [e, f] of fan) add(f, e, q);
        for (const [e, f] of fan) yield* legalize(f, e, q);
        next[L] = q; prev[q] = L; next[q] = R; prev[R] = q;
        g.frame(() => [...edges(), ...dots([P[q]], { c: 0.05, r: 4.5 })], 'insert, join to the visible hull edges');
        yield;
      }
    }
    const triangles: [number, number, number][] = [];
    if (!g.recording) {
      // a measuring run: the triangulation is the work; its drawing would be waste
      for (const [k, c] of tri) { const a = Math.floor(k / n); const b = k % n; if (a < b && a < c) triangles.push([a, b, c]); }
      return { result: { triangles } };
    }
    for (const [k, c] of tri) {
      const a = Math.floor(k / n); const b = k % n;
      if (a < b && a < c) triangles.push([a, b, c]);
    }
    // the dual: circumcentres joined across every edge, rays out of the hull edges
    const cc = new Map<number, Pt>();
    const centre = (a: number, b: number, c: number) => {
      const key = Math.min(a * n * n + b * n + c, b * n * n + c * n + a, c * n * n + a * n + b);
      let v = cc.get(key);
      if (!v) { v = circumcentre(P[a], P[b], P[c]); cc.set(key, v); }
      return v;
    };
    const vor: Mark[] = [];
    const far = 4 * (g.input.box.x1 - g.input.box.x0);
    let done = 0;
    for (const [k, c] of tri) {
      if (++done % 256 === 0) yield;
      const a = Math.floor(k / n); const b = k % n;
      const d = tri.get(b * n + a);
      const o = centre(a, b, c);
      if (d === undefined) {
        // hull edge a→b with the hull on its left: the ray leaves to the right
        const ex = P[b].x - P[a].x; const ey = P[b].y - P[a].y; const l = Math.hypot(ex, ey) || 1;
        vor.push(line(o, { x: o.x + (ey / l) * far, y: o.y - (ex / l) * far }, { c: 0.1, w: 1.6 }));
      } else if (a < b) vor.push(line(o, centre(b, a, d), { c: 0.1, w: 1.6 }));
    }
    const delaunay = edges().map((mk) => ({ ...mk, a: 70 }));
    for (let i = 1; i <= 24; i++) {
      const cut = Math.ceil((vor.length * i) / 24);
      g.frame(() => [...delaunay, ...vor.slice(0, cut)], 'the dual: Voronoi edges between circumcentres');
      yield;
    }
    g.last(() => [...delaunay, ...vor, ...dots(P, { c: 0.1, r: 2.6 })], 'Delaunay triangulation and Voronoi diagram');
    return {
      result: { triangles },
      rows: [{ label: 'Triangles', value: String(triangles.length) }, { label: 'Voronoi vertices', value: String(cc.size) }],
    };
  },
};
