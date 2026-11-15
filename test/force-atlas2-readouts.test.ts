// force-atlas2's readouts (wave 7b). G4: "Layout energy", at the start and at the end of the run.
// The forces the kernel applies (force-atlas2.ts) are kr m_u m_v / d along u - v for every pair,
// the edge vector itself along every edge, and kg m_u towards the centre, with m = deg + 1. They
// are minus the gradient of
//   E = sum over edges d^2 / 2 - kr sum over pairs m_u m_v ln d + kg sum over vertices m |x|,
// so a step along them goes downhill. Everything here is computed by the test from the Graph's
// edge lists and the positions the run recorded: the energy, its analytic gradient (checked by
// central differences), and the force read back from the run (the direction of every move and
// the swing |F_t - F_{t-1}| the kernel publishes for every vertex).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, OP, trace } from '../src/engines/graph/trace';
import { kernel } from '../src/kernels/graph/force-atlas2';
import { nthNumber } from './support/claims';
import { repeatedLabels, settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ENERGY = 'Layout energy';
const KR = 2;
const SHAPES = kernel.inputs as Shape[];
const SEEDS = [DEFAULT_SEED, 7];

/** m = deg + 1 for every vertex, from the edge list (a loop counts twice, as a degree does). */
function masses(g: Graph): number[] {
  const m = new Array<number>(g.n).fill(1);
  for (let e = 0; e < g.m; e++) { m[g.eu[e]]++; m[g.ev[e]]++; }
  return m;
}

function energy(g: Graph, kg: number, x: number[], y: number[]): number {
  const m = masses(g);
  let e = 0;
  for (let i = 0; i < g.m; i++) {
    const dx = x[g.eu[i]] - x[g.ev[i]]; const dy = y[g.eu[i]] - y[g.ev[i]];
    e += (dx * dx + dy * dy) / 2;
  }
  for (let u = 0; u < g.n; u++) {
    for (let v = u + 1; v < g.n; v++) e -= KR * m[u] * m[v] * Math.log(Math.hypot(x[u] - x[v], y[u] - y[v]));
    e += kg * m[u] * Math.hypot(x[u], y[u]);
  }
  return e;
}

/** -grad E, analytically, with the sum of the terms' magnitudes per vertex (the scale of its
 * rounding error). */
function minusGradient(g: Graph, kg: number, x: number[], y: number[]) {
  const m = masses(g);
  const fx = new Array<number>(g.n).fill(0); const fy = new Array<number>(g.n).fill(0);
  const scale = new Array<number>(g.n).fill(0);
  const add = (v: number, ax: number, ay: number) => { fx[v] += ax; fy[v] += ay; scale[v] += Math.hypot(ax, ay); };
  for (let i = 0; i < g.m; i++) {
    const u = g.eu[i]; const v = g.ev[i];
    add(u, x[v] - x[u], y[v] - y[u]);
    add(v, x[u] - x[v], y[u] - y[v]);
  }
  for (let u = 0; u < g.n; u++) {
    for (let v = 0; v < g.n; v++) {
      if (v === u) continue;
      const dx = x[u] - x[v]; const dy = y[u] - y[v];
      const k = (KR * m[u] * m[v]) / (dx * dx + dy * dy);
      add(u, k * dx, k * dy);
    }
    const r = Math.hypot(x[u], y[u]);
    add(u, (-kg * m[u] * x[u]) / r, (-kg * m[u] * y[u]) / r);
  }
  return { fx, fy, scale };
}

/** The run as the plate runs it at its defaults (the same graph, options and seed), with the
 * positions it recorded: before the first iteration, then after each. */
function run(shape: Shape, seed: number, p: Record<string, number> = {}, n = kernel.n!.value) {
  const g = makeGraph(shape, n, seed, 16 / 9);
  const params = { ...defaultParams(kernel), ...p };
  const t = trace(kernel, g, { s: g.s, t: g.t, p: params }, seed);
  const xs: number[][] = []; const ys: number[][] = []; const swings: number[][] = [];
  let places = 0; let values = 0;
  for (let i = 0; i < t.length; i++) {
    const o = 5 * i;
    const op = t.events[o]; const v = t.events[o + 1];
    if (op === OP.place) {
      const k = Math.floor(places++ / g.n);
      (xs[k] ??= [])[v] = t.events[o + 3]; (ys[k] ??= [])[v] = t.events[o + 4];
    } else if (op === OP.value) {
      (swings[Math.floor(values++ / g.n)] ??= [])[v] = t.events[o + 3];
    }
  }
  return { g, kg: Number(params.gravity), iterations: Number(params.iterations), xs, ys, swings, r: t.result! };
}

const value = (rows: { label: string; value: string }[], label: string) =>
  rows.find((r) => r.label === label)?.value;

describe('force-atlas2: "Layout energy" at the start and the end of the run (G4)', () => {
  for (const shape of SHAPES) for (const seed of SEEDS) {
    it(`is the energy of the run's first and last positions: ${shape}, seed ${seed}`, async () => {
      const { g, kg, iterations, xs, ys, r } = run(shape, seed);
      expect(xs.length).toBe(iterations + 1);
      expect(xs[iterations]).toEqual(r.x);
      const rows = await settledRows('force-atlas2', { shape } as never, seed);
      const shown = rows.map((s) => `${s.label}: ${s.value}`).join(' | ');
      expect(repeatedLabels(rows)).toEqual([]);
      // the plate ran the same layout: its own distance row, recomputed here from the positions
      let edge = 0; let all = 0; let pairs = 0;
      for (let e = 0; e < g.m; e++) edge += Math.hypot(r.x[g.eu[e]] - r.x[g.ev[e]], r.y[g.eu[e]] - r.y[g.ev[e]]);
      for (let u = 0; u < g.n; u++) for (let v = u + 1; v < g.n; v++) { all += Math.hypot(r.x[u] - r.x[v], r.y[u] - r.y[v]); pairs++; }
      expect(value(rows, 'Edge length / mean distance'), shown).toBe((edge / g.m / (all / pairs)).toFixed(3));
      const text = value(rows, ENERGY);
      expect(text, shown).toBeDefined();
      const start = energy(g, kg, xs[0], ys[0]);
      const end = energy(g, kg, r.x, r.y);
      // shown to six significant digits at least
      expect(Math.abs((nthNumber(text!, 1) as number) - start), text).toBeLessThanOrEqual(5e-6 * Math.abs(start));
      expect(Math.abs((nthNumber(text!, 2) as number) - end), text).toBeLessThanOrEqual(5e-6 * Math.abs(end));
      // G4 test 3: the run goes downhill on every default input at both seeds
      expect(end).toBeLessThan(start);
      expect(nthNumber(text!, 2) as number, text).toBeLessThan(nthNumber(text!, 1) as number);
    });
  }

  it('has the analytic gradient written here, by central differences', () => {
    for (const [shape, seed, n] of [['communities', DEFAULT_SEED, 70], ['grid', 7, 12], ['random', 7, 6]] as const) {
      const { g, kg, xs, ys } = run(shape, seed, {}, n);
      for (const k of [0, 3, xs.length - 1]) {
        const x = xs[k].slice(); const y = ys[k].slice();
        const { fx, fy, scale } = minusGradient(g, kg, x, y);
        for (let v = 0; v < g.n; v++) {
          for (const [c, f] of [[x, fx], [y, fy]] as const) {
            const h = 1e-5 * Math.max(1, Math.abs(c[v]));
            const keep = c[v];
            c[v] = keep + h; const up = energy(g, kg, x, y);
            c[v] = keep - h; const down = energy(g, kg, x, y);
            c[v] = keep;
            expect(Math.abs(-(up - down) / (2 * h) - f[v]), `${shape} vertex ${v}`).toBeLessThanOrEqual(1e-5 * scale[v] + 1e-6);
          }
        }
      }
    }
  });

  it('applies -grad E: every move is along it and every swing is its change', () => {
    for (const [shape, seed, p, n] of [
      ['communities', DEFAULT_SEED, {}, 70], ['small-world', 7, {}, 70],
      ['geometric', DEFAULT_SEED, { gravity: 5, iterations: 60 }, 40], ['random', 7, { gravity: 0.1 }, 8],
    ] as const) {
      const { g, kg, iterations, xs, ys, swings } = run(shape, seed, p, n);
      let px = new Array<number>(g.n).fill(0); let py = new Array<number>(g.n).fill(0); let ps = px.slice();
      let moves = 0;
      for (let it = 0; it < iterations; it++) {
        const { fx, fy, scale } = minusGradient(g, kg, xs[it], ys[it]);
        for (let v = 0; v < g.n; v++) {
          const tol = 1e-10 * (scale[v] + ps[v]);
          expect(Math.abs(swings[it][v] - Math.hypot(fx[v] - px[v], fy[v] - py[v])), `${shape} it ${it} v ${v}`)
            .toBeLessThanOrEqual(tol + 1e-12);
          const dx = xs[it + 1][v] - xs[it][v]; const dy = ys[it + 1][v] - ys[it][v];
          const f = Math.hypot(fx[v], fy[v]); const d = Math.hypot(dx, dy);
          // the recorded move is k F for some k > 0, up to the rounding of the two positions
          const slack = 4e-16 * (Math.hypot(xs[it][v], ys[it][v]) + Math.hypot(xs[it + 1][v], ys[it + 1][v]));
          expect(Math.abs(fx[v] * dy - fy[v] * dx), `${shape} it ${it} v ${v}`)
            .toBeLessThanOrEqual(2 * f * slack + d * 1e-10 * scale[v]);
          expect(fx[v] * dx + fy[v] * dy).toBeGreaterThanOrEqual(-2 * f * slack);
          if (d > 0) moves++;
        }
        px = fx; py = fy; ps = scale;
      }
      expect(moves).toBeGreaterThan(0);
    }
  });
});
