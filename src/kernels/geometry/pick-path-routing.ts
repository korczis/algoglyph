import { dots, poly, rect, type GeometryKernel, type Mark, type Pt, type Warehouse } from '../../engines/geometry/trace';

type Loc = { aisle: number; y: number };

/** Shortest walk between two locations of a single-block warehouse with a front cross aisle at
 * y = 0 and a back one at y = L: along the aisle, or out through the nearer end and back in. */
function walk(w: Warehouse, p: Loc, q: Loc): Pt[] {
  const P = { x: w.aisles[p.aisle], y: p.y }; const Q = { x: w.aisles[q.aisle], y: q.y };
  if (p.aisle === q.aisle) return [P, Q];
  const end = p.y + q.y <= 2 * w.length - p.y - q.y ? 0 : w.length;
  return [P, { x: P.x, y: end }, { x: Q.x, y: end }, Q];
}

const lengthOf = (r: Pt[]) => r.reduce((s, p, i) => (i ? s + Math.abs(p.x - r[i - 1].x) + Math.abs(p.y - r[i - 1].y) : 0), 0);

function join(parts: Pt[][]): Pt[] {
  const out: Pt[] = [];
  for (const part of parts) for (const p of part) {
    const l = out[out.length - 1];
    if (!l || l.x !== p.x || l.y !== p.y) out.push(p);
  }
  return out;
}

/** S-shape: every aisle with a pick is walked end to end, alternating direction; with an odd
 * number of such aisles the last one is entered from the front and left the same way. */
export function sShape(w: Warehouse, picks: Loc[]): Pt[] {
  const D = w.depot; const L = w.length;
  const aisles = [...new Set(picks.map((p) => p.aisle))].sort((a, b) => a - b);
  const r: Pt[] = [D];
  if (!aisles.length) return r;
  let back = false;
  aisles.forEach((a, i) => {
    const x = w.aisles[a];
    if (i === aisles.length - 1 && aisles.length % 2 === 1) {
      const far = Math.max(...picks.filter((p) => p.aisle === a).map((p) => p.y));
      r.push({ x, y: 0 }, { x, y: far }, { x, y: 0 });
    } else {
      r.push({ x, y: back ? L : 0 }, { x, y: back ? 0 : L });
      back = !back;
    }
  });
  r.push(D);
  return join([r]);
}

/** Largest gap: the first and last aisles with picks are walked end to end; every aisle between
 * is entered from the back down to its largest gap and from the front up to it, never across. */
export function largestGap(w: Warehouse, picks: Loc[]): Pt[] {
  const D = w.depot; const L = w.length;
  const aisles = [...new Set(picks.map((p) => p.aisle))].sort((a, b) => a - b);
  if (aisles.length <= 1) return sShape(w, picks);
  const split = new Map<number, { front: number; back: number }>();
  for (const a of aisles.slice(1, -1)) {
    const ys = picks.filter((p) => p.aisle === a).map((p) => p.y).sort((u, v) => u - v);
    const bounds = [0, ...ys, L];
    let j = 0;
    for (let i = 1; i < bounds.length - 1; i++) if (bounds[i + 1] - bounds[i] > bounds[j + 1] - bounds[j]) j = i;
    // the gap is (bounds[j], bounds[j + 1]): picks at or below bounds[j] from the front
    split.set(a, { front: bounds[j], back: bounds[j + 1] });
  }
  const first = w.aisles[aisles[0]]; const last = w.aisles[aisles[aisles.length - 1]];
  const r: Pt[] = [D, { x: first, y: 0 }, { x: first, y: L }];
  for (const a of aisles.slice(1, -1)) {
    const x = w.aisles[a]; const s = split.get(a)!;
    r.push({ x, y: L });
    if (s.back < L) r.push({ x, y: s.back }, { x, y: L });
  }
  r.push({ x: last, y: L }, { x: last, y: 0 });
  for (const a of aisles.slice(1, -1).reverse()) {
    const x = w.aisles[a]; const s = split.get(a)!;
    r.push({ x, y: 0 });
    if (s.front > 0) r.push({ x, y: s.front }, { x, y: 0 });
  }
  r.push(D);
  return join([r]);
}

/** The shortest tour from the depot through every pick and back, by Held and Karp's dynamic
 * programme over subsets of picks; distances are the shortest walks between locations. */
