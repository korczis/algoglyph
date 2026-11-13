// drift-divergence (catalogue/entries/drift-divergence.md): "The population stability index
// Σ(q − p) ln(q/p) is exactly the sum of the two Kullback–Leibler divergences, KL(q‖p) + KL(p‖q)".
// The two directions and their sum are a readout of their own, "a + b = s nats", so that a claim
// can set PSI against it; each number is recomputed here from the run's binned proportions.
// The entry's Monte-Carlo claims are checked here too: with no drift, PSI ≈ 2χ²_{k−1}/n and
// KL ≈ χ²_{k−1}/n, and at n 20000 the Jensen–Shannon reading lies within four standard deviations
// of the divergence between the exact binned normal distributions, the standard deviation measured
// on a named seed set disjoint from the claim's.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel, type DriftResult } from '../src/kernels/stochastic/drift-divergence';
import { nthNumber, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'drift-divergence';
const probe = (readout: string, params: Record<string, number>, seed: number): Claim =>
  ({ id: 'probe', statement: 'a readout test reading', readout, expect: { above: -1 }, setup: { params, seed } });
const kl = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * Math.log(x / b[i]), 0);
const round4 = (x: number) => Number(x.toFixed(4));
const k = kernel as StochasticKernel<DriftResult>;

/** The seed every claim runs on (DEFAULT_SEED: no claim sets its own). */
const CLAIM_SEEDS = [4242];
/** The seeds the standard deviations and null spreads come from, disjoint from CLAIM_SEEDS. */
const SD_SEEDS = Array.from({ length: 400 }, (_, i) => i + 1);
const BINS = 22;
const LO = -4;
const HI = 7;

/** The normal distribution function by Simpson's rule on the density (not the kernels' erf). */
function phi(x: number): number {
  const a = Math.min(0, x);
  const b = Math.max(0, x);
  const m = 4000;
  const h = (b - a) / m;
  const f = (t: number) => Math.exp(-t * t / 2) / Math.sqrt(2 * Math.PI);
  let sum = f(a) + f(b);
  for (let i = 1; i < m; i++) sum += (i % 2 ? 4 : 2) * f(a + i * h);
  return x >= 0 ? 0.5 + (sum * h) / 3 : 0.5 - (sum * h) / 3;
}

/** N(mu, sd²) binned as the plate bins it: equal bins on [LO, HI], the tails in the end bins. */
function binned(mu: number, sd: number): number[] {
  const w = (HI - LO) / BINS;
  const F = (b: number) => (b <= 0 ? 0 : b >= BINS ? 1 : phi((LO + b * w - mu) / sd));
  return Array.from({ length: BINS }, (_, b) => F(b + 1) - F(b));
}

const jsBits = (p: number[], q: number[]) => {
  const m = p.map((x, i) => (x + q[i]) / 2);
  const d = (a: number[]) => a.reduce((s, x, i) => s + (x > 0 ? x * Math.log(x / m[i]) : 0), 0);
  return (0.5 * d(p) + 0.5 * d(q)) / Math.LN2;
};

function meanSd(v: number[]): [number, number] {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return [m, Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))];
}

const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === ID)!.claims;
const claimById = (id: string) => claims.find((c) => c.id === id);

describe('drift-divergence: KL both ways is a readout', () => {
  for (const params of [{}, { drift: 0, widen: 0 }, { n: 20000, drift: 3, widen: 1.5 }] as Record<string, number>[]) {
    it(`reads KL(q‖p) + KL(p‖q) = PSI at ${JSON.stringify(params)}`, async () => {
      for (const seed of [4242, 7]) {
        const r = await read(ID, probe('KL both ways', params, seed));
        expect(r.reason, `seed ${seed}`).toBeUndefined();
        const text = r.text ?? '';
        const res = trace(k, params, seed).result!;
        const last = res.steps[res.steps.length - 1];
        expect(nthNumber(text, 1), text).toBe(round4(kl(last.q, last.p)));
        expect(nthNumber(text, 2), text).toBe(round4(kl(last.p, last.q)));
        expect(nthNumber(text, 3), text).toBe(round4(kl(last.q, last.p) + kl(last.p, last.q)));
        const forward = await read(ID, probe('KL(current ‖ reference)', params, seed));
        expect(nthNumber(text, 1)).toBe(forward.value);
        const psi = await read(ID, probe('PSI', params, seed));
        expect(Math.abs((nthNumber(text, 3) as number) - (psi.value as number))).toBeLessThanOrEqual(1e-4);
      }
    });
  }
});

describe('drift-divergence: the claims\' margins', () => {
  it('no claim seed is among the standard-deviation seeds', () => {
    for (const s of CLAIM_SEEDS) expect(SD_SEEDS).not.toContain(s);
    for (const c of claims) expect(CLAIM_SEEDS).toContain(c.setup?.seed ?? 4242);
  });

  it('with no drift PSI and KL sit near 2χ²/n and χ²/n, far below the claims\' bounds', () => {
    const n = 2000;
    const runs = SD_SEEDS.map((s) => trace(k, { drift: 0, widen: 0 }, s).result!.steps[80]);
    const [psiMean] = meanSd(runs.map((r) => r.psi));
    const [klMean] = meanSd(runs.map((r) => r.kl));
    // at most k − 1 = 21 degrees of freedom: E PSI ≤ 2·21/n, E KL ≤ 21/n
    expect(psiMean).toBeLessThan((2 * (BINS - 1)) / n);
    expect(klMean).toBeLessThan((BINS - 1) / n);
    expect(Math.max(...runs.map((r) => r.psi))).toBeLessThan(claimById('no-drift-psi-is-small')!.expect.below as number);
    expect(Math.max(...runs.map((r) => r.kl))).toBeLessThan(claimById('no-drift-kl-is-small')!.expect.below as number);
  });

  it('at n 20000 the JS claim is the exact binned divergence ± at least 4 sd over the other seeds', () => {
    const exact = jsBits(binned(0, 1), binned(1.5, 1.4));
    const c = claimById('js-at-full-drift')!;
    expect(c.setup?.params).toEqual({ n: 20000 });
    const [mean, sd] = meanSd(SD_SEEDS.map((s) => trace(k, { n: 20000 }, s).result!.steps[80].js));
    expect(Math.abs((c.expect.value as number) - exact), `exact ${exact}`).toBeLessThanOrEqual(0.0005);
    expect(c.expect.tolerance as number).toBeGreaterThanOrEqual(4 * sd);
    expect(c.expect.tolerance as number).toBeLessThan(4 * sd + 0.002);
    expect(Math.abs(mean - exact), `mean ${mean}, sd ${sd}`).toBeLessThan(sd);
  });
});
