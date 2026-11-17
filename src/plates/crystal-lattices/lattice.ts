// Crystal lattices in real space: each as three primitive vectors and a basis, in units of the
// cubic (or hexagonal) cell's side a. The neighbours of one atom are found by enumerating every
// lattice point in a block of cells and sorting them by distance into shells; nothing about the
// shells is told to the code.

export type V3 = [number, number, number];

export interface Lattice { id: string; label: string; vectors: [V3, V3, V3]; basis: V3[] }

const R3 = Math.sqrt(3);
const CA = Math.sqrt(8 / 3);

export const LATTICES: Lattice[] = [
  { id: 'sc', label: 'simple cubic', vectors: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], basis: [[0, 0, 0]] },
  { id: 'bcc', label: 'body-centred cubic', vectors: [[-0.5, 0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, -0.5]], basis: [[0, 0, 0]] },
  { id: 'fcc', label: 'face-centred cubic', vectors: [[0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]], basis: [[0, 0, 0]] },
  // ideal hexagonal close packing: c/a = √(8/3), the second atom at (2/3, 1/3, 1/2) of the cell
  {
    id: 'hcp', label: 'hexagonal close-packed', vectors: [[1, 0, 0], [0.5, R3 / 2, 0], [0, 0, CA]],
    basis: [[0, 0, 0], [0.5, R3 / 6, CA / 2]],
  },
  { id: 'diamond', label: 'diamond', vectors: [[0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]], basis: [[0, 0, 0], [0.25, 0.25, 0.25]] },
];

export const lattice = (id: string): Lattice => LATTICES.find((l) => l.id === id) ?? LATTICES[0];

/** The primitive cell's volume, |a₁ · (a₂ × a₃)|. */
export function cellVolume(l: Lattice): number {
  const [a, b, c] = l.vectors;
  return Math.abs(a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]));
}

/** One shell of neighbours: its distance, and the neighbours' positions relative to the atom. */
export interface Shell { r: number; atoms: V3[] }

/** The shells around the basis's first atom out to `count` shells, from every point within ±K
 * cells along each primitive vector; distances within `tol` of each other share a shell. */
export function shells(l: Lattice, count: number, K = 4, tol = 1e-9): Shell[] {
  const pts: { r: number; p: V3 }[] = [];
  const [a, b, c] = l.vectors;
  const o = l.basis[0];
  for (let i = -K; i <= K; i++) for (let j = -K; j <= K; j++) for (let k = -K; k <= K; k++) {
    for (const s of l.basis) {
      const x = i * a[0] + j * b[0] + k * c[0] + s[0] - o[0];
      const y = i * a[1] + j * b[1] + k * c[1] + s[1] - o[1];
      const z = i * a[2] + j * b[2] + k * c[2] + s[2] - o[2];
      const r = Math.sqrt(x * x + y * y + z * z);
      if (r > tol) pts.push({ r, p: [x, y, z] });
    }
  }
  pts.sort((u, v) => u.r - v.r);
  const out: Shell[] = [];
  for (const q of pts) {
    const last = out[out.length - 1];
    if (last && q.r - last.r < tol) last.atoms.push(q.p);
    else if (out.length < count) out.push({ r: q.r, atoms: [q.p] });
    else break;
  }
  return out;
}

/** The packing fraction: spheres touching their nearest neighbours, radius r₁/2, times the
 * number of atoms per volume. */
export const packing = (l: Lattice, r1: number): number =>
  ((l.basis.length / cellVolume(l)) * 4 * Math.PI * (r1 / 2) ** 3) / 3;
