// kosaraju-scc's readouts (wave 7a). D2: the engine's groups readout is labelled
// "Strong components" (the kernel's names.groups), and the kernel's own report added a second row
// with the same label and value: a claim reads only the first row with its label, so a settled
// plate's labels must be unique. The engine's row stays (the replay's count of components, live
// as they are painted); the report keeps the largest component.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { installBrowserStubs } from './support/p5-stub';
import { repeatedLabels, settledRows } from './support/digraph-oracles';

installBrowserStubs();

const SETTINGS: [string, Record<string, unknown>][] = [
  ['digraph', {}], ['dag', { shape: 'dag' }], ['ownership', { shape: 'ownership' }],
  ['digraph at 300', { n: 300 }], ['digraph at 6', { n: 6 }],
];

describe('kosaraju-scc: a settled plate publishes each readout label once (D2)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const rows = await settledRows('kosaraju-scc', set as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      expect(rows.map((r) => r.label)).toContain('Strong components');
      expect(rows.map((r) => r.label)).toContain('Largest');
    });
  }
});
