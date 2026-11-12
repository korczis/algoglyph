// The Pareto front of options scored on two criteria (both to maximise): sort by the first
// criterion, sweep, and keep each option that beats every option before it on the second.
// Peeling the front off and sweeping again ranks every option by its layer.
import { gaussian, mulberry32 } from '../../core/random';
import { drain, fmt, int, logSlope, Meter, type Layer, type NumericKernel, type NumericRun, type RunInput, type Step, type XY } from '../../engines/numeric/trace';

/** p dominates q: at least as good on every criterion and better on one. */
export function dominates(p: number[], q: number[]): boolean {
  let better = false;
  for (let i = 0; i < p.length; i++) { if (p[i] < q[i]) return false; if (p[i] > q[i]) better = true; }
  return better;
}

/** Indices of the non-dominated points of a 2D set, by one sort and one sweep. */
export function front2(pts: XY[], idx: number[] = pts.map((_, i) => i), m = new Meter(), visit?: (i: number, kept: boolean, best: number) => void): number[] {
  const order = idx.slice().sort((a, b) => { m.tick('compare'); return pts[b][0] - pts[a][0] || pts[b][1] - pts[a][1]; });
  const out: number[] = [];
  let best = -Infinity;
  for (let k = 0; k < order.length;) {
    // a run of equal first criteria: only its largest second criterion can survive
    let e = k;
    while (e + 1 < order.length && pts[order[e + 1]][0] === pts[order[k]][0]) e++;
    const top = pts[order[k]][1];
    for (let t = k; t <= e; t++) {
      m.tick('compare');
      const kept = pts[order[t]][1] === top && top > best;
      if (kept) out.push(order[t]);
      visit?.(order[t], kept, Math.max(best, kept ? top : -Infinity));
    }
    best = Math.max(best, top);
    k = e + 1;
  }
  return out;
}

/** Layer of every point: 0 for the front, 1 for the front of what remains, and so on. */
export function layers(pts: XY[]): number[] {
  return drain(layerSteps(pts));
}

/** layers(), resumable: it yields after every layer peeled off. */
export function* layerSteps(pts: XY[]): Generator<void, number[], void> {
  const rank = new Array<number>(pts.length).fill(-1);
  let rest = pts.map((_, i) => i);
  for (let r = 0; rest.length; r++) {
    const f = new Set(front2(pts, rest));
    for (const i of f) rank[i] = r;
    rest = rest.filter((i) => !f.has(i));
    yield;
  }
  return rank;
}

export function options(kind: string, n: number, seed: number): XY[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const u = gaussian(rnd); const v = gaussian(rnd);
    if (kind === 'correlated') return [0.5 + 0.15 * (u + 0.35 * v), 0.5 + 0.15 * (u - 0.35 * v)] as XY;
    if (kind === 'anti') return [0.5 + 0.15 * (u + 0.35 * v), 0.5 - 0.15 * (u - 0.35 * v)] as XY;
    return [rnd(), rnd()] as XY;
  });
}

