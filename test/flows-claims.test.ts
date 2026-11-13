// Where the flow plates' claims get their figures (catalogue/entries/<id>.md `claims`, read on the
// plates by test/claims.test.ts). Every literal is computed here at the claim's own setup by an
// algorithm other than the plate's (test/support/graph-oracles.ts): the maximum flow by Dinic's
// algorithm, the minimum cost by successive shortest paths, the maximum matching by
// Hopcroft–Karp. Every bound is derived below for the plate's own variant, from the network the
// claim's setup draws; no figure is a reading of the run it is checked on.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import type { GraphKernel } from '../src/engines/graph/trace';
import { kernel as fordFulkerson } from '../src/kernels/graph/ford-fulkerson';
import { dinic } from './support/graph-oracles';

interface Entry { id: string; claims: Claim[] }
const { model } = loadCatalogue(process.cwd()) as { model: { entries: Entry[] } };
const DEFAULT_SEED = 4242;

/** The network a claim's setup draws, as the plate draws it (16:9, the kernel's default size). */
function graphOf(kernel: GraphKernel, c: Claim): Graph {
  const p = (c.setup?.params ?? {}) as Record<string, unknown>;
  const shape = (p.shape ?? kernel.inputs[0]) as Shape;
  return makeGraph(shape, Number(p.n ?? kernel.n!.value), c.setup?.seed ?? DEFAULT_SEED, 16 / 9);
}

/** How a claim on a readout is checked: a literal against a reference, a bound against its
 * derivation, a comparison of two readouts by its shape alone. */
type Check = (c: Claim, g: Graph) => void;

/** A literal claim on the flow value: Dinic's maximum flow of the claim's network. */
const flowValue: Check = (c, g) => {
  expect(c.expect.value, c.id).toBe(dinic(g, g.s, g.t));
};

/** A comparison claim that must be exact: this readout against another, tolerance 0. */
const exactAgainst = (other: string): Check => (c) => {
  expect(c.expect, c.id).toEqual({ against: other, tolerance: 0 });
};

/** Each augmentation pushes its bottleneck, at least one unit with integer capacities, so the
 * augmentations are at most the flow value: Rounds − Flow value < 1, an integer at most 0. */
const roundsAtMostFlow: Check = (c) => {
  expect(c.expect, c.id).toEqual({ against: 'Flow value', below: 1 });
};

interface Plate { id: string; kernel: GraphKernel; checks: Record<string, Check>; needs: string[] }

const PLATES: Plate[] = [
  {
    id: 'ford-fulkerson', kernel: fordFulkerson as GraphKernel,
    checks: {
      'Flow value': flowValue,
      'Cut capacity': exactAgainst('Flow value'),
      Rounds: roundsAtMostFlow,
    },
    needs: ['Flow value', 'Cut capacity', 'Rounds'],
  },
];

for (const p of PLATES) {
  describe(`${p.id}: claims against independent references`, () => {
    const entry = model.entries.find((e) => e.id === p.id);
    it('makes a claim on each readout the article names', () => {
      const readouts = new Set(entry?.claims.map((c) => c.readout));
      for (const r of p.needs) expect(readouts.has(r), `${p.id} claims "${r}"`).toBe(true);
    });
    for (const c of entry?.claims ?? []) {
      it(`${c.id}: "${c.readout}"`, () => {
        const check = p.checks[c.readout];
        expect(check, `${p.id} claim ${c.id} reads "${c.readout}", which this file has no reference for`).toBeDefined();
        check(c, graphOf(p.kernel, c));
      });
    }
  });
}
