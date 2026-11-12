import type { GraphKernel } from '../../engines/graph/trace';

export interface OwnershipResult { eff: number[]; rounds: number }

// The target owns all of itself; everyone else owns, through each holding, the share held times
// what the held company owns of the target: e(v) = sum over v -> u of share(v, u) * e(u), with
// e(target) = 1. That sums the product of shares over every ownership path into the target,
// cross-holdings included (the cycles repeat with ever smaller products). Iterated from zero
// until no value moves by 1e-12; it converges because nobody holds more than 95 % of a company.
export const kernel: GraphKernel<OwnershipResult> = {
  goal: 'ownership',
  inputs: ['ownership'],
  n: { min: 4, max: 200, value: 50 },
  pick: 't',
  endpoints: 't',
  view: { colour: 'value', size: true },
  names: { value: 'Effective share' },
  readouts: ['rounds', 'scans', 'values', 'change'],
  chart: { title: 'Change per round', x: 'rounds', y: 'total change', series: ['change'], log: true },
  *steps(ops, { t }) {
    const g = ops.g;
    let e = new Array<number>(g.n).fill(0);
    e[t] = 1;
    for (let v = 0; v < g.n; v++) ops.value(v, e[v]);
    let rounds = 0;
    for (; rounds < 5000; rounds++) {
      const next = new Array<number>(g.n).fill(0);
      next[t] = 1;
      let moved = 0;
      for (let v = 0; v < g.n; v++) {
        if (v === t) continue;
        for (const f of g.out[v]) { ops.scan(f); next[v] += g.w[f] * e[g.ev[f]]; }
        if (next[v] !== e[v]) { moved = Math.max(moved, Math.abs(next[v] - e[v])); ops.value(v, next[v]); }
      }
      e = next;
      ops.round();
      yield;
      if (moved < 1e-12) break;
    }
    return { eff: e, rounds };
  },
  report(r, _g, { t }) {
    let top = -1;
    for (let v = 0; v < r.eff.length; v++) if (v !== t && (top < 0 || r.eff[v] > r.eff[top])) top = v;
    return [{ label: 'Largest effective owner', value: top < 0 ? 'none' : `vertex ${top}: ${(100 * r.eff[top]).toFixed(1)} % of vertex ${t}` }];
  },
};
