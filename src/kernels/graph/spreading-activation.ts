import { other } from '../../engines/graph/graph';
import type { GraphKernel } from '../../engines/graph/trace';

export interface ActivationResult { act: number[]; pulses: number }

// The seed fires a pulse of 1. In each round every vertex whose incoming pulse is at least the
// threshold passes d times it along its edges, split in proportion to their weights; a pulse
// below the threshold dies. A vertex's activation is the sum of the pulses it received. With a
// zero threshold that is the series s + dW s + d^2 W^2 s + ... = (I - dW)^-1 s.
export const kernel: GraphKernel<ActivationResult> = {
  goal: 'activation',
  inputs: ['communities', 'small-world', 'links', 'geometric'],
  n: { min: 3, max: 300, value: 80 },
  params: [
    { kind: 'range', key: 'decay', label: 'Decay d', min: 0.1, max: 0.95, step: 0.05, value: 0.7, rebuild: true },
    { kind: 'range', key: 'threshold', label: 'Firing threshold (per mille)', min: 0, max: 50, step: 1, value: 2, rebuild: true },
  ],
  pick: 's',
  endpoints: 's',
  view: { colour: 'value', size: true },
  names: { frontier: 'Firing', done: 'Activated', value: 'Activation' },
  readouts: ['rounds', 'scans', 'frontier', 'done', 'change'],
  chart: { title: 'Vertices firing, round by round', x: 'rounds', y: 'vertices', series: ['frontier', 'done'] },
  speed: 4,
  *steps(ops, { s, p }) {
    const g = ops.g;
    const d = Number(p.decay);
    const th = Number(p.threshold) / 1000;
    const strength = new Array<number>(g.n).fill(0);
    for (let e = 0; e < g.m; e++) { strength[g.eu[e]] += g.w[e]; if (!g.directed) strength[g.ev[e]] += g.w[e]; }
    const act = new Array<number>(g.n).fill(0);
    let pulse = new Array<number>(g.n).fill(0);
    pulse[s] = 1; act[s] = 1;
    ops.value(s, 1);
    ops.discover(s);
    let pulses = 0;
    for (let round = 0; round < 10000; round++) {
      const next = new Array<number>(g.n).fill(0);
      let firing = false;
      for (let u = 0; u < g.n; u++) {
        if (pulse[u] <= 0) continue;
        if (pulse[u] < th || !strength[u]) { if (act[u] > 0) ops.settle(u); continue; }
        yield;
        firing = true;
        pulses++;
        for (const e of g.out[u]) {
          ops.scan(e);
          next[other(g, e, u)] += (d * pulse[u] * g.w[e]) / strength[u];
        }
        ops.settle(u);
        yield;
      }
      if (!firing) break;
      let biggest = 0;
      for (let v = 0; v < g.n; v++) {
        if (!next[v]) continue;
        act[v] += next[v];
        biggest = Math.max(biggest, next[v]);
        ops.value(v, act[v]);
        if (next[v] >= th) ops.discover(v);
      }
      pulse = next;
      ops.round();
      yield;
      if (biggest < 1e-13) break;
    }
    return { act, pulses };
  },
  report(r, _g, { s }) {
    const reached = r.act.filter((x) => x > 0).length;
    let top = -1;
    for (let v = 0; v < r.act.length; v++) if (v !== s && (top < 0 || r.act[v] > r.act[top])) top = v;
    return [
      { label: 'Activated', value: `${reached} vertices, ${r.pulses} firings` },
      { label: 'Most activated', value: top < 0 ? 'none' : `vertex ${top}: ${r.act[top].toPrecision(3)}` },
    ];
  },
};
