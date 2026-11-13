import type { GraphKernel } from '../../engines/graph/trace';

export interface SccResult { comp: number[] }

// One DFS. Every vertex goes on a second stack when discovered; low[v] is the earliest
// discovery time v's subtree reaches through vertices still on that stack. When a vertex
// finishes with low = its own discovery time it roots a component, popped off the stack whole.
export const kernel: GraphKernel<SccResult> = {
  goal: 'scc',
  inputs: ['digraph', 'ownership', 'dag'],
  n: { min: 6, max: 300, value: 70 },
  view: { colour: 'group' },
  names: { frontier: 'On the stack', done: 'Assigned', groups: 'Strong components', value: 'Low link' },
  readouts: ['scans', 'frontier', 'done', 'groups'],
  chart: { title: 'Vertices waiting on the component stack', y: 'vertices', series: ['frontier', 'done'] },
  *steps(ops) {
    const g = ops.g;
    const disc = new Array<number>(g.n).fill(-1);
    const low = new Array<number>(g.n).fill(0);
    const onStack = new Array<boolean>(g.n).fill(false);
    const comp = new Array<number>(g.n).fill(-1);
    const held: number[] = [];
    let clock = 0; let k = 0;
    for (let root = 0; root < g.n; root++) {
      if (disc[root] >= 0) continue;
      const enter = (v: number) => {
        disc[v] = low[v] = clock++;
        held.push(v); onStack[v] = true;
        ops.value(v, low[v]);
        ops.discover(v);
      };
      enter(root);
      const stack: [number, number][] = [[root, 0]];
      while (stack.length) {
        const top = stack[stack.length - 1];
        const u = top[0];
        if (top[1] < g.out[u].length) {
          const e = g.out[u][top[1]++];
          ops.scan(e);
          const v = g.ev[e];
          if (disc[v] < 0) { ops.parent(v, e); enter(v); stack.push([v, 0]); } else if (onStack[v] && disc[v] < low[u]) {
            low[u] = disc[v];
            ops.value(u, low[u]);
          }
        } else {
          stack.pop();
          if (stack.length) {
            const p = stack[stack.length - 1][0];
            if (low[u] < low[p]) { low[p] = low[u]; ops.value(p, low[p]); }
          }
          if (low[u] === disc[u]) {
            for (;;) {
              const w = held.pop() as number;
              onStack[w] = false;
              comp[w] = k;
              ops.group(w, k);
              ops.settle(w);
              yield;
              if (w === u) break;
            }
            k++;
          }
        }
      }
      ops.round();
      yield;
    }
    return { comp };
  },
  report(r) {
    const sizes = new Map<number, number>();
    for (const c of r.comp) sizes.set(c, (sizes.get(c) ?? 0) + 1);
    // the count is the engine's groups readout (names.groups); a second row of that label
    // would hide from a claim behind the first
    return [{ label: 'Largest', value: `${Math.max(...sizes.values())} vertices` }];
  },
};
