// charged-particles' loss-cone claim (catalogue/entries/charged-particles.md): the band of the
// mirror's escaping share, derived here. A particle starts at the mirror's centre, on its axis,
// so the field is symmetric about the axis and under z → −z: its fate depends on |cos α| alone,
// and the plate's pusher keeps a particle exactly when |cos α| ≤ μ*, one threshold found by
// bisection with the plate's own orbit (checked on a grid of pitches, phases and both signs).
// A seed's escaping share is then the share of its isotropic launches with |cos α| > μ*,
// counted without pushing a single orbit, so the calibration seeds 101–130 (disjoint from the
// claim's) cost microseconds: four of their standard deviations plus the offset the finite
// gyroradius leaves, their mean minus the adiabatic share 1 − √(1 − B₀/B_max), is the claim's
// tolerance. The count is checked once against the plate's own run at a calibration seed.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { claimSeeds } from '../src/core/claims';
import { mulberry32 } from '../src/core/random';
import { trapped } from '../src/plates/_shared/particles/charged';
import { chargedParticles as plate, H, L } from '../src/plates/charged-particles/plate';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ESCAPING = 'escaping share, measured';
const ADIABATIC = 'adiabatic loss cone sin²α_c = B₀/B_max, escaping share 1 − √(1 − B₀/B_max)';
/** The seeds the band is measured on, fixed before they were read; disjoint from the claim's. */
const BAND_SEEDS = Array.from({ length: 30 }, (_, i) => 101 + i);

const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claim = model.entries.find((e) => e.id === 'charged-particles')!.claims.find((c) => c.id === 'loss-cone')!;
const defaults = Object.fromEntries(plate.params.map((d) => [d.key, d.value])) as Record<string, number | string>;
const params = { ...defaults, ...(claim.setup?.params ?? {}) } as Record<string, number | string>;
const N = Number(params.particles);
const v = Number(params.v);
const qm = Number(params.qm);
const zMax = Number(params.wall) * L;
const pAdiabatic = 1 - Math.sqrt(1 - 1 / (1 + (zMax * zMax) / (L * L)));

/** Whether the plate's orbit escapes, at pitch cos α = mu and gyrophase phi, in a mirror of scale
 * `scale` (the plate's L; another value is a mutation of the field the analytic share assumes). */
const escapes = (mu: number, phi: number, scale = L) =>
  !trapped(1, scale, zMax, v, Math.acos(mu), phi, qm, H, (6 * zMax) / v);

/** μ*: kept below it, lost above it, by bisection on the plate's own orbit. */
function threshold(scale = L): number {
  let lo = 0;
  let hi = 1;
  if (escapes(lo, 0, scale) || !escapes(hi, 0, scale)) throw new Error(`no threshold at L ${scale}`);
  for (let k = 0; k < 40; k++) {
    const m = 0.5 * (lo + hi);
    if (escapes(m, 0, scale)) hi = m; else lo = m;
  }
  return 0.5 * (lo + hi);
}

/** The escaping share the plate reads at a seed, from its launch stream (src/plates/charged-particles/
 * plate.ts mirrorSetup: one draw of the context's generator seeds the particles' own). */
function share(seed: number, muStar: number, n = N): number {
  const rnd = mulberry32(Math.floor(mulberry32(seed)() * 0x7fffffff) + 1);
  let lost = 0;
  for (let i = 0; i < n; i++) {
    const mu = 2 * rnd() - 1;
    rnd(); // the gyrophase, which the fate does not depend on
    if (Math.abs(mu) > muStar) lost++;
  }
  return lost / n;
}

function meanSd(xs: number[]): [number, number] {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return [m, Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))];
}

/** The fate is |cos α| > μ* on a grid of pitches, six gyrophases and both directions along B. */
function checkThreshold(muStar: number, scale = L) {
  for (let i = 0; i <= 100; i++) {
    const mu = i / 100;
    if (Math.abs(mu - muStar) < 1e-3) continue;
    for (const phi of [0, 1, 2, 3, 4, 5]) {
      for (const sign of [1, -1]) {
        expect(escapes(sign * mu, phi, scale), `cos α ${sign * mu}, φ ${phi}, L ${scale}`).toBe(mu > muStar);
      }
    }
  }
}

describe('charged-particles: the loss-cone band from the calibration seeds', () => {
  const muStar = threshold();
  const shares = BAND_SEEDS.map((s) => share(s, muStar));
  const [mean, sd] = meanSd(shares);
  const offset = mean - pAdiabatic;

  it('keeps a particle exactly when |cos α| is at most one threshold μ*', () => {
    checkThreshold(muStar);
  });

  it('counts the plate’s own escaping share at a calibration seed', async () => {
    const r = await read('charged-particles', { ...claim, setup: { params: { ...claim.setup?.params, particles: 400 }, seed: BAND_SEEDS[0] } });
    expect(r.reason).toBeUndefined();
    // the reading is the share minus the adiabatic one, both printed to six decimals
    expect(Number((r.value as number).toFixed(6))).toBe(Number((share(BAND_SEEDS[0], muStar, 400) - Number(pAdiabatic.toFixed(6))).toFixed(6)));
  });

  it('the claim is the adiabatic share ± four calibration sd plus the offset, at seeds outside them', () => {
    expect(claim.readout).toBe(ESCAPING);
    expect(claim.expect.against).toBe(ADIABATIC);
    expect(claim.expect.tolerance, `4 × ${sd} + |${offset}|`).toBe(Math.round((4 * sd + Math.abs(offset)) * 1000) / 1000);
    for (const s of claimSeeds(claim)) expect(BAND_SEEDS, `claim seed ${s}`).not.toContain(s);
    // the seeds' spread is the binomial one, √(p(1 − p)/N), within four of its standard errors
    const p = 1 - muStar;
    expect(Math.abs(sd / Math.sqrt((p * (1 - p)) / N) - 1)).toBeLessThan(4 / Math.sqrt(2 * (BAND_SEEDS.length - 1)));
  });

  it('the band holds the analytic share and the pusher’s own, and excludes a loss cone 5° off', () => {
    const tol = claim.expect.tolerance as number;
    // the band is centred on the adiabatic share; the pusher's exact share 1 − μ* lies inside it
    expect(Math.abs(1 - muStar - pAdiabatic)).toBeLessThan(tol);
    // a field whose scale moves the loss cone's edge α_c by ±5° (the analytic readout unchanged)
    // reads outside the band at every claim seed
    const edge = Math.asin(Math.sqrt(1 / (1 + (zMax * zMax) / (L * L))));
    for (const dAlpha of [5, -5]) {
      const a = edge + (dAlpha * Math.PI) / 180;
      const scale = zMax / Math.sqrt(1 / Math.sin(a) ** 2 - 1);
      const mutated = threshold(scale);
      checkThreshold(mutated, scale);
      for (const s of claimSeeds(claim)) {
        const off = share(s, mutated) - pAdiabatic;
        expect(Math.abs(off), `α_c ${dAlpha > 0 ? '+' : ''}${dAlpha}°, seed ${s}: share off by ${off}`).toBeGreaterThan(tol);
      }
    }
  });
});
