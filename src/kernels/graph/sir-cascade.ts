import { other } from '../../engines/graph/graph';
import { E, type GraphKernel } from '../../engines/graph/trace';

export interface SirResult { infected: number[]; recovered: number[]; steps: number }

// Discrete-time SIR on the graph from one seed. Each step, every vertex infected at the start of
// the step passes the story to each susceptible neighbour with probability beta, then recovers
// (stops spreading) with probability gamma; vertices reached in a step spread from the next
// one. The run ends when nobody is spreading.
export const kernel: GraphKernel<SirResult> = {
  goal: 'sir',
  inputs: ['small-world', 'communities', 'geometric', 'random'],
  n: { min: 4, max: 400, value: 160 },
  params: [
    { kind: 'range', key: 'beta', label: 'Transmission beta', min: 0.05, max: 1, step: 0.05, value: 0.35, rebuild: true },
    { kind: 'range', key: 'gamma', label: 'Recovery gamma', min: 0.05, max: 1, step: 0.05, value: 0.3, rebuild: true },
  ],
  pick: 's',
  endpoints: 's',
  names: { frontier: 'Spreading (I)', done: 'Recovered (R)', tree: 'Transmissions' },
  readouts: ['frontier', 'done', 'maxFrontier', 'rounds', 'scans'],
  chart: { title: 'Susceptible, spreading, recovered', x: 'rounds', y: 'vertices', series: ['unseen', 'frontier', 'done'] },
  speed: 12,
  *steps(ops, { s, p }) {
    const g = ops.g;
    const beta = Number(p.beta); const gamma = Number(p.gamma);
    const state = new Array<number>(g.n).fill(0);
    const infected = new Array<number>(g.n).fill(-1);
    const recovered = new Array<number>(g.n).fill(-1);
    state[s] = 1; infected[s] = 0;
    ops.discover(s);
    let active = [s];
    let step = 0;
    while (active.length && step < 10000) {
      step++;
      const fresh: number[] = [];
      for (const u of active) {
        for (const e of g.out[u]) {
          ops.scan(e);
          const v = other(g, e, u);
          if (state[v] !== 0 || ops.rnd() >= beta) continue;
          state[v] = 1; infected[v] = step;
          ops.edge(e, E.tree);
          fresh.push(v);
        }
      }
      const still: number[] = [];
      for (const u of active) {
        if (ops.rnd() < gamma) { state[u] = 2; recovered[u] = step; ops.settle(u); } else still.push(u);
        yield;
      }
      for (const v of fresh) ops.discover(v);
      active = [...still, ...fresh];
      ops.round();
      yield;
    }
    return { infected, recovered, steps: step };
  },
  report(r, g) {
    const reached = r.infected.filter((x) => x >= 0).length;
    return [{ label: 'Final reach', value: `${reached} of ${g.n} (${((100 * reached) / g.n).toFixed(0)} %) after ${r.steps} steps` }];
  },
};
