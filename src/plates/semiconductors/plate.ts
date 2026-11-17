// Semiconductors: a p-n junction in thermal equilibrium. The bands bend across the junction until
// the Fermi level is flat; the plate solves the Poisson–Boltzmann equation for the potential with
// zero field at both ends and reads the drop and the peak field against two independent closed
// forms, neutrality far from the junction and the equation's first integral. A still diagram of the
// controls.
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { depletionWidth, firstIntegral, intrinsic, K_EV, material, MATERIALS, Q, solve, type Junction } from './junction';

/** Debye lengths of neutral material kept beyond each depletion edge: the far field falls as e^(−x/L). */
const TAIL_DEBYE = 30;
/** Grid nodes per Debye length of the more heavily doped side. */
const NODES_PER_DEBYE = 4;

const exp = (x: number) => x.toExponential(2);

/** Everything a setting fixes, computed once per change of the controls. */
export function junctionOf(id: string, log10na: number, log10nd: number, T: number, perDebye = NODES_PER_DEBYE) {
  const m = material(id);
  const na = 10 ** log10na;
  const nd = 10 ** log10nd;
  const ni = intrinsic(m, T);
  const kT = K_EV * T;
  const vbi = kT * (Math.asinh(na / (2 * ni)) + Math.asinh(nd / (2 * ni)));
  const w = depletionWidth(na, nd, vbi, m);
  const debye = (n: number) => Math.sqrt((m.eps * 8.8541878128e-14 * kT) / (Q * n));
  const left = (w * nd) / (na + nd) + TAIL_DEBYE * debye(na);
  const right = (w * na) / (na + nd) + TAIL_DEBYE * debye(nd);
  const h = debye(Math.max(na, nd)) / perDebye;
  const nodes = Math.ceil((left + right) / h) + 1;
  const j: Junction = solve(na, nd, ni, m, T, left, right, nodes);
  const drop = kT * (j.u[j.u.length - 1] - j.u[0]);
  const step = j.x[1] - j.x[0];
  const j0 = j.x.findIndex((v) => Math.abs(v) < step / 2);
  // the central difference across the junction, less its leading error: u'' jumps there by
  // −(C_A + C_D)/L_i², which puts (h/4)·(that jump) into (u[+1] − u[−1])/2h
  const jump = -(na + nd) / ni / j.li2;
  const gridField = kT * ((j.u[j0 + 1] - j.u[j0 - 1]) / (2 * step) - (step / 4) * jump);
  return { m, na, nd, ni, kT, vbi, w, j, drop, j0, gridField, exact: firstIntegral(na, nd, ni, m, T) };
}

