// The graph engine joined its components through two union-finds of its own (wave 7a plan
// decision f): `find` under connect() (geometric, digraph, signed, negative-cycle, flow,
// eulerian, links) and an inline `f` in the communities/islands generator. It joins through the
// shared src/kernels/graph/_uf.ts instead. That module compresses paths fully and lets the larger
// set's root win, where the engine's copies halved paths (or did not compress) and let the second
// argument's root win; every use asks only whether two vertices share a root and scans vertices
// in index order, so no pair, edge order or draw depends on which root wins. Proved in one run
// (rules 9 and 10, never a recorded hash): the engine against connect and the island join as
// they were, copied verbatim below, and every graph plate's input against the same engine on the
// union-find it had, mocked in. test/controls-graph-engine.test.ts still compares the defaults
// against the frozen engine of test/fixtures/graph-engine-before/.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import * as ENGINE from '../src/engines/graph/graph';
import { graphInput } from '../src/engines/graph/index';
import { defaultParams, type GraphKernel } from '../src/engines/graph/trace';

const kernels = import.meta.glob<GraphKernel>('../src/kernels/graph/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => kernels[`../src/kernels/graph/${id}.ts`];
const live = ENTRIES.filter((e) => e.engine === 'graph' && e.status === 'live');
const SEEDS = [1, 7, 4242];
const ENGINE_DIR = resolve('src/engines/graph');

// ---- src/engines/graph/graph.ts at 4565a43, verbatim (the island join lifted out of makeGraph
// into a function of the names it read: x, y, ids, local) ----
const d2 = (x: number[], y: number[], i: number, j: number) => (x[i] - x[j]) ** 2 + (y[i] - y[j]) ** 2;

function find(p: number[], a: number): number {
  while (p[a] !== a) { p[a] = p[p[a]]; a = p[a]; }
  return a;
}

/** Add the shortest pair between components until the pairs connect every point. */
function refConnect(x: number[], y: number[], pairs: [number, number][]): void {
  const n = x.length;
  const p = x.map((_, i) => i);
  for (const [a, b] of pairs) p[find(p, a)] = find(p, b);
  for (;;) {
    const root = find(p, 0);
    let best = Infinity; let bi = -1; let bj = -1;
    for (let i = 0; i < n; i++) {
      if (find(p, i) !== root) continue;
      for (let j = 0; j < n; j++) {
        if (find(p, j) === root) continue;
        const d = d2(x, y, i, j);
        if (d < best) { best = d; bi = i; bj = j; }
      }
    }
    if (bi < 0) return;
    pairs.push([Math.min(bi, bj), Math.max(bi, bj)]);
    p[find(p, bi)] = find(p, bj);
  }
}

function refJoin(x: number[], y: number[], ids: number[], local: [number, number][]): void {
  if (ids.length > 1) {
    const sub = ids.map((i) => i);
    // connect each island inside itself
    const p = new Map(sub.map((i) => [i, i]));
    const f = (a: number): number => { while (p.get(a) !== a) a = p.get(a)!; return a; };
    for (const [a, b] of local) p.set(f(a), f(b));
    for (const i of sub) {
      if (f(i) === f(sub[0])) continue;
      let best = sub[0];
      for (const j of sub) if (f(j) === f(sub[0]) && d2(x, y, i, j) < d2(x, y, i, best)) best = j;
      local.push([Math.min(i, best), Math.max(i, best)]);
      p.set(f(i), f(sub[0]));
    }
  }
}
// ---- end of the verbatim copy ----

/** The union-find the engine had, behind _uf.ts's interface: path halving, and the second
 * argument's root wins (`p[find(p, a)] = find(p, b)`). Counts its use, so the mock is seen to take. */
const used = { made: 0, unions: 0 };
class TodaysUnionFind {
  readonly parent: number[];
  readonly members: number[][] = [];
  constructor(n: number) { this.parent = Array.from({ length: n }, (_, i) => i); used.made++; }
  find(a: number): number { return find(this.parent, a); }
  union(a: number, b: number): [number, number[]] | null {
    used.unions++;
    const ra = this.find(a); const rb = this.find(b);
    if (ra === rb) return null;
    this.parent[ra] = rb;
    return [rb, []];
  }
}

type Make = typeof ENGINE.makeGraph;

/** The engine module again, fresh, joining through TodaysUnionFind. */
async function engineOnTodaysUnionFind(): Promise<Make> {
  vi.resetModules();
  vi.doMock('../src/kernels/graph/_uf', () => ({ UnionFind: TodaysUnionFind }));
  const G = await import('../src/engines/graph/graph');
  vi.doUnmock('../src/kernels/graph/_uf');
  vi.resetModules();
  return G.makeGraph;
}

interface Case {
  shape: ENGINE.Shape; n: number; seed: number; aspect: number; input: ENGINE.GraphInput; at: string;
}

/** Every input a graph plate receives, derived from the catalogue and the kernels: each input
 * shape at n min/default/max and every seed, with the defaults and with each input control at
 * either end of its range; then every shape at the engine's own extremes. */
function cases(): Case[] {
  const out = new Map<string, Case>();
  const add = (c: Case) => out.set(JSON.stringify([c.shape, c.n, c.seed, c.aspect, c.input]), c);
  for (const e of live) {
    const k = kernelOf(e.id);
    const size = k.n ?? { min: 8, max: 240, value: 60 };
    const aspect = k.view?.matrix ? 1 : 16 / 9;
    const inputs: [string, ENGINE.GraphInput][] = [['defaults', graphInput(k, defaultParams(k))]];
    for (const d of k.params ?? []) {
      if (d.kind !== 'range' || !(ENGINE.INPUT_KEYS as readonly string[]).includes(d.key)) continue;
      for (const v of [d.min, d.max]) {
        inputs.push([`${d.key}=${v}`, graphInput(k, { ...defaultParams(k), [d.key]: v })]);
      }
    }
    for (const shape of k.inputs) for (const n of new Set([size.min, size.value, size.max])) {
      for (const seed of SEEDS) for (const [at, input] of inputs) {
        add({ shape, n, seed, aspect, input, at: `${e.id} ${at}` });
      }
    }
  }
  for (const shape of ENGINE.SHAPES) for (const n of [3, 60, 400]) for (const seed of SEEDS) {
    for (const aspect of [16 / 9, 1]) add({ shape, n, seed, aspect, input: {}, at: 'engine' });
  }
  return [...out.values()];
}

const CASES = cases();

/** The k each caller in graph.ts passes to knn before connect() or the island join. Up to
 * SMALL vertices every k is tried on every shape's points (grid ties, circles, clusters, more
 * components at k = 1 up to 100 vertices, none at all at k = 0 up to 60); above it, the
 * callers' own feeds. */
const CONNECT_K: Partial<Record<ENGINE.Shape, number>> = {
  geometric: 3, digraph: 3, signed: 3, 'negative-cycle': 3, flow: 3, links: 3, eulerian: 2,
};
const JOIN_K: Partial<Record<ENGINE.Shape, number>> = { communities: 4, islands: 2 };
const SMALL = 160;

/** Exact equality, field by field (Object.is: -0 is not 0), much cheaper than toEqual on a
 * graph of tens of thousands of edges; toEqual only to print the difference. */
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => same(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a); const kb = Object.keys(b);
    const at = (o: object, k: string) => (o as Record<string, unknown>)[k];
    return ka.length === kb.length && ka.every((k) => same(at(a, k), at(b, k)));
  }
  return Object.is(a, b);
}
function expectSame(a: unknown, b: unknown, at: string): void {
  if (!same(a, b)) expect(a, at).toEqual(b);
  expect(same(a, b), at).toBe(true);
}

