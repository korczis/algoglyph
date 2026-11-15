// articulation-points' readouts (wave 7b). D1: the engine's marked readout is labelled
// "Articulation points" (the kernel's names.marked), and the kernel's own report added a second
// row with the same label and value: a claim reads only the first row with its label, so a
// settled plate's labels must be unique. The marks are set only after the search ends, so the
// engine's row never counted anything live; the report's row stays.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { repeatedLabels, settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SETTINGS: [string, Record<string, unknown>][] = [
  ['geometric', {}], ['small-world', { shape: 'small-world' }], ['random', { shape: 'random' }],
  ['islands', { shape: 'islands' }], ['geometric at 300', { n: 300 }], ['geometric at 6', { n: 6 }],
];

describe('articulation-points: a settled plate publishes each readout label once (D1)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const rows = await settledRows('articulation-points', set as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      expect(rows.map((r) => r.label)).toContain('Articulation points');
      expect(rows.map((r) => r.label)).toContain('Biconnected blocks');
    });
  }
});
