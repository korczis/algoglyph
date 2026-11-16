// centrality-comparison's readouts (wave 7b). D7: the power iteration runs at most a fixed number
// of rounds, and at the default (communities, n 50, seed 4242) it needs 304 by its own 1e-10
// rule, so the eigenvector it reports is an iterate. The cap stays (decision b); the readout now
// names it, so that an unconverged vector reads as such rather than as a run that chose to stop.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace } from '../src/engines/graph/trace';
import { kernel, POWER_ROUNDS, type CentralityResult } from '../src/kernels/graph/centrality-comparison';
import { settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SETTINGS: [string, Record<string, unknown>][] = [
  ['communities', {}], ['grid', { shape: 'grid' }], ['small-world', { shape: 'small-world' }],
  ['geometric at 80', { shape: 'geometric', n: 80 }],
];

describe('centrality-comparison names its power-iteration cap (D7)', () => {
  it('keeps the 300-round default cap', () => expect(POWER_ROUNDS).toBe(300));

  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const rows = await settledRows('centrality-comparison', set as never, seed);
      const g = makeGraph((set.shape ?? kernel.inputs[0]) as Shape, Number(set.n ?? kernel.n?.value),
        seed, 16 / 9);
      const r = trace(kernel, g, { s: g.s, t: g.t, p: defaultParams(kernel) }, seed)
        .result as CentralityResult;
      const row = rows.find((x) => x.label === 'Power iteration')?.value ?? '';
      if (r.converged) {
        expect(r.iterations).toBeLessThanOrEqual(POWER_ROUNDS);
        expect(row).toMatch(new RegExp(`^converged after ${r.iterations} rounds, eigenvalue `));
      } else {
        expect(r.iterations).toBe(POWER_ROUNDS);
        expect(row).toMatch(new RegExp(`^stopped at the ${POWER_ROUNDS}-round cap, eigenvalue `));
      }
    });
  }

  it('the default run is the unconverged case', () => {
    const g = makeGraph(kernel.inputs[0], Number(kernel.n?.value), DEFAULT_SEED, 16 / 9);
    const r = trace(kernel, g, { s: g.s, t: g.t, p: {} }, DEFAULT_SEED).result as CentralityResult;
    expect(r.converged).toBe(false);
  });
});
