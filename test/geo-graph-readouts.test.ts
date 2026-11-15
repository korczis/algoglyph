// geo-graph's readouts (wave 7b). "Force balance", the virial ratio of the Fruchterman-Reingold
// forces with the map spring (geo-graph.ts): repulsion L^2/d between every pair, attraction d^2/L
// along every edge, and k (a - x) towards each vertex's place a on the map, with
// k = 4 pull n / max(1, sqrt n) / L. At a fixed point sum (x - mean x) . F = 0, which makes
//   (sum over edges d^3 / L - k sum (a - x) . (x - mean x)) / (L^2 n (n - 1) / 2)
// equal to 1. The plate stops short of one, so only the ratio of its final positions is checked,
// recomputed here from the Graph and those positions; no tolerance on its value is claimed.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace } from '../src/engines/graph/trace';
import { kernel } from '../src/kernels/graph/geo-graph';
import { nthNumber } from './support/claims';
import { repeatedLabels, settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const BALANCE = 'Force balance';
const SHAPES = kernel.inputs as Shape[];

function balance(g: Graph, pull: number, x: number[], y: number[]): number {
  const n = g.n;
  const cx = g.x.reduce((s, v) => s + v, 0) / n; const cy = g.y.reduce((s, v) => s + v, 0) / n;
  const span = Math.max(...g.x.map((gx, v) => Math.hypot(gx - cx, g.y[v] - cy)));
  const L = Math.sqrt((Math.PI * span * span) / n);
  const k = (4 * pull * n) / Math.max(1, Math.sqrt(n)) / L;
  const mx = x.reduce((s, v) => s + v, 0) / n; const my = y.reduce((s, v) => s + v, 0) / n;
  let attract = 0; let spring = 0;
  for (let e = 0; e < g.m; e++) attract += Math.hypot(x[g.eu[e]] - x[g.ev[e]], y[g.eu[e]] - y[g.ev[e]]) ** 3 / L;
  for (let v = 0; v < n; v++) spring += k * ((g.x[v] - x[v]) * (x[v] - mx) + (g.y[v] - y[v]) * (y[v] - my));
  return (attract - spring) / ((L * L * n * (n - 1)) / 2);
}

describe('geo-graph: "Force balance", the virial ratio of the final positions', () => {
  for (const shape of SHAPES) for (const seed of [DEFAULT_SEED, 7]) for (const pull of [0, 0.3, 1]) {
    it(`is the ratio recomputed from the run's last positions: ${shape}, seed ${seed}, pull ${pull}`,
      async () => {
        const g = makeGraph(shape, kernel.n!.value, seed, 16 / 9);
        const t = trace(kernel, g, { s: g.s, t: g.t, p: { ...defaultParams(kernel), pull } }, seed);
        const rows = await settledRows('geo-graph', { shape, pull } as never, seed);
        const shown = rows.map((r) => `${r.label}: ${r.value}`).join(' | ');
        expect(repeatedLabels(rows)).toEqual([]);
        // the plate ran the same layout: its own offset row, recomputed here from the positions
        const off = t.result!.x.reduce((s, x, v) => s + Math.hypot(x - g.x[v], t.result!.y[v] - g.y[v]), 0);
        expect(rows.find((r) => r.label === 'Mean distance from the map')?.value, shown)
          .toBe((off / g.n).toPrecision(3));
        const text = rows.find((r) => r.label === BALANCE)?.value;
        expect(text, shown).toBeDefined();
        // shown to four decimals
        expect(Math.abs((nthNumber(text!, 1) as number) - balance(g, pull, t.result!.x, t.result!.y)), text)
          .toBeLessThanOrEqual(5e-5 + 1e-12);
      });
  }
});
