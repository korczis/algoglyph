// Gauss's and Stokes's theorems in the plane, each read two ways: a field of the presets, a loop
// (a circle, a square or a reader's polygon), the flux and the circulation walked along the loop
// against the divergence and the curl integrated over its inside, the work from A to B over two
// paths, and the closed forms where there are any (src/plates/_shared/fields/calculus.ts).
import { optionId } from '../../core/data';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { arcWork, areaIntegral, boundary, CORE, curl, divergence, FIELDS, signedArea, square, work, type Field2, type Loop } from '../_shared/fields/calculus';
import { rgba } from '../_shared/two-slit/draw';

/** Half the height of the view, in the field's units. */
const VIEW = 2;
const ARROWS_Y = 13;
const SHADE_Y = 50;

const fmt = (v: number) => (Math.abs(v) < 1e-12 ? '0' : Math.abs(v) >= 1e-3 ? v.toFixed(8) : v.toExponential(3));
const sci = (v: number) => v.toExponential(2);

/** The largest |F + ∇φ| over a grid of the view, ∇φ by central differences: F is −∇φ. */
export function gradientDefect(F: Field2, phi: (x: number, y: number) => number, h = 1e-4): number {
  let worst = 0;
  for (let i = -8; i <= 8; i++) {
    for (let j = -5; j <= 5; j++) {
      const x = (i / 8) * 3; const y = (j / 5) * VIEW;
      const gx = (phi(x + h, y) - phi(x - h, y)) / (2 * h);
      const gy = (phi(x, y + h) - phi(x, y - h)) / (2 * h);
      const [fx, fy] = F(x, y);
      worst = Math.max(worst, Math.hypot(fx + gx, fy + gy));
    }
  }
  return worst;
}

interface Result { rows: Stat[]; loop: Loop | null; shade: Float32Array; shadeMax: number; a: [number, number] | null; b: [number, number] | null }

