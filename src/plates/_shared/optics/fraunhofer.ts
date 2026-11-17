// The Fraunhofer far field of a plane aperture (plan S3): the aperture's transmission sampled on a
// G × G grid of pitch p, its two-dimensional transform by the shared radix-2 FFT (rows, then
// columns), and |·|² as the intensity seen at sin θ = (k/G)(λ/p) for bin k from the centre.
//
// The zeros the plates measure are found on the transform itself, not on a closed form: along an
// axis the amplitude of a centred, mirror-symmetric aperture is real, Σ_x c(x) cos(2πk(x − x̄)/G)
// with c the column sums, and it is bracketed on the FFT's bins and then bisected as a function of
// a fractional k. Along a diagonal the same holds with the sums over x + y. A sampled slit of n
// cells has the Dirichlet kernel sin(πkn/G)/sin(πk/G) as that sum, whose zeros sit exactly at
// k = mG/n: the sampled slit and the continuous one share them.
import { Fft } from '../fft/fft';

/** A transmission grid, row-major, side G (a power of two). */
export interface Aperture {
  G: number;
  t: Float64Array;
}

export function blank(G: number): Aperture {
  return { G, t: new Float64Array(G * G) };
}

/** n whole cells centred on the grid as nearly as cells allow: [lo, lo + n). */
function span(G: number, n: number): [number, number] {
  const lo = Math.round((G - n) / 2);
  return [lo, lo + n];
}

/**
 * N slits of a cells at a pitch of d cells, each h cells tall, centred: whole cells, the k-th slit
 * starting k·d cells after the first, so the pattern is exactly periodic and mirror-symmetric
 * about its own centroid.
 */
export function slits(G: number, N: number, a: number, d: number, h: number): Aperture {
  const ap = blank(G);
  const [y0, y1] = span(G, h);
  const [first] = span(G, (N - 1) * d + a);
  for (let j = 0; j < N; j++) {
    const x0 = first + j * d;
    for (let y = y0; y < y1; y++) for (let x = Math.max(0, x0); x < Math.min(G, x0 + a); x++) ap.t[y * G + x] = 1;
  }
  return ap;
}

/** A w × h rectangle, centred. */
export function rectangle(G: number, w: number, h: number): Aperture {
  return slits(G, 1, w, 0, h);
}

/** A disc of diameter D cells: the cells whose centres lie within D/2 of the grid's centre. */
export function disc(G: number, D: number): Aperture {
  const ap = blank(G);
  const c = G / 2 - 0.5;
  const r2 = (D / 2) * (D / 2);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    if ((x - c) ** 2 + (y - c) ** 2 <= r2) ap.t[y * G + x] = 1;
  }
  return ap;
}

/** A profile across x (values in [0, 1], one per cell, centred), h cells tall. */
export function profile(G: number, values: ArrayLike<number>, h: number): Aperture {
  const ap = blank(G);
  const n = Math.min(G, values.length);
  const [x0] = span(G, n);
  const [y0, y1] = span(G, h);
  for (let y = y0; y < y1; y++) for (let i = 0; i < n; i++) ap.t[y * G + x0 + i] = values[i];
  return ap;
}

/** The far-field intensity |FFT₂(t)|², shifted so bin (0, 0) is at (G/2, G/2), row-major. */
export function farField(ap: Aperture): Float64Array {
  const { G, t } = ap;
  const fft = new Fft(G);
  const re = Float64Array.from(t);
  const im = new Float64Array(G * G);
  const rr = new Float64Array(G);
  const ri = new Float64Array(G);
  for (let y = 0; y < G; y++) {
    rr.set(re.subarray(y * G, y * G + G));
    ri.set(im.subarray(y * G, y * G + G));
    fft.transform(rr, ri);
    re.set(rr, y * G);
    im.set(ri, y * G);
  }
  for (let x = 0; x < G; x++) {
    for (let y = 0; y < G; y++) { rr[y] = re[y * G + x]; ri[y] = im[y * G + x]; }
    fft.transform(rr, ri);
    for (let y = 0; y < G; y++) { re[y * G + x] = rr[y]; im[y * G + x] = ri[y]; }
  }
  const I = new Float64Array(G * G);
  const h = G / 2;
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const k = y * G + x;
    I[((y + h) % G) * G + ((x + h) % G)] = re[k] * re[k] + im[k] * im[k];
  }
  return I;
}

/** The weights of the aperture projected on a direction: along x (column sums) or the diagonal (sums over x + y). */
export function projection(ap: Aperture, along: 'x' | 'diagonal'): { pos: Float64Array; w: Float64Array; centre: number } {
  const { G, t } = ap;
  const n = along === 'x' ? G : 2 * G - 1;
  const w = new Float64Array(n);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) w[along === 'x' ? x : x + y] += t[y * G + x];
  // positions along the direction, in cells: x, or (x + y)/√2 along the diagonal
  const pos = Float64Array.from({ length: n }, (_, i) => (along === 'x' ? i : i / Math.SQRT2));
  let m = 0;
  let s = 0;
  for (let i = 0; i < n; i++) { m += w[i] * pos[i]; s += w[i]; }
  return { pos, w, centre: s > 0 ? m / s : 0 };
}

/** The real amplitude along a projection at fractional bin k: Σ w cos(2πk(pos − centre)/G). */
export function amplitude(G: number, pr: { pos: Float64Array; w: Float64Array; centre: number }, k: number): number {
  let a = 0;
  for (let i = 0; i < pr.w.length; i++) if (pr.w[i] !== 0) a += pr.w[i] * Math.cos((2 * Math.PI * k * (pr.pos[i] - pr.centre)) / G);
  return a;
}

/**
 * The first zero of the real amplitude f past k = from: bracketed by walking in steps of `step`
 * bins until the sign changes, then bisected to 1e−12 of a bin; null if none within `to`.
 */
export function firstZero(f: (k: number) => number, from: number, step: number, to: number): number | null {
  let k0 = from;
  let f0 = f(k0);
  for (let k1 = from + step; k1 <= to + 1e-12; k1 += step) {
    const f1 = f(k1);
    if (f0 === 0) return k0;
    if ((f0 < 0) !== (f1 < 0)) {
      let lo = k0;
      let hi = k1;
      let flo = f0;
      for (let i = 0; i < 80 && hi - lo > 1e-12; i++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid;
      }
      return (lo + hi) / 2;
    }
    k0 = k1;
    f0 = f1;
  }
  return null;
}

/** The largest |f|² on [lo, hi], by golden-section search after a scan of `cells` points. */
export function peak(f: (k: number) => number, lo: number, hi: number, cells = 64): number {
  let best = lo;
  let bv = -Infinity;
  for (let i = 0; i <= cells; i++) {
    const k = lo + ((hi - lo) * i) / cells;
    const v = f(k) ** 2;
    if (v > bv) { bv = v; best = k; }
  }
  let a = Math.max(lo, best - (hi - lo) / cells);
  let b = Math.min(hi, best + (hi - lo) / cells);
  const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 100 && b - a > 1e-12; i++) {
    const c = b - g * (b - a);
    const d = a + g * (b - a);
    if (f(c) ** 2 > f(d) ** 2) b = d; else a = c;
  }
  return (a + b) / 2;
}
