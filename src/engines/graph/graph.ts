// The graph engine's input: one graph type and a seeded generator for every input shape a
// kernel may declare. Pure: the same shape, size, seed and aspect give the same graph.
import { gaussian, mulberry32 } from '../../core/random';

export interface Graph {
  shape: Shape;
  n: number;
  m: number;
  directed: boolean;
  /** Where the input is drawn, in [0, aspect] x [0, 1]. Layout kernels move vertices. */
  x: number[];
  y: number[];
  /** Edge e runs from eu[e] to ev[e] (either way when undirected). */
  eu: number[];
  ev: number[];
  /** Edge weight: a length, a cost, a share, a similarity, depending on the shape. */
  w: number[];
  /** Capacity (flow networks; 1 elsewhere) and cost per unit of flow. */
  cap: number[];
  cost: number[];
  /** A vertex weight: a task's duration (1..9, or 1..maxDuration when the kernel sets it). */
  vw: number[];
  /** Edges leaving v, and edges entering v; for an undirected graph both are the incident edges. */
  out: number[][];
  in: number[][];
  /** The suggested source and target (sink, conclusion, ego, target company). */
  s: number;
  t: number;
  /** A known class per vertex where the shape has one: cluster, island, side, entity, kind. */
  truth: number[];
  /** Record names, for the entity-resolution shape. */
  names: string[];
}

export const SHAPES = [
  'geometric', 'grid', 'random', 'small-world', 'communities', 'islands', 'bipartite', 'digraph',
  'dag', 'signed-dag', 'signed', 'negative-cycle', 'flow', 'ownership', 'eulerian', 'points',
  'reasoning', 'records', 'links',
] as const;
export type Shape = (typeof SHAPES)[number];

export const SHAPE_LABELS: Record<Shape, string> = {
  geometric: 'Geometric (nearest neighbours)',
  grid: 'Grid, random weights',
  random: 'Random sparse (Erdős–Rényi)',
  'small-world': 'Small world (Watts–Strogatz)',
  communities: 'Three communities',
  islands: 'Separate islands',
  bipartite: 'Bipartite',
  digraph: 'Directed, with cycles',
  dag: 'Layered DAG',
  'signed-dag': 'Layered DAG, some negative weights',
  signed: 'Directed, negative weights, no negative cycle',
  'negative-cycle': 'Directed, with a negative cycle',
  flow: 'Flow network',
  ownership: 'Ownership with cross-holdings',
  eulerian: 'Every degree even',
  points: 'Points in the plane (every pair an edge)',
  reasoning: 'Evidence and claims',
  records: 'Noisy duplicate records',
  links: 'Links with confidences',
};

/** Shapes whose edges are directed. */
export const DIRECTED: ReadonlySet<Shape> = new Set<Shape>(['digraph', 'dag', 'signed-dag', 'signed',
  'negative-cycle', 'flow', 'ownership', 'reasoning']);

export function other(g: Graph, e: number, v: number): number {
  return g.eu[e] === v ? g.ev[e] : g.eu[e];
}

type Edge = [number, number, number];

/** The longest task duration a vertex weight may have, unless the kernel's own control sets it. */
export const MAX_DURATION = 9;

/** What a kernel's own controls set in its input (index.ts graphInput); absent, the default. */
export interface GraphInput {
  /** Vertex weights are 1 + ⌊u · maxDuration⌋, the same draw in the same place at every value. */
  maxDuration?: number;
}

/** The keys of GraphInput: a kernel param with one of these keys sets the input, not the run. */
export const INPUT_KEYS: readonly (keyof GraphInput)[] = ['maxDuration'];

interface Extra { s?: number; t?: number; truth?: number[]; names?: string[]; cap?: number[];
  cost?: number[]; vw?: number[] }

