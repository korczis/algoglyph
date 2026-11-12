// Lumped oscillators (plan S1): ẍ + γẋ + ω₀²x = (F₀/m) cos ωt, or ω₀² sin x for the pendulum, and two
// identical oscillators coupled by a spring κ. Integrated by the shared RK4
// (src/plates/_shared/ode) at 400 steps a period (ω₀Δt ≈ 0.016), and measured the way a
// laboratory would: a lock-in over whole drive periods for amplitude and phase, a sweep of the
// absorbed power for the resonance width, the decay of successive peaks for the ring-down, zero
// crossings for a period, the envelope's minima for a beat. The closed forms here are the ones the
// measurements are compared with; none of them is used to produce a measurement.
import { Rk4, type Deriv } from '../ode/ode';

export interface Oscillator {
  m: number;
  omega0: number;
  /** γ in ẍ + γẋ: the energy decays as e^(−γt), the amplitude as e^(−γt/2), Q = ω₀/γ. */
  gamma: number;
  F0: number;
  /** sin x in place of x: the pendulum. */
  pendulum: boolean;
}

/** Steps per period of the faster of the drive and the natural frequency. */
export const STEPS_PER_PERIOD = 400;

const rk2 = new Rk4(2);
const rk4n = new Rk4(4);

function deriv(o: Oscillator, w: number): Deriv {
  return (t, y, out) => {
    out[0] = y[1];
    const restoring = o.pendulum ? Math.sin(y[0]) : y[0];
    out[1] = -o.gamma * y[1] - o.omega0 * o.omega0 * restoring + (o.F0 / o.m) * Math.cos(w * t);
  };
}

/** The steady state in closed form: x = A cos(ωt − φ), A = (F₀/m)/√((ω₀² − ω²)² + γ²ω²), φ = atan2(γω, ω₀² − ω²). */
export function steadyClosedForm(o: Oscillator, w: number): { amplitude: number; phase: number } {
  const a = o.omega0 * o.omega0 - w * w;
  return { amplitude: o.F0 / o.m / Math.hypot(a, o.gamma * w), phase: Math.atan2(o.gamma * w, a) };
}

/** Time step: STEPS_PER_PERIOD to the shorter of the natural and the drive period. */
const stepFor = (o: Oscillator, w: number) => (2 * Math.PI) / (STEPS_PER_PERIOD * Math.max(o.omega0, w || 0));

/**
 * The steady amplitude and phase lag measured by a lock-in: driven from rest until the transient
 * has decayed by e^(−14) (28/γ), then x is correlated with cos ωt and sin ωt over twenty whole drive
 * periods by the trapezoid rule.
 */
export function lockIn(o: Oscillator, w: number): { amplitude: number; phase: number } {
  const y = new Float64Array(2);
  const f = deriv(o, w);
  const period = (2 * Math.PI) / w;
  const settleSteps = Math.ceil(28 / Math.max(o.gamma, 1e-3) / stepFor(o, w));
  const perPeriod = Math.max(STEPS_PER_PERIOD, Math.ceil(period / stepFor(o, w)));
  const h = period / perPeriod;
  let t = 0;
  for (let i = 0; i < settleSteps; i++) {
    rk2.step(f, t, y, h);
    t += h;
  }
  // align the window to whole drive periods from t
  let c = 0;
  let s = 0;
  const n = 20 * perPeriod;
  for (let i = 0; i <= n; i++) {
    const wgt = i === 0 || i === n ? 0.5 : 1;
    c += wgt * y[0] * Math.cos(w * t);
    s += wgt * y[0] * Math.sin(w * t);
    if (i < n) {
      rk2.step(f, t, y, h);
      t += h;
    }
  }
  c *= 2 / n;
  s *= 2 / n;
  return { amplitude: Math.hypot(c, s), phase: Math.atan2(s, c) };
}

/** Power absorbed in the steady state, ½ m γ (ωA)², from a measured amplitude. */
export const absorbed = (o: Oscillator, w: number, amplitude: number) => 0.5 * o.m * o.gamma * (w * amplitude) ** 2;

/**
 * The full width at half maximum of the absorbed power, from a sweep of `n` lock-ins over
 * ω₀ ± 3γ and linear interpolation at the half-maximum crossings. Exactly γ in closed form.
 */
export function powerWidth(o: Oscillator, n: number, sweep?: (w: number, p: number) => void): number {
  const ws: number[] = [];
  const ps: number[] = [];
  for (let i = 0; i < n; i++) {
    const w = o.omega0 - 3 * o.gamma + (6 * o.gamma * i) / (n - 1);
    const p = absorbed(o, w, lockIn(o, w).amplitude);
    ws.push(w);
    ps.push(p);
    sweep?.(w, p);
  }
  return widthOf(ws, ps);
}

/** The full width at half maximum of a sampled peak, by linear interpolation either side. */
export function widthOf(ws: number[], ps: number[]): number {
  let k = 0;
  for (let i = 1; i < ps.length; i++) if (ps[i] > ps[k]) k = i;
  const half = ps[k] / 2;
  let lo = Number.NaN;
  let hi = Number.NaN;
  for (let i = k; i > 0; i--) {
    if (ps[i - 1] <= half) { lo = ws[i - 1] + ((half - ps[i - 1]) / (ps[i] - ps[i - 1])) * (ws[i] - ws[i - 1]); break; }
  }
  for (let i = k; i < ps.length - 1; i++) {
    if (ps[i + 1] <= half) { hi = ws[i] + ((ps[i] - half) / (ps[i] - ps[i + 1])) * (ws[i + 1] - ws[i]); break; }
  }
  return hi - lo;
}

