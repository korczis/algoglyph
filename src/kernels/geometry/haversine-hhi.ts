import type { GeometryKernel, Mark } from '../../engines/geometry/trace';
import { bearing, EARTH_KM, haversine } from './_geo';

const RINGS = [5, 10, 20, 30, 45, 60];
const STEPS = 120;

/** Herfindahl–Hirschman index of the given sizes: the sum of squared percentage shares. */
function hhi(sizes: number[]): number {
  const total = sizes.reduce((s, v) => s + v, 0);
  return total > 0 ? sizes.reduce((s, v) => s + (100 * v / total) ** 2, 0) : 0;
}

// Each competitor's great-circle distance from the centre comes from the haversine formula; a
// ring of radius r holds the competitors within r, and their shares of the ring's total size
// give its Herfindahl–Hirschman index. Competitors are drawn at their true distance and initial
// bearing (an azimuthal equidistant view), so the rings are exact circles.
export const kernel: GeometryKernel = {
  task: 'rings',
  input: 'firms',
  n: { min: 2, max: 400, value: 60, step: 1, label: 'Competitors' },
  counters: [['haversine', 'Haversine evaluations'], ['bearing', 'Bearings'], ['compare', 'Ring membership tests']],
  *run(g) {
    const F = g.input.firms;
    const C = g.input.centre;
    const R = 66;
    g.view({ x0: -R * 1.6, y0: -R, x1: R * 1.6, y1: R });
    const d: number[] = []; const xy: { x: number; y: number }[] = [];
    for (const f of F) {
      g.count('haversine');
      const km = haversine(C.lat, C.lon, f.lat, f.lon);
      g.count('bearing');
      const b = bearing(C.lat, C.lon, f.lat, f.lon);
      d.push(km);
      xy.push({ x: km * Math.sin(b), y: km * Math.cos(b) });
    }
    const wmax = Math.max(1e-9, ...F.map((f) => f.weight));
    const firm = (i: number, lit: boolean): Mark => ({ t: 'p', x: xy[i].x, y: xy[i].y, r: 1.5 + 5 * Math.sqrt(F[i].weight / wmax), c: lit ? 0.15 + 0.7 * Math.sqrt(F[i].weight / wmax) : undefined, a: lit ? 230 : 70 });
    const rings: Mark[] = RINGS.flatMap((r): Mark[] => [{ t: 'o', x: 0, y: 0, rad: r, w: 0.8, a: 70 }, { t: 'x', x: r * Math.SQRT1_2 + 1, y: r * Math.SQRT1_2 + 1, s: `${r} km`, a: 150 }]);
    g.base([...rings, { t: 'p', x: 0, y: 0, r: 3 }]);
    const curve: [number, number][] = [];
    const byRing: [number, number, number][] = [];
    for (let s = 1; s <= STEPS; s++) {
      yield;
      const r = (RINGS[RINGS.length - 1] * s) / STEPS;
      const inside = F.map((_, i) => i).filter((i) => !g.less(r, d[i]));
      const h = hhi(inside.map((i) => F[i].weight));
      curve.push([Number(r.toFixed(2)), Number(h.toFixed(1))]);
      g.frame(() => [{ t: 'o', x: 0, y: 0, rad: r, w: 2, c: 0.85 }, ...F.map((_, i) => firm(i, d[i] <= r)),
        { t: 'x', x: -R * 1.55, y: R * 0.9, s: `r = ${r.toFixed(1)} km   ${inside.length} inside   HHI ${h.toFixed(0)}`, a: 220 }], 'grow the radius');
    }
    for (const r of RINGS) {
      const inside = F.map((_, i) => i).filter((i) => d[i] <= r);
      byRing.push([r, inside.length, hhi(inside.map((i) => F[i].weight))]);
    }
    g.last(() => [...F.map((_, i) => firm(i, true)), ...byRing.map(([r, , h]): Mark => ({ t: 'x', x: -r * Math.SQRT1_2 - 1, y: -r * Math.SQRT1_2 - 1, s: `${h.toFixed(0)}`, align: 'r', c: 0.85 }))], 'HHI of every ring');
    return {
      result: { distances: d, rings: byRing, radius: EARTH_KM },
      rows: [
        ...byRing.map(([r, k, h]) => ({ label: `Within ${r} km`, value: `${k} competitors · HHI ${h.toFixed(0)} · ${h > 0 ? (10000 / h).toFixed(1) : '—'} equal-size equivalents` })),
        { label: 'Farthest competitor', value: `${Math.max(0, ...d).toFixed(1)} km` },
      ],
      chart: { title: 'Concentration as the radius grows', x: { label: 'radius (km)' }, y: { label: 'HHI' }, series: [{ name: 'HHI', points: curve }] },
    };
  },
};