export function build(shape: Shape, x: number[], y: number[], edges: Edge[], directed: boolean,
  extra: Extra = {}, rnd: () => number = () => 0.5, longest = MAX_DURATION): Graph {
  const n = x.length;
  const m = edges.length;
  const out: number[][] = Array.from({ length: n }, () => []);
  const inc: number[][] = directed ? Array.from({ length: n }, () => []) : out;
  edges.forEach(([u, v], e) => {
    out[u].push(e);
    if (directed) inc[v].push(e);
    else if (u !== v) out[v].push(e);
  });
  return {
    shape, n, m, directed, x, y,
    eu: edges.map((e) => e[0]), ev: edges.map((e) => e[1]), w: edges.map((e) => e[2]),
    cap: extra.cap ?? edges.map(() => 1),
    cost: extra.cost ?? edges.map(() => 1),
    vw: extra.vw ?? x.map(() => 1 + Math.floor(rnd() * longest)),
    out, in: inc,
    s: extra.s ?? 0, t: extra.t ?? Math.max(0, n - 1),
    truth: extra.truth ?? x.map(() => 0),
    names: extra.names ?? [],
  };
}

const M = 0.05;

/** n points spread by dart throwing over [M, aspect - M] x [M, 1 - M]. */
function scatter(n: number, aspect: number, rnd: () => number): { x: number[]; y: number[] } {
  const x: number[] = []; const y: number[] = [];
  const area = (aspect - 2 * M) * (1 - 2 * M);
  const r2 = (0.55 * Math.sqrt(area / Math.max(1, n))) ** 2;
  for (let i = 0; i < n; i++) {
    let px = 0; let py = 0;
    for (let tries = 0; tries < 30; tries++) {
      px = M + rnd() * (aspect - 2 * M);
      py = M + rnd() * (1 - 2 * M);
      let ok = true;
      for (let j = 0; j < x.length && ok; j++) ok = (x[j] - px) ** 2 + (y[j] - py) ** 2 >= r2;
      if (ok) break;
    }
    x.push(px); y.push(py);
  }
  return { x, y };
}

const d2 = (x: number[], y: number[], i: number, j: number) => (x[i] - x[j]) ** 2 + (y[i] - y[j]) ** 2;

/** Undirected pairs i < j joining each point to its k nearest (ties by index). */
function knn(x: number[], y: number[], k: number, among?: number[]): [number, number][] {
  const ids = among ?? x.map((_, i) => i);
  const seen = new Set<number>();
  const pairs: [number, number][] = [];
  const n = x.length;
  const best: number[] = []; const bestD: number[] = [];
  for (const i of ids) {
    // the k nearest by one pass with a short sorted list, O(n k) per point
    best.length = 0; bestD.length = 0;
    for (const j of ids) {
      if (j === i) continue;
      const d = d2(x, y, i, j);
      if (best.length === k && d >= bestD[k - 1]) continue;
      let at = best.length;
      while (at > 0 && bestD[at - 1] > d) at--;
      best.splice(at, 0, j); bestD.splice(at, 0, d);
      if (best.length > k) { best.pop(); bestD.pop(); }
    }
    for (const j of best) {
      const key = Math.min(i, j) * n + Math.max(i, j);
      if (!seen.has(key)) { seen.add(key); pairs.push([Math.min(i, j), Math.max(i, j)]); }
    }
  }
  return pairs;
}

function find(p: number[], a: number): number {
  while (p[a] !== a) { p[a] = p[p[a]]; a = p[a]; }
  return a;
}

/** Add the shortest pair between components until the pairs connect every point. */
function connect(x: number[], y: number[], pairs: [number, number][]): void {
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

/** A length as an integer weight: about 100 for the typical spacing of n points. */
function lengthOf(x: number[], y: number[], i: number, j: number, aspect: number): number {
  const spacing = Math.sqrt(aspect / Math.max(1, x.length));
  return Math.max(1, Math.round((100 * Math.sqrt(d2(x, y, i, j))) / spacing));
}

function circle(n: number, aspect: number): { x: number[]; y: number[] } {
  const rx = aspect / 2 - M; const ry = 0.5 - M;
  const x: number[] = []; const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    x.push(aspect / 2 + rx * Math.cos(a));
    y.push(0.5 + ry * Math.sin(a));
  }
  return { x, y };
}

