// Vector algebra: two vectors, their dot and cross products, and the same on axes turned by three
// angles, or turned and mirrored. A still diagram of the controls; the products are read against
// identities computed from the controls alone.
import { paletteParam, ramp } from '../../core/palette';
import { bool, num, type PlateCode, type Stat } from '../../core/plate';
import { frame, read, type V3 } from './vectors';

const exp = (x: number) => x.toExponential(2);
const fmt = (v: V3) => `(${v.map((x) => x.toFixed(4)).join(', ')})`;
const comp = (key: string, label: string, value: number) =>
  ({ kind: 'range' as const, key, label, min: -5, max: 5, step: 0.1, value });

export const vectorAlgebra: PlateCode = {
  id: 'vector-algebra',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    comp('ax', 'a, x component', 2.3), comp('ay', 'a, y component', 0.7), comp('az', 'a, z component', -0.4),
    comp('bx', 'b, x component', 0.5), comp('by', 'b, y component', 1.9), comp('bz', 'b, z component', 1.6),
    { kind: 'range', key: 'yaw', label: 'New axes: yaw about z (°)', min: -180, max: 180, step: 1, value: 30 },
    { kind: 'range', key: 'pitch', label: 'pitch about the new y (°)', min: -90, max: 90, step: 1, value: 20 },
    { kind: 'range', key: 'roll', label: 'roll about the newest x (°)', min: -180, max: 180, step: 1, value: 10 },
    { kind: 'toggle', key: 'mirror', label: 'Mirror the new x axis (a left-handed frame)', value: false },
    paletteParam('spectral'),
  ],
  pace: { kind: 'still', why: 'a diagram of the controls: the products are computed once when a control changes, and nothing in it moves' },
  create(p, ctx) {
    const params = ctx.params;
    return {
      setup() {},
      draw() {
        const a: V3 = [num(params, 'ax'), num(params, 'ay'), num(params, 'az')];
        const b: V3 = [num(params, 'bx'), num(params, 'by'), num(params, 'bz')];
        const mirror = bool(params, 'mirror');
        const m = frame(num(params, 'yaw'), num(params, 'pitch'), num(params, 'roll'), mirror);
        const r = read(a, b, m);

        // the identities, from the controls alone
        const aa = a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
        const bb = b[0] * b[0] + b[1] * b[1] + b[2] * b[2];
        const ab = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const crossSq = r.ab[0] ** 2 + r.ab[1] ** 2 + r.ab[2] ** 2;
        const perp = Math.abs(r.ab[0] * a[0] + r.ab[1] * a[1] + r.ab[2] * a[2]) + Math.abs(r.ab[0] * b[0] + r.ab[1] * b[1] + r.ab[2] * b[2]);
        const dot2 = r.a2[0] * r.b2[0] + r.a2[1] * r.b2[1] + r.a2[2] * r.b2[2];
        const gap = (s: number) => Math.hypot(r.ab2[0] - s * r.turned[0], r.ab2[1] - s * r.turned[1], r.ab2[2] - s * r.turned[2]);

        const W = ctx.width; const H = ctx.height;
        const pal = ctx.palette(); const fg = ctx.fg;
        p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
        p.textSize(Math.max(11, Math.min(15, W * 0.018)));

        // an oblique view of the old axes: x to the lower left, y to the right, z up
        const cx = W * 0.5; const cy = H * 0.55;
        const reach = Math.max(1, Math.sqrt(aa), Math.sqrt(bb), Math.sqrt(crossSq));
        const s = Math.min(W, H) * 0.36 / reach;
        const proj = (v: V3): [number, number] => [cx + s * (v[1] - 0.5 * v[0]), cy - s * (v[2] - 0.3 * v[0])];
        const seg = (v: V3, c: readonly number[], w: number, label: string) => {
          const [x, y] = proj(v);
          p.stroke(c[0], c[1], c[2]); p.strokeWeight(w); p.line(cx, cy, x, y);
          p.noStroke(); p.fill(c[0], c[1], c[2]); p.circle(x, y, 2 * w + 3);
          p.textAlign(p.LEFT, p.BOTTOM); p.text(label, x + 5, y - 3);
        };
        const axes: [V3, string][] = [[[1, 0, 0], 'x'], [[0, 1, 0], 'y'], [[0, 0, 1], 'z']];
        for (const [e, l] of axes) seg(e.map((t) => t * reach) as V3, [fg[0], fg[1], fg[2], 90], 1, l);
        // the new axes, dashed in spirit: thinner, in the palette's dim end
        m.forEach((row, i) => seg(row.map((t) => t * reach * 0.8) as V3, ramp(pal, 0.1), 1, `${'xyz'[i]}′`));
        seg(a, ramp(pal, 0.3), 3, 'a');
        seg(b, ramp(pal, 0.55), 3, 'b');
        seg(r.ab, ramp(pal, 0.85), 3, 'a × b');
        p.noStroke(); p.fill(fg[0], fg[1], fg[2], 190); p.textAlign(p.LEFT, p.TOP);
        p.text(mirror ? 'new axes turned and mirrored: a left-handed frame' : 'new axes turned: a right-handed frame', W * 0.03, H * 0.03);

        const rows: Stat[] = [
          { label: 'a · b', value: ab.toFixed(6) },
          { label: 'a × b', value: fmt(r.ab) },
          { label: 'z component of a × b', value: r.ab[2].toFixed(6) },
          { label: '|a × b|² against |a|²|b|² − (a·b)²', value: exp(Math.abs(crossSq - (aa * bb - ab * ab))) },
          { label: 'a × b against a and b, |(a×b)·a| + |(a×b)·b|', value: exp(perp) },
          { label: 'a′ · b′ − a · b', value: exp(Math.abs(dot2 - ab)) },
          { label: 'determinant of the new axes', value: r.det.toFixed(6) },
          { label: 'a′ × b′ against (a × b) on the new axes', value: gap(1).toFixed(6) },
          { label: 'a′ × b′ against det · (a × b) on the new axes', value: exp(gap(r.det)) },
          { label: 'angle between a and b', value: `${((Math.atan2(Math.sqrt(crossSq), ab) * 180) / Math.PI).toFixed(4)}°` },
        ];
        ctx.stats(rows);
      },
    };
  },
};

export default vectorAlgebra;
