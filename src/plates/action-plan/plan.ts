// A plan before it runs: the actions it needs, with what each depends on, ordered by the
// collection's own Kahn's waves (src/kernels/graph/kahn-waves.ts, run on the graph engine, not a
// copy), each action expanded into the presses that carry it out (repay 50k with a 10k step is five
// presses of one action), and the cash and loan walked through every press so a plan that would
// overdraw or overborrow is refused before anything runs. Nothing here acts on a game: the plan is
// shown, then an executor runs its steps in order.
import { build } from '../../engines/graph/graph';
import { trace } from '../../engines/graph/trace';
import { kernel as waves, type WavesResult } from '../../kernels/graph/kahn-waves';

export interface Action {
  id: string;
  kind: string;
  label?: string;
  /** What one press costs, and what it brings in (game money). */
  cost?: number;
  income?: number;
  /** How a press changes the loan: positive borrows; negative repays min(loan, -loan) of it from cash, as the game does. */
  loan?: number;
  /** Presses: `repeat` times, or `amount` in presses of `step` (amount must be a whole number of steps). */
  repeat?: number;
  amount?: number;
  step?: number;
  after?: string[];
}

export interface Step {
  /** Position in the run, from 1. */
  n: number;
  action: string;
  kind: string;
  /** Which press of its action this is, from 1, of how many. */
  press: number;
  presses: number;
  wave: number;
  cash: number;
  loan: number;
}

export interface ActionPlan {
  ok: true;
  steps: Step[];
  waves: string[][];
  /** The DAG as drawn: one node per action with its wave, an edge per dependency. */
  graph: { nodes: { id: string; label: string; kind: string; wave: number; presses: number }[]; edges: { from: string; to: string }[] };
  final: { cash: number; loan: number };
  lowest: { cash: number; at: number };
}

export interface Limits { cash: number; loan?: number; maxLoan?: number; loanStep?: number }

/** The kinds that move the loan, and the sign of one press (repay lowers it, borrow raises it). */
const LOAN_KINDS: Record<string, -1 | 1> = { repay: -1, repay_loan: -1, borrow: 1, borrow_loan: 1 };

/**
 * A loan action with its effects filled in from its step (or the game's loan step): a repay press
 * lowers the loan and the cash, a borrow press raises both; anything the caller wrote stays.
 * Refused when a loan action has no step to go by, so it can never silently do nothing.
 */
export function withLoanEffects(a: Action, loanStep?: number): Action | string {
  const sign = LOAN_KINDS[a.kind];
  if (!sign) return a;
  const step = a.step ?? loanStep;
  if (step === undefined) {
    if (a.loan !== undefined) return a;
    return `${a.id}: a ${a.kind} action needs its step or the game's loan_step to know what one press moves`;
  }
  const out: Action = { ...a, step: a.step ?? step, loan: a.loan ?? sign * step };
  if (sign > 0) out.income ??= step;
  return out;
}

/** How many presses an action takes. */
export function presses(a: Action): number | string {
  if (a.amount !== undefined) {
    const step = a.step ?? a.amount;
    if (!(step > 0)) return `${a.id}: step must be positive`;
    const n = a.amount / step;
    if (!Number.isInteger(n) || n < 1) return `${a.id}: amount ${a.amount} is not a whole number of steps of ${step}`;
    return n;
  }
  const n = a.repeat ?? 1;
  return Number.isInteger(n) && n >= 1 ? n : `${a.id}: repeat must be a positive integer`;
}

/**
 * Order, expand and walk a plan. Refused (a string naming why) when an id repeats or a dependency
 * names nothing, when the dependencies hold a cycle (the actions on it named), or when a press
 * would take cash below zero or the loan outside [0, maxLoan].
 */
export function schedule(actions: Action[], lim: Limits): ActionPlan | string {
  const index = new Map<string, number>();
  for (const [i, a] of actions.entries()) {
    if (index.has(a.id)) return `action id ${a.id} appears twice`;
    index.set(a.id, i);
  }
  const edges: [number, number, number][] = [];
  for (const [i, a] of actions.entries()) {
    for (const d of a.after ?? []) {
      const j = index.get(d);
      if (j === undefined) return `${a.id} comes after ${d}, which is not an action of the plan`;
      edges.push([j, i, 1]);
    }
  }
  const n = actions.length;
  const g = build('dag', actions.map((_, i) => i), actions.map(() => 0), edges, true);
  const t = trace(waves, g, { s: 0, t: Math.max(0, n - 1), p: {} }, 1, Infinity, false);
  const res = t.result as WavesResult;
  if (res.order.length < n) {
    const stuck = actions.filter((_, i) => res.wave[i] < 0).map((a) => a.id);
    return `the dependencies hold a cycle: ${stuck.join(', ')} each wait for one another`;
  }
  for (const [i, a] of actions.entries()) {
    const filled = withLoanEffects(a, lim.loanStep);
    if (typeof filled === 'string') return filled;
    actions[i] = filled;
  }
  const counts: number[] = [];
  for (const a of actions) {
    const p = presses(a);
    if (typeof p === 'string') return p;
    counts.push(p);
  }
  // within a wave, the order the plan lists its actions in: deterministic and the author's
  const byWave: number[][] = [];
  for (let i = 0; i < n; i++) (byWave[res.wave[i]] ??= []).push(i);
  let cash = lim.cash;
  let loan = lim.loan ?? 0;
  let lowest = { cash, at: 0 };
  const steps: Step[] = [];
  for (const [w, ids] of byWave.entries()) {
    for (const i of ids ?? []) {
      const a = actions[i];
      for (let k = 1; k <= counts[i]; k++) {
        const at = steps.length + 1;
        if ((a.loan ?? 0) < 0) {
          // a repayment as the game makes it: one press repays min(loan, step), from cash, and a
          // press with nothing owed is refused (the game answers "loan already repaid")
          if (loan <= 0) return `press ${k} of ${a.id} (step ${at}) would repay a loan already repaid`;
          const pay = Math.min(loan, -(a.loan as number));
          cash += (a.income ?? 0) - (a.cost === undefined ? pay : Math.min(a.cost, pay));
          loan -= pay;
        } else {
          cash += (a.income ?? 0) - (a.cost ?? 0);
          loan += a.loan ?? 0;
        }
        if (cash < 0) return `press ${k} of ${a.id} (step ${at}) would leave cash at ${cash}: the plan overdraws`;
        if (lim.maxLoan !== undefined && loan > lim.maxLoan) return `press ${k} of ${a.id} (step ${at}) would borrow beyond the limit ${lim.maxLoan} (loan ${loan})`;
        if (cash < lowest.cash) lowest = { cash, at };
        steps.push({ n: at, action: a.id, kind: a.kind, press: k, presses: counts[i], wave: w, cash, loan });
      }
    }
  }
  return {
    ok: true,
    steps,
    waves: byWave.map((ids) => (ids ?? []).map((i) => actions[i].id)),
    graph: {
      nodes: actions.map((a, i) => ({ id: a.id, label: a.label ?? a.id, kind: a.kind, wave: res.wave[i], presses: counts[i] })),
      edges: edges.map(([u, v]) => ({ from: actions[u].id, to: actions[v].id })),
    },
    final: { cash, loan },
    lowest,
  };
}
