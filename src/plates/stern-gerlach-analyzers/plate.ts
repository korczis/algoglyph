import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { rotationY, wignerMatrix, type Real } from '../_shared/quantum/rotation';
import { rgba } from '../_shared/two-slit/draw';

export const MAX_PER_FRAME = 400;

/** χ²'s 99.9 % point for 1 … 3 degrees of freedom (Abramowitz and Stegun, table 26.8). */
export const CHI2_999 = [10.828, 13.816, 16.266];

/** The probabilities a filter of channel index k (or every channel) passes, and those of the last
 * analyser, from the rotation matrices alone. */
export function chain(R: (theta: number) => Real, theta: number, phi: number, keep: number | null) {
  const dim = R(0).length;
  // after the first analyser: |j, j⟩ along z, index 0
  const toB = R(theta);
  // the amplitude of channel m of an analyser turned by θ is Σ R(θ)_{m′m} ψ_{m′}; ψ = e₀
  const pB = keep === null ? 1 : toB[0][keep] ** 2;
  // a kept channel leaves R(θ)|m_B⟩; the last analyser at φ sees R(φ)ᵀR(θ)|m_B⟩, an open one ψ itself
  const RC = R(phi);
  const RCt = RC[0].map((_, a) => RC.map((row) => row[a]));
  const state = keep === null ? Array.from({ length: dim }, (_, a) => (a === 0 ? 1 : 0)) : toB.map((row) => row[keep]);
  const amp = RCt.map((row) => row.reduce((s, v, b) => s + v * state[b], 0));
  return { pB, pC: amp.map((a) => a * a) };
}

