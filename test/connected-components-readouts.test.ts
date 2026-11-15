// connected-components' readouts (wave 7b). D1: the engine's groups readout is labelled
// "Components" (the kernel's names.groups), and the kernel's own report added a second row with
// the same label and value: a claim reads only the first row with its label, so a settled
// plate's labels must be unique. The report's row stays, beside the largest component; the
// labelling's progress stays live in the "Labelled" row.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { repeatedLabels, settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SETTINGS: [string, Record<string, unknown>][] = [
  ['islands', {}], ['random', { shape: 'random' }], ['geometric', { shape: 'geometric' }],
  ['grid', { shape: 'grid' }], ['islands at 400', { n: 400 }], ['islands at 8', { n: 8 }],
];

describe('connected-components: a settled plate publishes each readout label once (D1)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const rows = await settledRows('connected-components', set as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      expect(rows.map((r) => r.label)).toContain('Components');
      expect(rows.map((r) => r.label)).toContain('Largest');
    });
  }
});
