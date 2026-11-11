import type { GeometryKernel, Mark } from '../../engines/geometry/trace';

// DBSCAN: a point with at least minPts points (itself included) within distance eps is a core
// point. A cluster grows from a core point through every point within eps of a core point
// already in it; points reached but not core are its border, and points no cluster reaches are
// noise. The neighbourhoods here are found by a linear scan, so each query costs n distances.
export const kernel: GeometryKernel = {
  task: 'dbscan',
  input: 'points',
  shapes: ['clustered', 'uniform', 'lattice'],
  n: { min: 10, max: 1200, value: 400, step: 10 },
  params: [
    { kind: 'range', key: 'eps', label: 'Radius eps', min: 10, max: 160, step: 1, value: 45 },
    { kind: 'range', key: 'minPts', label: 'Core size minPts', min: 2, max: 20, step: 1, value: 5 },
  ],
  counters: [['dist', 'Distance computations'], ['query', 'Neighbourhood queries'], ['core', 'Core points']],
  scaling: [64, 128, 256, 512, 1024],
  run(g) {
    const P = g.input.points;
    const n = P.length;
    const eps = Number(g.params.eps ?? 45);
    const minPts = Number(g.params.minPts ?? 5);
    const NOISE = -1; const UNSEEN = -2;
    const label = new Int32Array(n).fill(UNSEEN);
    const core = new Uint8Array(n);
    let clusters = 0;
    const region = (i: number): number[] => {
      g.count('query');
      const out: number[] = [];
      for (let j = 0; j < n; j++) if (g.dist2(P[i], P[j]) <= eps * eps) out.push(j);
      return out;
    };
    const marks = (at: number): Mark[] => {
      const out: Mark[] = P.map((p, i): Mark => (label[i] >= 0
        ? { t: 'p', x: p.x, y: p.y, c: (label[i] * 0.618) % 1, r: core[i] ? 3 : 2, a: core[i] ? 255 : 170 }
        : { t: 'p', x: p.x, y: p.y, r: 1.6, a: label[i] === NOISE ? 110 : 60 }));
      if (at >= 0) out.push({ t: 'o', x: P[at].x, y: P[at].y, rad: eps, w: 1.2, a: 200 });
      return out;
    };
    for (let i = 0; i < n; i++) {
      if (label[i] !== UNSEEN) continue;
      const N = region(i);
      if (N.length < minPts) { label[i] = NOISE; g.frame(() => marks(i), 'too few neighbours: noise for now'); continue; }
      const c = clusters++;
      label[i] = c; core[i] = 1; g.count('core');
      const queue = N.filter((j) => j !== i);
      g.frame(() => marks(i), 'a core point starts a cluster');
      while (queue.length) {
        const j = queue.pop() as number;
        if (label[j] === NOISE) label[j] = c; // a border point
        if (label[j] !== UNSEEN) continue;
        label[j] = c;
        const M = region(j);
        if (M.length >= minPts) {
          core[j] = 1; g.count('core');
          for (const q of M) if (label[q] === UNSEEN || label[q] === NOISE) queue.push(q);
        }
        g.frame(() => marks(j), core[j] ? 'core point: its neighbours join' : 'border point');
      }
    }
    g.last(() => marks(-1), 'every point labelled');
    const noise = label.reduce((s, v) => s + (v === NOISE ? 1 : 0), 0);
    return {
      result: { labels: Array.from(label), core: Array.from(core), eps, minPts },
      rows: [
        { label: 'Clusters', value: String(clusters) },
        { label: 'Noise points', value: String(noise) },
      ],
    };
  },
};
