import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import {
  action, gradient, harmonic, hessianDiagonal, morseIndex, pendulum, quartic, stationaryPath, uniform, verletShoot,
  type Potential, type StationaryPath,
} from '../_shared/particles/action';
import { rgba } from '../_shared/two-slit/draw';

type Kind = 'harmonic' | 'uniform' | 'pendulum' | 'quartic';

/** The most path points a frame reveals: the bead's walk along the path is the counted change. */
export const MAX_PER_FRAME = 40;
const OMEGA = 1;
const G = 1;
const BUMPS = 2;

/** The potential a select names, with ω = 1, g = 1 and the quartic's c = 1. */
export function potentialOf(kind: Kind): Potential {
  return kind === 'uniform' ? uniform(G) : kind === 'pendulum' ? pendulum(OMEGA) : kind === 'quartic' ? quartic(1) : harmonic(OMEGA);
}

/** The classical path where it has a closed form: the oscillator's and free fall's. */
export function closedPath(kind: Kind, a: number, b: number, T: number): ((t: number) => number) | null {
  if (kind === 'harmonic') {
    const s = Math.sin(OMEGA * T);
    return (t) => (a * Math.sin(OMEGA * (T - t)) + b * Math.sin(OMEGA * t)) / s;
  }
  if (kind === 'uniform') return (t) => a + ((b - a) * t) / T + 0.5 * G * t * (T - t);
  return null;
}

