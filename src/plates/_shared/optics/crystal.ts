// A cubic crystal's diffraction (plan S3, in three dimensions): the crystal as point scatterers on
// a 32³ grid, four conventional cells of 8 grid steps along each axis, and its three-dimensional
// discrete Fourier transform by the shared radix-2 FFT along x, then y, then z. A reflection
// (h, k, l) of the cubic cell is the transform's bin (4h, 4k, 4l); its intensity over the square
// of the cell count is |F(hkl)|², the basis's structure factor, measured on the crystal and never
// computed from the selection rules the plate compares it with.
import { Fft } from '../fft/fft';

/** Grid steps per conventional cell, cells per axis, and the grid's side. */
export const STEPS = 8;
export const CELLS = 4;
export const N = STEPS * CELLS;
/** The largest |h|, |k|, |l| measured: below the transform's Nyquist bin, CELLS·4 = N/2. */
export const HMAX = 3;

/** One basis atom: fractional coordinates in the cubic cell and a scattering weight. */
export interface Atom { u: number; v: number; w: number; f: number }

export type Lattice = 'sc' | 'bcc' | 'fcc' | 'diamond';

const FCC: [number, number, number][] = [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]];

/** The basis of each cubic lattice in its conventional cell. */
export function basis(lattice: Lattice): Atom[] {
  const at = (p: number[]) => ({ u: p[0], v: p[1], w: p[2], f: 1 });
  if (lattice === 'sc') return [at([0, 0, 0])];
  if (lattice === 'bcc') return [at([0, 0, 0]), at([0.5, 0.5, 0.5])];
  if (lattice === 'fcc') return FCC.map(at);
  return [...FCC, ...FCC.map((p) => p.map((c) => c + 0.25))].map(at);
}

/** The basis snapped to the grid's eighths of a cell (the plate says when that moved an atom). */
export function snap(atoms: Atom[]): { atoms: Atom[]; moved: number } {
  let moved = 0;
  const out = atoms.map((a) => {
    const s = (c: number) => (((Math.round(c * STEPS) % STEPS) + STEPS) % STEPS) / STEPS;
    const b = { u: s(a.u), v: s(a.v), w: s(a.w), f: a.f };
    if (Math.abs(b.u - (((a.u % 1) + 1) % 1)) > 1e-12 || Math.abs(b.v - (((a.v % 1) + 1) % 1)) > 1e-12
      || Math.abs(b.w - (((a.w % 1) + 1) % 1)) > 1e-12) moved++;
    return b;
  });
  return { atoms: out, moved };
}

/** The crystal's density on the grid: each basis atom repeated in every cell, row-major x, y, z. */
export function crystal(atoms: Atom[]): Float64Array {
  const rho = new Float64Array(N * N * N);
  for (let cz = 0; cz < CELLS; cz++) for (let cy = 0; cy < CELLS; cy++) for (let cx = 0; cx < CELLS; cx++) {
    for (const a of atoms) {
      const x = (cx * STEPS + Math.round(a.u * STEPS)) % N;
      const y = (cy * STEPS + Math.round(a.v * STEPS)) % N;
      const z = (cz * STEPS + Math.round(a.w * STEPS)) % N;
      rho[(z * N + y) * N + x] += a.f;
    }
  }
  return rho;
}

/** |FFT₃(ρ)|², unshifted: bin (i, j, k) at ((k·N + j)·N + i). */
export function transform3(rho: Float64Array): Float64Array {
  const fft = new Fft(N);
  const re = Float64Array.from(rho);
  const im = new Float64Array(rho.length);
  const lr = new Float64Array(N);
  const li = new Float64Array(N);
  const pass = (index: (a: number, b: number, t: number) => number) => {
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      for (let t = 0; t < N; t++) { const q = index(a, b, t); lr[t] = re[q]; li[t] = im[q]; }
      fft.transform(lr, li);
      for (let t = 0; t < N; t++) { const q = index(a, b, t); re[q] = lr[t]; im[q] = li[t]; }
    }
  };
  pass((a, b, t) => (a * N + b) * N + t);
  pass((a, b, t) => (a * N + t) * N + b);
  pass((a, b, t) => (t * N + a) * N + b);
  const I = new Float64Array(rho.length);
  for (let q = 0; q < I.length; q++) I[q] = re[q] * re[q] + im[q] * im[q];
  return I;
}

/** |F(hkl)|² read off the transform: the bin (4h, 4k, 4l) over the square of the cell count. */
export function measured(I: Float64Array, h: number, k: number, l: number): number {
  const m = (c: number) => (((c * CELLS) % N) + N) % N;
  return I[(m(l) * N + m(k)) * N + m(h)] / (CELLS ** 3) ** 2;
}

export interface Reflection { h: number; k: number; l: number; F2: number }

/** Every reflection with |h|, |k|, |l| ≤ HMAX but (000), with its measured |F|². */
export function reflections(I: Float64Array): Reflection[] {
  const out: Reflection[] = [];
  for (let h = -HMAX; h <= HMAX; h++) for (let k = -HMAX; k <= HMAX; k++) for (let l = -HMAX; l <= HMAX; l++) {
    if (h === 0 && k === 0 && l === 0) continue;
    out.push({ h, k, l, F2: measured(I, h, k, l) });
  }
  return out;
}

export interface PowderLine {
  /** h² + k² + l². */
  n: number;
  /** Reflections in the line, and the summed measured |F|² over them (the multiplicity included). */
  count: number;
  F2: number;
}

/** The powder lines: the reflections grouped by h² + k² + l², the absent ones (|F|² ≤ eps) dropped. */
export function powder(refl: Reflection[], eps: number): PowderLine[] {
  const by = new Map<number, PowderLine>();
  for (const r of refl) {
    if (r.F2 <= eps) continue;
    const n = r.h * r.h + r.k * r.k + r.l * r.l;
    const line = by.get(n) ?? { n, count: 0, F2: 0 };
    line.count++;
    line.F2 += r.F2;
    by.set(n, line);
  }
  return [...by.values()].sort((a, b) => a.n - b.n);
}
