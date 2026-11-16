// The ownership input's cross-holdings, a control of the plates whose answer they decide
// (effective ownership, ownership cycles, the layered drawing): the engine asks for
// max(1, round(n · crossHoldings / 12)) of them (graph.ts GraphInput), none at 0.
import type { RangeParam } from '../../core/plate';
import { CROSS_HOLDINGS } from '../../engines/graph/graph';

// From 0, where no company holds one of its owners and the input is a DAG (a meaning end: no
// cycle to find, none to break, and effective ownership stops after the longest chain), to 12,
// one cross-holding for every company (a meaning end: there 87 % of the companies already sit
// on a cycle at n 50 and 200, measured over 7 seeds, and an input below 50 companies has run out
// of places for more, n 40 placing at most 19 of the 40 asked; more adds edges, not structure).
// The budget does not end it: at 12 and each plate's largest n the worst frame took 4-10 ms of
// a 31-34 ms budget and effective ownership at most 72,102 of the 600,000 events (31 seeds)
export const CROSS_HOLDINGS_PARAM: RangeParam = {
  kind: 'range', key: 'crossHoldings', label: 'Cross-holdings per 12 companies', min: 0, max: 12,
  step: 1, value: CROSS_HOLDINGS, rebuild: true,
  hint: 'How many companies hold a stake in one of their own owners, per 12; at 0 ownership has no cycle.',
};

/** The same control on a plate with other inputs: shown on the ownership input only. */
export const CROSS_HOLDINGS_ON_OWNERSHIP: RangeParam = {
  ...CROSS_HOLDINGS_PARAM, when: { key: 'shape', values: ['ownership'] },
};
