// Polarised light (plan S4): Jones vectors and matrices for polarisers, wave plates and rotators,
// Stokes parameters, single photons sampled by Born's rule through a bench, and Fresnel's
// amplitudes at a plane interface (complex beyond the critical angle). Complex numbers are pairs.
// Pure: randomness only from the generator passed in.
export type C = [number, number];
export type Jones = [C, C];
export type Mat = [[C, C], [C, C]];

export const cx = (re: number, im = 0): C => [re, im];
export const add = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
export const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const conj = (a: C): C => [a[0], -a[1]];
export const abs2 = (a: C): number => a[0] * a[0] + a[1] * a[1];
export const div = (a: C, b: C): C => { const d = abs2(b); return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
export const csqrt = (a: C): C => {
  const r = Math.hypot(a[0], a[1]);
  const re = Math.sqrt(Math.max(0, (r + a[0]) / 2));
  const im = Math.sqrt(Math.max(0, (r - a[0]) / 2));
  return [re, a[1] < 0 ? -im : im];
};

export function apply(m: Mat, v: Jones): Jones {
  return [add(mul(m[0][0], v[0]), mul(m[0][1], v[1])), add(mul(m[1][0], v[0]), mul(m[1][1], v[1]))];
}

export function compose(a: Mat, b: Mat): Mat {
  const e = (i: number, j: number) => add(mul(a[i][0], b[0][j]), mul(a[i][1], b[1][j]));
  return [[e(0, 0), e(0, 1)], [e(1, 0), e(1, 1)]];
}

export const intensity = (v: Jones): number => abs2(v[0]) + abs2(v[1]);

/** A linear polariser with its transmission axis at θ from x: the projector onto (cos θ, sin θ). */
export function polariser(theta: number): Mat {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [[cx(c * c), cx(c * s)], [cx(c * s), cx(s * s)]];
}

/** A wave plate of retardance δ with its fast axis at θ: R(θ) diag(1, e^(iδ)) R(−θ). */
export function wavePlate(theta: number, delta: number): Mat {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e: C = [Math.cos(delta), Math.sin(delta)];
  // R diag(1, e) Rᵀ, R = [[c, −s], [s, c]]
  const m = (a: number, b: number): C => add(cx(a), mul(e, cx(b)));
  return [[m(c * c, s * s), m(c * s, -c * s)], [m(c * s, -c * s), m(s * s, c * c)]];
}

/** A rotator turning the polarisation by α (optical activity, a Faraday cell). */
export function rotator(alpha: number): Mat {
  const c = Math.cos(alpha);
  const s = Math.sin(alpha);
  return [[cx(c), cx(-s)], [cx(s), cx(c)]];
}

/** The largest entry of |M†M − I|: zero for a lossless element. */
export function unitarityDefect(m: Mat): number {
  let worst = 0;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const e = add(mul(conj(m[0][i]), m[0][j]), mul(conj(m[1][i]), m[1][j]));
      worst = Math.max(worst, Math.hypot(e[0] - (i === j ? 1 : 0), e[1]));
    }
  }
  return worst;
}

/** Stokes parameters (S0, S1, S2, S3) of a Jones vector; S3 > 0 for right-handed light as seen
 * by the receiver, with E = (1, −i)/√2. */
export function stokes(v: Jones): [number, number, number, number] {
  const xy = mul(v[0], conj(v[1]));
  return [abs2(v[0]) + abs2(v[1]), abs2(v[0]) - abs2(v[1]), 2 * xy[0], -2 * xy[1]];
}

export type Element = { kind: 'polariser'; theta: number } | { kind: 'plate'; theta: number; delta: number };

export function matrixOf(e: Element): Mat {
  return e.kind === 'polariser' ? polariser(e.theta) : wavePlate(e.theta, e.delta);
}

/**
 * One photon in state ψ through the bench by Born's rule: a polariser passes it with probability
 * |⟨u|ψ⟩|² and leaves it in |u⟩, or absorbs it; a wave plate turns its state. Returns the index of
 * the element that absorbed it, or −1 when it reached the detector.
 */
export function photon(psi: Jones, bench: Element[], rnd: () => number): number {
  let state = psi;
  for (let k = 0; k < bench.length; k++) {
    const e = bench[k];
    if (e.kind === 'plate') { state = apply(wavePlate(e.theta, e.delta), state); continue; }
    const u: Jones = [cx(Math.cos(e.theta)), cx(Math.sin(e.theta))];
    const amp = add(mul(conj(u[0]), state[0]), mul(conj(u[1]), state[1]));
    if (rnd() >= abs2(amp) / intensity(state)) return k;
    state = u;
  }
  return -1;
}

export interface Fresnel {
  /** cos θt, complex beyond the critical angle (then purely imaginary). */
  cosT: C;
  rs: C; rp: C; ts: C; tp: C;
  /** Reflectances and transmittances, with the cos and n factors of the power; T = 0 beyond the
   * critical angle, where no power crosses. */
  Rs: number; Rp: number; Ts: number; Tp: number;
  total: boolean;
}

/** Fresnel's amplitudes from medium n1 into n2 at incidence θi (s: E normal to the plane of
 * incidence; p: E in it, with the sign convention that rp = rs at normal incidence). */
export function fresnel(n1: number, n2: number, thetaI: number): Fresnel {
  const ci = Math.cos(thetaI);
  const si = Math.sin(thetaI);
  const st = (n1 / n2) * si;
  const total = st > 1;
  const cosT = csqrt(cx(1 - st * st));
  const a = cx(n1 * ci);
  const b = mul(cx(n2), cosT);
  const rs = div(add(a, [-b[0], -b[1]]), add(a, b));
  const ts = div(cx(2 * n1 * ci), add(a, b));
  const c = mul(cx(n1), cosT);
  const d = cx(n2 * ci);
  const rp = div(add(c, [-d[0], -d[1]]), add(c, d));
  const tp = div(cx(2 * n1 * ci), add(c, d));
  const factor = total ? 0 : (n2 * cosT[0]) / (n1 * ci);
  return { cosT, rs, rp, ts, tp, Rs: abs2(rs), Rp: abs2(rp), Ts: factor * abs2(ts), Tp: factor * abs2(tp), total };
}
