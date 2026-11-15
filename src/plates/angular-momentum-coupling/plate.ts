import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import {
  block, breitRabi, cgByDiagonalising, cgRacah, hyperfineLevels, type ProductState,
} from '../_shared/quantum/coupling';
import { rgba } from '../_shared/two-slit/draw';

type Experiment = 'cg' | 'zeeman';

export const SAMPLES = 300;
export const MAX_PER_FRAME = 30;
/** The hyperfine constant: energies are in units of A. */
const A = 1;
const when = (...values: Experiment[]) => ({ key: 'experiment', values });
const half = (x: number) => (Number.isInteger(x) ? String(x) : `${Math.round(2 * x)}/2`);

export const angularMomentumCoupling: PlateCode = {
  id: 'angular-momentum-coupling',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'experiment', label: 'Experiment', value: 'cg', rebuild: true,
      options: [
        { value: 'cg', label: 'Clebsch–Gordan coefficients of j₁ ⊗ j₂' },
        { value: 'zeeman', label: 'Hyperfine levels in a field (Breit–Rabi)' },
      ],
    },
    {
      kind: 'select', key: 'j1', label: 'j₁ (the nuclear spin I in a field)', value: '1', rebuild: true,
      options: [{ value: '0.5', label: '½' }, { value: '1', label: '1' }, { value: '1.5', label: '3/2' }],
    },
    {
      kind: 'select', key: 'j2', label: 'j₂', value: '0.5', rebuild: true, when: when('cg'),
      options: [{ value: '0.5', label: '½' }, { value: '1', label: '1' }],
    },
    { kind: 'range', key: 'field', label: 'Largest field, x = b / A(I + ½)', min: 0.5, max: 4, step: 0.1, value: 2.5,
      rebuild: true, when: when('zeeman'), hint: 'Past x ≈ 1 the levels sort by the electron’s spin (Paschen–Back); 4 shows that limit clearly.' },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'steps' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'steps', MAX_PER_FRAME);
    let experiment: Experiment = 'cg';
    let j1 = 1;
    let j2 = 0.5;
    let shown = 0;
    let total = 1;
    let fixed: Stat[] = [];
    // the coupled states in order, J descending, M descending; the product states in order
    let coupled: { J: number; M: number; row: number[] }[] = [];
    let product: ProductState[] = [];
    // the field sweep: x, then each level's energy by diagonalisation and by Breit–Rabi
    let sweep: { x: number; levels: number[]; formula: number[] }[] = [];

    function setup() {
      experiment = str(params, 'experiment') as Experiment;
      j1 = Number(str(params, 'j1'));
      j2 = experiment === 'zeeman' ? 0.5 : Number(str(params, 'j2'));
      shown = 0;
      fixed = [];
      if (experiment === 'cg') {
        product = [];
        for (let M = j1 + j2; M >= -(j1 + j2) - 1e-9; M--) product.push(...block(j1, j2, M));
        const table = cgByDiagonalising(j1, j2);
        coupled = [];
        let gap = 0;
        for (let J = j1 + j2; J >= Math.abs(j1 - j2) - 1e-9; J--) {
          for (let M = J; M >= -J - 1e-9; M--) {
            const entry = table.get(`${J},${M}`)!;
            const row = product.map((s) => {
              const i = entry.states.findIndex((t) => t.m1 === s.m1 && t.m2 === s.m2);
              return i < 0 ? 0 : entry.c[i];
            });
            product.forEach((s, i) => { gap = Math.max(gap, Math.abs(row[i] - cgRacah(j1, s.m1, j2, s.m2, J, M))); });
            coupled.push({ J, M, row });
          }
        }
        let orth = 0;
        coupled.forEach((a, i) => coupled.forEach((b, k) => {
          const dot = a.row.reduce((s, v, n) => s + v * b.row[n], 0);
          orth = Math.max(orth, Math.abs(dot - (i === k ? 1 : 0)));
        }));
        const Js: string[] = [];
        for (let J = j1 + j2; J >= Math.abs(j1 - j2) - 1e-9; J--) Js.push(`${half(J)} (${Math.round(2 * J + 1)} states)`);
        total = coupled.length;
        fixed = [
          { label: 'total J found, each with 2J + 1 states', value: Js.join(', ') },
          { label: 'states in the product basis, and in the coupled basis', value: `${product.length} and ${coupled.length}` },
          { label: 'largest |CG by diagonalising J² − CG by Racah’s formula|', value: gap.toExponential(2) },
          { label: 'largest |CCᵀ − 1| of the coupled basis, numerics', value: orth.toExponential(2) },
        ];
      } else {
        const I = j1;
        const xmax = num(params, 'field');
        const dE = A * (I + 0.5);
        sweep = [];
        let gap = 0;
        for (let k = 0; k < SAMPLES; k++) {
          const x = (xmax * k) / (SAMPLES - 1);
          const levels: number[] = [];
          const formula: number[] = [];
          hyperfineLevels(I, A, x * dE).forEach((values, m) => {
            const br = breitRabi(I, A, x * dE, m);
            values.forEach((v, i) => { levels.push(v); formula.push(br[i]); gap = Math.max(gap, Math.abs(v - br[i])); });
          });
          sweep.push({ x, levels, formula });
        }
        const zero = sweep[0].levels;
        total = SAMPLES;
        fixed = [
          { label: 'levels', value: String(zero.length) },
          { label: 'largest |E by diagonalisation − Breit–Rabi| over the sweep (units of A)', value: gap.toExponential(2) },
          { label: 'zero-field splitting, measured (units of A)', value: (Math.max(...zero) - Math.min(...zero)).toFixed(12) },
          { label: 'hyperfine interval A(I + ½)', value: dE.toFixed(12) },
        ];
      }
      pacer.start(total);
    }

    return {
      setup,
      pace: () => pacer.report(shown >= total, params),
      draw() {
        const take = ctx.thumbnail ? total : pacer.take(params);
        shown = Math.min(total, shown + take);
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        g.font = '11px monospace';
        if (experiment === 'cg') {
          // rows: coupled |J M⟩; columns: product |m₁ m₂⟩; a cell's colour is the coefficient's sign, its depth the size
          const n = product.length;
          const x0 = W * 0.2;
          const y0 = H * 0.16;
          const cell = Math.min((W * 0.75) / n, (H * 0.76) / n);
          product.forEach((s, i) => {
            g.fillStyle = rgba(fg, 0.75);
            g.save();
            g.translate(x0 + (i + 0.6) * cell, y0 - 4);
            g.rotate(-Math.PI / 4);
            g.fillText(`${half(s.m1)},${half(s.m2)}`, 0, 0);
            g.restore();
          });
          coupled.forEach((c, r) => {
            g.fillStyle = rgba(fg, 0.75);
            g.fillText(`J ${half(c.J)}, M ${half(c.M)}`, W * 0.03, y0 + (r + 0.65) * cell);
            c.row.forEach((v, i) => {
              g.strokeStyle = rgba(mix(ctx.bg, fg, 0.15), 1);
              g.strokeRect(x0 + i * cell, y0 + r * cell, cell, cell);
              if (r >= shown || Math.abs(v) < 1e-12) return;
              g.fillStyle = rgba(ramp(pal, v > 0 ? 0.85 : 0.15), Math.min(1, 0.15 + Math.abs(v)));
              g.fillRect(x0 + i * cell + 1, y0 + r * cell + 1, cell - 2, cell - 2);
              if (cell > 34) {
                g.fillStyle = rgba(fg, 0.95);
                g.fillText(v.toFixed(3), x0 + i * cell + 3, y0 + (r + 0.6) * cell);
              }
            });
          });
          g.fillStyle = rgba(fg, 0.75);
          g.fillText(`⟨${half(j1)} m₁; ${half(j2)} m₂ | J M⟩: rows coupled states, columns m₁,m₂; colour the sign, depth the size`, W * 0.03, H * 0.06);
        } else {
          const x0 = W * 0.08;
          const w = W * 0.86;
          const y0 = H * 0.1;
          const h = H * 0.8;
          let lo = Infinity;
          let hi = -Infinity;
          for (const s of sweep) for (const v of s.levels) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
          const X = (k: number) => x0 + (k / (SAMPLES - 1)) * w;
          const Y = (v: number) => y0 + h - ((v - lo) / Math.max(1e-12, hi - lo)) * h;
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
          g.strokeRect(x0, y0, w, h);
          const levels = sweep[0].levels.length;
          for (let l = 0; l < levels; l++) {
            g.strokeStyle = rgba(fg, 0.5);
            g.setLineDash([4, 3]);
            g.beginPath();
            sweep.forEach((s, k) => { if (k === 0) g.moveTo(X(k), Y(s.formula[l])); else g.lineTo(X(k), Y(s.formula[l])); });
            g.stroke();
            g.setLineDash([]);
            g.strokeStyle = rgba(ramp(pal, 0.1 + (0.8 * l) / Math.max(1, levels - 1)), 1);
            g.lineWidth = 1.8;
            g.beginPath();
            for (let k = 0; k < shown; k++) { if (k === 0) g.moveTo(X(k), Y(sweep[k].levels[l])); else g.lineTo(X(k), Y(sweep[k].levels[l])); }
            g.stroke();
          }
          g.fillStyle = rgba(fg, 0.75);
          g.fillText('energy (units of A) against x = b/A(I + ½): diagonalised (solid), Breit–Rabi (dashed)', x0, y0 - 8);
        }
        g.restore();
        ctx.stats([pacer.row(params), { label: experiment === 'cg' ? 'coupled states shown' : 'field steps shown', value: `${shown} of ${total}` }, ...fixed]);
      },
    };
  },
};

export default angularMomentumCoupling;
