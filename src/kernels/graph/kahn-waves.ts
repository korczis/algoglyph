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
  *steps(ops) {
    const g = ops.g;
    const indeg = new Array<number>(g.n).fill(0);
    for (let e = 0; e < g.m; e++) { ops.scan(e); indeg[g.ev[e]]++; }
    const wave = new Array<number>(g.n).fill(-1);
    const order: number[] = [];
    let current: number[] = [];
    for (let v = 0; v < g.n; v++) if (!indeg[v]) { current.push(v); wave[v] = 0; ops.group(v, 0); ops.discover(v); }
    ops.round();
    yield;
    for (let w = 0; current.length; w++) {
      const next: number[] = [];
      for (const u of current) {
        order.push(u);
        ops.settle(u);
        yield;
        for (const e of g.out[u]) {
          ops.scan(e);
          const v = g.ev[e];
          if (--indeg[v] === 0) { next.push(v); wave[v] = w + 1; ops.group(v, w + 1); }
        }
      }
      // the next wave joins the frontier only once this one is removed, so the frontier is
      // always one wave and its largest size is the widest wave
      for (const v of next) ops.discover(v);
      current = next;
      ops.round();
      yield;
    }
    return { wave, order };
  },
  report(r, g) {
    const waves = Math.max(...r.wave) + 1;
    const sizes = new Array<number>(waves).fill(0);
    for (const w of r.wave) if (w >= 0) sizes[w]++;
    // the most vertices on a chain ending at each vertex, in the order they were removed (a
    // topological order), from the edges alone and not from the wave numbers
    const chain = new Array<number>(g.n).fill(1);
    for (const u of r.order) {
      for (const e of g.out[u]) chain[g.ev[e]] = Math.max(chain[g.ev[e]], chain[u] + 1);
    }
    return [
      { label: 'Waves', value: String(waves) },
      { label: 'Widest wave', value: `${Math.max(...sizes)} vertices` },
      { label: 'Longest dependency chain', value: `${Math.max(...chain)} vertices` },
    ];
  },
};
