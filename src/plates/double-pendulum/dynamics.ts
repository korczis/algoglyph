// The planar double pendulum (two point masses on massless rods), integrated with classic RK4
// from the shared integrator library (src/plates/_shared/ode).
import { Rk4 } from '../_shared/ode/ode';
// State: [θ1, θ2, ω1, ω2], angles from the downward vertical.

export interface Pendulum {
  m1: number;
  m2: number;
  l1: number;
  l2: number;
  g: number;
}

export type State = [number, number, number, number];

export function derivative(s: State, k: Pendulum): State {
  const [t1, t2, w1, w2] = s;
  const { m1, m2, l1, l2, g } = k;
  const d = t1 - t2;
  const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
  const a1 = (-g * (2 * m1 + m2) * Math.sin(t1) - m2 * g * Math.sin(t1 - 2 * t2)
    - 2 * Math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))) / (l1 * den);
  const a2 = (2 * Math.sin(d) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1)
    + w2 * w2 * l2 * m2 * Math.cos(d))) / (l2 * den);
  return [w1, w2, a1, a2];
}

const stepper = new Rk4(4);
const state = new Float64Array(4);

export function rk4(s: State, k: Pendulum, dt: number): State {
  state.set(s);
  stepper.step((_t, y, out) => {
    const d = derivative([y[0], y[1], y[2], y[3]], k);
    out[0] = d[0];
    out[1] = d[1];
    out[2] = d[2];
    out[3] = d[3];
  }, 0, state, dt);
  return [state[0], state[1], state[2], state[3]];
}

export function energy(s: State, k: Pendulum): number {
  const [t1, t2, w1, w2] = s;
  const { m1, m2, l1, l2, g } = k;
  const kinetic = 0.5 * m1 * l1 * l1 * w1 * w1
    + 0.5 * m2 * (l1 * l1 * w1 * w1 + l2 * l2 * w2 * w2 + 2 * l1 * l2 * w1 * w2 * Math.cos(t1 - t2));
  const potential = -(m1 + m2) * g * l1 * Math.cos(t1) - m2 * g * l2 * Math.cos(t2);
  return kinetic + potential;
}