function* build({ seed, params }: RunInput): Generator<void, NumericRun, void> {
  const n = Number(params.options ?? 160);
  const pts = options(String(params.shape ?? 'anti'), n, seed);
  const m = new Meter();
  const visits: { i: number; kept: boolean; best: number }[] = [];
  const front = front2(pts, undefined, m, (i, kept, best) => visits.push({ i, kept, best }));
  yield;
  const rank = yield* layerSteps(pts);
  const depth = Math.max(...rank) + 1;
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - 0.03; const x1 = Math.max(...xs) + 0.03;
  const y0 = Math.min(...ys) - 0.03; const y1 = Math.max(...ys) + 0.03;
  const sweep: XY[] = []; const brute: XY[] = [];
  for (let k = 16; k <= 2048; k *= 2) {
    const q = options('independent', k, seed + k);
    const ms = new Meter();
    front2(q, undefined, ms);
    sweep.push([k, ms.get('compare')]);
    brute.push([k, k * (k - 1)]);
    yield;
  }
  const chart = {
    title: 'Comparisons to find the front', x: { label: 'options', log: true }, y: { label: 'comparisons', log: true },
    series: [{ name: 'Sort and sweep', points: sweep }, { name: 'Every pair, both ways', points: brute }],
  };
  const stairs = (ids: number[]): XY[] => {
    const f = ids.map((i) => pts[i]).sort((a, b) => b[0] - a[0]);
    const out: XY[] = [];
    f.forEach((p, k) => { if (k) out.push([p[0], f[k - 1][1]]); out.push(p); });
    return out;
  };
  const steps: Step[] = [];
  const per = Math.max(1, Math.ceil(n / 120));
  for (let k = per; k < n + per; k += per) {
    const upto = Math.min(n, k);
    const seen = visits.slice(0, upto);
    const kept = seen.filter((v) => v.kept).map((v) => v.i);
    const cur = seen[seen.length - 1];
    const layer: Layer[] = [
      { kind: 'points', pts, size: 5, alpha: 0.35 },
      { kind: 'points', pts: seen.map((v) => pts[v.i]), size: 5, tone: 0.3 },
      { kind: 'segments', segs: [[pts[cur.i][0], y0, pts[cur.i][0], y1]], alpha: 0.4 },
      { kind: 'segments', segs: Number.isFinite(cur.best) ? [[x0, cur.best, x1, cur.best]] : [], tone: 0.85, alpha: 0.5 },
      { kind: 'curve', pts: stairs(kept), tone: 0.85, weight: 2.5 },
      { kind: 'points', pts: kept.map((i) => pts[i]), size: 9, tone: 0.85 },
    ];
    steps.push({
      layers: layer,
      stats: [
        { label: 'Swept', value: `${int(upto)} of ${int(n)} options, by the first criterion` },
        { label: 'On the front so far', value: int(kept.length) },
        { label: 'Comparisons (sort and sweep)', value: int(m.get('compare')) },
        { label: 'Measured growth', value: `sweep n^${fmt(logSlope(sweep), 3)}, every pair n^${fmt(logSlope(brute), 3)}` },
      ],
    });
    if (steps.length % 8 === 0) yield;
  }
  // after the sweep: every layer, peeled off one front at a time
  steps.push({
    layers: [
      { kind: 'points', pts, tones: rank.map((r) => 0.85 - (0.85 * r) / Math.max(1, depth - 1)), size: 6 },
      ...Array.from({ length: Math.min(depth, 8) }, (_, r): Layer => ({ kind: 'curve', pts: stairs(rank.flatMap((q, i) => (q === r ? [i] : []))), tone: 0.85 - (0.85 * r) / Math.max(1, depth - 1), weight: r ? 1.2 : 2.5 })),
    ],
    stats: [
      { label: 'Front', value: `${int(front.length)} of ${int(n)} options` },
      { label: 'Layers (non-dominated sorting)', value: int(depth) },
      { label: 'Comparisons (sort and sweep)', value: int(m.get('compare')) },
      { label: 'Measured growth', value: `sweep n^${fmt(logSlope(sweep), 3)}, every pair n^${fmt(logSlope(brute), 3)}` },
    ],
  });
  return {
    panels: [{ title: 'Options: criterion 1 → , criterion 2 ↑ (both better higher)', x: [x0, x1], y: [y0, y1] }],
    steps,
    chart,
  };
}

export const kernel: NumericKernel = {
  params: [
    { kind: 'range', key: 'options', label: 'Options', min: 10, max: 600, step: 10, value: 160, rebuild: true },
    { kind: 'select', key: 'shape', label: 'Criteria', value: 'anti', rebuild: true,
      options: [{ value: 'independent', label: 'Independent' }, { value: 'correlated', label: 'Correlated' }, { value: 'anti', label: 'Anti-correlated (a trade-off)' }] },
  ],
  rate: 20,
  thumb: 1,
  build,
  run: (inp) => drain(build(inp)),
};
