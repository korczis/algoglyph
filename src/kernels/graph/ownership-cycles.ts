import { E, V, type GraphKernel } from '../../engines/graph/trace';

export interface CyclesResult { cycles: number[][]; edges: number[][] }

// DFS colouring of a directed graph: white (unseen), grey (on the stack), black (finished). An
// edge into a grey vertex closes a cycle, which is read off the stack; a graph has a cycle
// exactly when such a back edge exists.
export const kernel: GraphKernel<CyclesResult> = {
  goal: 'cycles',
  inputs: ['ownership', 'digraph', 'dag'],
  n: { min: 6, max: 240, value: 60 },
  names: { frontier: 'Grey (on the stack)', done: 'Black (finished)', marked: 'On a cycle found', tree: 'DFS tree edges' },
  readouts: ['scans', 'frontier', 'done', 'marked'],
  chart: { title: 'Grey and black vertices', y: 'vertices', series: ['frontier', 'done'] },
  speed: 2,
  run(ops) {
    const g = ops.g;
    const colour = new Array<number>(g.n).fill(0);
    const via = new Array<number>(g.n).fill(-1);
    const cycles: number[][] = []; const cycleEdges: number[][] = [];
    const onCycle = new Set<number>();
    for (let root = 0; root < g.n; root++) {
      if (colour[root]) continue;
      colour[root] = 1;
      ops.discover(root);
      const stack: [number, number][] = [[root, 0]];
      while (stack.length) {
        const top = stack[stack.length - 1];
        const u = top[0];
        if (top[1] < g.out[u].length) {
          const e = g.out[u][top[1]++];
          ops.scan(e);
          const v = g.ev[e];
          if (colour[v] === 0) {
            colour[v] = 1; via[v] = e;
            ops.parent(v, e);
            ops.discover(v);
            stack.push([v, 0]);
          } else if (colour[v] === 1) {
            // walk the stack back from u to v: v -> ... -> u -> v
            const cyc: number[] = []; const es: number[] = [e];
            for (let w = u; w !== v; w = g.eu[via[w]]) { cyc.push(w); es.push(via[w]); }
            cyc.push(v);
            cyc.reverse(); es.reverse();
            cycles.push(cyc); cycleEdges.push(es);
            for (const f of es) ops.edge(f, E.mark);
            for (const w of cyc) onCycle.add(w);
          }
        } else {
          stack.pop();
          colour[u] = 2;
          ops.settle(u);
        }
      }
      ops.round();
    }
    for (const w of onCycle) ops.vertex(w, V.mark);
    return { cycles, edges: cycleEdges };
  },
  report(r) {
    return [
      { label: 'Cycles closed', value: String(r.cycles.length) },
      { label: 'Verdict', value: r.cycles.length ? 'circular ownership present' : 'acyclic' },
    ];
  },
};
