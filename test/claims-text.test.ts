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
