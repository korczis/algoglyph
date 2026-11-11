import { dots, line, type GeometryKernel, type Mark, type Pt } from '../../engines/geometry/trace';

// k-means++ seeding: the first centre is a point drawn uniformly, each further centre a point
// drawn with probability proportional to its squared distance from the nearest centre so far.
// Then Lloyd's iterations: assign every point to its nearest centre, move every centre to the
// mean of its points, until no assignment changes.
export const kernel: GeometryKernel = {
  task: 'kmeans',
  input: 'points',
  shapes: ['clustered', 'uniform', 'disk'],
  n: { min: 10, max: 2000, value: 400, step: 10 },
  params: [{ kind: 'range', key: 'k', label: 'Clusters k', min: 2, max: 12, step: 1, value: 5 }],
  counters: [['dist', 'Distance computations'], ['iter', 'Lloyd iterations'], ['moved', 'Reassignments']],
  run(g) {
    const P = g.input.points;
    const n = P.length;
    const k = Math.max(1, Math.min(n, Number(g.params.k ?? 5)));
    g.base([]);
    const centres: Pt[] = [];
    const d2 = new Float64Array(n).fill(Infinity);
    const colour = (j: number) => (k > 1 ? j / (k - 1) : 0.5);
    const centreMarks = (cs: Pt[]): Mark[] => cs.flatMap((c, j) => [
      ...dots([c], { r: 7 }), ...dots([c], { c: colour(j), r: 5 })]);
    // seeding
    centres.push({ ...P[Math.floor(g.rnd() * n)] });
    while (centres.length < k) {
      const c = centres[centres.length - 1];
      let total = 0;
      for (let i = 0; i < n; i++) { d2[i] = Math.min(d2[i], g.dist2(P[i], c)); total += d2[i]; }
      g.frame(() => [...P.map((p, i): Mark => ({ t: 'p', x: p.x, y: p.y, r: 1 + 5 * Math.sqrt(d2[i] / Math.max(1e-9, total / n)) / 3, a: 120 })),
        ...centreMarks(centres)], 'seed: dot size is the chance of being drawn');
      let r = g.rnd() * total;
      let pick = n - 1;
      for (let i = 0; i < n; i++) { r -= d2[i]; if (r < 0) { pick = i; break; } }
      if (total === 0) break;
      centres.push({ ...P[pick] });
    }
    // Lloyd
    const label = new Int32Array(n).fill(-1);
    const inertia: [number, number][] = [];
    const pointMarks = (): Mark[] => P.map((p, i): Mark => ({ t: 'p', x: p.x, y: p.y, c: colour(label[i]), r: 2.4, a: 220 }));
    for (let it = 1; it <= 100; it++) {
      g.count('iter');
      let moved = 0;
      let sse = 0;
      for (let i = 0; i < n; i++) {
        let best = 0; let bd = Infinity;
        for (let j = 0; j < centres.length; j++) {
          const d = g.dist2(P[i], centres[j]);
          if (d < bd) { bd = d; best = j; }
        }
        sse += bd;
        if (label[i] !== best) { label[i] = best; moved++; }
      }
      g.count('moved', moved);
      inertia.push([it, sse]);
      g.frame(() => [...pointMarks(), ...centreMarks(centres)], `iteration ${it}: assign to the nearest centre`);
      if (moved === 0) break;
      const old = centres.map((c) => ({ ...c }));
      const sx = new Float64Array(centres.length); const sy = new Float64Array(centres.length); const cnt = new Int32Array(centres.length);
      for (let i = 0; i < n; i++) { sx[label[i]] += P[i].x; sy[label[i]] += P[i].y; cnt[label[i]]++; }
      for (let j = 0; j < centres.length; j++) if (cnt[j]) centres[j] = { x: sx[j] / cnt[j], y: sy[j] / cnt[j] };
      g.frame(() => [...pointMarks(), ...old.map((o, j) => line(o, centres[j], { w: 2 })), ...centreMarks(centres)], `iteration ${it}: move each centre to its mean`);
    }
    const last = inertia[inertia.length - 1]?.[1] ?? 0;
    g.last(() => [...pointMarks(), ...centreMarks(centres)], 'converged: no point changes cluster');
    return {
      result: { centres, labels: Array.from(label), inertia: inertia.map((q) => q[1]) },
      rows: [
        { label: 'Inertia (sum of squared distances)', value: last.toExponential(4) },
        { label: 'Iterations to converge', value: String(inertia.length) },
      ],
      chart: {
        title: 'Inertia per Lloyd iteration',
        x: { label: 'iteration' },
        y: { label: 'sum of squared distances' },
        series: [{ name: 'Inertia', points: inertia }],
      },
    };
  },
};