export const semiconductors: PlateCode = {
  id: 'semiconductors',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    { kind: 'select', key: 'material', label: 'Material', value: 'si', options: MATERIALS.map((m) => ({ value: m.id, label: m.label })) },
    { kind: 'range', key: 'na', label: 'Acceptors on the p side, log₁₀ N_A (cm⁻³)', min: 15, max: 18, step: 0.1, value: 16 },
    { kind: 'range', key: 'nd', label: 'Donors on the n side, log₁₀ N_D (cm⁻³)', min: 15, max: 18, step: 0.1, value: 17 },
    { kind: 'range', key: 't', label: 'Temperature (K)', min: 200, max: 500, step: 5, value: 300 },
    paletteParam('spectral'),
  ],
  pace: { kind: 'still', why: 'thermal equilibrium: nothing in it moves, so the junction is solved once when the controls change and drawn as it stands' },
  create(p, ctx) {
    const params = ctx.params;
    let sig = '';
    let s: ReturnType<typeof junctionOf>;
    return {
      setup() {},
      draw() {
        const now = [str(params, 'material'), num(params, 'na'), num(params, 'nd'), num(params, 't')].join('|');
        if (now !== sig) {
          sig = now;
          s = junctionOf(str(params, 'material'), num(params, 'na'), num(params, 'nd'), num(params, 't'));
        }
        const { j, kT, m } = s;
        const W = ctx.width; const H = ctx.height;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
        p.textSize(Math.max(11, Math.min(15, W * 0.018)));
        const n = j.x.length;
        const x0 = j.x[0]; const x1 = j.x[n - 1];
        const px = (x: number) => W * 0.08 + ((x - x0) / (x1 - x0)) * W * 0.84;
        // the bands: E_c and E_v a half gap above and below the intrinsic level −u kT; E_F at 0
        const top = H * 0.1; const bot = H * 0.58;
        const span = Math.abs(j.un - j.up) * kT + m.gap + 0.2;
        const ey = (e: number) => top + (bot - top) * (0.5 - e / span);
        p.noFill(); p.strokeWeight(2);
        const stride = Math.max(1, Math.floor(n / 800));
        for (const [shift, c] of [[m.gap / 2, ramp(pal, 0.2)], [0, mix(ctx.bg, ctx.fg, 0.35)], [-m.gap / 2, ramp(pal, 0.8)]] as const) {
          p.stroke(c[0], c[1], c[2]);
          p.beginShape();
          for (let i = 0; i < n; i += stride) p.vertex(px(j.x[i]), ey(-j.u[i] * kT + (shift as number)));
          p.endShape();
        }
        p.stroke(fg[0], fg[1], fg[2], 140); p.strokeWeight(1);
        p.line(px(x0), ey(0), px(x1), ey(0));
        p.noStroke(); p.fill(fg[0], fg[1], fg[2], 200); p.textAlign(p.LEFT, p.BOTTOM);
        p.text('conduction band, intrinsic level, valence band; the Fermi level flat at 0', W * 0.08, top - 4);
        p.textAlign(p.LEFT, p.TOP);
        p.text(`p side, N_A = ${s.na.toExponential(1)}`, W * 0.08, bot + 4);
        p.textAlign(p.RIGHT, p.TOP);
        p.text(`n side, N_D = ${s.nd.toExponential(1)}`, W * 0.92, bot + 4);
        // the space charge ρ/q = p − n + N_D − N_A, as a share of the larger doping
        const cy = H * 0.8; const ch = H * 0.12;
        const big = Math.max(s.na, s.nd) / s.ni;
        p.stroke(fg[0], fg[1], fg[2], 60); p.line(px(x0), cy, px(x1), cy);
        p.stroke(...ramp(pal, 0.5)); p.strokeWeight(2); p.noFill();
        p.beginShape();
        for (let i = 0; i < n; i += stride) {
          const rho = Math.exp(-j.u[i]) - Math.exp(j.u[i]) + j.c[i];
          p.vertex(px(j.x[i]), cy - (rho / big) * ch);
        }
        p.endShape();
        p.noStroke(); p.fill(fg[0], fg[1], fg[2], 200); p.textAlign(p.LEFT, p.BOTTOM);
        p.text('space charge, a share of the larger doping', W * 0.08, cy - ch - 4);

        const rows: Stat[] = [
          { label: 'intrinsic density n_i', value: `${s.ni.toExponential(4)} cm⁻³` },
          { label: 'built-in potential from neutrality', value: `${s.vbi.toFixed(9)} V` },
          { label: 'potential drop, solved', value: `${s.drop.toFixed(9)} V` },
          { label: 'solved drop against neutrality', value: `${exp(Math.abs(s.drop - s.vbi))} V` },
          { label: 'field at the junction, first integral', value: `${s.exact.field.toExponential(6)} V/cm` },
          { label: 'field at the junction, solved', value: `${s.gridField.toExponential(6)} V/cm` },
          { label: 'solved field against the first integral, relative', value: exp(Math.abs(s.gridField / s.exact.field - 1)) },
          { label: 'depletion approximation width', value: `${(s.w * 1e4).toFixed(4)} µm` },
          { label: 'grid', value: `${n.toLocaleString('en')} nodes, ${((j.x[1] - j.x[0]) * 1e7).toFixed(2)} nm apart, ${j.iterations} Newton steps` },
        ];
        ctx.stats(rows);
      },
    };
  },
};

export default semiconductors;
