// Where centrality-comparison's claims get their figures (catalogue/entries/centrality-comparison.md,
// read on the plate by test/claims.test.ts and here). Only the eigenvalue is claimed (wave 7b
// decision b): the power iteration may stop at its round cap, and the eigenvalue it prints is
// still lambda_max(A) because its error is second order. Here lambda_max and the whole spectrum
// come from cyclic Jacobi (test/support/analysis-oracles.ts), never from the plate's iteration,
// and the error of the plate's iterate is computed from that spectrum, at the plate's own stop.
import { expect } from 'vitest';
import type { Claim } from '../src/core/claims';
import type { GraphKernel } from '../src/engines/graph/trace';
import { kernel as centrality } from '../src/kernels/graph/centrality-comparison';
import {
  adjacency, claimsAgainst, expectSimple, graphAt, jacobi, paramsOf, seedsOf, type Check,
} from './support/analysis-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'centrality-comparison';
const kernel = centrality as GraphKernel;
/** The plate's stop rule: no score moves by this much in a round (src/kernels/graph/centrality-comparison.ts). */
const STOP = 1e-10;

/**
 * The plate iterates x_j = B x_(j−1) / ‖B x_(j−1)‖ on B = A + I from the uniform unit vector x_0
 * and prints, after its last round J, λ_J = ‖B x_(J−1)‖ − 1. With B = Σ μ_i v_i v_iᵀ (Jacobi, μ_i =
 * λ_i + 1, μ_1 largest) and c_i = v_i · x_0, x_j is Σ c_i μ_i^j v_i over its norm, so every
 * iterate, its change and λ_j follow from the spectrum alone: this replays the stop rule (the
 * first j with max |x_j − x_(j−1)| below 1e-10, or the cap) on that closed form and returns the
 * printed eigenvalue's distance from λ_max there. ‖B x_j‖² = m_(j+1) / m_j with m_j = Σ c_i² μ_i^(2j),
 * a ratio of moments that never decreases (m_j² ≤ m_(j−1) m_(j+1), Cauchy–Schwarz), so the error
 * only shrinks with j; the replay's stop is taken two rounds early to cover a rounding-level
 * difference between the closed form and the plate's arithmetic.
 */
function spectral(c: Claim, seed: number) {
  const g = graphAt(kernel, c, seed);
  expectSimple(g);
  const n = g.n;
  const { values, vectors } = jacobi(adjacency(g));
  const order = values.map((_, i) => i).sort((a, b) => values[b] - values[a]);
  const mu = order.map((i) => values[i] + 1);
  const v = order.map((i) => vectors.map((row) => row[i]));
  const coeff = v.map((vi) => vi.reduce((s, x) => s + x / Math.sqrt(n), 0));
  const unit = (a: number[]) => {
    const norm = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
    const x = new Array<number>(n).fill(0);
    a.forEach((ai, i) => { for (let k = 0; k < n; k++) x[k] += (ai * v[i][k]) / norm; });
    return { x, norm };
  };
  const cap = Number(paramsOf(kernel, c).powerRounds);
  let a = coeff.slice();
  let prev = unit(a);
  const lambda: number[] = [NaN];
  let stop = cap;
  let converged = false;
  for (let j = 1; j <= cap; j++) {
    // scaled by μ_1^j against overflow: the direction is the same
    const b = a.map((ai, i) => (ai * mu[i]) / mu[0]);
    const cur = unit(b);
    lambda.push((mu[0] * cur.norm) / prev.norm - 1);
    let moved = 0;
    for (let k = 0; k < n; k++) moved = Math.max(moved, Math.abs(cur.x[k] - prev.x[k]));
    a = b; prev = cur;
    if (moved < STOP) { stop = j; converged = true; break; }
  }
  const lmax = values[order[0]];
  const deg = new Array<number>(n).fill(0);
  for (let e = 0; e < g.m; e++) { deg[g.eu[e]]++; deg[g.ev[e]]++; }
  return {
    lmax, error: lmax - lambda[Math.max(1, stop - 2)], converged,
    average: (2 * g.m) / n, largest: Math.max(...deg),
  };
}

/** The printed eigenvalue is λ_max to four decimals within 0.001: half a unit of the three
 * decimals printed, the literal's own rounding, and the iterate's error, which must be below
 * 0.0004 at every seed the claim names. `stops` is what the statement says of the run: that it
 * stops at its cap still moving, or converges by its own rule first. */
const lambdaMax = (stops?: 'at-the-cap' | 'converged'): Check => (c) => {
  const all = seedsOf(c).map((seed) => spectral(c, seed));
  for (const s of all) {
    expect(s.error, `${c.id}: the iterate's error`).toBeLessThan(4e-4);
    if (stops) expect(s.converged, `${c.id}: the run ${stops}`).toBe(stops === 'converged');
  }
  const literal = all.map((s) => Number(s.lmax.toFixed(4)));
  expect(new Set(literal).size, `${c.id}: one λ_max at every seed`).toBe(1);
  expect(c.expect, c.id).toEqual({ number: 2, value: literal[0], tolerance: 0.001 });
};

/**
 * The printed eigenvalue lies in [2m/n, Δ] at every round, converged or not. Above: λ_j + 1 =
 * ‖B x_(j−1)‖ ≥ ‖B x_0‖ (the moments' ratio never decreases, above) ≥ x_0ᵀ B x_0 (Cauchy–Schwarz,
 * ‖x_0‖ = 1) = 1 + 2m/n for the uniform x_0 on a simple graph. Below: ‖B x‖ ≤ μ_1 = λ_max + 1 for a
 * unit x, and λ_max ≤ Δ, the largest degree (a row sum bounds an eigenvector's largest entry).
 * Printed to three decimals, rounding keeps both ends: the range is [2m/n rounded down, Δ].
 */
const degreeBounds: Check = (c) => {
  const [seed] = seedsOf(c);
  const s = spectral(c, seed);
  expect(s.lmax).toBeGreaterThanOrEqual(s.average - 1e-9);
  expect(s.lmax).toBeLessThanOrEqual(s.largest + 1e-9);
  expect(c.expect, c.id).toEqual({ number: 2, range: [Math.floor(1000 * s.average) / 1000, s.largest] });
};

claimsAgainst(ID, {
  'eigenvalue-is-lambda-max-at-the-cap': lambdaMax('at-the-cap'),
  'eigenvalue-is-lambda-max-at-seed-7': lambdaMax('converged'),
  'eigenvalue-is-lambda-max-at-the-lowest-cap': lambdaMax('at-the-cap'),
  'eigenvalue-is-lambda-max-on-the-grid': lambdaMax(),
  'eigenvalue-is-lambda-max-on-a-slow-geometric-input': lambdaMax('at-the-cap'),
  'eigenvalue-between-average-and-largest-degree': degreeBounds,
  'eigenvalue-between-average-and-largest-degree-at-the-lowest-cap': degreeBounds,
});