export function* optimal(count: (key: string) => void, w: Warehouse, picks: Loc[]): Generator<unknown, Pt[]> {
  const m = picks.length;
  const D: Loc = { aisle: 0, y: 0 };
  if (!m) return [w.depot];
  const locs = [...picks, D]; // the depot is index m
  const dist = locs.map((p) => locs.map((q) => { count('dist'); return lengthOf(walk(w, p, q)); }));
  const full = 1 << m;
  const best = new Float64Array(full * m).fill(Infinity);
  const from = new Int32Array(full * m).fill(-1);
  for (let j = 0; j < m; j++) best[(1 << j) * m + j] = dist[m][j];
  for (let S = 1; S < full; S++) {
    if ((S & 63) === 0) yield;
    for (let j = 0; j < m; j++) {
      if (!(S & (1 << j))) continue;
      const v = best[S * m + j];
      if (v === Infinity) continue;
      count('state');
      for (let k = 0; k < m; k++) {
        if (S & (1 << k)) continue;
        const T = S | (1 << k);
        const c = v + dist[j][k];
        if (c < best[T * m + k]) { best[T * m + k] = c; from[T * m + k] = j; }
      }
    }
  }
  let end = 0; let total = Infinity;
  for (let j = 0; j < m; j++) { const c = best[(full - 1) * m + j] + dist[j][m]; if (c < total) { total = c; end = j; } }
  const order: number[] = [];
  for (let S = full - 1, j = end; j >= 0;) { order.push(j); const p = from[S * m + j]; S &= ~(1 << j); j = p; }
  order.reverse();
  const stops = [D, ...order.map((i) => picks[i]), D];
  return join(stops.slice(1).map((q, i) => walk(w, stops[i], q)));
}

const STRATEGIES = ['S-shape', 'Largest gap', 'Optimal'];

// A picker starts at the depot, collects every item on the list and returns. Two classical
// heuristics fix the route by rule (S-shape, largest gap); the optimal route is found exactly by
// dynamic programming over subsets of the list, which is why the list is kept short.
export const kernel: GeometryKernel = {
  task: 'pick-path',
  input: 'warehouse',
  n: { min: 1, max: 12, value: 10, step: 1, label: 'Picks' },
  params: [{ kind: 'range', key: 'aisles', label: 'Aisles', min: 2, max: 12, step: 1, value: 8 }],
  counters: [['state', 'Dynamic-programme states'], ['dist', 'Shortest walks computed']],
  *run(g) {
    const w = g.input.warehouse as Warehouse;
    const picks = w.picks;
    const L = w.length;
    const base: Mark[] = [];
    for (const x of w.aisles) {
      base.push(rect({ x0: x - 18 - w.rack, y0: 0, x1: x - 18, y1: L }, { fill: true, a: 40 }));
      base.push(rect({ x0: x + 18, y0: 0, x1: x + 18 + w.rack, y1: L }, { fill: true, a: 40 }));
    }
    base.push(rect({ x0: w.depot.x - 14, y0: -44, x1: w.depot.x + 14, y1: -16 }, { fill: true, c: 0.05 }));
    base.push({ t: 'x', x: w.depot.x + 22, y: -30, s: 'depot', a: 200 });
    const pickPts = picks.map((p) => ({ x: w.aisles[p.aisle], y: p.y }));
    base.push(...dots(pickPts, { r: 4.5 }));
    g.base(base);
    const routes = [sShape(w, picks), largestGap(w, picks), yield* optimal((k) => g.count(k), w, picks)];
    const lengths = routes.map(lengthOf);
    const colours = [0.05, 0.4, 0.8];
    const offset = [-7, 0, 7];
    const shifted = (r: Pt[], i: number) => r.map((p) => ({ x: p.x + offset[i], y: p.y }));
    const partial = (r: Pt[], t: number): Pt[] => {
      const out: Pt[] = [r[0]];
      let left = t;
      for (let i = 1; i < r.length && left > 0; i++) {
        const seg = Math.abs(r[i].x - r[i - 1].x) + Math.abs(r[i].y - r[i - 1].y);
        if (seg <= left) { out.push(r[i]); left -= seg; } else {
          const u = left / seg;
          out.push({ x: r[i - 1].x + u * (r[i].x - r[i - 1].x), y: r[i - 1].y + u * (r[i].y - r[i - 1].y) });
          left = 0;
        }
      }
      return out;
    };
    const done: Mark[] = [];
    for (const [i, r] of routes.entries()) {
      const steps = 60;
      for (let s = 1; s <= steps; s++) {
        const t = (lengths[i] * s) / steps;
        g.frame(() => [...done, poly(shifted(partial(r, t), i), { c: colours[i], w: 2.5 })], `${STRATEGIES[i]}: ${t.toFixed(0)} walked`);
      }
      done.push(poly(shifted(r, i), { c: colours[i], w: 2, a: 200 }));
      yield;
    }
    g.last(() => done.slice(), 'three routes through the same list');
    // the same three strategies on the first m picks of this list, m = 1 … n (not counted:
    // the readouts are the work of the full list)
    const series = STRATEGIES.map((name) => ({ name, points: [] as [number, number][] }));
    for (let m = 1; m <= picks.length; m++) {
      const sub = picks.slice(0, m);
      const rs = [sShape(w, sub), largestGap(w, sub), yield* optimal(() => {}, w, sub)];
      rs.forEach((r, i) => series[i].points.push([m, lengthOf(r)]));
    }
    const opt = lengths[2];
    return {
      result: { routes, lengths },
      rows: STRATEGIES.map((s, i) => ({ label: s, value: `${lengths[i].toFixed(0)} walked${i < 2 && opt > 0 ? ` · ${(100 * (lengths[i] / opt - 1)).toFixed(1)}% over optimal` : ''}` })),
      chart: { title: 'Route length as the pick list grows', x: { label: 'picks on the list' }, y: { label: 'distance walked' }, series },
    };
  },
};
