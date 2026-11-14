// An entry's claims (ADR 0007): what its plate measures, stated with the readout that shows it and
// the value the statement predicts. The page states a claim and how it is checked; the verdict is
// the gate's (test/claims.test.ts), on every build, and is never shown as if it were live here.

export interface Claim {
  id: string;
  statement: string;
  readout: string;
  expect: {
    /** Which number of this readout is read (from 1; default 1). */
    number?: number;
    value?: number; tolerance?: number; range?: [number, number]; below?: number; above?: number;
    /** Compare with another readout (or another number of the same one): the claim judges
     * readout − against, with tolerance (|difference|), below or above. */
    against?: string; against_number?: number;
    /** With against: the difference the claim states; it judges readout − against − offset. */
    offset?: number;
  };
  /** seed: the one run's seed; seeds: the claim holds at every one, each a run of its own. */
  setup?: { params?: Record<string, string | number | boolean>; seed?: number; seeds?: number[] };
  source?: string;
}

/** The seed a claim's run uses when its setup names none. */
export const DEFAULT_SEED = 4242;

/** The expectation in words, the one formatter the page and the instrument share. */
export function expectationText(claim: Claim): string {
  const x = claim.expect;
  if (x.against !== undefined) {
    const other = x.against === claim.readout
      ? `its number ${x.against_number ?? 1}`
      : `${x.against}${x.against_number ? ` (number ${x.against_number})` : ''}`;
    const self = x.number && x.number !== 1 ? `${claim.readout} (number ${x.number})` : claim.readout;
    const of = `${self} minus ${other}${x.offset ? ` minus ${x.offset}` : ''}`;
    if (x.tolerance !== undefined) return `${of} within ±${x.tolerance}`;
    return x.below !== undefined ? `${of} below ${x.below}` : `${of} above ${x.above}`;
  }
  // a claim reading another than the first number says which, beside the readout's label
  const its = x.number && x.number !== 1 ? `its number ${x.number} ` : '';
  if (x.range) return `${its}between ${x.range[0]} and ${x.range[1]}`;
  if (x.below !== undefined) return `${its}below ${x.below}`;
  if (x.above !== undefined) return `${its}above ${x.above}`;
  return its + (x.tolerance ? `${x.value} ± ${x.tolerance}` : `exactly ${x.value}`);
}

/** The run a claim is about, in short: its changed parameters and its seed. */
export function setupText(claim: Claim): string {
  const params = Object.entries(claim.setup?.params ?? {}).map(([k, v]) => `${k} ${v}`);
  const seeds = claim.setup?.seeds;
  const run = seeds ? `every seed of ${seeds.join(', ')}` : `seed ${claim.setup?.seed ?? DEFAULT_SEED}`;
  return [...params, run].join(', ');
}

/** The seeds a claim runs at: every one it lists, else its one seed (4242 when it names none). */
export function claimSeeds(claim: Claim): number[] {
  return claim.setup?.seeds ?? [claim.setup?.seed ?? DEFAULT_SEED];
}
