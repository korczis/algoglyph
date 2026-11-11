// The 2D Ising model on a square lattice with periodic boundaries (a torus), J = 1:
//   E = −Σ⟨ij⟩ s_i s_j − h Σ_i s_i,   s_i = ±1, each nearest-neighbour bond counted once.
// Metropolis dynamics: propose flipping one spin, accept with probability min(1, e^(−ΔE/T)),
// visiting the sites in checkerboard order (all even sites, then all odd sites) each sweep.

/** Onsager's exact critical temperature of the square lattice, 2 / ln(1 + √2) (k_B = J = 1). */
export const T_CRITICAL = 2 / Math.log(1 + Math.SQRT2);

export type Start = 'random' | 'ordered';

export interface Lattice {
  w: number;
  h: number;
  s: Int8Array;
}

export function lattice(w: number, h: number, start: Start, rnd: () => number): Lattice {
  const s = new Int8Array(w * h);
  for (let i = 0; i < s.length; i++) s[i] = start === 'ordered' || rnd() < 0.5 ? 1 : -1;
  return { w, h, s };
}

/** Sum of the four nearest neighbours of site i, wrapping at the edges. */
export function neighbours(l: Lattice, i: number): number {
  const { w, h, s } = l;
  const x = i % w;
  const y = (i - x) / w;
  const row = y * w;
  return s[row + (x + 1) % w] + s[row + (x - 1 + w) % w]
    + s[((y + 1) % h) * w + x] + s[((y - 1 + h) % h) * w + x];
}

/** Energy change of flipping spin i: ΔE = 2 s_i (Σ neighbours + h). */
export function deltaE(l: Lattice, i: number, field: number): number {
  return 2 * l.s[i] * (neighbours(l, i) + field);
}

/** Total energy, each bond counted once through its right and lower ends. */
export function energy(l: Lattice, field: number): number {
  const { w, h, s } = l;
  let bonds = 0;
  let sum = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const below = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const v = s[row + x];
      bonds += v * (s[row + (x + 1) % w] + s[below + x]);
      sum += v;
    }
  }
  return -bonds - field * sum;
}

export function magnetisation(l: Lattice): number {
  let sum = 0;
  for (let i = 0; i < l.s.length; i++) sum += l.s[i];
  return sum / l.s.length;
}

/**
 * One Metropolis sweep (every site proposed once). Returns the number of accepted flips; when
 * `flipped` is given, each flipped site is set to 1 there.
 */
export function sweep(l: Lattice, temperature: number, field: number, rnd: () => number,
  flipped?: Uint8Array): number {
  const { w, h, s } = l;
  const beta = 1 / Math.max(temperature, 1e-9);
  // ΔE = 2 s (n + h) with n ∈ {−4, −2, 0, 2, 4}: ten possible acceptance probabilities
  const accept = new Float64Array(10);
  for (let k = 0; k < 10; k++) {
    const spin = k < 5 ? -1 : 1;
    const n = 2 * (k % 5) - 4;
    accept[k] = Math.min(1, Math.exp(-beta * 2 * spin * (n + field)));
  }
  let accepted = 0;
  for (let parity = 0; parity < 2; parity++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      const up = ((y - 1 + h) % h) * w;
      const down = ((y + 1) % h) * w;
      for (let x = (y + parity) & 1; x < w; x += 2) {
        const i = row + x;
        const n = s[row + (x + 1) % w] + s[row + (x - 1 + w) % w] + s[up + x] + s[down + x];
        const a = accept[(s[i] > 0 ? 5 : 0) + (n + 4) / 2];
        if (a >= 1 || rnd() < a) {
          s[i] = -s[i];
          accepted++;
          if (flipped) flipped[i] = 1;
        }
      }
    }
  }
  return accepted;
}
