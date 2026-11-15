// Rays through a lens, traced exactly surface by surface (src/plates/_shared/optics/rays.ts), against
// the paraxial ABCD matrices and the lensmaker's formula: the focus, the spherical aberration that
// grows as the square of the height, the image of a near object; and Fermat's least time across an
// interface giving Snell's law. A reader's prescription (curvature, thickness, index per surface)
// replaces the lens.
import { optionId } from '../../core/data';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { abcd, axisCrossing, fermatCrossing, lens, traceRay, type Surface } from '../_shared/optics/rays';
import { rgba } from '../_shared/two-slit/draw';

const f9 = (v: number) => v.toFixed(9);
const f6 = (v: number) => v.toFixed(6);
/** The height of the paraxial ray: the exact trace's departure from the paraxial focus is O(h²). */
const H0 = 1e-6;

type Shape = 'biconvex' | 'plano-curved-first' | 'plano-flat-first' | 'meniscus';

/** A lens of a shape, index n, radius scale R and thickness t. */
export function shaped(shape: Shape, n: number, R: number, t: number): Surface[] {
  if (shape === 'plano-curved-first') return lens(n, R, Infinity, t);
  if (shape === 'plano-flat-first') return lens(n, Infinity, -R, t);
  if (shape === 'meniscus') return lens(n, R, 2.5 * R, t);
  return lens(n, R, -R, t);
}

/** A reader's prescription: each row a surface of curvature c (1/R, 0 for a plane), the thickness to
 * the next surface, and the index after it; the first vertex at 0. */
export function prescription(c: ArrayLike<number>, t: ArrayLike<number>, n: ArrayLike<number>): Surface[] {
  const out: Surface[] = [];
  let z = 0;
  for (let k = 0; k < c.length; k++) {
    out.push({ z, R: c[k] === 0 ? Infinity : 1 / c[k], n: n[k] });
    z += t[k];
  }
  return out;
}

