// The expectation and run of a claim in words (src/core/claims.ts): one formatter, shown on the
// plate page and used in the instrument's failure messages, so the two can never disagree.
import { describe, expect, it } from 'vitest';
import { type Claim, expectationText, setupText } from '../src/core/claims';
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
  });

  it('states the run, with the default seed when the claim names none', () => {
    expect(setupText(c({ value: 1 }))).toBe('seed 4242');
    expect(setupText(c({ value: 1 }, { params: { n: 200, population: 'normal' }, seed: 7 }))).toBe('n 200, population normal, seed 7');
  });

  it('is the formatter the instrument reports with', () => {
    expect(expected).toBe(expectationText);
  });
});
