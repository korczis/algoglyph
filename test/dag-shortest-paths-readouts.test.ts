// dag-shortest-paths' readouts (wave 7a). D4: the relaxation pass marked every vertex of the
// topological order "Relaxed", including those the source cannot reach, whose out-edges it skips
// (80 of 80 on the default graph, where 79 are reached); a vertex is now relaxed only when it is
// reached, so the count is the reachable set's size, and the run's work drops by one settlement per
// unreached vertex. Every expectation here is computed in this file without the kernel:
// reachability by an explicit-stack depth-first search over the edge list.
import { describe, expect, it } from 'vitest';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace } from '../src/engines/graph/trace';
import { kernel } from '../src/kernels/graph/dag-shortest-paths';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'dag-shortest-paths';
const N = 80;
const ASPECT = 16 / 9;

const probe = (readout: string, shape: Shape, seed: number, n = N): Claim => ({
  id: 'probe', statement: 'a readout test reading', readout, expect: { range: [-1e12, 1e12] },
  setup: { params: { shape, n }, seed },
});

/** Which vertices are reachable from s, by depth-first search with an explicit stack. */
function reachable(g: Graph, s: number): boolean[] {
  const seen = new Array<boolean>(g.n).fill(false);
  const stack = [s]; seen[s] = true;
  while (stack.length) {
    const u = stack.pop()!;
    for (let e = 0; e < g.m; e++) if (g.eu[e] === u && !seen[g.ev[e]]) { seen[g.ev[e]] = true; stack.push(g.ev[e]); }
  }
  return seen;
}

describe('dag-shortest-paths: Relaxed counts the reached vertices only (D4)', () => {
  for (const shape of ['signed-dag', 'dag'] as Shape[]) {
    it(`reads the reachable set on the ${shape} input`, async () => {
      for (const seed of [7, 4242]) {
        const g = makeGraph(shape, N, seed, ASPECT);
        const want = reachable(g, g.s).filter(Boolean).length;
        const r = await read(ID, probe('Relaxed', shape, seed));
        expect(r.reason, `${shape} seed ${seed}`).toBeUndefined();
        expect(r.value, `${shape} seed ${seed}: ${r.text}`).toBe(want);
      }
    });
  }

  it('settles exactly the reachable vertices, at every size and seed', () => {
    for (const shape of ['signed-dag', 'dag'] as Shape[]) {
      for (const n of [4, 12, 80, 400]) for (const seed of [1, 7, 11, 4242]) {
        const g = makeGraph(shape, n, seed, ASPECT);
        const t = trace(kernel, g, { s: g.s, t: g.t, p: defaultParams(kernel) }, seed);
        expect(t.counts.settles, `${shape} n ${n} seed ${seed}`).toBe(reachable(g, g.s).filter(Boolean).length);
      }
    }
  });
});
