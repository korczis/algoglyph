import { E, type GraphKernel } from '../../engines/graph/trace';

export interface LayeredResult {
  /** Layer of every node: the graph's vertices, then the dummy nodes of long edges. */
  layer: number[];
  /** The best order found, node ids per layer. */
  orders: number[][];
  /** Segments between adjacent layers, [upper, lower] node ids. */
  segs: [number, number][];
  crossings: number;
  initial: number;
  reversed: number[];
}

/** Crossings of the segments between each pair of adjacent layers, under `pos`. */
export function crossings(segs: [number, number][], layer: number[], pos: number[]): number {
  const by = new Map<number, [number, number][]>();
  for (const s of segs) {
    const l = layer[s[0]];
    if (!by.has(l)) by.set(l, []);
    (by.get(l) as [number, number][]).push(s);
  }
  let c = 0;
  for (const list of by.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if ((pos[list[i][0]] - pos[list[j][0]]) * (pos[list[i][1]] - pos[list[j][1]]) < 0) c++;
      }
    }
  }
  return c;
}

// The Sugiyama framework in four steps. Cycles are broken by reversing the back edges of a DFS.
// Layers by longest path from the sources, so every edge points to a later layer; an edge
// spanning several layers is split by dummy nodes into one segment per layer gap. Each layer is
// then reordered by the barycentre of its neighbours in the layer above (down sweeps) or below
// (up sweeps), keeping the order with the fewest crossings. Finally vertices are placed by
// layer and by rank within the layer. Edges are drawn straight; the crossing count is of the
// layered drawing, where long edges bend through their dummy nodes.
export const kernel: GraphKernel<LayeredResult> = {
  goal: 'layered',
  inputs: ['dag', 'reasoning', 'ownership'],
  n: { min: 4, max: 160, value: 40 },
  params: [{ kind: 'range', key: 'sweeps', label: 'Sweeps (down and up)', min: 1, max: 24, step: 1, value: 8, rebuild: true }],
  view: { colour: 'group' },
  names: { groups: 'Layers', done: 'Layered' },
  readouts: ['rounds', 'places', 'groups', 'scans'],
  speed: 6,
  run(ops, { p }) {
    const g = ops.g;
    const n = g.n;
    // 1. break cycles: reverse every back edge of a DFS
    const colour = new Array<number>(n).fill(0);
    const rev = new Array<boolean>(g.m).fill(false);
    for (let root = 0; root < n; root++) {
      if (colour[root]) continue;
      colour[root] = 1;
      const stack: [number, number][] = [[root, 0]];
      while (stack.length) {
        const top = stack[stack.length - 1];
        const u = top[0];
        if (top[1] < g.out[u].length) {
          const e = g.out[u][top[1]++];
          ops.scan(e);
          const v = g.ev[e];
          if (colour[v] === 1) { rev[e] = true; ops.edge(e, E.back); } else if (!colour[v]) { colour[v] = 1; stack.push([v, 0]); }
        } else { colour[u] = 2; stack.pop(); }
      }
    }
    const from = (e: number) => (rev[e] ? g.ev[e] : g.eu[e]);
    const to = (e: number) => (rev[e] ? g.eu[e] : g.ev[e]);
    // 2. longest-path layering in Kahn order
    const indeg = new Array<number>(n).fill(0);
    const outs: number[][] = Array.from({ length: n }, () => []);
    for (let e = 0; e < g.m; e++) { if (from(e) === to(e)) continue; indeg[to(e)]++; outs[from(e)].push(e); }
    const layer = new Array<number>(n).fill(0);
    const queue: number[] = [];
    for (let v = 0; v < n; v++) if (!indeg[v]) queue.push(v);
    for (let h = 0; h < queue.length; h++) {
      const u = queue[h];
      ops.group(u, layer[u]);
      ops.settle(u);
      for (const e of outs[u]) {
        ops.scan(e);
        const v = to(e);
        layer[v] = Math.max(layer[v], layer[u] + 1);
        if (--indeg[v] === 0) queue.push(v);
      }
    }
    ops.round();
    // 3. dummy nodes for long edges
    const segs: [number, number][] = [];
    let next = n;
    for (let e = 0; e < g.m; e++) {
      let a = from(e); const b = to(e);
      if (a === b) continue;
      for (let l = layer[a] + 1; l < layer[b]; l++) { layer[next] = l; segs.push([a, next]); a = next++; }
      segs.push([a, b]);
    }
    const L = Math.max(0, ...layer) + 1;
    const orders: number[][] = Array.from({ length: L }, () => []);
    for (let v = 0; v < next; v++) orders[layer[v]].push(v);
    const up: number[][] = Array.from({ length: next }, () => []);
    const down: number[][] = Array.from({ length: next }, () => []);
    for (const [a, b] of segs) { down[a].push(b); up[b].push(a); }
    const pos = new Array<number>(next).fill(0);
    const index = () => { for (const o of orders) o.forEach((v, i) => { pos[v] = i; }); };
    index();
    const place = () => {
      for (let v = 0; v < n; v++) {
        const size = orders[layer[v]].length;
        ops.place(v, (16 / 9) * (L > 1 ? layer[v] / (L - 1) : 0.5), (pos[v] + 0.5) / size);
      }
      ops.round();
    };
    place();
    const initial = crossings(segs, layer, pos);
    let best = initial;
    let bestOrders = orders.map((o) => o.slice());
    // 4. barycentre sweeps
    const sweeps = Number(p.sweeps);
    for (let s = 0; s < sweeps; s++) {
      const downwards = s % 2 === 0;
      const range = downwards ? Array.from({ length: L - 1 }, (_, i) => i + 1) : Array.from({ length: L - 1 }, (_, i) => L - 2 - i);
      for (const l of range) {
        const bary = new Map<number, number>();
        for (const v of orders[l]) {
          const nb = downwards ? up[v] : down[v];
          bary.set(v, nb.length ? nb.reduce((sum, u) => sum + pos[u], 0) / nb.length : pos[v]);
        }
        orders[l].sort((a, b) => (bary.get(a) as number) - (bary.get(b) as number) || pos[a] - pos[b]);
        orders[l].forEach((v, i) => { pos[v] = i; });
      }
      const c = crossings(segs, layer, pos);
      if (c < best) { best = c; bestOrders = orders.map((o) => o.slice()); }
      place();
    }
    for (let l = 0; l < L; l++) orders[l] = bestOrders[l];
    index();
    place();
    return { layer, orders: bestOrders, segs, crossings: best, initial, reversed: rev.map((r, e) => (r ? e : -1)).filter((e) => e >= 0) };
  },
  report(r) {
    return [
      { label: 'Crossings', value: `${r.initial} before the sweeps, ${r.crossings} after` },
      { label: 'Edges reversed to break cycles', value: String(r.reversed.length) },
    ];
  },
};
