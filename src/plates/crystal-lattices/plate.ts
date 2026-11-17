// Crystal lattices: one atom and its neighbours, shell by shell, in the five commonest packings of
// spheres. A still diagram of the controls; the coordination and the packing fraction, found by
// enumeration, are read against their closed forms.
import { paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { cellVolume, lattice, LATTICES, packing, shells, type V3 } from './lattice';

/** The packing fraction of each lattice in closed form, from the geometry of touching spheres. */
const CLOSED: Record<string, { value: number; text: string }> = {
  sc: { value: Math.PI / 6, text: 'π/6' },
  bcc: { value: (Math.PI * Math.sqrt(3)) / 8, text: 'π√3/8' },
  fcc: { value: Math.PI / (3 * Math.SQRT2), text: 'π/(3√2)' },
  hcp: { value: Math.PI / (3 * Math.SQRT2), text: 'π/(3√2)' },
  diamond: { value: (Math.PI * Math.sqrt(3)) / 16, text: 'π√3/16' },
};

export const crystalLattices: PlateCode = {
  id: 'crystal-lattices',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    { kind: 'select', key: 'lattice', label: 'Lattice', value: 'fcc', options: LATTICES.map((l) => ({ value: l.id, label: l.label })) },
    { kind: 'range', key: 'shells', label: 'Shells drawn', min: 1, max: 4, step: 1, value: 2 },
    { kind: 'range', key: 'turn', label: 'View, turned about the vertical (°)', min: 0, max: 360, step: 1, value: 25 },
    { kind: 'range', key: 'tilt', label: 'View, tilted (°)', min: -60, max: 60, step: 1, value: 20 },
    paletteParam('spectral'),
  ],
  pace: { kind: 'still', why: 'a diagram of the controls: the neighbours are enumerated once when a control changes, and nothing in it moves' },
  create(p, ctx) {
    const params = ctx.params;
    return {
      setup() {},
      draw() {
        const l = lattice(str(params, 'lattice'));
        const sh = shells(l, 4);
        const drawn = Math.round(num(params, 'shells'));
        const W = ctx.width; const H = ctx.height;
        const pal = ctx.palette(); const fg = ctx.fg;
        p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
        p.textSize(Math.max(11, Math.min(15, W * 0.018)));

        // the neighbours, turned and tilted, the far ones drawn first
        const t = (num(params, 'turn') * Math.PI) / 180; const u = (num(params, 'tilt') * Math.PI) / 180;
        const view = (q: V3): V3 => {
          const x = q[0] * Math.cos(t) - q[1] * Math.sin(t);
          const y = q[0] * Math.sin(t) + q[1] * Math.cos(t);
          return [x, y * Math.cos(u) - q[2] * Math.sin(u), y * Math.sin(u) + q[2] * Math.cos(u)];
        };
        const reach = sh[Math.min(drawn, sh.length) - 1].r;
        const s = (Math.min(W, H) * 0.38) / reach;
        const cx = W * 0.38; const cy = H * 0.52;
        const items: { v: V3; k: number }[] = [{ v: [0, 0, 0], k: -1 }];
        sh.slice(0, drawn).forEach((shell, k) => shell.atoms.forEach((q) => items.push({ v: view(q), k })));
        items.sort((a, b) => a.v[1] - b.v[1]);
        const radius = Math.max(4, (sh[0].r / 2) * s * 0.5);
        for (const it of items) {
          const c = it.k < 0 ? [fg[0], fg[1], fg[2]] : ramp(pal, 0.15 + 0.7 * (it.k / 3));
          const depth = 0.75 + 0.25 * Math.tanh(-it.v[1] / reach);
          p.stroke(ctx.bg[0], ctx.bg[1], ctx.bg[2]); p.strokeWeight(1);
          p.fill(c[0] * depth, c[1] * depth, c[2] * depth);
          p.circle(cx + s * it.v[0], cy - s * it.v[2], 2 * radius * (it.k < 0 ? 1.2 : 1));
        }
        p.noStroke(); p.fill(fg[0], fg[1], fg[2], 200); p.textAlign(p.LEFT, p.TOP);
        p.text(`${l.label}: an atom and its first ${drawn} shell${drawn > 1 ? 's' : ''}`, W * 0.03, H * 0.03);
        sh.forEach((shell, k) => {
          const c = ramp(pal, 0.15 + 0.7 * (k / 3));
          p.fill(c[0], c[1], c[2]);
          p.text(`shell ${k + 1}: ${shell.atoms.length} at ${shell.r.toFixed(4)} a`, W * 0.72, H * (0.2 + 0.07 * k));
        });

        const closed = CLOSED[l.id];
        const f = packing(l, sh[0].r);
        const rows: Stat[] = [
          { label: 'nearest neighbours (coordination number)', value: String(sh[0].atoms.length) },
          { label: 'nearest-neighbour distance', value: `${sh[0].r.toFixed(9)} a` },
          { label: 'second shell', value: `${sh[1].atoms.length} at ${sh[1].r.toFixed(6)} a` },
          { label: 'atoms per cubic a', value: (l.basis.length / cellVolume(l)).toFixed(6) },
          { label: 'packing fraction, enumerated', value: f.toFixed(9) },
          { label: `packing fraction in closed form, ${closed.text}`, value: closed.value.toFixed(9) },
          { label: 'packing against its closed form', value: Math.abs(f - closed.value).toExponential(2) },
        ];
        ctx.stats(rows);
      },
    };
  },
};

export default crystalLattices;
