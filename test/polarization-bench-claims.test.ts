// polarization-bench's photons-by-born claim (catalogue/entries/polarization-bench.md): its band,
// derived here. The plate sends the claim's photons one by one by Born's rule and publishes the
// fraction through minus the Jones intensity, in binomial standard errors. Over the calibration
// seeds 101–130, fixed before they were read and disjoint from the claim's, that readout has a
// standard deviation; the claim's range is four of them, rounded out to the readout's tenth.
// A bench whose middle polariser draws photons at another angle than the one the prediction
// assumes reads outside the band.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { claimSeeds } from '../src/core/claims';
import { firstNumber, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'polarization-bench';
const Z = 'photon fraction minus the prediction, in standard errors';
const THROUGH = 'photons through, of those sent';
const JONES = 'transmitted intensity, Jones';
/** The seeds the band is measured on; disjoint from the claim's. */
const BAND_SEEDS = Array.from({ length: 30 }, (_, i) => 101 + i);

const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claim = model.entries.find((e) => e.id === ID)!.claims.find((c) => c.id === 'photons-by-born')!;

/** The text of readout `label` in the plate's settled run with `params` at `seed`. */
async function readout(label: string, params: Record<string, unknown>, seed: number): Promise<string> {
  const r = await read(ID, {
    id: 'probe', statement: 'a calibration reading', readout: label,
    expect: { range: [-Number.MAX_VALUE, Number.MAX_VALUE] }, setup: { params: params as never, seed },
  });
  expect(r.reason, `${label} at seed ${seed}`).toBeUndefined();
  return r.text as string;
}

function meanSd(xs: number[]): [number, number] {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return [m, Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))];
}

describe('polarization-bench: the photons-by-born band from the calibration seeds', () => {
  const params = claim.setup!.params as Record<string, unknown>;

  it('the claim is ± four calibration sd, rounded out to a tenth, at seeds outside them', async () => {
    for (const s of claimSeeds(claim)) expect(BAND_SEEDS, `claim seed ${s}`).not.toContain(s);
    expect(claim.readout).toBe(Z);
    const zs: number[] = [];
    for (const s of BAND_SEEDS) zs.push(firstNumber(await readout(Z, params, s)) as number);
    const [mean, sd] = meanSd(zs);
    const r = Math.ceil(4 * sd * 10) / 10;
    // the readout is a z-score, so its sd is 1 by the binomial identity: within four of the
    // sample sd's standard errors, and its mean within four of the mean's
    expect(Math.abs(sd - 1), `sd ${sd}`).toBeLessThan(4 / Math.sqrt(2 * (zs.length - 1)));
    expect(Math.abs(mean), `mean ${mean}`).toBeLessThan(4 / Math.sqrt(zs.length));
    expect(claim.expect.range, `4 × ${sd} = ${4 * sd}`).toEqual([-r, r]);
  });

  it('a middle polariser drawing at 55° instead of 45° reads outside the band at every claim seed', async () => {
    const [lo, hi] = claim.expect.range as [number, number];
    const predicted = Number(await readout(JONES, params, claimSeeds(claim)[0]));
    expect(predicted).toBeCloseTo(0.25, 6); // cos²45° cos²45° of the horizontal input
    for (const s of claimSeeds(claim)) {
      const [through, sent] = (await readout(THROUGH, { ...params, theta2: 55 }, s)).split(' of ').map(Number);
      const z = (through / sent - predicted) / Math.sqrt((predicted * (1 - predicted)) / sent);
      expect(z < lo || z > hi, `seed ${s}: z ${z}`).toBe(true);
    }
  });
});