const int = (rnd: () => number, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

function leftmost(x: number[]): number {
  let b = 0;
  for (let i = 1; i < x.length; i++) if (x[i] < x[b]) b = i;
  return b;
}

function farthest(x: number[], y: number[], from: number): number {
  let b = from;
  for (let i = 0; i < x.length; i++) if (d2(x, y, from, i) > d2(x, y, from, b)) b = i;
  return b;
}

/** Layers of a layered DAG: vertex ids per layer, left to right. */
function layered(n: number, aspect: number, rnd: () => number, layerCount?: number) {
  const L = Math.max(2, layerCount ?? Math.round(Math.sqrt(n * 0.8)));
  const layers: number[][] = Array.from({ length: L }, () => []);
  layers[0].push(0);
  if (n > 2) layers[0].push(1);
  layers[L - 1].push(n - 1);
  for (let v = layers[0].length; v < n - 1; v++) layers[1 + Math.floor(rnd() * Math.max(1, L - 2))].push(v);
  const used = layers.filter((l) => l.length);
  const x = new Array<number>(n).fill(0); const y = new Array<number>(n).fill(0);
  const layer = new Array<number>(n).fill(0);
  used.forEach((ids, li) => {
    ids.forEach((v, k) => {
      layer[v] = li;
      x[v] = M + ((aspect - 2 * M) * li) / Math.max(1, used.length - 1);
      y[v] = M + ((1 - 2 * M) * (k + 0.5)) / ids.length + (rnd() - 0.5) * 0.02;
    });
  });
  return { layers: used, x, y, layer };
}

/** Edges of a layered DAG: forward only, every vertex past the first layer with a predecessor. */
function dagEdges(layers: number[][], rnd: () => number): [number, number][] {
  const pairs: [number, number][] = [];
  const seen = new Set<string>();
  const add = (u: number, v: number) => {
    const k = `${u},${v}`;
    if (!seen.has(k)) { seen.add(k); pairs.push([u, v]); }
  };
  for (let li = 1; li < layers.length; li++) {
    for (const v of layers[li]) {
      const prev = layers[li - 1];
      add(prev[Math.floor(rnd() * prev.length)], v);
      if (rnd() < 0.5) add(prev[Math.floor(rnd() * prev.length)], v);
      if (li >= 2 && rnd() < 0.3) {
        const far = layers[Math.floor(rnd() * (li - 1))];
        add(far[Math.floor(rnd() * far.length)], v);
      }
    }
  }
  // the first source reaches the whole second layer, so a run from it reaches most of the graph
  if (layers.length > 1) for (const v of layers[1]) add(layers[0][0], v);
  return pairs;
}

const SYLLABLES = ['ka', 'lo', 'mir', 'ten', 'sa', 'vo', 'ri', 'den', 'ba', 'tor', 'nel', 'qui',
  'pra', 'ho', 'zen', 'lu', 'gar', 'fe', 'mon', 'dra'];

function noisy(name: string, rnd: () => number): string {
  const c = name.split('');
  const r = rnd();
  const i = Math.floor(rnd() * c.length);
  if (r < 0.3 && c.length > 4) c.splice(i, 1);
  else if (r < 0.55) c[i] = 'aeiourstn'[Math.floor(rnd() * 9)];
  else if (r < 0.75 && i + 1 < c.length) { const t = c[i]; c[i] = c[i + 1]; c[i + 1] = t; } else if (r < 0.9) c.push(' ', ...'co');
  return c.join('');
}

/** The character trigrams of a name, padded with spaces. */
function trigrams(s: string): Set<string> {
  const p = `  ${s.toLowerCase()} `;
  const g = new Set<string>();
  for (let i = 0; i + 3 <= p.length; i++) g.add(p.slice(i, i + 3));
  return g;
}

function jaccard(A: Set<string>, B: Set<string>): number {
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter || 1);
}

/** Jaccard similarity of the character trigrams of two names (padded with spaces). */
export function trigramJaccard(a: string, b: string): number {
  return jaccard(trigrams(a), trigrams(b));
}

