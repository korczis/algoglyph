import { other } from '../../engines/graph/graph';
import type { GraphKernel } from '../../engines/graph/trace';

export interface ComponentsResult { comp: number[] }

// A DFS from every vertex not yet labelled gives everything it reaches the next label.
export const kernel: GraphKernel<ComponentsResult> = {
  goal: 'components',
  inputs: ['islands', 'random', 'geometric', 'grid'],
  n: { min: 8, max: 400, value: 110 },
  view: { colour: 'group' },
  names: { frontier: 'On the stack', done: 'Labelled', groups: 'Components', tree: 'Search tree edges' },
  readouts: ['scans', 'done', 'groups'],
  chart: { title: 'Labelling progress', y: 'vertices', series: ['done', 'frontier'] },
  speed: 3,
  *steps(ops) {
    const g = ops.g;
    const comp = new Array<number>(g.n).fill(-1);
    let k = 0;
    for (let root = 0; root < g.n; root++) {
      if (comp[root] >= 0) continue;
      comp[root] = k;
      ops.group(root, k);
      ops.discover(root);
      const stack = [root];
      while (stack.length) {
        const u = stack.pop() as number;
        ops.settle(u);
        yield;
        for (const e of g.out[u]) {
          ops.scan(e);
          const v = other(g, e, u);
          if (comp[v] >= 0) continue;
          comp[v] = k;
          ops.group(v, k);
          ops.parent(v, e);
          ops.discover(v);
          stack.push(v);
        }
      }
      k++;
      ops.round();
      yield;
    }
    return { comp };
  },
  report(r) {
    const sizes = new Map<number, number>();
    for (const c of r.comp) sizes.set(c, (sizes.get(c) ?? 0) + 1);
    return [
      { label: 'Components', value: String(sizes.size) },
      { label: 'Largest', value: `${Math.max(...sizes.values())} vertices` },
    ];
  },
};
