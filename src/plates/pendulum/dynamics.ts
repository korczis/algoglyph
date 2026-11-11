// The planar double pendulum (two point masses on massless rods), integrated with classic RK4.
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

export function rk4(s: State, k: Pendulum, dt: number): State {
  const add = (a: State, b: State, h: number): State =>
    [a[0] + b[0] * h, a[1] + b[1] * h, a[2] + b[2] * h, a[3] + b[3] * h];
  const k1 = derivative(s, k);
  const k2 = derivative(add(s, k1, dt / 2), k);
  const k3 = derivative(add(s, k2, dt / 2), k);
  const k4 = derivative(add(s, k3, dt), k);
  return [
    s[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    s[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    s[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    s[3] + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
  ];
}

export function energy(s: State, k: Pendulum): number {
  const [t1, t2, w1, w2] = s;
  const { m1, m2, l1, l2, g } = k;
  const kinetic = 0.5 * m1 * l1 * l1 * w1 * w1
    + 0.5 * m2 * (l1 * l1 * w1 * w1 + l2 * l2 * w2 * w2 + 2 * l1 * l2 * w1 * w2 * Math.cos(t1 - t2));
  const potential = -(m1 + m2) * g * l1 * Math.cos(t1) - m2 * g * l2 * Math.cos(t2);
  return kinetic + potential;
}