/** A seeded graph of the given shape with about n vertices. */
export function makeGraph(shape: Shape, n: number, seed: number, aspect = 16 / 9,
  input: GraphInput = {}): Graph {
  const rnd = mulberry32(seed);
  const longest = input.maxDuration ?? MAX_DURATION;
  n = Math.max(2, Math.floor(n));
  switch (shape) {
    case 'geometric': case 'digraph': case 'signed': case 'negative-cycle': {
      const { x, y } = scatter(n, aspect, rnd);
      const pairs = knn(x, y, 3);
      connect(x, y, pairs);
      const s = leftmost(x);
      if (shape === 'geometric') {
        return build(shape, x, y, pairs.map(([i, j]) => [i, j, lengthOf(x, y, i, j, aspect)]), false, { s, t: farthest(x, y, s) }, rnd, longest);
      }
      const edges: Edge[] = [];
      for (const [i, j] of pairs) {
        const [u, v] = rnd() < 0.5 ? [i, j] : [j, i];
        const len = lengthOf(x, y, u, v, aspect);
        edges.push([u, v, len]);
        if (rnd() < 0.35) edges.push([v, u, len]);
      }
      if (shape !== 'digraph') {
        // potentials keep every cycle's weight as it was (positive) while some edges go negative
        const pot = x.map(() => int(rnd, 0, 90));
        for (const e of edges) e[2] = e[2] + pot[e[0]] - pot[e[1]];
      }
      if (shape === 'negative-cycle') {
        // plant a three-cycle reachable from s whose weights sum below zero
        const reach = reachable(n, edges, s);
        const cand = reach.filter((v) => v !== s);
        const a = cand.length ? cand[Math.floor(rnd() * cand.length)] : s;
        const near = x.map((_, i) => i).filter((i) => i !== a).sort((p, q) => d2(x, y, a, p) - d2(x, y, a, q));
        const [b, c] = [near[0], near[1]];
        for (const [u, v] of [[a, b], [b, c], [c, a]] as [number, number][]) {
          const old = edges.find((e) => e[0] === u && e[1] === v);
          if (old) old[2] = -40; else edges.push([u, v, -40]);
        }
      }
      return build(shape, x, y, edges, true, { s, t: farthest(x, y, s) }, rnd, longest);
    }
    case 'grid': {
      const cols = Math.max(2, Math.round(Math.sqrt(n * aspect)));
      const rows = Math.max(2, Math.round(n / cols));
      const x: number[] = []; const y: number[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          x.push(M + ((aspect - 2 * M) * c) / (cols - 1));
          y.push(M + ((1 - 2 * M) * r) / (rows - 1));
        }
      }
      const edges: Edge[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = r * cols + c;
          if (c + 1 < cols) edges.push([v, v + 1, int(rnd, 1, 9)]);
          if (r + 1 < rows) edges.push([v, v + cols, int(rnd, 1, 9)]);
        }
      }
      return build(shape, x, y, edges, false, { s: 0, t: rows * cols - 1 }, rnd, longest);
    }
    case 'random': case 'small-world': {
      const { x, y } = circle(n, aspect);
      const seen = new Set<number>();
      const edges: Edge[] = [];
      const add = (u: number, v: number) => {
        if (u === v) return false;
        const k = Math.min(u, v) * n + Math.max(u, v);
        if (seen.has(k)) return false;
        seen.add(k);
        edges.push([Math.min(u, v), Math.max(u, v), shape === 'random' ? int(rnd, 1, 99) : int(rnd, 1, 9)]);
        return true;
      };
      if (shape === 'random') {
        const want = Math.min((n * (n - 1)) / 2, Math.round(1.2 * n));
        while (edges.length < want) add(Math.floor(rnd() * n), Math.floor(rnd() * n));
      } else {
        for (let v = 0; v < n; v++) {
          for (const d of [1, 2]) {
            let u = (v + d) % n;
            if (rnd() < 0.12) u = Math.floor(rnd() * n);
            if (!add(v, u)) add(v, (v + d) % n);
          }
        }
      }
      return build(shape, x, y, edges, false, { s: 0, t: Math.floor(n / 2) }, rnd, longest);
    }
    case 'communities': case 'islands': {
      const c = shape === 'communities' ? 3 : Math.min(n, 3 + Math.floor(rnd() * 3));
      const cx: number[] = []; const cy: number[] = [];
      for (let k = 0; k < c; k++) {
        const a = (2 * Math.PI * k) / c + 0.4;
        cx.push(aspect / 2 + (aspect / 2 - 0.25) * Math.cos(a));
        cy.push(0.5 + 0.28 * Math.sin(a));
      }
      const truth = Array.from({ length: n }, (_, i) => i % c);
      const sd = shape === 'communities' ? 0.09 : 0.07;
      const x = truth.map((k) => Math.min(aspect - M, Math.max(M, cx[k] + sd * gaussian(rnd))));
      const y = truth.map((k) => Math.min(1 - M, Math.max(M, cy[k] + sd * gaussian(rnd))));
      const pairs: [number, number][] = [];
      for (let k = 0; k < c; k++) {
        const ids = truth.map((t, i) => (t === k ? i : -1)).filter((i) => i >= 0);
        const local = knn(x, y, shape === 'communities' ? 4 : 2, ids);
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
        pairs.push(...local);
      }
      const seen = new Set(pairs.map(([a, b]) => a * n + b));
      if (shape === 'communities') {
        for (let tries = 0; tries < 4 * c; tries++) {
          const a = Math.floor(rnd() * n); const b = Math.floor(rnd() * n);
          if (truth[a] === truth[b]) continue;
          const key = Math.min(a, b) * n + Math.max(a, b);
          if (!seen.has(key)) { seen.add(key); pairs.push([Math.min(a, b), Math.max(a, b)]); }
          if (pairs.filter(([p, q]) => truth[p] !== truth[q]).length >= c + 1) break;
        }
      }
      const s = 0;
      return build(shape, x, y, pairs.map(([a, b]) => [a, b, shape === 'communities' ? 1 : lengthOf(x, y, a, b, aspect)]), false,
        { s, t: farthest(x, y, s), truth }, rnd, longest);
    }
    case 'bipartite': {
      const L = Math.ceil(n / 2); const R = n - L;
      const x: number[] = []; const y: number[] = []; const truth: number[] = [];
      for (let i = 0; i < n; i++) {
        const left = i < L;
        const k = left ? i : i - L;
        const cnt = left ? L : R;
        x.push(left ? aspect * 0.3 : aspect * 0.7);
        y.push(M + ((1 - 2 * M) * (k + 0.5)) / cnt);
        truth.push(left ? 0 : 1);
      }
      const seen = new Set<number>();
      const edges: Edge[] = [];
      for (let i = 0; i < L; i++) {
        const deg = int(rnd, 1, 3);
        const centre = Math.round((i * R) / L);
        for (let d = 0; d < deg && R > 0; d++) {
          const j = Math.min(R - 1, Math.max(0, centre + int(rnd, -3, 3)));
          if (seen.has(i * n + j)) continue;
          seen.add(i * n + j);
          edges.push([i, L + j, 1]);
        }
      }
      return build(shape, x, y, edges, false, { s: 0, t: n - 1, truth }, rnd, longest);
    }
    case 'dag': case 'signed-dag': {
      const { layers, x, y } = layered(n, aspect, rnd);
      const pairs = dagEdges(layers, rnd);
      const edges: Edge[] = pairs.map(([u, v]) => [u, v, shape === 'dag' ? int(rnd, 1, 20) : int(rnd, -8, 12)]);
      return build(shape, x, y, edges, true, { s: 0, t: n - 1 }, rnd, longest);
    }
    case 'flow': {
      const { x, y } = scatter(n, aspect, rnd);
      x[0] = M; y[0] = 0.5; x[n - 1] = aspect - M; y[n - 1] = 0.5;
      const pairs = knn(x, y, 3);
      connect(x, y, pairs);
      const edges: Edge[] = []; const cost: number[] = [];
      for (const [i, j] of pairs) {
        const [u, v] = x[i] <= x[j] ? [i, j] : [j, i];
        if (v === 0 || u === n - 1) { edges.push([v, u, int(rnd, 1, 12)]); cost.push(int(rnd, 1, 9)); continue; }
        edges.push([u, v, int(rnd, 1, 12)]); cost.push(int(rnd, 1, 9));
        if (rnd() < 0.25 && u !== 0 && v !== n - 1) { edges.push([v, u, int(rnd, 1, 12)]); cost.push(int(rnd, 1, 9)); }
      }
      return build(shape, x, y, edges, true, { s: 0, t: n - 1, cap: edges.map((e) => e[2]), cost }, rnd, longest);
    }
    case 'ownership': {
      const { layers, x, y, layer } = layered(n, aspect, rnd, Math.max(3, Math.round(Math.sqrt(n) * 0.7)));
      // owners on the left, the companies they hold to the right
      const pairs = dagEdges(layers, rnd);
      // cross-holdings: a company holds a stake in one of its own (indirect) owners, which
      // closes an ownership cycle
      const preds: number[][] = Array.from({ length: n }, () => []);
      for (const [u, v] of pairs) preds[v].push(u);
      const back = Math.max(1, Math.round(n / 12));
      const seen = new Set(pairs.map(([u, v]) => `${u},${v}`));
      for (let k = 0, tries = 0; k < back && tries < 50 * back; tries++) {
        const u = Math.floor(rnd() * n);
        if (layer[u] < 2) continue;
        let v = u;
        for (let step = int(rnd, 1, 3); step > 0; step--) {
          const p = preds[v].filter((q) => layer[q] > 0);
          if (!p.length) break;
          v = p[Math.floor(rnd() * p.length)];
        }
        if (v === u || seen.has(`${u},${v}`)) continue;
        seen.add(`${u},${v}`); pairs.push([u, v]); k++;
      }
      // each company's holders share at most 95 % of it; the rest is free float
      const w = pairs.map(() => 0.2 + rnd());
      const into = new Array<number>(n).fill(0);
      pairs.forEach(([, v], e) => { into[v] += w[e]; });
      const float = x.map(() => 0.5 + rnd() * 0.45);
      const edges: Edge[] = pairs.map(([u, v], e) => [u, v, Math.round((1000 * w[e] * float[v]) / into[v]) / 1000]);
      return build(shape, x, y, edges, true, { s: 0, t: n - 1 }, rnd, longest);
    }
    case 'eulerian': {
      const { x, y } = scatter(n, aspect, rnd);
      const pairs = knn(x, y, 2);
      connect(x, y, pairs);
      const has = new Set(pairs.map(([a, b]) => a * 100000 + b));
      const deg = new Array<number>(x.length).fill(0);
      for (const [a, b] of pairs) { deg[a]++; deg[b]++; }
      const odd = deg.map((d, i) => (d % 2 ? i : -1)).filter((i) => i >= 0);
      // pair the odd vertices by proximity; an adjacent pair is joined through a new vertex
      while (odd.length) {
        const a = odd.shift()!;
        let bi = 0;
        for (let k = 1; k < odd.length; k++) if (d2(x, y, a, odd[k]) < d2(x, y, a, odd[bi])) bi = k;
        const b = odd.splice(bi, 1)[0];
        const key = Math.min(a, b) * 100000 + Math.max(a, b);
        if (!has.has(key)) { has.add(key); pairs.push([Math.min(a, b), Math.max(a, b)]); } else {
          const mid = x.length;
          const dx = x[b] - x[a]; const dy = y[b] - y[a];
          x.push((x[a] + x[b]) / 2 - dy * 0.3); y.push((y[a] + y[b]) / 2 + dx * 0.3);
          pairs.push([a, mid], [b, mid]);
        }
      }
      return build(shape, x, y, pairs.map(([a, b]) => [a, b, lengthOf(x, y, a, b, aspect)]), false, { s: 0 }, rnd, longest);
    }
    case 'points': {
      const { x, y } = scatter(n, aspect, rnd);
      const edges: Edge[] = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push([i, j, lengthOf(x, y, i, j, aspect)]);
      return build(shape, x, y, edges, false, {}, rnd, longest);
    }
    case 'links': {
      const { x, y } = scatter(n, aspect, rnd);
      const pairs = knn(x, y, 3);
      connect(x, y, pairs);
      const s = leftmost(x);
      return build(shape, x, y, pairs.map(([i, j]) => [i, j, Math.round(30 + rnd() * 69) / 100]), false,
        { s, t: farthest(x, y, s) }, rnd, longest);
    }
    case 'reasoning': {
      // evidence at the bottom, claims above it, one conclusion on top; edges point upwards
      const E = Math.max(1, Math.round(n * 0.45));
      const C = Math.max(1, n - E - 1);
      const tiers = [E, Math.ceil(C * 0.6), C - Math.ceil(C * 0.6), 1].filter((k) => k > 0);
      const ids: number[][] = []; let next = 0;
      const x: number[] = []; const y: number[] = []; const truth: number[] = [];
      tiers.forEach((k, ti) => {
        const row: number[] = [];
        for (let i = 0; i < k; i++) {
          row.push(next++);
          x.push(M + ((aspect - 2 * M) * (i + 0.5)) / k + (rnd() - 0.5) * 0.03);
          y.push(1 - M - ((1 - 2 * M) * ti) / (tiers.length - 1));
          truth.push(ti === 0 ? 0 : ti === tiers.length - 1 ? 2 : 1);
        }
        ids.push(row);
      });
      const seen = new Set<string>();
      const edges: Edge[] = [];
      const add = (u: number, v: number) => {
        if (seen.has(`${u},${v}`)) return;
        seen.add(`${u},${v}`); edges.push([u, v, 1]);
      };
      for (let ti = 1; ti < ids.length; ti++) {
        const below = ids[ti - 1];
        ids[ti].forEach((v, i) => {
          const centre = Math.round(((i + 0.5) * below.length) / ids[ti].length - 0.5);
          const k = ti === ids.length - 1 ? Math.max(1, Math.round(below.length * 0.7)) : int(rnd, 1, 3);
          for (let d = 0; d < k; d++) {
            const j = ti === ids.length - 1 ? Math.floor(rnd() * below.length)
              : Math.min(below.length - 1, Math.max(0, centre + int(rnd, -2, 2)));
            add(below[j], v);
          }
        });
      }
      return build(shape, x, y, edges, true, { s: 0, t: next - 1, truth }, rnd, longest);
    }
    case 'records': {
      const k = Math.max(1, Math.round(n / 3));
      const base: string[] = [];
      for (let i = 0; i < k; i++) {
        let s = '';
        const len = int(rnd, 2, 3);
        for (let j = 0; j < len; j++) s += SYLLABLES[Math.floor(rnd() * SYLLABLES.length)];
        base.push(s);
      }
      const names: string[] = []; const truth: number[] = [];
      for (let i = 0; i < n; i++) {
        const ent = i < k ? i : Math.floor(rnd() * k);
        truth.push(ent);
        names.push(i < k ? base[ent] : noisy(base[ent], rnd));
      }
      const cols = Math.max(1, Math.round(Math.sqrt(k * aspect)));
      const rows = Math.ceil(k / cols);
      const x = truth.map((ent) => M + ((aspect - 2 * M) * ((ent % cols) + 0.5)) / cols + (rnd() - 0.5) * (0.5 * aspect) / cols);
      const y = truth.map((ent) => M + ((1 - 2 * M) * (Math.floor(ent / cols) + 0.5)) / rows + (rnd() - 0.5) * 0.5 / rows);
      const edges: Edge[] = [];
      const grams = names.map(trigrams);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const sim = jaccard(grams[i], grams[j]);
          if (sim >= 0.2) edges.push([i, j, Math.round(sim * 100) / 100]);
        }
      }
      return build(shape, x, y, edges, false, { truth, names }, rnd, longest);
    }
  }
}

function reachable(n: number, edges: Edge[], s: number): number[] {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) adj[u].push(v);
  const seen = new Array<boolean>(n).fill(false);
  const stack = [s]; seen[s] = true;
  const out: number[] = [];
  while (stack.length) {
    const u = stack.pop()!;
    out.push(u);
    for (const v of adj[u]) if (!seen[v]) { seen[v] = true; stack.push(v); }
  }
  return out;
}
