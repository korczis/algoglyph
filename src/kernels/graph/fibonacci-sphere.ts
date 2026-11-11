import { other } from '../../engines/graph/graph';
import type { GraphKernel } from '../../engines/graph/trace';

export interface SphereResult { x: number[]; y: number[]; z: number[]; slot: number[]; meanChord: number }

/** The i-th of n points of the Fibonacci lattice on the unit sphere. */
export function fibonacciPoint(i: number, n: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (2 * i + 1) / n;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  return [r * Math.cos(golden * i), y, r * Math.sin(golden * i)];
}

// Point i sits at height 1 - (2i + 1)/n and turns by the golden angle pi (3 - sqrt 5) from the
// last: equal heights mean equal areas (Archimedes), and the irrational turn keeps the spiral
// from lining up. Vertices take the points in breadth-first order from the source, so a
// vertex's neighbours land on nearby turns of the spiral.
export const kernel: GraphKernel<SphereResult> = {
  goal: 'sphere',
  inputs: ['small-world', 'communities', 'geometric', 'grid'],
  n: { min: 4, max: 400, value: 160 },
  pick: 's',
  endpoints: 's',
  view: { sphere: true },
  names: { frontier: 'In the queue', done: 'Placed' },
  readouts: ['places', 'done', 'scans'],
  chart: { title: 'Vertices placed', y: 'vertices', series: ['done'] },
  speed: 2,
  run(ops, { s }) {
    const g = ops.g;
    const slot = new Array<number>(g.n).fill(-1);
    const x: number[] = []; const y: number[] = []; const z: number[] = [];
    let next = 0;
    const roots = [s, ...Array.from({ length: g.n }, (_, i) => i).filter((i) => i !== s)];
    for (const root of roots) {
      if (slot[root] >= 0) continue;
      slot[root] = next++;
      ops.discover(root);
      const queue = [root];
      for (let h = 0; h < queue.length; h++) {
        const u = queue[h];
        const [px, py, pz] = fibonacciPoint(slot[u], g.n);
        x[u] = px; y[u] = py; z[u] = pz;
        ops.place(u, px, py, pz);
        ops.settle(u);
        for (const e of g.out[u]) {
          ops.scan(e);
          const v = other(g, e, u);
          if (slot[v] >= 0) continue;
          slot[v] = next++;
          ops.discover(v);
          queue.push(v);
        }
      }
    }
    let sum = 0;
    for (let e = 0; e < g.m; e++) sum += Math.hypot(x[g.eu[e]] - x[g.ev[e]], y[g.eu[e]] - y[g.ev[e]], z[g.eu[e]] - z[g.ev[e]]);
    return { x, y, z, slot, meanChord: g.m ? sum / g.m : 0 };
  },
  report(r) {
    return [{ label: 'Mean edge chord', value: `${r.meanChord.toFixed(3)} (4/3 for random points)` }];
  },
};
