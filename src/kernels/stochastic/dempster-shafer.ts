import { num } from '../../core/plate';
import { fmt, Sampler } from '../../engines/stochastic/sample';
import type { StochasticKernel } from '../../engines/stochastic/trace';

/** A mass function on the subsets of three hypotheses, indexed by bit mask (bit i = H(i+1));
 * mass[0], the empty set, stays 0 and mass[7] is the whole frame. */
export type Mass = number[];

export const NAMES = ['H1', 'H2', 'H3'];
const FULL = 7;

export function setName(mask: number): string {
  if (mask === FULL) return 'Θ';
  return `{${NAMES.filter((_, i) => mask & (1 << i)).join(',')}}`;
}

/** Dempster's rule: products of masses go to the intersection; the mass on empty
 * intersections is the conflict K, and the rest is renormalised by 1 - K. Under total conflict
 * (K = 1) the rule is undefined and the mass is null. */
export function combine(a: Mass, b: Mass): { mass: Mass | null; conflict: number } {
  const out = new Array<number>(8).fill(0);
  let conflict = 0;
  for (let x = 1; x <= FULL; x++) {
    for (let y = 1; y <= FULL; y++) {
      const w = a[x] * b[y];
      if (!w) continue;
      const z = x & y;
      if (z) out[z] += w;
      else conflict += w;
    }
  }
  // 1 - K, summed from the products that landed rather than subtracted from 1, so that a run of
  // near-total conflicts does not drift the combined mass away from summing to 1
  const kept = out.reduce((a, b) => a + b, 0);
  if (!kept || conflict >= 1 - 1e-12) return { mass: null, conflict };
  return { mass: out.map((v) => v / kept), conflict };
}

/** Belief: the mass of every subset of x. */
export function belief(m: Mass, x: number): number {
  let s = 0;
  for (let y = 1; y <= FULL; y++) if ((y & x) === y) s += m[y];
  return s;
}

/** Plausibility: the mass of every set that meets x. */
export function plausibility(m: Mass, x: number): number {
  let s = 0;
  for (let y = 1; y <= FULL; y++) if (y & x) s += m[y];
  return s;
}

export interface DempsterResult {
  sources: Mass[];
  /** The combination of every source, or null when one step met total conflict. */
  combined: Mass | null;
  conflicts: number[];
  /** Index of the source whose combination was undefined, or -1. */
  undefinedAt: number;
}

const HOLD = 30;
const SHOWN = [1, 2, 4, 3, 5, 6];

// Each synthetic source commits mass to two or three sets of hypotheses and keeps the rest on
// the whole frame (what it does not know), none when the least mass on Θ is 0. Sources are
// combined one at a time; belief is what the evidence forces, plausibility what it still allows.
export const kernel: StochasticKernel<DempsterResult> = {
  palette: 'spectral',
  params: [
    { kind: 'range', key: 'sources', label: 'Sources', min: 2, max: 10, step: 1, value: 5, rebuild: true },
    { kind: 'range', key: 'ignorance', label: 'Least mass on Θ per source', min: 0, max: 0.8, step: 0.05, value: 0.2, rebuild: true },
  ],
  chart: { title: 'Belief and plausibility of H1', x: { label: 'sources combined' }, y: { label: 'value' } },
  *run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const k = num(cfg, 'sources');
    const ign = num(cfg, 'ignorance');
    const sources: Mass[] = [];
    for (let j = 0; j < k; j++) {
      const m = new Array<number>(8).fill(0);
      const focal = 2 + s.int(2);
      const weights = Array.from({ length: focal }, () => s.gamma(1));
      const total = weights.reduce((a, b) => a + b, 0);
      // at a least mass of 0 a source commits everything, so two of them can be in total conflict
      const rest = ign && ign + (1 - ign) * 0.3 * s.uniform();
      weights.forEach((w) => { m[1 + s.int(6)] += (1 - rest) * (w / total); });
      m[FULL] += rest;
      sources.push(m);
    }
    let combined = sources[0].slice();
    const conflicts: number[] = [];
    const show = (j: number, conflict: number) => {
      ops.point('Bel(H1)', j + 1, belief(combined, 1));
      ops.point('Pl(H1)', j + 1, plausibility(combined, 1));
      if (j > 0) ops.point('conflict K', j + 1, conflict);
      const lead = [1, 2, 4].reduce((a, b) => (belief(combined, b) > belief(combined, a) ? b : a));
      const panels = [
        {
          kind: 'bars' as const, title: `Belief to plausibility, ${fmt(j + 1)} source${j ? 's' : ''} combined`, x: [0, 1] as [number, number],
          rows: SHOWN.map((x, i) => ({ label: setName(x), lo: belief(combined, x), hi: plausibility(combined, x), tone: 0.1 + 0.8 * (i / 5), mark: combined[x] })),
        },
        {
          kind: 'bars' as const, title: `Masses of source ${fmt(j + 1)}`, x: [0, 1] as [number, number],
          rows: [...SHOWN, FULL].map((x) => ({ label: setName(x), lo: 0, hi: sources[j][x], tone: 0.55 })),
        },
      ];
      const stats = [
        { label: 'Sources combined', value: `${fmt(j + 1)} of ${fmt(k)}` },
        { label: 'Conflict K of the last combination', value: j ? fmt(conflict, 4) : '—' },
        { label: `Leading hypothesis ${setName(lead)}`, value: `Bel ${fmt(belief(combined, lead), 3)}, Pl ${fmt(plausibility(combined, lead), 3)}` },
        { label: 'Mass left on Θ', value: fmt(combined[FULL], 4) },
      ];
      for (let h = 0; h < HOLD; h++) ops.frame(panels, stats);
    };
    show(0, 0);
    yield;
    let undefinedAt = -1;
    for (let j = 1; j < k; j++) {
      const r = combine(combined, sources[j]);
      ops.count(49);
      conflicts.push(r.conflict);
      if (!r.mass) {
        // total conflict: nothing is left to renormalise, so the rule says nothing
        undefinedAt = j;
        const stats = [
          { label: 'Sources combined', value: `${fmt(j)} of ${fmt(k)}; source ${fmt(j + 1)} could not be` },
          { label: 'Conflict K of the last combination', value: `${fmt(r.conflict, 4)}: total conflict` },
          { label: 'Combination', value: "undefined: Dempster's rule cannot renormalise by 1 − K = 0" },
        ];
        const panels = [{
          kind: 'bars' as const, title: `Masses of source ${fmt(j + 1)}, in total conflict with the rest`, x: [0, 1] as [number, number],
          rows: [...SHOWN, FULL].map((x) => ({ label: setName(x), lo: 0, hi: sources[j][x], tone: 0.05 })),
        }];
        for (let h = 0; h < HOLD; h++) ops.frame(panels, stats);
        break;
      }
      combined = r.mass;
      show(j, r.conflict);
      yield;
    }
    return { sources, combined: undefinedAt < 0 ? combined : null, conflicts, undefinedAt };
  },
};