const copy = (pairs: [number, number][]) => pairs.map(([a, b]) => [a, b] as [number, number]);

describe('the graph engine joins through src/kernels/graph/_uf.ts', () => {
  it('no file of the graph engine carries a union-find of its own', () => {
    // a root walk (`while (p[a] !== a)`, `while (p.get(a) !== a)`) or a find of its own
    const OWN = [/while\s*\(\s*[\w.]+(\[\s*\w+\s*\]|\.get\(\s*\w+\s*\))\s*!==\s*\w+\s*\)/, /\bfunction\s+find\s*\(/];
    const own = readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.ts'))
      .filter((f) => OWN.some((re) => re.test(readFileSync(join(ENGINE_DIR, f), 'utf8'))));
    expect(own).toEqual([]);
    expect(readFileSync(join(ENGINE_DIR, 'graph.ts'), 'utf8'))
      .toMatch(/import\s*\{[^}]*\bUnionFind\b[^}]*\}\s*from\s*'\.\.\/\.\.\/kernels\/graph\/_uf'/);
  });

  it('connect and the island join give the pairs they gave, on every input a plate is drawn from', () => {
    // the points of every case (scatter, flow's pinned ends, the islands' clusters, the grid,
    // the circle), grouped by truth for the join
    const seen = new Set<string>();
    let connects = 0; let joins = 0;
    for (const c of CASES) {
      const g = ENGINE.makeGraph(c.shape, c.n, c.seed, c.aspect, c.input);
      const key = JSON.stringify([c.shape, g.x, g.y, g.truth]);
      if (seen.has(key)) continue;
      seen.add(key);
      const at = `${c.shape} n=${g.n} seed=${c.seed} aspect=${c.aspect.toFixed(3)}`;
      const small = g.n <= SMALL;
      // k = 0 (no pairs) joins n times and k = 1 about n / 3 times, each a scan of O(n²)
      const ck = small ? [0, 1, 2, 3, 4].filter((k) => k > 1 || g.n <= [60, 100][k]) : [CONNECT_K[c.shape]];
      for (const k of ck) {
        if (k === undefined) continue;
        const pairs = k ? ENGINE.knn(g.x, g.y, k) : [];
        const a = copy(pairs); const b = copy(pairs);
        ENGINE.connect(g.x, g.y, a); refConnect(g.x, g.y, b);
        expectSame(a, b, `connect ${at} k=${k}`);
        connects++;
      }
      const jk = small ? [0, 1, 2, 4] : [JOIN_K[c.shape]];
      for (const cls of new Set(g.truth)) {
        const ids = g.truth.map((t, i) => (t === cls ? i : -1)).filter((i) => i >= 0);
        for (const k of jk) {
          if (k === undefined) continue;
          const local = k ? ENGINE.knn(g.x, g.y, k, ids) : [];
          const a = copy(local); const b = copy(local);
          ENGINE.joinWithin(g.x, g.y, ids, a); refJoin(g.x, g.y, ids, b);
          expectSame(a, b, `join ${at} class=${cls} k=${k}`);
          joins++;
        }
      }
    }
    expect(connects).toBeGreaterThan(0);
    expect(joins).toBeGreaterThan(0);
  });

  it('every graph plate\'s input is the graph the engine drew on its own union-find', async () => {
    const before = await engineOnTodaysUnionFind();
    expect(before).not.toBe(ENGINE.makeGraph);
    used.made = 0; used.unions = 0;
    for (const c of CASES) {
      const after = ENGINE.makeGraph(c.shape, c.n, c.seed, c.aspect, c.input);
      const ref = before(c.shape, c.n, c.seed, c.aspect, c.input);
      // every field: eu, ev, w, cap, cost, vw, x, y, out, in, s, t, truth, names
      expectSame(after, ref, `${c.at}: ${c.shape} n=${c.n} seed=${c.seed} aspect=${c.aspect.toFixed(3)}`);
    }
    // the mock took: the reference engine joined through today's union-find
    expect(used.made, 'the reference engine made its union-finds').toBeGreaterThan(0);
    expect(used.unions, 'the reference engine joined through them').toBeGreaterThan(0);
  });
});