export const raysAndLenses: PlateCode = {
  id: 'rays-and-lenses',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 2,
  params: [
    {
      kind: 'select', key: 'view', label: 'Show', value: 'lens',
      options: [
        { value: 'lens', label: 'A lens: its rays, focus and aberration' },
        { value: 'fermat', label: 'Fermat: the path of least time across an interface' },
      ],
    },
    {
      kind: 'select', key: 'shape', label: 'Lens', value: 'biconvex',
      options: [
        { value: 'biconvex', label: 'Biconvex' },
        { value: 'plano-curved-first', label: 'Plano-convex, curved side to the light' },
        { value: 'plano-flat-first', label: 'Plano-convex, flat side to the light' },
        { value: 'meniscus', label: 'A positive meniscus' },
      ],
      when: { key: 'view', values: ['lens'] },
    },
    { kind: 'range', key: 'n', label: 'Glass index n', min: 1.3, max: 2, step: 0.01, value: 1.5 },
    { kind: 'range', key: 'R', label: 'Radius of curvature', min: 2, max: 20, step: 0.5, value: 5, when: { key: 'view', values: ['lens'] } },
    { kind: 'range', key: 't', label: 'Centre thickness', min: 0.05, max: 1.5, step: 0.05, value: 0.4, when: { key: 'view', values: ['lens'] } },
    // the aperture stops short of the smallest radius, beyond which a ray misses the cap
    { kind: 'range', key: 'aperture', label: 'Aperture radius (ray height)', min: 0.1, max: 1.5, step: 0.05, value: 1, when: { key: 'view', values: ['lens'] } },
    { kind: 'range', key: 'object', label: 'Object distance (0: at infinity)', min: 0, max: 60, step: 1, value: 0, when: { key: 'view', values: ['lens'] } },
    { kind: 'range', key: 'rays', label: 'Rays drawn', min: 3, max: 41, step: 2, value: 15, cosmetic: true, when: { key: 'view', values: ['lens'] } },
    { kind: 'range', key: 'depth', label: 'Depth of B below the interface', min: 0.2, max: 3, step: 0.1, value: 1, when: { key: 'view', values: ['fermat'] } },
    paletteParam('spectral'),
  ],
  pace: { kind: 'still', why: 'a diagram of the controls: every ray is traced once when they change, and nothing in it moves' },
  create(p, ctx) {
    const params = ctx.params;
    let key = '';
    let rows: Stat[] = [];
    let surfaces: Surface[] = [];
    let paths: [number, number][][] = [];
    let focus = 0;
    let aberration: [number, number][] = [];
    let fermat: { A: [number, number]; B: [number, number]; x: number } | null = null;

    function lensRows(input: string): Stat[] {
      const out: Stat[] = [{ label: 'Input', value: input }];
      if (!surfaces.length) return out;
      const ap = num(params, 'aperture');
      const so = num(params, 'object');
      const M = abcd(surfaces);
      const last = surfaces[surfaces.length - 1];
      const nOut = last.n;
      const parallel = traceRay(surfaces, H0, 0, surfaces[0].z - 1);
      if (!parallel) return [...out, { label: 'paraxial ray', value: 'lost: it misses a surface or is totally reflected' }];
      focus = axisCrossing(parallel);
      out.push(
        { label: 'paraxial focus behind the last vertex, exact trace at h → 0', value: f9(focus - last.z) },
        { label: 'back focal distance by ABCD, −A·n/C', value: f9((-M[0][0] * nOut) / M[1][0]) },
        { label: 'effective focal length by ABCD, −1/C', value: f9(-1 / M[1][0]) },
      );
      if (surfaces.length === 2 && last.n === 1) {
        // the lensmaker's thick-lens formula, and the back focal distance f(1 − (n − 1)t/nR₁)
        const n = surfaces[0].n;
        const [R1, R2] = [surfaces[0].R, surfaces[1].R];
        const t = surfaces[1].z - surfaces[0].z;
        const P = (n - 1) * (1 / R1 - 1 / R2 + ((n - 1) * t) / (n * R1 * R2));
        out.push(
          { label: 'lensmaker focal length, 1/f = (n − 1)(1/R₁ − 1/R₂ + (n − 1)t/nR₁R₂)', value: f9(1 / P) },
          { label: 'back focal distance, lensmaker f(1 − (n − 1)t/nR₁)', value: f9((1 / P) * (1 - ((n - 1) * t) / (n * R1))) },
        );
      }
      // spherical aberration: where rays at height h cross the axis, against the paraxial focus
      aberration = [];
      for (let k = 1; k <= 24; k++) {
        const h = (ap * k) / 24;
        const r = traceRay(surfaces, h, 0, surfaces[0].z - 1);
        if (r) aberration.push([h, axisCrossing(r) - focus]);
      }
      const at = (h: number) => { const r = traceRay(surfaces, h, 0, surfaces[0].z - 1); return r ? axisCrossing(r) - focus : NaN; };
      const lsa = at(ap);
      const h1 = ap / 8;
      const order = Math.log(Math.abs(at(h1) / at(h1 / 2))) / Math.log(2);
      out.push(
        { label: 'longitudinal spherical aberration at the aperture', value: Number.isFinite(lsa) ? f6(lsa) : 'the marginal ray is lost' },
        { label: 'order of the aberration in h, between h/8 and h/16 of the aperture', value: Number.isFinite(order) ? f6(order) : 'none measured' },
      );
      if (so > 0) {
        // a near object: the image by the exact trace of a ray at a small angle, and by ABCD
        const r = traceRay(surfaces, 0, H0, surfaces[0].z - so);
        // ABCD from the object: translate so, then the lens; the image where y returns to 0
        const [[A, B], [C, D]] = M;
        const sImage = -(A * so + B) / ((C * so + D) / nOut);
        out.push(
          { label: 'image behind the last vertex, exact trace at a small angle', value: r ? f9(axisCrossing(r) - last.z) : 'lost' },
          { label: 'image behind the last vertex by ABCD', value: f9(sImage) },
          { label: 'magnification by ABCD, 1/(C·s_o + D)', value: f6(1 / (C * so + D)) },
        );
      }
      // the drawn rays
      paths = [];
      const nr = num(params, 'rays');
      for (let k = 0; k < nr; k++) {
        const h = -ap + (2 * ap * k) / Math.max(1, nr - 1);
        const path: [number, number][] = [];
        const r = so > 0
          ? traceRay(surfaces, 0, Math.atan2(h, so), surfaces[0].z - so, 1, path)
          : traceRay(surfaces, h, 0, surfaces[0].z - 3, 1, path);
        if (r) {
          const end = Math.max(focus + 3, last.z + 6);
          path.push([end, r.y + ((end - r.z) * r.dy) / r.dz]);
        }
        paths.push(path);
      }
      return out;
    }

    function fermatRows(): Stat[] {
      const n2 = num(params, 'n');
      const A: [number, number] = [-1.5, 1.2];
      const B: [number, number] = [1.5, -num(params, 'depth')];
      const { x, path } = fermatCrossing(1, n2, A, B);
      fermat = { A, B, x };
      const s1 = (x - A[0]) / Math.hypot(x - A[0], A[1]);
      const s2 = (B[0] - x) / Math.hypot(B[0] - x, B[1]);
      // the straight line A–B crosses the interface where y = 0
      const xs = A[0] + (A[1] / (A[1] - B[1])) * (B[0] - A[0]);
      const straight = Math.hypot(xs - A[0], A[1]) + n2 * Math.hypot(B[0] - xs, B[1]);
      return [
        { label: 'Input', value: `seeded: air above, index ${n2} below` },
        { label: 'least-time crossing x, by golden-section search', value: f9(x) },
        { label: 'n₁ sin θ₁ − n₂ sin θ₂ at the least-time crossing', value: (s1 - n2 * s2).toExponential(2) },
        { label: 'optical path of the least-time route', value: f6(path) },
        { label: 'optical path of the straight line, longer', value: f6(straight) },
      ];
    }

    function compute(): void {
      const raw = str(params, 'view');
      fermat = null;
      if (raw === 'fermat') { rows = fermatRows(); surfaces = []; return; }
      if (optionId(raw)) {
        const table = ctx.data?.(optionId(raw) ?? '') ?? null;
        if (!table) { surfaces = []; rows = [{ label: 'Input', value: 'your data: none attached; attach a table of c, t, n, one surface a row' }]; return; }
        surfaces = prescription(table.values[0], table.values[1], table.values[2]);
        rows = lensRows(`your data, a prescription of ${table.rows} surfaces`);
        return;
      }
      surfaces = shaped(str(params, 'shape') as Shape, num(params, 'n'), num(params, 'R'), num(params, 't'));
      rows = lensRows(`seeded: a ${str(params, 'shape')} lens`);
    }

    return {
      setup() { key = ''; },
      draw() {
        const k = JSON.stringify(params) + (optionId(params.view) ? String(ctx.data?.(optionId(params.view) ?? '')?.digest) : '');
        if (k !== key) { compute(); key = k; }
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        g.font = '11px monospace';
        if (fermat) {
          const s = Math.min(W / 5, H / 4.5);
          const X = (x: number) => W / 2 + x * s;
          const Y = (y: number) => H * 0.45 - y * s;
          g.fillStyle = rgba(mix(ctx.bg, ramp(pal, 0.3), 0.35), 1);
          g.fillRect(0, Y(0), W, H - Y(0));
          const { A, B, x } = fermat;
          // a fan of trial crossings, the least-time one bright
          for (let k = -6; k <= 6; k++) {
            const xt = x + k * 0.25;
            g.strokeStyle = rgba(fg, k === 0 ? 0 : 0.18);
            g.beginPath(); g.moveTo(X(A[0]), Y(A[1])); g.lineTo(X(xt), Y(0)); g.lineTo(X(B[0]), Y(B[1])); g.stroke();
          }
          g.strokeStyle = rgba(ramp(pal, 0.9), 1);
          g.lineWidth = 2.5;
          g.beginPath(); g.moveTo(X(A[0]), Y(A[1])); g.lineTo(X(x), Y(0)); g.lineTo(X(B[0]), Y(B[1])); g.stroke();
          g.fillStyle = rgba(fg, 0.9);
          g.fillText('A', X(A[0]) - 12, Y(A[1]));
          g.fillText('B', X(B[0]) + 6, Y(B[1]));
          g.fillText('trial paths (faint) and the path of least time', 10, 16);
        } else if (surfaces.length) {
          const last = surfaces[surfaces.length - 1];
          const zMin = surfaces[0].z - Math.max(3, num(params, 'object') || 0);
          const zMax = Math.max(focus + 3, last.z + 6);
          const ap = Math.max(num(params, 'aperture'), 0.5);
          const s = Math.min((W * 0.94) / (zMax - zMin), (H * 0.6) / (2.4 * ap));
          const X = (z: number) => W * 0.03 + (z - zMin) * s;
          const Y = (y: number) => H * 0.42 - y * s;
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.35), 1);
          g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.stroke();
          // the surfaces, as arcs across the aperture
          g.strokeStyle = rgba(fg, 0.9);
          g.lineWidth = 2;
          for (const sf of surfaces) {
            g.beginPath();
            for (let k = 0; k <= 40; k++) {
              const y = -1.1 * ap + (2.2 * ap * k) / 40;
              const z = Number.isFinite(sf.R) && Math.abs(y) < Math.abs(sf.R) ? sf.z + sf.R - Math.sign(sf.R) * Math.sqrt(sf.R * sf.R - y * y) : sf.z;
              if (k === 0) g.moveTo(X(z), Y(y)); else g.lineTo(X(z), Y(y));
            }
            g.stroke();
          }
          g.lineWidth = 1;
          paths.forEach((path, k) => {
            g.strokeStyle = rgba(ramp(pal, paths.length > 1 ? k / (paths.length - 1) : 0.5), 0.85);
            g.beginPath();
            path.forEach(([z, y], i) => { if (i === 0) g.moveTo(X(z), Y(y)); else g.lineTo(X(z), Y(y)); });
            g.stroke();
          });
          g.fillStyle = rgba(fg, 1);
          g.beginPath(); g.arc(X(focus), Y(0), 3.5, 0, 2 * Math.PI); g.fill();
          // the aberration: the axis crossing against the height
          if (aberration.length > 1) {
            const px = W * 0.62; const pw = W * 0.34; const top = H * 0.72; const ph = H * 0.22;
            const dMax = Math.max(1e-12, ...aberration.map(([, d]) => Math.abs(d)));
            g.strokeStyle = rgba(fg, 0.3);
            g.strokeRect(px, top, pw, ph);
            g.strokeStyle = rgba(ramp(pal, 0.85), 1);
            g.beginPath();
            aberration.forEach(([h, d], i) => {
              const xx = px + pw / 2 + (d / dMax) * (pw / 2) * 0.95;
              const yy = top + ph - (h / aberration[aberration.length - 1][0]) * ph;
              if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
            });
            g.stroke();
            g.fillStyle = rgba(fg, 0.75);
            g.fillText('axis crossing against ray height (spherical aberration)', px, top - 6);
          }
          g.fillStyle = rgba(fg, 0.75);
          g.fillText('rays traced exactly; the paraxial focus (dot)', 10, 16);
        }
        g.restore();
        ctx.stats(rows);
      },
    };
  },
};

export default raysAndLenses;
