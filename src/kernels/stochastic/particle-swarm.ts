import { num, str } from '../../core/plate';
import { fmt, Sampler } from '../../engines/stochastic/sample';
import { landscape, landscapeField, landscapeParam } from '../../engines/stochastic/scenarios';
import type { StochasticKernel } from '../../engines/stochastic/trace';
import { budgetParam, clamp, RandomSearch, searchStats, type SearchResult } from './_search';

const SERIES = 'Particle swarm';
// constriction-equivalent coefficients (Clerc and Kennedy): inertia 0.7298, pulls 1.49618
const W = 0.7298;
const C = 1.49618;

// Each particle keeps a velocity, its own best point and the swarm's best point; every
// iteration the velocity keeps some momentum and is pulled at random strengths towards both.
export const kernel: StochasticKernel<SearchResult> = {
  palette: 'ember',
  params: [
    landscapeParam(),
    budgetParam(),
    { kind: 'range', key: 'swarm', label: 'Particles', min: 6, max: 60, step: 2, value: 24, rebuild: true },
  ],
  chart: { title: 'Best value found', x: { label: 'evaluations' }, y: { label: 'best objective' } },
  labSeries: SERIES,
  *run(ops, cfg) {
    const l = landscape(str(cfg, 'landscape'));
    const field = landscapeField(l);
    const s = new Sampler(() => ops.rnd());
    const rs = new RandomSearch(ops, l);
    const m = num(cfg, 'swarm');
    const iters = Math.max(1, Math.floor(num(cfg, 'budget') / m) - 1);
    const vmax = [0.2 * (l.x[1] - l.x[0]), 0.2 * (l.y[1] - l.y[0])];
    const pos: [number, number][] = [];
    const vel: [number, number][] = [];
    const pbest: [number, number][] = [];
    const pval: number[] = [];
    let g: [number, number] = [0, 0];
    let gval = Infinity;
    for (let i = 0; i < m; i++) {
      const p: [number, number] = [s.uniform(l.x[0], l.x[1]), s.uniform(l.y[0], l.y[1])];
      pos.push(p);
      vel.push([s.uniform(-vmax[0], vmax[0]) * 0.5, s.uniform(-vmax[1], vmax[1]) * 0.5]);
      const v = ops.evaluate(l.f, p[0], p[1]);
      rs.step();
      pbest.push([p[0], p[1]]);
      pval.push(v);
      if (v < gval) { gval = v; g = [p[0], p[1]]; }
    }
    let evals = m;
    const record = (it: number) => {
      ops.point(SERIES, evals, gval);
      ops.point('Random search', evals, rs.best);
      const cx = pos.reduce((a, q) => a + q[0], 0) / m;
      const cy = pos.reduce((a, q) => a + q[1], 0) / m;
      const spread = pos.reduce((a, q) => a + Math.hypot(q[0] - cx, q[1] - cy), 0) / m;
      ops.frame([{
        kind: 'plot', title: `${l.label}: particles, their bests and the swarm's best`, x: l.x, y: l.y, field,
        lines: pos.map((q, i) => ({ pts: [q, [q[0] - vel[i][0], q[1] - vel[i][1]]] as [number, number][], tone: -1, weight: 1, alpha: 0.5 })),
        dots: [
          { pts: pbest.map((q) => [q[0], q[1]] as [number, number]), tone: 0.2, size: 2, alpha: 0.7 },
          { pts: pos.map((q) => [q[0], q[1]] as [number, number]), tone: -1, size: 3 },
          { pts: [g], tone: 1, size: 6 },
          { pts: [rs.at], tone: 0, size: 4 },
        ],
      }], [
        ...searchStats('Swarm', evals, gval, rs, l),
        { label: 'Iteration', value: `${fmt(it)} of ${fmt(iters)}` },
        { label: 'Swarm spread', value: `${fmt(spread, 3)} (mean distance to the centroid)` },
      ]);
    };
    record(0);
    for (let it = 1; it <= iters; it++) {
      for (let i = 0; i < m; i++) {
        const p = pos[i];
        const v = vel[i];
        for (let d = 0; d < 2; d++) {
          const nv = W * v[d] + C * s.uniform() * (pbest[i][d] - p[d]) + C * s.uniform() * (g[d] - p[d]);
          v[d] = Math.max(-vmax[d], Math.min(vmax[d], nv));
          p[d] = clamp(p[d] + v[d], d === 0 ? l.x : l.y);
        }
        const f = ops.evaluate(l.f, p[0], p[1]);
        rs.step();
        evals++;
        if (f < pval[i]) { pval[i] = f; pbest[i] = [p[0], p[1]]; }
        if (f < gval) { gval = f; g = [p[0], p[1]]; }
      }
      record(it);
      yield;
    }
    return { landscape: l.id, best: gval, bestAt: g, randomBest: rs.best, evals };
  },
};
