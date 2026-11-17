// Spectral lines and what a grating spectrometer makes of them. A line is a Voigt profile: the
// Doppler spread of the atoms' velocities (a Gaussian) convolved with the Lorentzian of the
// excited state's decay and of collisions. The spectrometer sees it through its instrument
// function, the N-groove grating's sin²(Nφ/2)/(N² sin²(φ/2)) in order m. Wavelengths are in pm.

/** Boltzmann's constant (J/K), exact since 2019. */
export const K_B = 1.380649e-23;
/** The speed of light (m/s), exact. */
export const C = 299792458;
/** The atomic mass unit (kg), CODATA 2018. */
export const AMU = 1.6605390666e-27;

/** One line: its wavelength (pm, in air) and its strength relative to the strongest. */
export interface Line { lambda: number; weight: number }

/** A lamp: its lines and the mass of the emitting atom (u). */
export interface Lamp { id: string; label: string; mass: number; lines: Line[] }

/** The two doublets of a laboratory's spectral lamps (NIST Atomic Spectra Database, air). */
export const LAMPS: Lamp[] = [
  // sodium's D lines, 3p ²P₃/₂ and ²P₁/₂ to 3s: D2 twice D1, the upper levels' 4 : 2 states
  { id: 'sodium', label: 'sodium D lines', mass: 22.98977, lines: [{ lambda: 588995.0, weight: 1 }, { lambda: 589592.4, weight: 0.5 }] },
  // mercury's yellow pair, 6d ¹D₂ and ³D₂ to 6p ¹P₁, taken as equally strong
  { id: 'mercury', label: 'mercury yellow pair', mass: 200.59, lines: [{ lambda: 576959.8, weight: 1 }, { lambda: 579066.3, weight: 1 }] },
];

export const lamp = (id: string): Lamp => LAMPS.find((l) => l.id === id) ?? LAMPS[0];

/** The Doppler standard deviation σ (pm) of a line at λ (pm) from atoms of mass M (u) at T (K):
 * a velocity component's spread √(kT/M), as a fraction of c. */
export const dopplerSigma = (lambda: number, T: number, mass: number): number =>
  lambda * Math.sqrt((K_B * T) / (mass * AMU * C * C));

/** Terms of the rational series for w(z) (Weideman 1994); 40 give the double-precision answer. */
const TERMS = 40;
const WL = Math.sqrt(TERMS / Math.SQRT2);

/** The series' coefficients a₁…a_N, from the transform of f(t) = (L² + t²)e^(−t²) sampled at
 * t = L tan(θ/2), θ = kπ/2N (Weideman 1994, eq. 3.8, its FFT written out as cosines). */
const COEF: Float64Array = (() => {
  const M = 2 * TERMS;
  const f = new Float64Array(M);
  for (let k = 0; k < M; k++) {
    const t = WL * Math.tan((k * Math.PI) / (2 * M));
    f[k] = Math.exp(-t * t) * (WL * WL + t * t);
  }
  const a = new Float64Array(TERMS);
  for (let n = 1; n <= TERMS; n++) {
    let s = f[0];
    for (let k = 1; k < M; k++) s += 2 * f[k] * Math.cos((Math.PI * k * n) / M);
    a[n - 1] = s / (2 * M);
  }
  return a;
})();

/**
 * The Faddeeva function's real part, Re w(x + iy) for y ≥ 0, by Weideman's rational series:
 * w ≈ 2p(Z)/(L − iz)² + π^(−½)/(L − iz), Z = (L + iz)/(L − iz), p(Z) = Σ aₙ Zⁿ⁻¹.
 */
export function faddeevaRe(x: number, y: number): number {
  // L − iz = (L + y) − ix and L + iz = (L − y) + ix
  const dr = WL + y; const di = -x;
  const nr = WL - y; const ni = x;
  const dd = dr * dr + di * di;
  const zr = (nr * dr + ni * di) / dd; const zi = (ni * dr - nr * di) / dd;
  let pr = COEF[TERMS - 1]; let pi = 0;
  for (let n = TERMS - 2; n >= 0; n--) {
    const t = pr * zr - pi * zi;
    pi = pr * zi + pi * zr;
    pr = t + COEF[n];
  }
  // 1/(L − iz) and its square
  const ir = dr / dd; const ii = -di / dd;
  const sr = ir * ir - ii * ii; const si = 2 * ir * ii;
  return 2 * (pr * sr - pi * si) + ir / Math.sqrt(Math.PI);
}

/** The Voigt profile (area 1, per pm) at offset x (pm) from the line's centre: a Gaussian of
 * standard deviation σ convolved with a Lorentzian of half width γ, Re w(z)/(σ√2π),
 * z = (x + iγ)/(σ√2). */
export const voigt = (x: number, sigma: number, gamma: number): number =>
  faddeevaRe(x / (sigma * Math.SQRT2), gamma / (sigma * Math.SQRT2)) / (sigma * Math.sqrt(2 * Math.PI));

/** The profile's full width at half its maximum (pm), found on the profile by bisection. */
export function measuredFwhm(sigma: number, gamma: number): number {
  const half = voigt(0, sigma, gamma) / 2;
  let lo = 0; let hi = 4 * (sigma + gamma);
  while (voigt(hi, sigma, gamma) > half) hi *= 2;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (voigt(mid, sigma, gamma) > half) lo = mid; else hi = mid;
  }
  return lo + hi;
}

/** The profile sampled at `xs` (pm, offsets from the centre), for the chart. */
export function profile(xs: Float64Array, sigma: number, gamma: number): Float64Array {
  const out = new Float64Array(xs.length);
  const a = 1 / (sigma * Math.SQRT2);
  const y = gamma * a;
  const norm = 1 / (sigma * Math.sqrt(2 * Math.PI));
  for (let i = 0; i < xs.length; i++) out[i] = faddeevaRe(xs[i] * a, y) * norm;
  return out;
}

