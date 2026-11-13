// Independent references for the digraph plates' claims (wave 7a: kosaraju-scc, tarjan-scc,
// topological-sort, transitive-closure), written over the Graph's edge lists alone: a
// breadth-first search from every vertex, never a depth-first search or Warshall's rounds as the
// plates run. And the settled readouts of a plate, as test/support/claims.ts runs it.
import { expect } from 'vitest';
import { GROUNDS, palette as lookupPalette } from '../../src/core/palette';
import { defaults, type Params, type PlateContext, type Stat } from '../../src/core/plate';
import { DEFAULT_SEED } from '../../src/core/claims';
import { mulberry32 } from '../../src/core/random';
import { makeGraph, type Graph, type Shape } from '../../src/engines/graph/graph';
import type { GraphKernel } from '../../src/engines/graph/trace';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../../scripts/lib/catalogue.mjs';
import { loadPlate } from '../../src/registry';
import { MAX_FRAMES, SETTLE_FRAMES } from './claims';
import { p5Stub } from './p5-stub';

/** reach[i][j]: j is reachable from i along the directed edges (every vertex reaches itself),
 * by a breadth-first search from each vertex. */
export function reachability(g: Graph): boolean[][] {
  const next: number[][] = Array.from({ length: g.n }, () => []);
  for (let e = 0; e < g.m; e++) next[g.eu[e]].push(g.ev[e]);
  return Array.from({ length: g.n }, (_, s) => {
    const seen = new Array<boolean>(g.n).fill(false);
    seen[s] = true;
    const queue = [s];
    for (let i = 0; i < queue.length; i++) {
      for (const v of next[queue[i]]) if (!seen[v]) { seen[v] = true; queue.push(v); }
    }
    return seen;
  });
}

/** The classes of mutual reachability (u and v reach each other): the strong components. */
export function mutualClasses(g: Graph): number[] {
  const reach = reachability(g);
  const cls = new Array<number>(g.n).fill(-1);
  let k = 0;
  for (let u = 0; u < g.n; u++) {
    if (cls[u] >= 0) continue;
    for (let v = u; v < g.n; v++) if (reach[u][v] && reach[v][u]) cls[v] = k;
    k++;
  }
  return cls;
}

/** Every readout row of `id`'s plate once its readouts have settled, as test/support/claims.ts
 * runs it: loop off, the pace control at its top, the given parameters and seed. */
export async function settledRows(id: string, set: Params, seed: number): Promise<Stat[]> {
  const plate = await loadPlate(id);
  if (!plate) throw new Error(`${id} has no plate`);
  const params: Params = { ...defaults(plate), loop: false, ...set };
  const pace = plate.params.find((d) => d.key === 'pace');
  if (pace?.kind === 'range') params.pace = pace.max;
  let rows: Stat[] = [];
  const ground = GROUNDS.dark;
  const ctx: PlateContext = {
    width: 800, height: Math.round(800 / plate.aspect), params, seed, rnd: mulberry32(seed),
    theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => lookupPalette('spectral'), stats(r) { rows = r; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  let last = '';
  let still = 0;
  for (let f = 0; f < MAX_FRAMES && (still < SETTLE_FRAMES || !sim.pace?.().done); f++) {
    sim.draw();
    const now = JSON.stringify(rows);
    still = now === last ? still + 1 : 0;
    last = now;
  }
  expect(still, `${id} settles`).toBeGreaterThanOrEqual(SETTLE_FRAMES);
  return rows;
}

/** Labels that a settled row list carries more than once. */
export function repeatedLabels(rows: Stat[]): string[] {
  const labels = rows.map((r) => r.label);
  return labels.filter((l, i) => labels.indexOf(l) !== i);
}

export interface EntryClaim {
  id: string; readout: string;
  expect: { value?: number; range?: number[]; against?: string; offset?: number };
  setup?: { params?: Record<string, unknown>; seed?: number };
}

/** The claims catalogue/entries/<id>.md authors, as the catalogue loads them. */
export function entryClaims(id: string): EntryClaim[] {
  const { model } = loadCatalogue(process.cwd()) as {
    model: { entries: { id: string; claims: EntryClaim[] }[] };
  };
  return model.entries.find((e) => e.id === id)?.claims ?? [];
}

/** The graph a claim's run starts on: the plate's first input, as src/engines/graph/index.ts
 * builds it (its shape and size controls, the claim's seed, 1:1 for a matrix kernel). */
export function claimGraph(kernel: GraphKernel, c: EntryClaim): Graph {
  const p = c.setup?.params ?? {};
  const shape = (p.shape ?? kernel.inputs[0]) as Shape;
  const n = Number(p.n ?? kernel.n?.value);
  return makeGraph(shape, n, c.setup?.seed ?? DEFAULT_SEED, kernel.view?.matrix ? 1 : 16 / 9);
}
