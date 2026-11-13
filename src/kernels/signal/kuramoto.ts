import { str } from '../../core/plate';
import { gaussian } from '../../core/random';
import { mulberry32 } from '../../engines/signal/input';
import { Rk4, type Deriv } from '../../plates/_shared/ode/ode';
import type { Meter, SignalKernel, View } from '../../engines/signal/trace';

export const EVAL = 'Derivative evaluations';
const DT = 0.02;

/** The order parameter r·e^{iψ} = (1/N) Σ e^{iθ_j}. */
export function order(theta: Float64Array): { r: number; psi: number } {
  let c = 0; let s = 0;
  for (let i = 0; i < theta.length; i++) { c += Math.cos(theta[i]); s += Math.sin(theta[i]); }
  c /= theta.length; s /= theta.length;
  return { r: Math.hypot(c, s), psi: Math.atan2(s, c) };
}

/**
 * dθ_i/dt = ω_i + (K/N) Σ_j sin(θ_j − θ_i), in its exact mean-field form K·r·sin(ψ − θ_i), as
 * the derivative the library's Rk4 (src/plates/_shared/ode) steps; each call is N evaluations.
 */
export function derivOf(omega: Float64Array, K: number, meter?: Meter): Deriv {
  return (_t, theta, out) => {
    const { r, psi } = order(theta);
    for (let i = 0; i < theta.length; i++) out[i] = omega[i] + K * r * Math.sin(psi - theta[i]);
    meter?.add(EVAL, theta.length);
  };
}

/** Natural frequencies: Lorentzian by quantiles (critical coupling 2γ) or seeded Gaussian. */
export function frequencies(n: number, dist: string, width: number, rnd: () => number): { omega: Float64Array; kc: number } {
  if (dist === 'gauss') {
    return { omega: Float64Array.from({ length: n }, () => width * gaussian(rnd)), kc: (2 / Math.PI) * width * Math.sqrt(2 * Math.PI) };
  }
  return { omega: Float64Array.from({ length: n }, (_, i) => width * Math.tan(Math.PI * ((i + 0.5) / n - 0.5))), kc: 2 * width };
}

/** Simulate and return r over time and the time-averaged r over the second half. */
export function simulate(n: number, K: number, width: number, steps: number, seed: number, dist = 'lorentz', meter?: Meter): { r: number[]; mean: number } {
  const rnd = mulberry32(seed);
  const { omega } = frequencies(n, dist, width, rnd);
  const theta = Float64Array.from({ length: n }, () => 2 * Math.PI * rnd());
  const r: number[] = [];
  const rk = new Rk4(n); const f = derivOf(omega, K, meter);
  for (let s = 0; s < steps; s++) { rk.step(f, 0, theta, DT); r.push(order(theta).r); }
  const tail = r.slice(steps >> 1);
  return { r, mean: tail.reduce((a, b) => a + b, 0) / tail.length };
}

