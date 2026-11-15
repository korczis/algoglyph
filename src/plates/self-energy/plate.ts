// The energy of a charged ball three ways (the field's ∫½E² dV, the work of assembling it shell by
// shell, the pairs of N points drawn from it), the closed form beside them, the momentum of its
// field when it moves (the 4/3 problem), and what it means for a point electron
// (src/plates/_shared/fields/self-energy.ts). Units: ε₀ = 1, Q = 1, R = 1; energies in Q²/4πε₀R.
import { optionId } from '../../core/data';
import { paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import {
  assemblyWork, ball, closedForm, CODATA, enclosed, fieldEnergy, momentumOverEnergy, PairSum, samplePoints,
  type Ball, type Profile,
} from '../_shared/fields/self-energy';
import { rgba } from '../_shared/two-slit/draw';

/** Pair distances a frame may compute: the sum over pairs is spread over frames, a row at a time. */
export const PAIRS_PER_FRAME = 200_000;
const FOUR_PI = 4 * Math.PI;
/** The radial plots reach this many radii. */
const R_MAX = 3;

const f9 = (v: number) => v.toFixed(9);

export const selfEnergy: PlateCode = {
  id: 'self-energy',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 4,
  params: [
    {
      kind: 'select', key: 'profile', label: 'Charge', value: 'uniform', rebuild: true,
      options: [
        { value: 'uniform', label: 'Spread evenly through the ball' },
        { value: 'power', label: 'Denser outwards, ρ ∝ rᵏ' },
        { value: 'shell', label: 'All on the surface (a shell)' },
      ],
    },
    { kind: 'range', key: 'k', label: 'Power k of ρ ∝ rᵏ', min: 0, max: 8, step: 0.5, value: 2, rebuild: true, when: { key: 'profile', values: ['power'] } },
    { kind: 'range', key: 'points', label: 'Points in the pair sum', min: 100, max: 4000, step: 100, value: 1000, rebuild: true },
    paletteParam('ember'),
  ],
  pace: { kind: 'still', why: 'a derivation of the controls, drawn once; only the sum over pairs is spread over a few frames' },
  create(p, ctx) {
    const params = ctx.params;
    let b: Ball;
    let pairs: PairSum;
    let pts: { x: Float64Array; y: Float64Array; z: Float64Array };
    let fixed: Stat[] = [];
    let input = '';
    let ok = true;
    let rows: Stat[] = [];
    /** The plots, computed once: E(r)/max E and the share of the field energy inside r. */
    const STEPS = 300;
    let plotE = new Float64Array(STEPS + 1);
    let plotU = new Float64Array(STEPS + 1);

    function profileOf(): Profile | null {
      const raw = str(params, 'profile');
      if (optionId(raw)) {
        const table = ctx.data?.(optionId(raw) ?? '') ?? null;
        if (!table) { input = 'your data: none attached; attach a table of r, rho'; return null; }
        // sorted by radius, so the profile is a function of r whatever the order of the rows
        const order = Array.from({ length: table.rows }, (_, i) => i).sort((i, j) => table.values[0][i] - table.values[0][j]);
        const r = order.map((i) => table.values[0][i]);
        const rho = order.map((i) => table.values[1][i]);
        if (!rho.some((v) => v > 0)) { input = `your data, ${table.rows} points of ρ(r), all zero: no charge to weigh`; return null; }
        input = `your data, ρ(r) through ${table.rows} points`;
        return { kind: 'table', r, rho };
      }
      input = raw === 'shell' ? 'seeded: a thin shell' : raw === 'power' ? `seeded: ρ ∝ r^${num(params, 'k')}` : 'seeded: an even ball';
      return raw === 'shell' ? { kind: 'shell' } : { kind: 'power', k: raw === 'power' ? num(params, 'k') : 0 };
    }

    function measure(): Stat[] {
      const out: Stat[] = [{ label: 'Input', value: input }, ...fixed];
      if (!ok) return out;
      out.splice(3, 0, {
        label: 'pairs of N points, ½Σqᵢqⱼ/4πε₀rᵢⱼ ÷ (1 − 1/N)',
        value: pairs.done ? f9(pairs.energy * FOUR_PI) : `${f9(pairs.energy * FOUR_PI)} (partial: ${pairs.row} of ${pairs.n} rows)`,
      });
      return out;
    }

    return {
      setup() {
        const prof = profileOf();
        ok = prof !== null;
        fixed = [];
        if (!prof) { rows = measure(); return; }
        b = ball(prof);
        const U = fieldEnergy(b);
        const W = assemblyWork(b);
        const exact = closedForm(prof);
        const outside = 1 / (2 * FOUR_PI);
        // how large the electron would be if its rest energy were all this distribution's field energy
        const { e, eps0, me, c, re } = CODATA;
        const classical = (e * e) / (4 * Math.PI * eps0 * me * c * c);
        fixed.push(
          { label: 'energy of the field ∫½ε₀E² dV, in Q²/4πε₀R', value: f9(U * FOUR_PI) },
          { label: 'work of assembling it shell by shell, ∫Q dQ/4πε₀r', value: f9(W * FOUR_PI) },
          { label: 'field energy minus assembly work (numerics)', value: (FOUR_PI * (U - W)).toExponential(2) },
          ...(exact !== null ? [{ label: 'closed form (k + 3)/(2k + 5), ½ for a shell', value: f9(exact * FOUR_PI) }] : []),
          { label: 'share of the energy outside the ball', value: (outside / U).toFixed(6) },
          { label: 'field momentum over U v/c², ∫ε₀E×B dV by quadrature', value: f9(momentumOverEnergy(b)) },
          { label: 'classical electron radius e²/4πε₀mₑc², fm (CODATA 2018 e, ε₀, mₑ, c)', value: (classical * 1e15).toFixed(10) },
          { label: 'CODATA 2018 rₑ, fm', value: (re * 1e15).toFixed(10) },
          { label: 'radius whose field energy would be mₑc², fm', value: (U * FOUR_PI * classical * 1e15).toFixed(6) },
          { label: 'radiation reaction time 2rₑ/3c, s', value: ((2 * classical) / (3 * c)).toExponential(4) },
        );
        const E = (r: number) => (r <= 0 ? 0 : (r >= 1 ? 1 : enclosed(b, r)) / (FOUR_PI * r * r));
        plotE = new Float64Array(STEPS + 1);
        plotU = new Float64Array(STEPS + 1);
        let acc = 0;
        for (let k = 1; k <= STEPS; k++) {
          // the energy inside r: ½E² 4πr² dr by the midpoint rule along the plot
          const mid = ((k - 0.5) / STEPS) * R_MAX;
          acc += 0.5 * E(mid) ** 2 * FOUR_PI * mid * mid * (R_MAX / STEPS);
          plotU[k] = acc / U;
          plotE[k] = E((k / STEPS) * R_MAX);
        }
        const eMax = Math.max(...plotE) || 1;
        for (let k = 0; k <= STEPS; k++) plotE[k] /= eMax;
        const rnd = mulberry32(Math.floor(ctx.rnd() * 0x7fffffff) + 1);
        pts = samplePoints(b, num(params, 'points'), rnd);
        pairs = new PairSum(pts);
        rows = measure();
      },
      draw() {
        if (ok && !pairs.done) { pairs.advance(ctx.thumbnail ? Infinity : PAIRS_PER_FRAME); rows = measure(); }
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        // a slice through the ball, |z| < 0.2, with the sampled points in it
        const R = Math.min(H * 0.4, W * 0.2);
        const cx = W * 0.25;
        const cy = H / 2;
        g.strokeStyle = rgba(fg, 0.7);
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.stroke();
        if (ok) {
          g.fillStyle = rgba(ramp(pal, 0.75), 0.85);
          for (let i = 0; i < pts.x.length; i++) {
            if (Math.abs(pts.z[i]) > 0.2) continue;
            g.fillRect(cx + pts.x[i] * R - 1, cy - pts.y[i] * R - 1, 2.2, 2.2);
          }
        }
        g.fillStyle = rgba(fg, 0.75);
        g.font = '11px monospace';
        g.fillText('a slice |z| < 0.2R of the points', cx - R, cy + R + 18);
        // E(r) and the field energy inside r, as a share of the whole, out to R_MAX radii
        const px = W * 0.5;
        const pw = W * 0.46;
        const top = H * 0.12;
        const ph = H * 0.72;
        g.strokeStyle = rgba(fg, 0.3);
        g.strokeRect(px, top, pw, ph);
        // the ball's edge
        g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(px + pw / R_MAX, top); g.lineTo(px + pw / R_MAX, top + ph); g.stroke();
        g.setLineDash([]);
        if (ok) {
          for (const [series, colour] of [[plotE, ramp(pal, 0.9)], [plotU, ramp(pal, 0.45)]] as const) {
            g.strokeStyle = rgba(colour, 1);
            g.lineWidth = 2;
            g.beginPath();
            for (let k = 0; k <= STEPS; k++) {
              const xx = px + (k / STEPS) * pw;
              const yy = top + ph - series[k] * ph * 0.95;
              if (k === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
            }
            g.stroke();
          }
        }
        g.fillStyle = rgba(fg, 0.75);
        g.fillText('E(r) (bright) and the share of the field energy inside r; the ball’s edge dashed', px, top - 8);
        g.fillText(`r from 0 to ${R_MAX}R`, px, top + ph + 16);
        g.restore();
        ctx.stats(rows);
      },
    };
  },
};

export default selfEnergy;
