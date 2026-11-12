// The damped 2-D wave equation u_tt + γ u_t = c² ∇²u + F on a grid of unit cells with a unit time
// step, by the explicit leapfrog scheme with the five-point Laplacian and centred damping:
//   (u⁺ − 2u + u⁻) + (g/2)(u⁺ − u⁻) = C² (u_E + u_W + u_N + u_S − 4u) + F,   C = cΔt/Δx,
// where g = γΔt plus, in an absorbing border, a sponge σ that grows quadratically into it. Solved
// for u⁺. The scheme is stable exactly when C ≤ 1/√2 in two dimensions; a field asked for more is
// refused (CourantError), never stepped. Its plane waves obey the discrete dispersion relation
//   sin²(ω/2) = C² [ sin²(k cos θ / 2) + sin²(k sin θ / 2) ],
// so a wave of angular frequency ω travels with a wavenumber slightly above the continuum ω/c,
// direction by direction (numericalWavenumber). With no damping and no sponge, inside fixed
// (u = 0) edges and walls, the discrete energy
//   E = ½ Σ (u − u⁻)² + ½ C² Σ_edges (Δu)(Δu⁻)
// is conserved to rounding; damping only lowers it. Sources are soft (a forcing term), so fields
// superpose exactly: the scheme is linear. Pure: typed arrays, no p5, no randomness.
import { flush } from '../../../core/budget';

/** The two-dimensional stability limit of the five-point leapfrog scheme, 1/√2. */
export const MAX_COURANT = Math.SQRT1_2;

export class CourantError extends Error {
  constructor(readonly courant: number) {
    super(`Courant number ${courant} is outside (0, 1/√2]: the 2-D leapfrog scheme would be unstable`);
  }
}

export interface FieldOptions {
  w: number;
  h: number;
  /** C = cΔt/Δx. */
  courant: number;
  /** γΔt everywhere (default 0). */
  damping?: number;
  /** Width of the absorbing border in cells (default 0: fixed, reflecting edges). */
  sponge?: number;
  /** The sponge's damping at the outer edge, per step (default 0.25). */
  spongeStrength?: number;
  /** Cells held at zero inside the grid (a wall with openings). */
  walls?: Uint8Array;
  /** Wrap the top and bottom rows onto each other (a strip that is uniform across). */
  periodicY?: boolean;
}

/** A soft source: F = amplitude · sin(ω t + phase) added at one cell. */
export interface Source {
  index: number;
  amplitude: number;
  phase: number;
}

export interface WaveField {
  w: number;
  h: number;
  courant: number;
  c2: number;
  u: Float64Array;
  prev: Float64Array;
  next: Float64Array;
  /** Per cell: 1/(1 + g/2) and (1 − g/2)/(1 + g/2). */
  b: Float64Array;
  a: Float64Array;
  /** Cells held at zero: the grid's edges (unless periodic across) and the walls. */
  fixed: Uint8Array;
  periodicY: boolean;
  /** Steps taken. */
  step: number;
}

export function waveField(o: FieldOptions): WaveField {
  if (!(o.courant > 0 && o.courant <= MAX_COURANT)) throw new CourantError(o.courant);
  const { w, h } = o;
  const n = w * h;
  const sponge = o.sponge ?? 0;
  const strength = o.spongeStrength ?? 0.25;
  const damping = o.damping ?? 0;
  const periodicY = o.periodicY ?? false;
  const b = new Float64Array(n);
  const a = new Float64Array(n);
  const fixed = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const edge = periodicY ? Math.min(x, w - 1 - x) : Math.min(x, w - 1 - x, y, h - 1 - y);
      const s = sponge > 0 && edge < sponge ? strength * ((sponge - edge) / sponge) ** 2 : 0;
      const g = damping + s;
      b[i] = 1 / (1 + g / 2);
      a[i] = (1 - g / 2) / (1 + g / 2);
      const border = x === 0 || x === w - 1 || (!periodicY && (y === 0 || y === h - 1));
      fixed[i] = border || (o.walls && o.walls[i]) ? 1 : 0;
    }
  }
  return {
    w, h, courant: o.courant, c2: o.courant * o.courant,
    u: new Float64Array(n), prev: new Float64Array(n), next: new Float64Array(n),
    b, a, fixed, periodicY, step: 0,
  };
}

/**
 * One step, with soft sources driven at angular frequency ω (radians per step), every source's
 * amplitude multiplied by `scale` (a ramp that switches the drive on gently).
 */
export function stepField(f: WaveField, sources: readonly Source[] = [], omega = 0, scale = 1): void {
  const { w, h, c2, u, prev, next, a, b, fixed } = f;
  const n = w * h;
  for (let y = 0; y < h; y++) {
    const up = f.periodicY ? ((y + h - 1) % h) * w : (y - 1) * w;
    const down = f.periodicY ? ((y + 1) % h) * w : (y + 1) * w;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      if (fixed[i]) {
        next[i] = 0;
        continue;
      }
      const lap = u[i - 1] + u[i + 1] + u[up + x] + u[down + x] - 4 * u[i];
      next[i] = b[i] * (2 * u[i] + c2 * lap) - a[i] * prev[i];
    }
  }
  const t = f.step;
  for (const s of sources) {
    if (s.index < 0 || s.index >= n || fixed[s.index]) continue;
    next[s.index] += b[s.index] * scale * s.amplitude * Math.sin(omega * t + s.phase);
  }
  for (let i = 0; i < n; i++) next[i] = flush(next[i]);
  f.prev = u;
  f.u = next;
  f.next = prev;
  f.step++;
}

/**
 * The scheme's conserved energy between the last two levels:
 * ½ Σ (u − u⁻)² + ½ C² Σ over neighbouring pairs of (Δu)(Δu⁻).
 */
export function energy(f: WaveField): number {
  const { w, h, u, prev, c2 } = f;
  let kin = 0;
  let pot = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = u[i] - prev[i];
      kin += d * d;
      if (x + 1 < w) pot += (u[i + 1] - u[i]) * (prev[i + 1] - prev[i]);
      const j = y + 1 < h ? i + w : f.periodicY ? x : -1;
      if (j >= 0) pot += (u[j] - u[i]) * (prev[j] - prev[i]);
    }
  }
  return 0.5 * kin + 0.5 * c2 * pot;
}

/**
 * The wavenumber (radians per cell) of a plane wave of angular frequency ω travelling at angle θ to
 * the grid's x axis, from the scheme's dispersion relation, by bisection on the branch where both
 * half-angles stay below π/2.
 */
export function numericalWavenumber(omega: number, courant: number, theta: number): number {
  const target = Math.sin(omega / 2) ** 2;
  const cx = Math.abs(Math.cos(theta));
  const sy = Math.abs(Math.sin(theta));
  const rhs = (k: number) => courant * courant * (Math.sin((k * cx) / 2) ** 2 + Math.sin((k * sy) / 2) ** 2);
  let lo = 0;
  let hi = Math.PI / Math.max(cx, sy);
  if (rhs(hi) < target) return Number.NaN; // ω above what the grid can carry
  // 64 halvings of an interval of at most π·√2 reach the last bit of a double
  for (let it = 0; it < 64; it++) {
    const mid = (lo + hi) / 2;
    if (rhs(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