// Phase oscillators pulled toward the population's mean phase; above the critical coupling a
// cluster locks and the order parameter r rises from the incoherent level of about 1/√N.
export const kernel: SignalKernel = {
  aspect: 16 / 9,
  params: [
    { kind: 'range', key: 'n', label: 'Oscillators', min: 16, max: 512, step: 16, value: 192, rebuild: true },
    { kind: 'range', key: 'K', label: 'Coupling K', min: 0, max: 6, step: 0.05, value: 2 },
    { kind: 'select', key: 'dist', label: 'Natural frequencies', value: 'lorentz', options: [
      { value: 'lorentz', label: 'Lorentzian, half-width γ' }, { value: 'gauss', label: 'Gaussian, σ = γ' }] },
    // the critical coupling is 2γ (Lorentzian) or 1.6γ (Gaussian): γ ends at 2, where K_c = 4,
    // so the coupling's range up to 6 still reaches well above it and the plate shows locking
    { kind: 'range', key: 'gamma', label: 'Frequency width γ', min: 0.1, max: 2, step: 0.05, value: 0.5 },
  ],
  *run(params, seed, meter): Generator<View | null> {
    const rnd = mulberry32(seed);
    const n = Number(params.n); const K = Number(params.K);
    const dist = str(params, 'dist');
    const width = Number(params.gamma ?? 0.5);
    const { omega, kc } = frequencies(n, dist, width, rnd);
    const theta = Float64Array.from({ length: n }, () => 2 * Math.PI * rnd());
    // each oscillator's rank by natural frequency, by one sort of the indices
    const rank = new Float64Array(n);
    Array.from(omega.keys()).sort((a, b) => omega[a] - omega[b]).forEach((i, k) => { rank[i] = k / Math.max(1, n - 1); });
    yield null;
    const steps = 2500; const every = 25;
    const rs: number[] = [];
    const unwrapped = Float64Array.from(theta);
    const lim = Math.min(3, Math.max(...omega.map(Math.abs)) * 1.05);
    const history: Float64Array[] = [];
    const rk = new Rk4(n); const f = derivOf(omega, K, meter);
    for (let s = 1; s <= steps; s++) {
      const before = Float64Array.from(theta);
      rk.step(f, 0, theta, DT);
      for (let i = 0; i < n; i++) {
        let d = theta[i] - before[i];
        d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
        unwrapped[i] += d;
      }
      const { r, psi } = order(theta);
      rs.push(r);
      if (s % 5 === 0 && s % every !== 0) yield null;
      if (s % every !== 0) continue;
      history.push(Float64Array.from(unwrapped));
      // effective frequencies over the last 20 time units, measured from the unwrapped phases
      const back = history[Math.max(0, history.length - 1 - Math.round(20 / (every * DT)))];
      const span = (history.length - 1 - Math.max(0, history.length - 1 - Math.round(20 / (every * DT)))) * every * DT;
      const eff = Float64Array.from(unwrapped, (u, i) => (span > 0 ? (u - back[i]) / span : omega[i]));
      const meanEff = eff.reduce((a, b) => a + b, 0) / n;
      // the oscillators turning at the mean effective frequency, to 0.02: the locked cluster once
      // the transient has passed (a count of a tolerance, not a test of locking)
      const near = span > 0 ? eff.filter((w) => Math.abs(w - meanEff) < 0.02).length : 0;
      const tail = rs.slice(rs.length >> 1);
      const avg = tail.reduce((a, b) => a + b, 0) / tail.length;
      const pts: number[] = [];
      for (let a = 0; a <= 64; a++) pts.push(Math.cos((a / 64) * 2 * Math.PI), Math.sin((a / 64) * 2 * Math.PI));
      yield {
        layout: [[0, 2], [1]],
        panels: [
          { kind: 'xy', title: `${n} phases on the circle, coloured by natural frequency`, range: [-1.25, 1.25, -1.25, 1.25], equal: true,
            lines: [{ pts, tone: -1, weight: 1, alpha: 70 }],
            dots: Array.from(theta, (t, i) => ({ x: Math.cos(t), y: Math.sin(t), tone: rank[i], r: n > 256 ? 2 : 3 })),
            arrows: [{ x0: 0, y0: 0, x1: r * Math.cos(psi), y1: r * Math.sin(psi), tone: -1 }] },
          { kind: 'wave', title: 'Order parameter r(t)', range: [0, 1], upto: rs.length, series: [{ name: 'r', y: Float64Array.from({ length: steps }, (_, i) => rs[i] ?? 0), tone: 0.8 }] },
          { kind: 'xy', title: 'Effective against natural frequency', range: [-lim, lim, -lim, lim], equal: true, xLabel: 'natural ω', yLabel: 'effective',
            lines: [{ pts: [-lim, -lim, lim, lim], tone: -1, weight: 1, alpha: 60 }],
            dots: Array.from(omega, (w, i) => ({ x: w, y: Math.max(-lim, Math.min(lim, eff[i])), tone: rank[i], r: 2.5 })) },
        ],
        stats: [
          { label: 'Time', value: (s * DT).toFixed(1) },
          { label: 'Order parameter r now', value: r.toFixed(3) },
          { label: 'r averaged over the second half so far', value: avg.toFixed(3) },
          { label: 'Coupling K / critical K_c', value: `${K.toFixed(2)} / ${kc.toFixed(3)} = ${(K / kc).toFixed(2)}` },
          ...(dist === 'lorentz' ? [{ label: 'Theory for N → ∞, √(1 − K_c/K)', value: K > kc ? Math.sqrt(1 - kc / K).toFixed(3) : '0 (incoherent)' }] : []),
          { label: 'Incoherent level 1/√N', value: (1 / Math.sqrt(n)).toFixed(3) },
          { label: 'Effective frequency within 0.02 of the mean (measured)', value: `${near} of ${n}` },
        ],
        counts: meter.snapshot(),
        chart: { title: 'Order parameter over time', x: { label: 'time' }, y: { label: 'r' }, series: [
          { name: 'r(t)', points: rs.filter((_, i) => i % 10 === 0).map((v, i) => [i * 10 * DT, v]) }] },
      };
    }
  },
};
