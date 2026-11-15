// Charged particles in prescribed fields (plan S5): non-relativistic motion under q(E + v × B), by the
// Boris pusher of the shared library (src/plates/_shared/ode), which keeps |v| exactly in a magnetic
// field, with the fields evaluated where the particle is. Fields: uniform E and B, and a magnetic
// mirror B_z = B₀(1 + z²/L²) with the radial part that makes it divergence-free to first order in r.
// Measured, never assumed: radii and periods from the orbit, drifts from the guiding centre, and
// whether a particle escapes the mirror. Pure: randomness only from the generator passed in.
import { boris } from '../ode/ode';

export type V3 = [number, number, number];
export type Field = (x: number, y: number, z: number) => { E: V3; B: V3 };
export interface State { x: Float64Array; v: Float64Array }

export const uniformField = (E: V3, B: V3): Field => () => ({ E, B });

/** A magnetic bottle: B_z = B₀(1 + z²/L²), B_r = −(r/2) ∂B_z/∂z, so ∇·B = 0 exactly in this form. */
export function mirrorField(B0: number, L: number): Field {
  return (x, y, z) => ({ E: [0, 0, 0], B: [(-x * B0 * z) / (L * L), (-y * B0 * z) / (L * L), B0 * (1 + (z * z) / (L * L))] });
}

const e = new Float64Array(3);
const b = new Float64Array(3);

/** One Boris step of h for charge-to-mass ratio qm, the fields taken at the particle's position. */
export function push(s: State, h: number, qm: number, f: Field): void {
  const { E, B } = f(s.x[0], s.x[1], s.x[2]);
  e[0] = E[0]; e[1] = E[1]; e[2] = E[2];
  b[0] = B[0]; b[1] = B[1]; b[2] = B[2];
  boris(s.x, s.v, h, qm, e, b);
}

/**
 * A charge started at the origin with speed v along x in a uniform B along z, pushed for `turns`
 * turns: its radius as the mean distance from the orbit's centre (the mean of its positions over the
 * whole turns), and its period from the turning of its velocity.
 */
export function gyrate(o: { qm: number; B: number; v: number; h: number; turns: number }): { radius: number; period: number } {
  const s: State = { x: new Float64Array(3), v: new Float64Array([o.v, 0, 0]) };
  const f = uniformField([0, 0, 0], [0, 0, o.B]);
  const xs: number[] = [];
  const ys: number[] = [];
  let angle = 0;
  let last = Math.atan2(s.v[1], s.v[0]);
  let t = 0;
  while (Math.abs(angle) < 2 * Math.PI * o.turns) {
    push(s, o.h, o.qm, f);
    t += o.h;
    const a = Math.atan2(s.v[1], s.v[0]);
    let d = a - last;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    angle += d;
    last = a;
    xs.push(s.x[0]);
    ys.push(s.x[1]);
  }
  const cx = xs.reduce((p, q) => p + q, 0) / xs.length;
  const cy = ys.reduce((p, q) => p + q, 0) / ys.length;
  const radius = xs.reduce((p, x, i) => p + Math.hypot(x - cx, ys[i] - cy), 0) / xs.length;
  return { radius, period: (2 * Math.PI * t) / Math.abs(angle) };
}

/**
 * Whether a charge started at the mirror's centre with speed v at pitch angle α to the axis stays
 * trapped for `time`: it escapes when it passes |z| > zMax.
 */
export function trapped(B0: number, L: number, zMax: number, v: number, alpha: number, phi: number, qm: number, h: number, time: number): boolean {
  const f = mirrorField(B0, L);
  const s: State = {
    x: new Float64Array([0, 0, 0]),
    v: new Float64Array([v * Math.sin(alpha) * Math.cos(phi), v * Math.sin(alpha) * Math.sin(phi), v * Math.cos(alpha)]),
  };
  for (let t = 0; t < time; t += h) {
    push(s, h, qm, f);
    if (Math.abs(s.x[2]) > zMax) return false;
  }
  return true;
}