/** Times and heights of the local maxima of x, each placed by a parabola through three samples. */
function peaks(xs: number[], h: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i < xs.length - 1; i++) {
    if (xs[i] > xs[i - 1] && xs[i] >= xs[i + 1]) {
      const den = xs[i - 1] - 2 * xs[i] + xs[i + 1];
      const p = den !== 0 ? (0.5 * (xs[i - 1] - xs[i + 1])) / den : 0;
      out.push([(i + p) * h, xs[i] - 0.25 * (xs[i - 1] - xs[i + 1]) * p]);
    }
  }
  return out;
}

/** The ring-down: released from x = 1 at rest, undriven; the slope of ln(peak) against time, negated. */
export function ringDownRate(o: Oscillator, record?: (t: number, x: number) => void): number {
  const free = { ...o, F0: 0 };
  const f = deriv(free, 0);
  const y = Float64Array.from([1, 0]);
  const h = stepFor(o, 0);
  const T = 6 / Math.max(o.gamma, 1e-3);
  const xs: number[] = [1];
  for (let i = 0; i * h < T; i++) {
    rk2.step(f, i * h, y, h);
    xs.push(y[0]);
    record?.((i + 1) * h, y[0]);
  }
  const pk = peaks(xs, h);
  let sx = 0; let sy = 0; let sxx = 0; let sxy = 0;
  for (const [t, a] of pk) { const l = Math.log(a); sx += t; sy += l; sxx += t * t; sxy += t * l; }
  const n = pk.length;
  return -(n * sxy - sx * sy) / (n * sxx - sx * sx);
}

/** The least x reaches when released from x = 1 at rest, undriven, over 20/ω₀. */
export function criticalMinimum(o: Oscillator, record?: (t: number, x: number) => void): number {
  const f = deriv({ ...o, F0: 0 }, 0);
  const y = Float64Array.from([1, 0]);
  const h = stepFor(o, 0);
  let least = 1;
  for (let i = 0; i * h < 20 / o.omega0; i++) {
    rk2.step(f, i * h, y, h);
    least = Math.min(least, y[0]);
    record?.((i + 1) * h, y[0]);
  }
  return least;
}

/** K(k) = π / (2·AGM(1, √(1 − k²))), the complete elliptic integral of the first kind. */
export function agmK(k: number): number {
  let a = 1;
  let b = Math.sqrt(1 - k * k);
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-16 * a; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return Math.PI / (2 * a);
}

/** The pendulum's period from θ₀ at rest, undamped: the mean time between upward zero crossings. */
export function pendulumPeriod(o: Oscillator, theta0: number, record?: (t: number, x: number) => void): number {
  const f = deriv({ ...o, F0: 0, gamma: 0, pendulum: true }, 0);
  const y = Float64Array.from([theta0, 0]);
  const h = stepFor(o, 0) * 0.5;
  const crossings: number[] = [];
  let prev = y[0];
  for (let i = 0; crossings.length < 6 && i < 1e7; i++) {
    rk2.step(f, i * h, y, h);
    record?.((i + 1) * h, y[0]);
    if (prev < 0 && y[0] >= 0) crossings.push(i * h + (-prev / (y[0] - prev)) * h);
    prev = y[0];
  }
  return (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1);
}

/**
 * Two identical oscillators coupled by a spring κ, the first released from x = 1: the time between
 * successive minima of its amplitude envelope. Closed form 2π/(ω₂ − ω₁), ω₁ = ω₀, ω₂ = √(ω₀² + 2κ).
 */
export function beatPeriod(omega0: number, kappa: number, record?: (t: number, x1: number, x2: number) => void): number {
  const f: Deriv = (_t, y, out) => {
    out[0] = y[2];
    out[1] = y[3];
    out[2] = -omega0 * omega0 * y[0] + kappa * (y[1] - y[0]);
    out[3] = -omega0 * omega0 * y[1] + kappa * (y[0] - y[1]);
  };
  const w2 = Math.sqrt(omega0 * omega0 + 2 * kappa);
  const h = (2 * Math.PI) / (STEPS_PER_PERIOD * w2);
  const span = (2.5 * 2 * Math.PI) / (w2 - omega0);
  const y = Float64Array.from([1, 0, 0, 0]);
  const xs: number[] = [1];
  for (let i = 0; i * h < span; i++) {
    rk4n.step(f, i * h, y, h);
    xs.push(y[0]);
    record?.((i + 1) * h, y[0], y[1]);
  }
  // the envelope: heights of the peaks of x₁; its minima are where the energy has moved across
  const env = peaks(xs, h);
  const minima: number[] = [];
  for (let i = 1; i < env.length - 1; i++) {
    const [ta, a] = env[i - 1];
    const [tb, b] = env[i];
    const [tc, c] = env[i + 1];
    if (b < a && b <= c) {
      const den = a - 2 * b + c;
      const p = den !== 0 ? (0.5 * (a - c)) / den : 0;
      minima.push(tb + p * ((tc - ta) / 2));
    }
  }
  return minima.length >= 2 ? (minima[minima.length - 1] - minima[0]) / (minima.length - 1) : Number.NaN;
}
