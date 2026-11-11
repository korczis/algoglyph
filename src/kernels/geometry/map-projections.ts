import type { Box, GeometryKernel, Mark } from '../../engines/geometry/trace';
import { BESSEL_E2, KROVAK, krovak, mercator, radii, WEB_MERCATOR_R } from './_projections';

const D = Math.PI / 180;
const LAT0 = 48.5; const LAT1 = 51.5; const LON0 = 12; const LON1 = 19;
const STEP = 0.25;
const H = 1e-5; // radians, for the central differences

interface Proj {
  name: string;
  f: (lat: number, lon: number) => [number, number];
  /** Radii of curvature of the surface the projection is measured against. */
  radii: (phi: number) => [number, number];
}

const PROJ: Proj[] = [
  { name: 'Web Mercator, EPSG:3857 (on its sphere)', f: mercator, radii: () => [WEB_MERCATOR_R, WEB_MERCATOR_R] },
  { name: 'Křovák, EPSG:5514 (on Bessel 1841)', f: krovak, radii: (phi) => radii(KROVAK.a, BESSEL_E2, phi) },
];

export interface Distortion { lat: number; lon: number; h: number; k: number; angle: number }

// Each projection is evaluated at the nodes of a graticule over central Europe, and its
// distortion is measured there by central differences: h is the scale along the meridian, k
// along the parallel, each the length of the projected step over the length of the same step
// on the surface; the angle is the one between the projected meridian and parallel.
export const kernel: GeometryKernel = {
  task: 'projections',
  input: 'none',
  counters: [['proj', 'Projection evaluations'], ['node', 'Nodes measured']],
  run(g) {
    const panels: Box[] = [{ x0: 0, y0: 0, x1: 1, y1: 0.78 }, { x0: 1.12, y0: 0, x1: 2.12, y1: 0.78 }];
    g.view({ x0: -0.04, y0: -0.12, x1: 2.16, y1: 0.9 });
    const lats: number[] = []; const lons: number[] = [];
    for (let v = LAT0; v <= LAT1 + 1e-9; v += STEP) lats.push(Number(v.toFixed(4)));
    for (let v = LON0; v <= LON1 + 1e-9; v += STEP) lons.push(Number(v.toFixed(4)));
    const P = (pj: Proj, lat: number, lon: number) => { g.count('proj'); return pj.f(lat, lon); };
    // fit each projection's graticule into its panel
    const fits = PROJ.map((pj, i) => {
      const pts = [...lats.flatMap((la) => [pj.f(la, LON0), pj.f(la, LON1)]), ...lons.flatMap((lo) => [pj.f(LAT0, lo), pj.f(LAT1, lo)])];
      const xs = pts.map((q) => q[0]); const ys = pts.map((q) => q[1]);
      const bx0 = Math.min(...xs); const by0 = Math.min(...ys);
      const s = Math.min((panels[i].x1 - panels[i].x0) / (Math.max(...xs) - bx0), (panels[i].y1 - panels[i].y0) / (Math.max(...ys) - by0));
      return (q: [number, number]) => ({ x: panels[i].x0 + (q[0] - bx0) * s, y: panels[i].y0 + (q[1] - by0) * s });
    });
    const grat: Mark[] = [];
    PROJ.forEach((pj, i) => {
      for (const la of lats) {
        if (Math.abs((la * 2) % 1) > 1e-9) continue;
        grat.push({ t: 'g', pts: lons.flatMap((lo) => { const q = fits[i](pj.f(la, lo)); return [q.x, q.y]; }), w: 0.8, a: 110 });
      }
      for (const lo of lons) {
        if (Math.abs(lo % 1) > 1e-9) continue;
        grat.push({ t: 'g', pts: lats.flatMap((la) => { const q = fits[i](pj.f(la, lo)); return [q.x, q.y]; }), w: 0.8, a: 110 });
      }
      grat.push({ t: 'x', x: panels[i].x0, y: -0.07, s: pj.name, a: 220 });
    });
    g.base(grat);
    const out: Distortion[][] = PROJ.map(() => []);
    const range = PROJ.map(() => ({ lo: Infinity, hi: -Infinity }));
    const nodeMarks = (): Mark[] => out.flatMap((list, i) => list.map((d): Mark => {
      const q = fits[i](PROJ[i].f(d.lat, d.lon));
      const span = range[i].hi - range[i].lo;
      return { t: 'p', x: q.x, y: q.y, r: 3.2, c: span > 0 ? (d.k - range[i].lo) / span : 0.5 };
    }));
    for (const la of lats) {
      for (const lo of lons) {
        for (let i = 0; i < PROJ.length; i++) {
          const pj = PROJ[i];
          const phi = la * D;
          const [M, N] = pj.radii(phi);
          const n1 = P(pj, la + H / D, lo); const s1 = P(pj, la - H / D, lo);
          const e1 = P(pj, la, lo + H / D); const w1 = P(pj, la, lo - H / D);
          const mx = n1[0] - s1[0]; const my = n1[1] - s1[1];
          const px = e1[0] - w1[0]; const py = e1[1] - w1[1];
          const h = Math.hypot(mx, my) / (2 * H * M);
          const k = Math.hypot(px, py) / (2 * H * N * Math.cos(phi));
          const angle = Math.acos((mx * px + my * py) / (Math.hypot(mx, my) * Math.hypot(px, py))) / D;
          g.count('node');
          out[i].push({ lat: la, lon: lo, h, k, angle });
          range[i].lo = Math.min(range[i].lo, k); range[i].hi = Math.max(range[i].hi, k);
        }
        g.frame(nodeMarks, `measure the scale at ${la.toFixed(2)}° N, ${lo.toFixed(2)}° E`);
      }
    }
    g.last(nodeMarks, 'every node measured');
    const stat = (list: Distortion[]) => ({
      kmin: Math.min(...list.map((d) => d.k)), kmax: Math.max(...list.map((d) => d.k)),
      conformal: Math.max(...list.map((d) => Math.abs(d.h / d.k - 1))), angle: Math.max(...list.map((d) => Math.abs(d.angle - 90))),
      area: [Math.min(...list.map((d) => d.h * d.k * Math.sin(d.angle * D))), Math.max(...list.map((d) => d.h * d.k * Math.sin(d.angle * D)))],
    });
    const sMerc = stat(out[0]); const sKro = stat(out[1]);
    const along = (i: number): [number, number][] => out[i].filter((d) => d.lon === 15).map((d) => [d.lat, Number(d.k.toFixed(7))]);
    const ppm = (x: number) => `${((x - 1) * 1e6).toFixed(0)} ppm`;
    return {
      result: { nodes: out, mercator: sMerc, krovak: sKro },
      rows: [
        { label: 'Web Mercator scale k', value: `${sMerc.kmin.toFixed(4)} to ${sMerc.kmax.toFixed(4)}` },
        { label: 'Web Mercator area scale', value: `${sMerc.area[0].toFixed(3)} to ${sMerc.area[1].toFixed(3)}` },
        { label: 'Křovák scale k', value: `${ppm(sKro.kmin)} to ${ppm(sKro.kmax)}` },
        { label: 'Largest |h/k − 1|, Mercator / Křovák', value: `${sMerc.conformal.toExponential(1)} / ${sKro.conformal.toExponential(1)}` },
        { label: 'Largest meridian–parallel angle error', value: `${sMerc.angle.toExponential(1)}° / ${sKro.angle.toExponential(1)}°` },
      ],
      chart: {
        title: 'Scale factor along the meridian 15° E',
        x: { label: 'latitude (°)' },
        y: { label: 'scale factor k' },
        series: [{ name: 'Web Mercator', points: along(0) }, { name: 'Křovák', points: along(1) }],
      },
    };
  },
};