export const vectorCalculus: PlateCode = {
  id: 'vector-calculus',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 2,
  params: [
    {
      kind: 'select', key: 'field', label: 'Field', value: 'source',
      options: [
        { value: 'source', label: 'A smoothed source (a line charge)' },
        { value: 'vortex', label: 'A smoothed vortex' },
        { value: 'saddle', label: 'A saddle, −∇(x² − y²)' },
        { value: 'shear', label: 'A shear flow (y, 0)' },
        { value: 'uniform', label: 'A uniform field' },
        { value: 'mixed', label: 'A source, a vortex and a drift' },
      ],
    },
    {
      kind: 'select', key: 'curve', label: 'Loop', value: 'circle',
      options: [
        { value: 'circle', label: 'A circle' },
        { value: 'square', label: 'A square' },
      ],
    },
    { kind: 'range', key: 'cx', label: 'Loop centre x', min: -1.5, max: 1.5, step: 0.05, value: 0 },
    { kind: 'range', key: 'cy', label: 'Loop centre y', min: -1, max: 1, step: 0.05, value: 0 },
    { kind: 'range', key: 'size', label: 'Radius or half-side', min: 0.1, max: 1, step: 0.05, value: 0.8 },
    {
      kind: 'select', key: 'shade', label: 'Shade', value: 'div', cosmetic: true,
      options: [
        { value: 'div', label: 'Divergence' },
        { value: 'curl', label: 'Curl' },
        { value: 'none', label: 'Nothing' },
      ],
    },
    paletteParam('spectral'),
  ],
  pace: { kind: 'still', why: 'a diagram of the controls: every integral is computed once when they change, and nothing in it moves' },
  create(p, ctx) {
    const params = ctx.params;
    let key = '';
    let res: Result;

    function compute(): Result {
      const preset = FIELDS[str(params, 'field')] ?? FIELDS.source;
      const F = preset.F;
      const rawLoop = str(params, 'curve');
      const cx = num(params, 'cx');
      const cy = num(params, 'cy');
      const s = num(params, 'size');
      const rows: Stat[] = [];
      let loop: Loop | null = null;
      let a: [number, number] | null = null;
      let b: [number, number] | null = null;
      if (optionId(rawLoop)) {
        const table = ctx.data?.(optionId(rawLoop) ?? '') ?? null;
        if (!table) rows.push({ label: 'Input', value: 'your data: none attached; attach a table of x, y, the loop’s corners in order' });
        else {
          loop = { kind: 'polygon', xs: table.values[0], ys: table.values[1] };
          rows.push({ label: 'Input', value: `your data, a loop of ${table.rows} corners` });
        }
      } else {
        loop = rawLoop === 'square' ? square(cx, cy, s) : { kind: 'circle', cx, cy, r: s };
        rows.push({ label: 'Input', value: `seeded: a ${rawLoop} about (${cx.toFixed(2)}, ${cy.toFixed(2)})` });
      }
      if (loop) {
        // the polygon's quadrature is spread thinner as its corners grow, so a reader's loop costs
        // what a square does
        const corners = loop.kind === 'polygon' ? loop.xs.length : 0;
        const nArea = loop.kind === 'circle' ? 48 : Math.max(6, Math.min(32, Math.floor(Math.sqrt(4096 / Math.max(1, corners - 2)))));
        const nEdge = loop.kind === 'circle' ? 512 : Math.max(8, Math.min(32, Math.floor(2048 / Math.max(1, corners))));
        const edge = boundary(F, loop, nEdge);
        const div = areaIntegral((x, y) => divergence(F, x, y), loop, nArea);
        const rot = areaIntegral((x, y) => curl(F, x, y), loop, nArea);
        rows.push(
          { label: 'outward flux ∮F·n dl, along the loop', value: fmt(edge.flux) },
          { label: 'area integral of div F, inside', value: fmt(div) },
          { label: 'circulation ∮F·dl, along the loop', value: fmt(edge.circulation) },
          { label: 'area integral of curl F, inside', value: fmt(rot) },
        );
        // closed forms: a centred circle about the smoothed source or vortex, and the linear fields
        const centred = loop.kind === 'circle' && Math.abs(cx) < 1e-12 && Math.abs(cy) < 1e-12;
        // the area by its own formula: πr², or the shoelace sum of the corners
        const area = loop.kind === 'circle' ? Math.PI * s * s : Math.abs(signedArea(loop.xs, loop.ys));
        const enclosedCore = centred ? 2 * Math.PI * -Math.expm1(-(s * s) / (CORE * CORE)) : null;
        const id = preset.id;
        let flux: number | null = null;
        let circ: number | null = null;
        if (id === 'source') { flux = enclosedCore; circ = 0; } else if (id === 'vortex') { flux = 0; circ = enclosedCore; } else if (id === 'saddle' || id === 'uniform') {
          flux = 0; circ = 0;
        } else if (id === 'shear') { flux = 0; circ = -area; }
        if (flux !== null) rows.push({ label: 'flux, closed form', value: fmt(flux) });
        if (circ !== null) rows.push({ label: 'circulation, closed form', value: fmt(circ) });
        // work from A on the left of the loop to B on its right, over the top and under the bottom
        if (!optionId(rawLoop)) {
          a = [cx - s, cy];
          b = [cx + s, cy];
          let top: number;
          let bottom: number;
          if (loop.kind === 'circle') {
            top = arcWork(F, cx, cy, s, Math.PI, 0);
            bottom = arcWork(F, cx, cy, s, Math.PI, 2 * Math.PI);
          } else {
            top = work(F, [cx - s, cx - s, cx + s, cx + s], [cy, cy + s, cy + s, cy], 24);
            bottom = work(F, [cx - s, cx - s, cx + s, cx + s], [cy, cy - s, cy - s, cy], 24);
          }
          rows.push(
            { label: 'work from A to B over the top', value: fmt(top) },
            { label: 'work from A to B under the bottom', value: fmt(bottom) },
            { label: 'bottom minus top, which is the circulation', value: fmt(bottom - top) },
          );
          if (preset.phi) rows.push({ label: 'φ(A) − φ(B), the potential drop', value: fmt(preset.phi(a[0], a[1]) - preset.phi(b[0], b[1])) });
        }
      }
      if (preset.phi) rows.push({ label: 'largest |F + ∇φ| over the view (numerics)', value: sci(gradientDefect(F, preset.phi)) });
      // the shade: the divergence or the curl on a coarse grid of the view
      const W = Math.round(SHADE_Y * 1.6);
      const shade = new Float32Array(W * SHADE_Y);
      let shadeMax = 1e-12;
      const which = str(params, 'shade');
      if (which !== 'none') {
        for (let j = 0; j < SHADE_Y; j++) {
          for (let i = 0; i < W; i++) {
            const x = ((i + 0.5) / W - 0.5) * 2 * VIEW * 1.6;
            const y = (0.5 - (j + 0.5) / SHADE_Y) * 2 * VIEW;
            const v = which === 'curl' ? curl(F, x, y) : divergence(F, x, y);
            shade[j * W + i] = v;
            shadeMax = Math.max(shadeMax, Math.abs(v));
          }
        }
      }
      return { rows, loop, shade, shadeMax, a, b };
    }

    return {
      setup() { key = ''; },
      draw() {
        const k = JSON.stringify(params) + (optionId(params.curve) ? String(ctx.data?.(optionId(params.curve) ?? '')?.digest) : '');
        if (k !== key) { res = compute(); key = k; }
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        const scale = H / (2 * VIEW);
        const X = (x: number) => W / 2 + x * scale;
        const Y = (y: number) => H / 2 - y * scale;
        g.save();
        // the shade
        if (str(params, 'shade') !== 'none') {
          const cols = Math.round(SHADE_Y * 1.6);
          const cw = W / cols;
          const ch = H / SHADE_Y;
          for (let j = 0; j < SHADE_Y; j++) {
            for (let i = 0; i < cols; i++) {
              const v = res.shade[j * cols + i] / res.shadeMax;
              g.fillStyle = rgba(mix(ctx.bg, ramp(pal, v >= 0 ? 0.85 : 0.15), Math.min(1, Math.abs(v)) * 0.55), 1);
              g.fillRect(i * cw, j * ch, cw + 1, ch + 1);
            }
          }
        }
        // the arrows
        const preset = FIELDS[str(params, 'field')] ?? FIELDS.source;
        const step = (2 * VIEW) / ARROWS_Y;
        let fmax = 1e-12;
        const pts: [number, number, number, number][] = [];
        for (let y = -VIEW + step / 2; y < VIEW; y += step) {
          for (let x = -VIEW * 1.6 + step / 2; x < VIEW * 1.6; x += step) {
            const [fx, fy] = preset.F(x, y);
            fmax = Math.max(fmax, Math.hypot(fx, fy));
            pts.push([x, y, fx, fy]);
          }
        }
        g.strokeStyle = rgba(fg, 0.7);
        g.lineWidth = 1.2;
        for (const [x, y, fx, fy] of pts) {
          const m = Math.hypot(fx, fy) / fmax;
          const len = step * scale * 0.85 * Math.sqrt(m);
          const ang = Math.atan2(fy, fx);
          const x0 = X(x) - (Math.cos(ang) * len) / 2;
          const y0 = Y(y) + (Math.sin(ang) * len) / 2;
          const x1 = x0 + Math.cos(ang) * len;
          const y1 = y0 - Math.sin(ang) * len;
          g.beginPath();
          g.moveTo(x0, y0); g.lineTo(x1, y1);
          g.lineTo(x1 - 4 * Math.cos(ang - 0.5), y1 + 4 * Math.sin(ang - 0.5));
          g.moveTo(x1, y1);
          g.lineTo(x1 - 4 * Math.cos(ang + 0.5), y1 + 4 * Math.sin(ang + 0.5));
          g.stroke();
        }
        // the loop, A and B
        const loop = res.loop;
        if (loop) {
          g.strokeStyle = rgba(ramp(pal, 0.95), 1);
          g.lineWidth = 2.5;
          g.beginPath();
          if (loop.kind === 'circle') g.arc(X(loop.cx), Y(loop.cy), loop.r * scale, 0, 2 * Math.PI);
          else {
            for (let i = 0; i < loop.xs.length; i++) { if (i === 0) g.moveTo(X(loop.xs[i]), Y(loop.ys[i])); else g.lineTo(X(loop.xs[i]), Y(loop.ys[i])); }
            g.closePath();
          }
          g.stroke();
        }
        g.fillStyle = rgba(fg, 0.9);
        g.font = '12px monospace';
        for (const [pt, name] of [[res.a, 'A'], [res.b, 'B']] as const) {
          if (!pt) continue;
          g.beginPath();
          g.arc(X(pt[0]), Y(pt[1]), 4, 0, 2 * Math.PI);
          g.fill();
          g.fillText(name, X(pt[0]) + 6, Y(pt[1]) - 6);
        }
        g.restore();
        ctx.stats(res.rows);
      },
    };
  },
};

export default vectorCalculus;
