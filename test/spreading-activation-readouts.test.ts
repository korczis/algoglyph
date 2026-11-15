// spreading-activation's readouts (wave 7b).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { repeatedLabels, settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'spreading-activation';

// D1: the engine's done readout is labelled "Activated" (the kernel's names.done), and the
// kernel's own report added a second row with the same label: a claim reads only the first row
// with its label, so a settled plate's labels must be unique. The engine's row stays (the
// replay's count of settled vertices); the report row is renamed "Reach and firings".
const SETTINGS: [string, Record<string, unknown>][] = [
  ['communities', {}], ['links', { shape: 'links' }], ['threshold 0', { threshold: 0 }],
  ['decay 0.1, threshold 50', { decay: 0.1, threshold: 50 }],
];

describe('spreading-activation: a settled plate publishes each readout label once (D1)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const rows = await settledRows(ID, set as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      expect(rows.map((r) => r.label)).toContain('Activated');
      expect(rows.map((r) => r.label)).toContain('Reach and firings');
    });
  }
});
