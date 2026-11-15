// The expectation and run of a claim in words (src/core/claims.ts): one formatter, shown on the
// plate page and used in the instrument's failure messages, so the two can never disagree.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { type Claim, claimSeeds, expectationText, setupText } from '../src/core/claims';
import { expected } from './support/claims';

const c = (expect: Claim['expect'], setup?: Claim['setup']): Claim => ({
  id: 'c', statement: 'a claim in words', readout: 'Coverage', expect, setup,
});

describe('a claim in words', () => {
  it('states every expectation form', () => {
    expect(expectationText(c({ value: 1 }))).toBe('exactly 1');
    expect(expectationText(c({ value: 1.645, tolerance: 0.045 }))).toBe('1.645 ± 0.045');
    expect(expectationText(c({ range: [88.9, 92.7] }))).toBe('between 88.9 and 92.7');
    expect(expectationText(c({ below: 90 }))).toBe('below 90');
    expect(expectationText(c({ above: 0 }))).toBe('above 0');
  });

  it('states a comparison against another readout or another number of the same one', () => {
    expect(expectationText(c({ against: 'Exact', tolerance: 0.01 }))).toBe('Coverage minus Exact within ±0.01');
    expect(expectationText(c({ against: 'Exact', against_number: 2, below: 0 }))).toBe('Coverage minus Exact (number 2) below 0');
    expect(expectationText(c({ against: 'Coverage', against_number: 2, above: 0 }))).toBe('Coverage minus its number 2 above 0');
    expect(expectationText(c({ against: 'Chain', offset: 1, tolerance: 0 }))).toBe('Coverage minus Chain minus 1 within ±0');
  });

  it('states which number of the readout a claim reads, when it is not the first', () => {
    expect(expectationText(c({ below: 0.5, number: 2 }))).toBe('its number 2 below 0.5');
    expect(expectationText(c({ range: [0, 1], number: 3 }))).toBe('its number 3 between 0 and 1');
    expect(expectationText(c({ value: 1, number: 1 }))).toBe('exactly 1');
    expect(expectationText(c({ against: 'Exact', number: 2, tolerance: 0.01 }))).toBe('Coverage (number 2) minus Exact within ±0.01');
    expect(expectationText(c({ against: 'Coverage', number: 2, against_number: 3, above: 0 }))).toBe('Coverage (number 2) minus its number 3 above 0');
  });

  it('states the run, with the default seed when the claim names none', () => {
    expect(setupText(c({ value: 1 }))).toBe('seed 4242');
    expect(setupText(c({ value: 1 }, { params: { n: 200, population: 'normal' }, seed: 7 }))).toBe('n 200, population normal, seed 7');
  });

  it('states a claim held at every seed of a list, one run per seed', () => {
    expect(setupText(c({ below: 1 }, { params: { n: 200 }, seeds: [1, 2, 3, 4, 5] }))).toBe('n 200, every seed of 1, 2, 3, 4, 5');
    expect(setupText(c({ below: 1 }, { seeds: [7] }))).toBe('every seed of 7');
  });

  it('is the formatter the instrument reports with', () => {
    expect(expected).toBe(expectationText);
  });
});

/** The seeds a statement names: "at every seed of 1–5", "… of 1 and 2", "… of 1, 2, 3", or
 * "at seed 7"; null when it names none. */
function statedSeeds(statement: string): number[] | null {
  const every = statement.match(/\bat every seed of (\d+(?:\s*[–-]\s*\d+|(?:,\s*(?:and\s+)?|\s+and\s+)\d+)*)/);
  if (every) {
    return every[1].split(/,\s*(?:and\s+)?|\s+and\s+/).flatMap((part) => {
      const range = part.match(/^(\d+)\s*[–-]\s*(\d+)$/);
      if (!range) return [Number(part)];
      return Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, i) => Number(range[1]) + i);
    });
  }
  const one = statement.match(/\bat seed (\d+)/);
  return one ? [Number(one[1])] : null;
}

describe('a claim\'s statement names the seeds it runs at', () => {
  it('reads the forms statements use', () => {
    expect(statedSeeds('… at every seed of 1–5.')).toEqual([1, 2, 3, 4, 5]);
    expect(statedSeeds('… at every seed of 1 and 2.')).toEqual([1, 2]);
    expect(statedSeeds('… at every seed of 1, 2, and 7.')).toEqual([1, 2, 7]);
    expect(statedSeeds('On the grid at seed 4242, 217 edges')).toEqual([4242]);
    expect(statedSeeds('over the calibration seeds 101–130')).toBeNull();
  });

  it('every statement that names seeds names the ones its setup runs', () => {
    const { model } = loadCatalogue(process.cwd()) as {
      model: { entries: { id: string; claims: Claim[] }[]; chapters?: { key: string; figures: { id: string; claims: Claim[] }[] }[] };
    };
    const all = [
      ...model.entries.flatMap((e) => e.claims.map((c) => [`${e.id}/${c.id}`, c] as const)),
      ...(model.chapters ?? []).flatMap((ch) => ch.figures.flatMap((f) => f.claims.map((c) => [`${ch.key}/${f.id}/${c.id}`, c] as const))),
    ];
    let named = 0;
    for (const [at, c] of all) {
      const stated = statedSeeds(c.statement);
      if (!stated) continue;
      named++;
      expect(stated, `${at}: "${c.statement}"`).toEqual(claimSeeds(c));
    }
    // the check reads something: the catalogue's statements do name seeds
    expect(named).toBeGreaterThan(0);
  });
});
