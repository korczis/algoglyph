import type { GraphKernel } from '../../engines/graph/trace';

export interface WavesResult { wave: number[]; order: number[] }

// Kahn's algorithm, one wave at a time: every vertex with no remaining in-edges is removed at
// once, which may free the next wave. The vertices of one wave depend on nothing among
// themselves, so each wave can run in parallel; a vertex's wave is the number of edges on the
// longest chain of dependencies leading to it.
export const kernel: GraphKernel<WavesResult> = {
  goal: 'waves',
  inputs: ['dag', 'reasoning', 'signed-dag'],
  n: { min: 3, max: 300, value: 60 },
  view: { colour: 'group' },
  names: { frontier: 'In the current wave', done: 'Removed', groups: 'Waves' },
  readouts: ['scans', 'rounds', 'frontier', 'maxFrontier', 'done'],
  chart: { title: 'Wave sizes', x: 'rounds', y: 'vertices', series: ['frontier', 'done'] },
  speed: 2,
  run(ops) {
    const g = ops.g;
    const indeg = new Array<number>(g.n).fill(0);
    for (let e = 0; e < g.m; e++) { ops.scan(e); indeg[g.ev[e]]++; }
    const wave = new Array<number>(g.n).fill(-1);
    const order: number[] = [];
    let current: number[] = [];
    for (let v = 0; v < g.n; v++) if (!indeg[v]) { current.push(v); wave[v] = 0; ops.group(v, 0); ops.discover(v); }
    ops.round();
    for (let w = 0; current.length; w++) {
      const next: number[] = [];
      for (const u of current) {
        order.push(u);
        ops.settle(u);
        for (const e of g.out[u]) {
          ops.scan(e);
          const v = g.ev[e];
          if (--indeg[v] === 0) { next.push(v); wave[v] = w + 1; ops.group(v, w + 1); ops.discover(v); }
        }
      }
      current = next;
      ops.round();
    }
    return { wave, order };
  },
  report(r) {
    const waves = Math.max(...r.wave) + 1;
    const sizes = new Array<number>(waves).fill(0);
    for (const w of r.wave) if (w >= 0) sizes[w]++;
    return [
      { label: 'Waves', value: String(waves) },
      { label: 'Widest wave', value: `${Math.max(...sizes)} vertices` },
    ];
  },
};
