import { other } from '../../engines/graph/graph';
import type { GraphKernel, GraphOps } from '../../engines/graph/trace';

export interface CommunitiesResult { comm: number[]; levels: number }

/** A level of the multilevel graph: a symmetric weighted adjacency with self-weights. */
interface Level {
  n: number;
  adj: Map<number, number>[];
  /** Twice the weight of the edges inside the node (an original vertex has none). */
  self: number[];
  /** Weighted degree: the sum of the members' original degrees. */
  k: number[];
  members: number[][];
}

function shuffled(n: number, rnd: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Label every original vertex with the community of the level node it belongs to. */
function paint(ops: GraphOps, L: Level, a: number, c: number, label: number[]): void {
  for (const v of L.members[a]) if (label[v] !== c) { label[v] = c; ops.group(v, c); }
}

/**
 * Local moving: nodes, in random order, move to the neighbouring community with the largest
 * modularity gain k_{a,C} - tot_C k_a / 2m (their own community after removal included; ties
 * keep it), sweeping until a sweep moves nothing. Returns whether anything moved.
 */
function* moveNodes(ops: GraphOps, L: Level, comm: number[], m2: number, label: number[],
  level0: boolean): Generator<void, boolean, void> {
  const g = ops.g;
  const tot = new Array<number>(L.n).fill(0);
  for (let a = 0; a < L.n; a++) tot[comm[a]] += L.k[a];
  let movedAny = false;
  for (let sweep = 0; sweep < 100; sweep++) {
    let moved = 0;
    for (const a of shuffled(L.n, ops.rnd)) {
      const own = comm[a];
      tot[own] -= L.k[a];
      const links = new Map<number, number>();
      if (level0) {
        // on the original graph, count the edges examined one by one
        for (const e of g.out[a]) {
          ops.scan(e);
          const b = other(g, e, a);
          if (b !== a) links.set(comm[b], (links.get(comm[b]) ?? 0) + 1);
        }
      } else {
        for (const [b, w] of L.adj[a]) links.set(comm[b], (links.get(comm[b]) ?? 0) + w);
      }
      const gain = (c: number) => (links.get(c) ?? 0) - (tot[c] * L.k[a]) / m2;
      let best = own; let bestGain = gain(own);
      for (const c of links.keys()) {
        const x = gain(c);
        if (x > bestGain + 1e-12 || (Math.abs(x - bestGain) <= 1e-12 && c < best && best !== own)) { best = c; bestGain = x; }
      }
      tot[best] += L.k[a];
      if (best !== own) {
        comm[a] = best;
        moved++;
        paint(ops, L, a, best, label);
      }
    }
    ops.round();
    yield;
    if (!moved) break;
    movedAny = true;
  }
  return movedAny;
}

/**
 * Leiden's refinement, greedy (randomness parameter taken to zero): inside each community S,
 * every node still alone that is well connected to S joins the well-connected refined
 * subcommunity of S with the largest non-negative gain. Returns the refined partition.
 */
function refine(L: Level, comm: number[], m2: number, rnd: () => number): number[] {
  const ref = Array.from({ length: L.n }, (_, a) => a);
  const totRef = L.k.slice();
  const size = new Array<number>(L.n).fill(1);
  const totS = new Map<number, number>();
  for (let a = 0; a < L.n; a++) totS.set(comm[a], (totS.get(comm[a]) ?? 0) + L.k[a]);
  // weight from each refined subcommunity to the rest of its community
  const outS = new Array<number>(L.n).fill(0);
  for (let a = 0; a < L.n; a++) for (const [b, w] of L.adj[a]) if (comm[b] === comm[a]) outS[a] += w;
  for (const a of shuffled(L.n, rnd)) {
    if (size[ref[a]] !== 1) continue;
    const S = comm[a];
    const tS = totS.get(S) as number;
    if (outS[a] < (L.k[a] * (tS - L.k[a])) / m2) continue;
    const links = new Map<number, number>();
    for (const [b, w] of L.adj[a]) if (comm[b] === S && ref[b] !== ref[a]) links.set(ref[b], (links.get(ref[b]) ?? 0) + w);
    let best = -1; let bestGain = 0;
    for (const [C, w] of links) {
      if (outS[C] < (totRef[C] * (tS - totRef[C])) / m2) continue;
      const x = w - (totRef[C] * L.k[a]) / m2;
      if (x >= bestGain && (best < 0 || x > bestGain || C < best)) { best = C; bestGain = x; }
    }
    if (best < 0) continue;
    const from = ref[a];
    ref[a] = best;
    size[from]--; size[best]++;
    totRef[best] += L.k[a]; totRef[from] -= L.k[a];
    // the merged subcommunity's weight to the rest of S: both sides' minus the links between them
    outS[best] = outS[best] + outS[from] - 2 * (links.get(best) ?? 0);
  }
  return ref;
}

/** Contract the level by `part`; returns the new level and each new node's old community. */
function aggregate(L: Level, part: number[], comm: number[]): { next: Level; init: number[] } {
  const ids = new Map<number, number>();
  for (let a = 0; a < L.n; a++) if (!ids.has(part[a])) ids.set(part[a], ids.size);
  const N = ids.size;
  const next: Level = {
    n: N, adj: Array.from({ length: N }, () => new Map()), self: new Array<number>(N).fill(0),
    k: new Array<number>(N).fill(0), members: Array.from({ length: N }, () => []),
  };
  const init = new Array<number>(N).fill(0);
  for (let a = 0; a < L.n; a++) {
    const A = ids.get(part[a]) as number;
    init[A] = comm[a];
    next.k[A] += L.k[a];
    next.self[A] += L.self[a];
    for (const v of L.members[a]) next.members[A].push(v);
    for (const [b, w] of L.adj[a]) {
      const B = ids.get(part[b]) as number;
      if (A === B) next.self[A] += w;
      else next.adj[A].set(B, (next.adj[A].get(B) ?? 0) + w);
    }
  }
  // communities of the new level, renumbered onto node ids that exist
  const cid = new Map<number, number>();
  for (let A = 0; A < N; A++) {
    if (!cid.has(init[A])) cid.set(init[A], A);
    init[A] = cid.get(init[A]) as number;
  }
  return { next, init };
}

// Louvain: local moving (each node to the neighbouring community that most raises modularity)
// until nothing moves, then contract every community to a node and repeat on the smaller
// graph, until a level moves nothing. Leiden refines each community into well-connected parts
// before contracting, contracts by those parts, and starts the next level from the unrefined
// communities; when a refinement merges nothing, that level contracts by the communities as
// Louvain does. Edge weights are ignored: every edge counts one.
export const kernel: GraphKernel<CommunitiesResult> = {
  goal: 'modularity',
  inputs: ['communities', 'small-world', 'geometric', 'grid'],
  n: { min: 4, max: 300, value: 90 },
  params: [{
    kind: 'select', key: 'method', label: 'Method', value: 'leiden', rebuild: true,
    options: [{ value: 'louvain', label: 'Louvain' }, { value: 'leiden', label: 'Leiden (greedy refinement)' }],
  }],
  view: { colour: 'group', truth: true },
  names: { groups: 'Communities' },
  readouts: ['rounds', 'groups', 'modularity', 'scans'],
  chart: { title: 'Modularity, sweep by sweep', x: 'rounds', y: 'Q', series: ['modularity'] },
  *steps(ops, { p }) {
    const g = ops.g;
    const leiden = p.method === 'leiden';
    let L: Level = {
      n: g.n, adj: Array.from({ length: g.n }, () => new Map()), self: new Array<number>(g.n).fill(0),
      k: new Array<number>(g.n).fill(0), members: Array.from({ length: g.n }, (_, v) => [v]),
    };
    for (let e = 0; e < g.m; e++) {
      const u = g.eu[e]; const v = g.ev[e];
      if (u === v) continue;
      L.adj[u].set(v, (L.adj[u].get(v) ?? 0) + 1);
      L.adj[v].set(u, (L.adj[v].get(u) ?? 0) + 1);
      L.k[u]++; L.k[v]++;
    }
    const m2 = L.k.reduce((s, x) => s + x, 0);
    const label = Array.from({ length: g.n }, (_, v) => v);
    for (let v = 0; v < g.n; v++) ops.group(v, v);
    if (!m2) return { comm: label, levels: 0 };
    let comm = Array.from({ length: L.n }, (_, a) => a);
    let levels = 0;
    for (; levels < 50; levels++) {
      yield* moveNodes(ops, L, comm, m2, label, levels === 0);
      const count = new Set(comm).size;
      if (count === L.n) break;
      let part = comm;
      if (leiden) {
        const ref = refine(L, comm, m2, ops.rnd);
        if (new Set(ref).size < L.n) part = ref;
      }
      const { next, init } = aggregate(L, part, comm);
      L = next;
      comm = init;
      for (let a = 0; a < L.n; a++) paint(ops, L, a, comm[a], label);
    }
    return { comm: label, levels: levels + 1 };
  },
  report(r) {
    return [
      { label: 'Communities', value: String(new Set(r.comm).size) },
      { label: 'Levels', value: String(r.levels) },
    ];
  },
};
