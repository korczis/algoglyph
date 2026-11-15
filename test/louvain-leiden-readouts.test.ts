// louvain-leiden's readouts (wave 7b). D1: the engine's groups readout is labelled
// "Communities" (the kernel's names.groups), and the kernel's own report added a second row with
// the same label and value: a claim reads only the first row with its label, so a settled plate's
// labels must be unique. The engine's row stays (the replay's count, live as communities are
// painted); the report keeps "Levels".
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace } from '../src/engines/graph/trace';
import { kernel, type CommunitiesResult } from '../src/kernels/graph/louvain-leiden';
import { repeatedLabels, settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SETTINGS: [string, Record<string, unknown>][] = [
  ['leiden', {}], ['louvain', { method: 'louvain' }], ['grid', { shape: 'grid' }],
  ['louvain at 300', { method: 'louvain', n: 300 }],
];

describe('louvain-leiden: a settled plate publishes each readout label once (D1)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const rows = await settledRows('louvain-leiden', set as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      expect(rows.map((r) => r.label)).toContain('Communities');
      expect(rows.map((r) => r.label)).toContain('Levels');
      // the row that stays counts what the dropped one counted: the run's own communities
      const g = makeGraph((set.shape ?? kernel.inputs[0]) as Shape, Number(set.n ?? kernel.n?.value),
        seed, 16 / 9);
      const p = { ...defaultParams(kernel), ...(set.method ? { method: set.method as string } : {}) };
      const r = trace(kernel, g, { s: g.s, t: g.t, p }, seed).result as CommunitiesResult;
      expect(rows.find((x) => x.label === 'Communities')?.value).toBe(String(new Set(r.comm).size));
    });
  }
});
