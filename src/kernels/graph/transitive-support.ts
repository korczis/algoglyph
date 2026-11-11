import { E, V, type GraphKernel } from '../../engines/graph/trace';

export interface SupportResult { support: number[]; evidence: number[]; lines: number; paths: number[][] }

// Two questions about a conclusion in a graph where edges run from what supports to what is
// supported. Which evidence stands under it at all: a reverse breadth-first search from the
// conclusion. How many independent lines of support: the most paths from evidence to the
// conclusion that share no vertex but the conclusion, which by Menger's theorem is the fewest
// vertices whose loss would cut the conclusion off. Found as a maximum flow with every vertex
// split into an in-half and out-half joined by capacity one, augmenting by BFS.
export const kernel: GraphKernel<SupportResult> = {
  goal: 'support',
  inputs: ['reasoning'],
  n: { min: 4, max: 160, value: 40 },
  pick: 't',
  endpoints: 't',
  names: { frontier: 'Found under the conclusion', done: 'Searched', tree: 'Independent lines', marked: 'Evidence on a line' },
  readouts: ['scans', 'done', 'tree', 'rounds'],
  chart: { title: 'Search, then lines of support', x: 'rounds', y: 'count', series: ['done', 'tree'] },
  speed: 2,
  *steps(ops, { t }) {
    const g = ops.g;
    const n = g.n;
    // under the conclusion: reverse BFS over in-edges
    const under = new Array<boolean>(n).fill(false);
    under[t] = true;
    ops.discover(t);
    const queue = [t];
    for (let h = 0; h < queue.length; h++) {
      const u = queue[h];
      ops.settle(u);
      yield;
      for (const e of g.in[u]) {
        ops.scan(e);
        const v = g.eu[e];
        if (under[v]) continue;
        under[v] = true;
        ops.parent(v, e);
        ops.discover(v);
        queue.push(v);
      }
    }
    ops.round();
    yield;
    const support = queue.slice(1);
    const evidence = support.filter((v) => g.in[v].length === 0);
    for (const v of support) ops.parent(v, -1);
    // vertex-disjoint lines: node v_in = 2v, v_out = 2v + 1, super source S = 2n
    const S = 2 * n;
    const cap = new Map<string, number>();
    const adj: number[][] = Array.from({ length: 2 * n + 1 }, () => []);
    const edgeOf = new Map<string, number>();
    const arc = (a: number, b: number, c: number, e = -1) => {
      const k = `${a},${b}`;
      if (!cap.has(k)) { adj[a].push(b); adj[b].push(a); cap.set(`${b},${a}`, cap.get(`${b},${a}`) ?? 0); }
      cap.set(k, (cap.get(k) ?? 0) + c);
      if (e >= 0) edgeOf.set(k, e);
    };
    for (const v of support) arc(2 * v, 2 * v + 1, 1);
    for (const v of evidence) arc(S, 2 * v, 1);
    for (let e = 0; e < g.m; e++) if (under[g.eu[e]] && under[g.ev[e]]) arc(2 * g.eu[e] + 1, g.ev[e] === t ? 2 * t : 2 * g.ev[e], 1, e);
    const sink = 2 * t;
    let lines = 0;
    for (;;) {
      const prev = new Map<number, number>([[S, -1]]);
      const q = [S];
      for (let h = 0; h < q.length && !prev.has(sink); h++) {
        const a = q[h];
        for (const b of adj[a]) {
          if (prev.has(b) || (cap.get(`${a},${b}`) ?? 0) <= 0) continue;
          const e = edgeOf.get(`${a},${b}`) ?? edgeOf.get(`${b},${a}`);
          if (e !== undefined) ops.scan(e);
          prev.set(b, a);
          q.push(b);
        }
      }
      if (!prev.has(sink)) break;
      for (let b = sink; b !== S;) {
        const a = prev.get(b) as number;
        cap.set(`${a},${b}`, (cap.get(`${a},${b}`) ?? 0) - 1);
        cap.set(`${b},${a}`, (cap.get(`${b},${a}`) ?? 0) + 1);
        b = a;
      }
      lines++;
      ops.round();
      yield;
    }
    // read the lines off the flow: original edges whose arc is used (residual capacity 0)
    const used = (e: number) => {
      const a = 2 * g.eu[e] + 1; const b = g.ev[e] === t ? 2 * t : 2 * g.ev[e];
      return under[g.eu[e]] && under[g.ev[e]] && (cap.get(`${a},${b}`) ?? 1) === 0;
    };
    const paths: number[][] = [];
    for (const v of evidence) {
      if ((cap.get(`${S},${2 * v}`) ?? 1) !== 0) continue;
      const path = [v];
      for (let u = v; u !== t;) {
        const e = g.out[u].find((f) => used(f));
        if (e === undefined) break;
        ops.edge(e, E.tree);
        u = g.ev[e];
        path.push(u);
      }
      paths.push(path);
      ops.vertex(v, V.mark);
    }
    return { support, evidence, lines, paths };
  },
  report(r) {
    return [
      { label: 'Evidence under the conclusion', value: `${r.evidence.length} items, ${r.support.length} supporting vertices` },
      { label: 'Independent lines of support', value: String(r.lines) },
    ];
  },
};
