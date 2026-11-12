import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type PlateCode, type Stat } from '../../core/plate';
import { rgba } from '../_shared/two-slit/draw';
import {
  dipoleAxisSlope, fieldLine, gaussFlux, planeInducedCharge, potential, sphereImage, type Charge,
} from '../_shared/fields/superposition';

type Layout = 'pair' | 'plane' | 'sphere' | 'dipole';

/** Half the width of the view in field units; the height follows the canvas. */
const HALF_W = 4;
/** Field lines start this far from their charge. */
const START = 0.06;
/** The grounded sphere's radius in the sphere layout. */
const SPHERE_R = 1;
const when = (...values: Layout[]) => ({ key: 'layout', values });
const sci = (x: number) => (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(3) : x.toFixed(9));

export const chargesAndFieldLines: PlateCode = {
  id: 'charges-and-field-lines',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'layout', label: 'Charges', value: 'pair', rebuild: true,
      options: [
        { value: 'pair', label: 'Two charges' },
        { value: 'plane', label: 'A charge above a grounded plane' },
        { value: 'sphere', label: 'A charge beside a grounded sphere' },
        { value: 'dipole', label: 'A small dipole, seen from afar' },
      ],
    },
    { kind: 'range', key: 'ratio', label: 'Charge 2 over charge 1', min: -2, max: 2, step: 0.25,
      value: -0.5, rebuild: true, when: when('pair') },
    { kind: 'range', key: 'sep', label: 'Separation (field units)', min: 0.4, max: 3, step: 0.1,
      value: 1.6, rebuild: true, when: when('pair', 'plane', 'sphere') },
    { kind: 'range', key: 'radius', label: 'Gauss sphere radius', min: 0.2, max: 2.5, step: 0.1,
      value: 1.2, rebuild: true, when: when('pair') },
    {
      kind: 'select', key: 'around', label: 'Gauss sphere centred on', value: 'origin', rebuild: true,
      when: when('pair'),
      options: [
        { value: 'origin', label: 'The midpoint' },
        { value: 'charge1', label: 'Charge 1' },
      ],
    },
    { kind: 'range', key: 'lines', label: 'Field lines per unit charge', min: 4, max: 32, step: 2,
      value: 16, rebuild: true },
    { kind: 'toggle', key: 'equipotentials', label: 'Equipotentials', value: true, cosmetic: true },
    paletteParam('spectral'),
  ],
  pace: { kind: 'still', why: 'one static field: its lines are traced once, and readouts are computed from the charges' },
  create(p, ctx) {
    const params = ctx.params;
    let layout: Layout = 'pair';
    let charges: Charge[] = [];
    /** Charges drawn as images (behind a conductor): part of the field, not of the room. */
    let images: Charge[] = [];
    let lines: [number, number][][] = [];
    let rows: Stat[] = [];
    let dragging = -1;
    const halfH = HALF_W * (ctx.height / ctx.width);
    const px = (x: number) => ctx.width / 2 + (x / HALF_W) * (ctx.width / 2);
    const py = (y: number) => ctx.height / 2 - (y / HALF_W) * (ctx.width / 2);
    const wx = (sx: number) => ((sx - ctx.width / 2) / (ctx.width / 2)) * HALF_W;
    const wy = (sy: number) => -((sy - ctx.height / 2) / (ctx.width / 2)) * HALF_W;

    function build() {
      const sep = num(params, 'sep');
      images = [];
      if (layout === 'pair') {
        charges = [{ x: -sep / 2, y: 0, q: 1 }, { x: sep / 2, y: 0, q: num(params, 'ratio') }];
      } else if (layout === 'plane') {
        charges = [{ x: 0, y: sep / 2, q: 1 }];
        images = [{ x: 0, y: -sep / 2, q: -1 }];
      } else if (layout === 'sphere') {
        const a = SPHERE_R + sep;
        const img = sphereImage(1, a, SPHERE_R);
        charges = [{ x: a, y: 0, q: 1 }];
        images = [{ x: img.at, y: 0, q: img.q }];
      } else {
        charges = [{ x: -0.05, y: 0, q: -1 }, { x: 0.05, y: 0, q: 1 }];
      }
    }

    function trace() {
      const all = [...charges, ...images];
      const per = num(params, 'lines');
      lines = [];
      const bounds = HALF_W * 1.05;
      for (const c of charges) {
        if (c.q === 0) continue;
        const sign = c.q > 0 ? 1 : -1;
        const count = Math.max(2, Math.round(per * Math.abs(c.q)));
        for (let i = 0; i < count; i++) {
          const ang = (2 * Math.PI * (i + 0.5)) / count;
          const line = fieldLine(all, c.x + START * Math.cos(ang), c.y + START * Math.sin(ang),
            { step: 0.02, maxSteps: 900, bounds, boundsY: halfH * 1.05, sign, stopRadius: START });
          // a line from a negative charge that ends in a positive one is already drawn from there
          const end = line[line.length - 1];
          if (sign < 0 && charges.some((o) => o.q > 0 && Math.hypot(end[0] - o.x, end[1] - o.y) < 2 * START)) continue;
          // nothing crosses into a conductor: stop at the plane or the sphere
          lines.push(clip(line));
        }
      }
    }

    function clip(line: [number, number][]): [number, number][] {
      if (layout === 'plane') {
        const k = line.findIndex(([, y]) => y < 0);
        return k < 0 ? line : line.slice(0, k + 1);
      }
      if (layout === 'sphere') {
        const k = line.findIndex(([x, y]) => Math.hypot(x, y) < SPHERE_R);
        return k < 0 ? line : line.slice(0, k + 1);
      }
      return line;
    }

    function measure(): Stat[] {
      const all = [...charges, ...images];
      const out: Stat[] = [
        { label: 'charges (ε₀ = 1)', value: charges.map((c) => `${c.q.toFixed(2)} at (${c.x.toFixed(2)}, ${c.y.toFixed(2)})`).join('; ') },
      ];
      if (layout === 'pair') {
        const R = num(params, 'radius');
        const c0: [number, number, number] = str(params, 'around') === 'charge1' ? [charges[0].x, charges[0].y, 0] : [0, 0, 0];
        const inside = charges.filter((c) => Math.hypot(c.x - c0[0], c.y - c0[1]) < R);
        // a charge on the surface has no flux to speak of: say so rather than average across it
        const onSurface = charges.some((c) => Math.abs(Math.hypot(c.x - c0[0], c.y - c0[1]) - R) < 0.1 * R);
        out.push(
          { label: 'Gauss sphere', value: `radius ${R.toFixed(2)} about (${c0[0].toFixed(2)}, ${c0[1].toFixed(2)})` },
          { label: 'flux of E out of the sphere, numerical', value: onSurface ? 'a charge sits on the surface' : sci(gaussFlux(charges, c0, R)) },
          { label: 'charge inside the sphere, summed', value: sci(inside.reduce((t, c) => t + c.q, 0)) },
        );
      } else if (layout === 'plane') {
        const a = charges[0].y;
        out.push(
          { label: 'charge induced on the plane, ∫σ dA numerical', value: sci(planeInducedCharge(charges[0].q, a)) },
          { label: 'image charge −q', value: sci(-charges[0].q) },
        );
      } else if (layout === 'sphere') {
        const a = charges[0].x;
        let worst = 0;
        for (let i = 0; i < 720; i++) {
          const th = (2 * Math.PI * (i + 0.5)) / 720;
          worst = Math.max(worst, Math.abs(potential(all, SPHERE_R * Math.cos(th), SPHERE_R * Math.sin(th), 0)));
        }
        const scale = charges[0].q / (4 * Math.PI * (a - SPHERE_R));
        out.push(
          { label: 'largest |V| on the grounded sphere, over q/4π(a − R)', value: (worst / scale).toExponential(2) },
          { label: 'flux out of a sphere just around the conductor, numerical', value: sci(gaussFlux(all, [0, 0, 0], (SPHERE_R + a) / 2)) },
          { label: 'image charge −qR/a', value: sci(images[0].q) },
          { label: 'image position R²/a', value: images[0].x.toFixed(6) },
        );
      } else {
        out.push(
          { label: 'far-field slope of |E| on the axis, r from 2 to 20', value: dipoleAxisSlope(charges, 2, 20).toFixed(4) },
          { label: 'the same slope for a single charge', value: dipoleAxisSlope([{ x: 0, y: 0, q: 1 }], 2, 20).toFixed(4) },
        );
      }
      out.push({ label: 'field lines traced', value: String(lines.length) });
      return out;
    }

    /** Equipotential segments in canvas pixels, by marching squares on a grid of the potential. */
    let segments: Float64Array[] = [];
    function contours() {
      const all = [...charges, ...images];
      const nx = 160;
      const ny = Math.round(nx * (ctx.height / ctx.width));
      const grid = new Float64Array((nx + 1) * (ny + 1));
      for (let j = 0; j <= ny; j++) {
        for (let i = 0; i <= nx; i++) {
          grid[j * (nx + 1) + i] = potential(all, wx((i / nx) * ctx.width), wy((j / ny) * ctx.height), 0);
        }
      }
      const v0 = 1 / (4 * Math.PI);
      const levels = [-4, -2, -1, -0.5, -0.25, -0.12, 0.12, 0.25, 0.5, 1, 2, 4].map((k) => k * v0);
      const cw = ctx.width / nx;
      const ch = ctx.height / ny;
      segments = levels.map((lv) => {
        const out: number[] = [];
        for (let j = 0; j < ny; j++) {
          for (let i = 0; i < nx; i++) {
            const a = grid[j * (nx + 1) + i] - lv;
            const b = grid[j * (nx + 1) + i + 1] - lv;
            const c = grid[(j + 1) * (nx + 1) + i + 1] - lv;
            const d = grid[(j + 1) * (nx + 1) + i] - lv;
            // the crossings on the cell's four edges, joined in pairs
            const pts: number[] = [];
            const edge = (u: number, v: number, x0: number, y0: number, x1: number, y1: number) => {
              if ((u < 0) !== (v < 0)) {
                const t = u / (u - v);
                pts.push(x0 + t * (x1 - x0), y0 + t * (y1 - y0));
              }
            };
            const X = i * cw;
            const Y = j * ch;
            edge(a, b, X, Y, X + cw, Y);
            edge(b, c, X + cw, Y, X + cw, Y + ch);
            edge(c, d, X + cw, Y + ch, X, Y + ch);
            edge(d, a, X, Y + ch, X, Y);
            if (pts.length >= 4) out.push(pts[0], pts[1], pts[2], pts[3]);
          }
        }
        return Float64Array.from(out);
      });
    }

    function refresh() {
      trace();
      contours();
      rows = measure();
    }

    return {
      setup() {
        layout = str(params, 'layout') as Layout;
        build();
        refresh();
      },
      pressed(x, y) {
        if (layout !== 'pair') return;
        const X = wx(x);
        const Y = wy(y);
        dragging = charges.findIndex((c) => Math.hypot(c.x - X, c.y - Y) < 0.25);
      },
      dragged(x, y) {
        if (dragging < 0) return;
        charges[dragging] = { ...charges[dragging], x: wx(x), y: wy(y) };
        refresh();
      },
      draw() {
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        if (bool(params, 'equipotentials')) {
          g.lineWidth = 0.8;
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.35), 0.8);
          g.beginPath();
          for (const seg of segments) {
            for (let k = 0; k + 3 < seg.length; k += 4) {
              g.moveTo(seg[k], seg[k + 1]);
              g.lineTo(seg[k + 2], seg[k + 3]);
            }
          }
          g.stroke();
        }
        // conductors
        g.fillStyle = rgba(mix(ctx.bg, fg, 0.18), 1);
        if (layout === 'plane') g.fillRect(0, py(0), ctx.width, ctx.height - py(0));
        if (layout === 'sphere') {
          g.beginPath();
          g.arc(px(0), py(0), (SPHERE_R / HALF_W) * (ctx.width / 2), 0, 2 * Math.PI);
          g.fill();
        }
        if (layout === 'pair') {
          const R = num(params, 'radius');
          const c0 = str(params, 'around') === 'charge1' ? charges[0] : { x: 0, y: 0 };
          g.strokeStyle = rgba(fg, 0.6);
          g.setLineDash([5, 4]);
          g.beginPath();
          g.arc(px(c0.x), py(c0.y), (R / HALF_W) * (ctx.width / 2), 0, 2 * Math.PI);
          g.stroke();
          g.setLineDash([]);
        }
        // field lines
        g.lineWidth = 1.2;
        lines.forEach((line, k) => {
          g.strokeStyle = rgba(ramp(pal, (k % 7) / 7 * 0.6 + 0.2), 0.85);
          g.beginPath();
          line.forEach(([x, y], i) => (i === 0 ? g.moveTo(px(x), py(y)) : g.lineTo(px(x), py(y))));
          g.stroke();
        });
        // charges, and images drawn faintly behind their conductor
        const dot = (c: Charge, alpha: number) => {
          g.fillStyle = rgba(c.q > 0 ? ramp(pal, 0.05) : ramp(pal, 0.95), alpha);
          g.beginPath();
          g.arc(px(c.x), py(c.y), 6 + 3 * Math.min(2, Math.abs(c.q)), 0, 2 * Math.PI);
          g.fill();
          g.fillStyle = rgba(ctx.bg, alpha);
          g.font = 'bold 11px monospace';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(c.q > 0 ? '+' : '−', px(c.x), py(c.y));
        };
        for (const c of images) dot(c, 0.35);
        for (const c of charges) dot(c, 1);
        g.restore();
        ctx.stats(rows);
      },
    };
  },
};

export default chargesAndFieldLines;
