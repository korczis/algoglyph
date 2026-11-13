// The max-flow plates' cut (wave 7a, G1). ford-fulkerson's notes say the vertices still reachable
// at the end are one side of a minimum cut and "the flow value equals the cut's capacity, the
// max-flow min-cut theorem"; preflow-push draws the same cut. Each plate now publishes the
// capacity of the cut its final residual network defines (the edges from the reachable side to
// the rest), so a claim can set it against the flow value. Its expectation here is the maximum
// flow by Dinic's algorithm (test/support/graph-oracles.ts), which by the same theorem is the
// capacity of every minimum cut.
import { describe, expect, it } from 'vitest';
import { makeGraph } from '../src/engines/graph/graph';
import { defaultParams, trace, type GraphKernel } from '../src/engines/graph/trace';
import type { FlowResult } from '../src/kernels/graph/_flow';
import { kernel as edmondsKarp } from '../src/kernels/graph/edmonds-karp';
import { kernel as fordFulkerson } from '../src/kernels/graph/ford-fulkerson';
import { kernel as preflowPush } from '../src/kernels/graph/preflow-push';
import { holds, read, type Claim } from './support/claims';
import { dinic } from './support/graph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const PLATES: [string, GraphKernel<FlowResult>][] = [
  ['ford-fulkerson', fordFulkerson], ['edmonds-karp', edmondsKarp], ['preflow-push', preflowPush],
];
const CUT = 'Cut capacity';

const probe = (n: number, seed: number, against?: string): Claim => ({
  id: 'probe', statement: 'a readout test reading', readout: CUT,
  expect: against ? { against, tolerance: 0 } : { range: [-1e12, 1e12] }, setup: { params: { n }, seed },
});

describe('max-flow plates publish the capacity of their final cut (G1)', () => {
  for (const [id, kernel] of PLATES) {
    const settings = [[kernel.n!.value, 4242], [kernel.n!.value, 7], [kernel.n!.max, 4242], [kernel.n!.min, 7]];
    for (const [n, seed] of settings) {
      it(`${id}, n ${n}, seed ${seed}: the cut is Dinic's maximum flow and the plate's flow value`, async () => {
        const g = makeGraph('flow', n, seed);
        const max = dinic(g, g.s, g.t);
        const r = await read(id, probe(n, seed));
        expect(r.reason).toBeUndefined();
        expect(r.value, r.text).toBe(max);
        const c = probe(n, seed, 'Flow value');
        const d = await read(id, c);
        expect(d.reason).toBeUndefined();
        expect(holds(c, d.value as number), d.text).toBe(true);
      });
    }
  }

  it('the row is the capacity of the edges leaving the residual side, which holds s and not t', () => {
    for (const [id, kernel] of PLATES) {
      for (const seed of [3, 7, 4242]) for (const n of [4, 24, 40, 150]) {
        const g = makeGraph('flow', n, seed);
        const t = trace(kernel, g, { s: g.s, t: g.t, p: defaultParams(kernel) });
        const res = t.result as FlowResult;
        expect(res.side[g.s] && !res.side[g.t], `${id} n ${n} seed ${seed}`).toBe(true);
        let cap = 0;
        for (let e = 0; e < g.m; e++) if (res.side[g.eu[e]] && !res.side[g.ev[e]]) cap += g.cap[e];
        const row = kernel.report?.(res, g, t.opts).find((x) => x.label === CUT);
        expect(row?.value.split(' ')[0], `${id} n ${n} seed ${seed}`).toBe(String(cap));
      }
    }
  });
});