export const sternGerlachAnalyzers: PlateCode = {
  id: 'stern-gerlach-analyzers',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'j', label: 'Spin j', value: '1', rebuild: true,
      options: [{ value: '0.5', label: '½' }, { value: '1', label: '1' }, { value: '1.5', label: '3/2' }],
    },
    { kind: 'range', key: 'theta', label: 'Middle analyser, turned by θ about the beam (°)', min: 0, max: 180, step: 5,
      value: 60, rebuild: true },
    {
      kind: 'select', key: 'keep', label: 'Middle analyser passes', value: '0', rebuild: true,
      options: [
        { value: 'open', label: 'every channel (open)' },
        { value: '0', label: 'the top channel only' },
        { value: '1', label: 'the second channel only' },
        { value: '2', label: 'the third channel only' },
        { value: '3', label: 'the fourth channel only (j = 3/2)' },
      ],
    },
    { kind: 'range', key: 'phi', label: 'Last analyser, turned by φ (°)', min: 0, max: 180, step: 5, value: 0, rebuild: true },
    { kind: 'range', key: 'particles', label: 'Particles from the source', min: 100, max: 20000, step: 100, value: 1200,
      rebuild: true, hint: 'At most 20 000: fifty frames at the fastest pace; more would only narrow the binomial errors further.' },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'particles' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'particles', MAX_PER_FRAME);
    let dim = 2;
    let j = 1;
    let keep: number | null = 0;
    let pB = 1;
    let pC: number[] = [];
    let N = 0;
    let sent = 0;
    let passA = 0;
    let passB = 0;
    let counts: number[] = [];
    let fixed: Stat[] = [];

    function setup() {
      j = Number(str(params, 'j'));
      dim = Math.round(2 * j + 1);
      const k = str(params, 'keep');
      keep = k === 'open' ? null : Math.min(Number(k), dim - 1);
      const theta = (num(params, 'theta') * Math.PI) / 180;
      const phi = (num(params, 'phi') * Math.PI) / 180;
      N = Math.round(num(params, 'particles'));
      ({ pB, pC } = chain((t) => rotationY(j, t), theta, phi, keep));
      // the same chain by Wigner's formula, and the rotation's orthogonality
      let gap = 0;
      let orth = 0;
      for (const t of [theta, phi]) {
        const E = rotationY(j, t);
        const W = wignerMatrix(j, t);
        for (let a = 0; a < dim; a++) for (let b = 0; b < dim; b++) {
          gap = Math.max(gap, Math.abs(E[a][b] - W[a][b]));
          let dot = 0;
          for (let c = 0; c < dim; c++) dot += E[c][a] * E[c][b];
          orth = Math.max(orth, Math.abs(dot - (a === b ? 1 : 0)));
        }
      }
      fixed = [
        { label: 'largest |d by e^(−iθJy) − d by Wigner’s formula|', value: gap.toExponential(2) },
        { label: 'largest |RᵀR − 1| of the rotation, numerics', value: orth.toExponential(2) },
        { label: 'middle analyser passes, probability |d_{m j}(θ)|²', value: pB.toFixed(9) },
        { label: 'last analyser, probabilities by channel from the top', value: pC.map((v) => v.toFixed(6)).join(', ') },
      ];
      if (j === 1) {
        // Feynman's table for spin one, in closed form: ((1 + cos θ)/2)², sin²θ/2, ((1 − cos θ)/2)²
        const c = Math.cos(theta);
        const closed = [((1 + c) / 2) ** 2, (1 - c * c) / 2, ((1 - c) / 2) ** 2];
        const W = wignerMatrix(1, theta);
        const gap1 = Math.max(...closed.map((v, a) => Math.abs(W[a][0] ** 2 - v)));
        fixed.push({ label: 'largest gap to the spin-1 table (1 ± cos θ)²/4, sin²θ/2', value: gap1.toExponential(2) });
      }
      sent = 0;
      passA = 0;
      passB = 0;
      counts = new Array(dim).fill(0);
      pacer.start(N);
    }

    /** One particle through the three analysers, each outcome drawn by Born's rule. */
    function shoot() {
      sent++;
      // an unpolarised source: each m equally likely; the first analyser keeps m = j
      if (Math.floor(ctx.rnd() * dim) !== 0) return;
      passA++;
      if (ctx.rnd() >= pB) return;
      passB++;
      let u = ctx.rnd();
      let c = 0;
      while (c < dim - 1 && u >= pC[c]) { u -= pC[c]; c++; }
      counts[c]++;
    }

    function stats(): Stat[] {
      const done = sent >= N;
      const rows: Stat[] = [pacer.row(params), { label: 'particles sent', value: `${sent} of ${N}` }, ...fixed];
      const share = passA ? passB / passA : Number.NaN;
      const se = Math.sqrt((pB * (1 - pB)) / Math.max(1, passA));
      rows.push(
        { label: 'passed the first analyser', value: String(passA) },
        { label: 'share passing the middle analyser, measured', value: done && passA ? share.toFixed(6) : 'after the run' },
        { label: 'middle analyser, measured share in binomial standard errors from |d|²', value: done && passA && se > 0 ? ((share - pB) / se).toFixed(3) : done ? '0.000' : 'after the run' },
        { label: 'last analyser, counts by channel from the top', value: counts.join(', ') },
      );
      // χ² over the channels the last analyser can reach
      let chi = 0;
      let df = -1;
      let impossible = 0;
      counts.forEach((n, c) => {
        const e = passB * pC[c];
        if (pC[c] > 1e-12) { chi += (n - e) ** 2 / e; df++; } else impossible += n;
      });
      rows.push(
        { label: 'counts in channels of zero probability', value: String(impossible) },
        { label: 'χ² of the last analyser’s counts against Born’s rule', value: done && df > 0 ? chi.toFixed(4) : done ? 'one channel: nothing to test' : 'after the run' },
      );
      if (df > 0) rows.push({ label: 'χ² 99.9 % point for the channels reached less one', value: CHI2_999[df - 1].toFixed(3) });
      return rows;
    }

    return {
      setup,
      pace: () => pacer.report(sent >= N, params),
      draw() {
        const take = ctx.thumbnail ? N : pacer.take(params);
        for (let k = 0; k < take && sent < N; k++) shoot();
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        // the apparatus: source, three analysers, the channels each lets through
        const y0 = H * 0.5;
        const xs = [W * 0.04, W * 0.16, W * 0.32, W * 0.5];
        const spread = H * 0.07;
        const chY = (c: number) => y0 + (c - (dim - 1) / 2) * spread;
        g.lineWidth = 1.5;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.5), 1);
        g.beginPath();
        g.moveTo(xs[0], y0);
        g.lineTo(xs[1], y0);
        g.stroke();
        const box = (x: number, label: string) => {
          g.strokeStyle = rgba(fg, 0.8);
          g.strokeRect(x - 12, y0 - spread * (dim / 2 + 0.6), 24, spread * (dim + 1.2));
          g.fillStyle = rgba(fg, 0.8);
          g.font = '11px monospace';
          g.fillText(label, x - 12, y0 - spread * (dim / 2 + 0.6) - 6);
        };
        const beams = (x0: number, x1: number, pass: (c: number) => boolean, out: number | null) => {
          for (let c = 0; c < dim; c++) {
            g.strokeStyle = pass(c) ? rgba(ramp(pal, 0.15 + (0.7 * c) / Math.max(1, dim - 1)), 1) : rgba(mix(ctx.bg, fg, 0.2), 1);
            g.beginPath();
            g.moveTo(x0 + 12, chY(c));
            g.lineTo(x0 + 40, chY(c));
            if (pass(c)) g.lineTo(x1 - 12, out === null ? chY(c) : y0);
            g.stroke();
          }
        };
        box(xs[1], 'S z');
        beams(xs[1], xs[2], (c) => c === 0, 0);
        box(xs[2], `T ${num(params, 'theta')}°`);
        beams(xs[2], xs[3], (c) => keep === null || c === keep, keep === null ? null : 0);
        box(xs[3], `U ${num(params, 'phi')}°`);
        beams(xs[3], W * 0.6, () => true, null);
        // the last analyser's counts against Born's rule, on the right
        const hx = W * 0.64;
        const hw = W * 0.32;
        const peak = Math.max(1, passB * Math.max(...pC), ...counts);
        for (let c = 0; c < dim; c++) {
          const y = chY(c) - spread * 0.35;
          g.fillStyle = rgba(ramp(pal, 0.15 + (0.7 * c) / Math.max(1, dim - 1)), 0.9);
          g.fillRect(hx, y, (counts[c] / peak) * hw, spread * 0.7);
          g.strokeStyle = rgba(fg, 0.8);
          g.setLineDash([4, 3]);
          const e = (passB * pC[c]) / peak;
          g.beginPath();
          g.moveTo(hx + e * hw, y - 2);
          g.lineTo(hx + e * hw, y + spread * 0.7 + 2);
          g.stroke();
          g.setLineDash([]);
        }
        g.fillStyle = rgba(fg, 0.75);
        g.font = '11px monospace';
        g.fillText('last analyser: counts (bars), Born’s rule (dashed)', hx, H * 0.12);
        g.restore();
        ctx.stats(stats());
      },
    };
  },
};

export default sternGerlachAnalyzers;