/** A grating spectrometer: N grooves lit, used in order m. */
export interface Grating { grooves: number; order: number }

/**
 * What the spectrometer records at each wavelength `at` (pm): every line's Voigt profile
 * convolved with the instrument function F(k₀Δ), k₀ = 2πm/λ̄, the Fejér kernel
 * sin²(Nφ/2)/(N² sin²(φ/2)) = (1/N²)Σ_{|j|<N}(N − |j|)e^(ijφ). The profile's transform is
 * e^(−σ²k²/2 − γ|k|), so the convolution is that sum with each term damped, exact: no line is
 * sampled and no integral truncated. A line of zero width is recorded as weight × F; the sum is
 * run by Clenshaw's recurrence.
 */
export function recorded(at: Float64Array, lines: Line[], sigmas: number[], gamma: number, g: Grating): Float64Array {
  const N = Math.max(1, Math.round(g.grooves));
  let mean = 0;
  for (const l of lines) mean += l.lambda / lines.length;
  const k0 = (2 * Math.PI * g.order) / mean;
  const out = new Float64Array(at.length);
  const c = new Float64Array(N);
  for (let li = 0; li < lines.length; li++) {
    const s = sigmas[li];
    const w = lines[li].weight / (N * N);
    // c_j = (N − j)·e^(−σ²(jk₀)²/2 − γjk₀), doubled for j ≥ 1 (the term for −j is its mirror)
    for (let j = 0; j < N; j++) {
      const k = j * k0;
      c[j] = (j === 0 ? 1 : 2) * (N - j) * Math.exp(-0.5 * s * s * k * k - gamma * k);
    }
    for (let i = 0; i < at.length; i++) {
      const th = k0 * (at[i] - lines[li].lambda);
      const x2 = 2 * Math.cos(th);
      let b1 = 0; let b2 = 0;
      for (let j = N - 1; j >= 1; j--) {
        const b = c[j] + x2 * b1 - b2;
        b2 = b1; b1 = b;
      }
      // Σ c_j cos(jθ) = c₀ + b₁cos θ − b₂
      out[i] += w * (c[0] + b1 * 0.5 * x2 - b2);
    }
  }
  return out;
}

/** The instrument function at offset Δ (pm) for lines near λ̄, in closed form: sin²(Nφ/2)/(N²
 * sin²(φ/2)), φ = 2πmΔ/λ̄, and 1 where φ is a whole number of turns. */
export function instrument(delta: number, mean: number, g: Grating): number {
  const N = Math.max(1, Math.round(g.grooves));
  // reduced to (−π/2, π/2], where sin is exact near its zeros: the instrument's period is π
  const raw = (Math.PI * g.order * delta) / mean;
  const half = raw - Math.PI * Math.round(raw / Math.PI);
  const den = Math.sin(half);
  if (Math.abs(den) < 1e-300) return 1;
  const r = Math.sin(N * half) / (N * den);
  return r * r;
}

/** What the spectrometer would record of lines of no width, Σ weight × F(Δ), in closed form. */
export function unbroadened(at: Float64Array, lines: Line[], g: Grating): Float64Array {
  let mean = 0;
  for (const l of lines) mean += l.lambda / lines.length;
  const N = Math.max(1, Math.round(g.grooves));
  const out = new Float64Array(at.length);
  for (let i = 0; i < at.length; i++) {
    for (const l of lines) {
      const raw = (Math.PI * g.order * (at[i] - l.lambda)) / mean;
      const half = raw - Math.PI * Math.round(raw / Math.PI);
      const den = Math.sin(half);
      const r = Math.abs(den) < 1e-300 ? 1 : Math.sin(N * half) / (N * den);
      out[i] += l.weight * r * r;
    }
  }
  return out;
}

/** exp(y²)·erfc(y) for y ≥ 0, never from w(z): the power series of erf below 1 (above it 1 − erf
 * cancels to e^(y²) roundings), Laplace's continued fraction from 1 on, 300 deep (Abramowitz and
 * Stegun 7.1.5 and 7.1.14). */
export function erfcx(y: number): number {
  if (y < 1) {
    // erf(y) = (2/√π) Σ (−1)ⁿ y^(2n+1)/(n!(2n + 1))
    let term = y; let sum = y;
    for (let n = 1; n < 200 && Math.abs(term) > 1e-17 * Math.abs(sum); n++) {
      term *= (-y * y) / n;
      sum += term / (2 * n + 1);
    }
    return Math.exp(y * y) * (1 - (2 / Math.sqrt(Math.PI)) * sum);
  }
  // √π·erfcx(y) = 1/(y + (1/2)/(y + 1/(y + (3/2)/(y + 2/(y + …))))), evaluated from the tail
  let t = y;
  for (let n = 300; n >= 1; n--) t = y + n / 2 / t;
  return 1 / (Math.sqrt(Math.PI) * t);
}

/** The Voigt profile's peak in closed form: erfcx(γ/(σ√2))/(σ√2π). */
export const voigtPeak = (sigma: number, gamma: number): number =>
  erfcx(gamma / (sigma * Math.SQRT2)) / (sigma * Math.sqrt(2 * Math.PI));

/** The Olivero–Longbothum (1977) width of a Voigt profile from its two parts' widths:
 * f_V ≈ 0.5346 f_L + √(0.2166 f_L² + f_G²), good to about 2 parts in 10⁴. */
export const oliveroFwhm = (fG: number, fL: number): number => 0.5346 * fL + Math.sqrt(0.2166 * fL * fL + fG * fG);