export const leastAction: PlateCode = {
  id: 'least-action',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'potential', label: 'Potential V(q)', value: 'harmonic', rebuild: true,
      options: [
        { value: 'harmonic', label: 'Spring, ½ω²q²' },
        { value: 'uniform', label: 'Uniform gravity, gq' },
        { value: 'pendulum', label: 'Pendulum, ω²(1 − cos q)' },
        { value: 'quartic', label: 'Quartic well, q⁴/4' },
      ],
    },
    { kind: 'range', key: 'T', label: 'Time between the ends T (in 1/ω)', min: 0.5, max: 12, step: 0.1, value: 2,
      rebuild: true, hint: 'Past T = π the spring path stops being a minimum of the action: a conjugate point.' },
    { kind: 'range', key: 'a', label: 'Start q(0)', min: -3, max: 3, step: 0.1, value: 1, rebuild: true,
      hint: 'Up to ±3, just short of the pendulum’s top at ±π.' },
    { kind: 'range', key: 'b', label: 'End q(T)', min: -3, max: 3, step: 0.1, value: 0.5, rebuild: true,
      hint: 'Up to ±3, just short of the pendulum’s top at ±π.' },
    { kind: 'range', key: 'points', label: 'Steps N of the discrete path', min: 20, max: 1300, step: 10, value: 200,
      rebuild: true, hint: 'Each step adds one unknown. The top is what finding a path by shooting affords when a rebuild must stay quick.' },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'points' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'points', MAX_PER_FRAME);
    let kind: Kind = 'harmonic';
    let pot: Potential = harmonic(OMEGA);
    let path: StationaryPath;
    let shot: Float64Array = new Float64Array(0);
    let a = 1;
    let b = 0;
    let T = 1;
    let N = 10;
    let shown = 0;
    let curves: [number, number][][] = [];
    let rows: Stat[] = [];

    const bump = (j: number, k: number) => Math.sin((j * Math.PI * k) / N);

    function setup() {
      kind = str(params, 'potential') as Kind;
      pot = potentialOf(kind);
      a = num(params, 'a');
      b = num(params, 'b');
      T = num(params, 'T');
      N = Math.round(num(params, 'points'));
      path = stationaryPath(pot, a, b, T, N);
      const { q, h } = path;
      shot = verletShoot(pot, q[0], q[1], h, N);
      const s0 = action(pot, q, h);
      // the action along q + εηⱼ, ηⱼ = sin(jπt/T): its shape says minimum or saddle in that direction
      const span = 0.5;
      curves = Array.from({ length: BUMPS }, (_, j) => Array.from({ length: 41 }, (_, i) => {
        const eps = -span + (2 * span * i) / 40;
        const trial = q.map((v, k) => v + eps * bump(j + 1, k));
        return [eps, action(pot, trial, h) - s0] as [number, number];
      }));
      const d = hessianDiagonal(pot, q, h);
      const index = morseIndex(d, -1 / h);
      const g = new Float64Array(N + 1);
      const residual = gradient(pot, q, h, g);
      let gap = 0;
      for (let k = 0; k <= N; k++) gap = Math.max(gap, Math.abs(q[k] - shot[k]));
      // ηᵀHη for η = sin(πt/T): the second variation in the first bump's direction
      let quad = 0;
      for (let i = 0; i < N - 1; i++) {
        const e = bump(1, i + 1);
        quad += d[i] * e * e - (2 / h) * (i + 1 < N - 1 ? e * bump(1, i + 2) : 0);
      }
      const straight = Float64Array.from({ length: N + 1 }, (_, k) => a + ((b - a) * k) / N);
      rows = [
        { label: 'how the path was found', value: `${path.shot ? 'shooting, then' : 'from the straight line by'} Newton, ${path.iterates.length - (path.shot ? 2 : 1)} iteration(s), ${path.converged ? 'converged' : 'not converged'}` },
        { label: 'largest |∂S/∂qₖ| of the stationary path, numerics', value: residual.toExponential(2) },
        { label: 'largest gap to the Verlet trajectory shot from q₀, q₁', value: gap.toExponential(2) },
        { label: 'action S of the stationary path', value: s0.toFixed(9) },
        { label: 'action of the straight line less the stationary action', value: (action(pot, straight, h) - s0).toFixed(9) },
        { label: 'negative eigenvalues of the Hessian (Morse index), by a Sturm count', value: String(index) },
        { label: 'second variation along sin(πt/T), ηᵀHη', value: quad.toFixed(9) },
      ];
      const exact = closedPath(kind, a, b, T);
      if (exact) {
        let worst = 0;
        for (let k = 0; k <= N; k++) worst = Math.max(worst, Math.abs(q[k] - exact(k * h)));
        rows.push({ label: 'largest |qₖ − q(tₖ)| against the closed-form path', value: worst.toExponential(3) });
      }
      if (kind === 'harmonic') {
        const w = OMEGA;
        const sT = (w / (2 * Math.sin(w * T))) * ((a * a + b * b) * Math.cos(w * T) - 2 * a * b);
        rows.push(
          { label: 'action, closed form (ω/2 sin ωT)((a² + b²) cos ωT − 2ab)', value: sT.toFixed(9) },
          { label: '⌊ωT/π⌋, conjugate points of the continuous path', value: String(Math.floor((w * T) / Math.PI)) },
          { label: 'second variation, continuous (T/2)((π/T)² − ω²)', value: ((T / 2) * ((Math.PI / T) ** 2 - w * w)).toFixed(9) },
        );
      }
      shown = 0;
      pacer.start(N + 1);
    }

    return {
      setup,
      pace: () => pacer.report(shown >= N + 1, params),
      draw() {
        const take = ctx.thumbnail ? N + 1 : pacer.take(params);
        shown = Math.min(N + 1, shown + take);
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        // the path in the (t, q) plane, on the left
        const x0 = W * 0.06;
        const w = W * 0.5;
        const y0 = H * 0.14;
        const h = H * 0.72;
        let lo = Math.min(a, b);
        let hi = Math.max(a, b);
        for (const it of path.iterates) for (const v of it) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        const pad = 0.08 * Math.max(1e-6, hi - lo);
        lo -= pad;
        hi += pad;
        const X = (k: number) => x0 + (k / N) * w;
        const Y = (v: number) => y0 + h - ((v - lo) / (hi - lo)) * h;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
        g.lineWidth = 1;
        g.strokeRect(x0, y0, w, h);
        if (lo < 0 && hi > 0) {
          g.beginPath();
          g.moveTo(x0, Y(0));
          g.lineTo(x0 + w, Y(0));
          g.stroke();
        }
        const line = (q: ArrayLike<number>, upto: number) => {
          g.beginPath();
          for (let k = 0; k < upto; k++) { if (k === 0) g.moveTo(X(k), Y(q[k])); else g.lineTo(X(k), Y(q[k])); }
          g.stroke();
        };
        path.iterates.forEach((it, i) => {
          if (i === path.iterates.length - 1) return;
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.25 + 0.3 * (i / Math.max(1, path.iterates.length - 1))), 1);
          g.setLineDash(i === 0 ? [4, 3] : []);
          line(it, N + 1);
        });
        g.setLineDash([]);
        g.strokeStyle = rgba(ramp(pal, 0.85), 1);
        g.lineWidth = 2;
        line(path.q, shown);
        // the Verlet shot, as dots on top of the path it must reproduce
        g.fillStyle = rgba(ramp(pal, 0.15), 1);
        const every = Math.max(1, Math.round(N / 40));
        for (let k = 0; k < shown; k += every) g.fillRect(X(k) - 1.5, Y(shot[k]) - 1.5, 3, 3);
        const last = Math.max(0, shown - 1);
        g.beginPath();
        g.arc(X(last), Y(path.q[last]), 5, 0, 2 * Math.PI);
        g.fill();
        g.fillStyle = rgba(fg, 0.75);
        g.font = '11px monospace';
        g.fillText(`q(t): straight guess (dashed), ${path.shot ? 'shot and ' : ''}Newton iterates (faint), stationary path, Verlet (dots)`, x0, y0 - 8);
        // the action along two bumps, on the right
        const cx = W * 0.62;
        const cw = W * 0.34;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
        g.strokeRect(cx, y0, cw, h);
        let slo = Infinity;
        let shi = -Infinity;
        for (const c of curves) for (const [, s] of c) { slo = Math.min(slo, s); shi = Math.max(shi, s); }
        const span = Math.max(1e-9, Math.max(Math.abs(slo), Math.abs(shi)));
        const SY = (s: number) => y0 + h / 2 - (s / span) * (h / 2) * 0.9;
        g.beginPath();
        g.moveTo(cx, SY(0));
        g.lineTo(cx + cw, SY(0));
        g.stroke();
        curves.forEach((c, j) => {
          g.strokeStyle = rgba(ramp(pal, j === 0 ? 0.8 : 0.3), 1);
          g.lineWidth = 1.6;
          g.beginPath();
          c.forEach(([eps, s], i) => {
            const xx = cx + ((eps + 0.5) / 1) * cw;
            if (i === 0) g.moveTo(xx, SY(s)); else g.lineTo(xx, SY(s));
          });
          g.stroke();
        });
        g.fillStyle = rgba(fg, 0.75);
        g.fillText('S(q + εηⱼ) − S(q), ε from −0.5 to 0.5; ηⱼ = sin(jπt/T), j = 1, 2', cx, y0 - 8);
        g.restore();
        ctx.stats([pacer.row(params), { label: 'path points walked', value: `${shown} of ${N + 1}` }, ...rows]);
      },
    };
  },
};

export default leastAction;
