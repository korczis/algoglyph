// A plan on a caller's actions (src/core/solve.ts): the form an executor sends before it acts, and
// the answer it runs — the steps in order with the cash and loan after each, the waves, and the DAG
// ready to draw — or a refusal that names the action and the press that breaks the plan.
import { finite, integer, record, unknownKeys, type DataForm } from '../../core/solve';
import { schedule, type Action } from './plan';

/** The most actions and presses a plan may hold. */
export const LIMITS = { actions: 2000, presses: 20_000 };

export const data: DataForm = {
  input: '{actions: [{id, kind, label?, cost?, income?, loan?, repeat? | amount?+step?, after?: [ids]}], cash, loan?, max_loan?, loan_step? (openttd://companies loan_step: fills step, cost, income and loan of repay_loan and borrow)}',
  solve(raw) {
    if (!record(raw)) return 'the input must be an object {actions, cash, loan?, max_loan?}';
    const extra = unknownKeys(raw, ['actions', 'cash', 'loan', 'max_loan', 'loan_step']);
    if (raw.loan_step !== undefined && !(finite(raw.loan_step) && raw.loan_step > 0)) return 'loan_step must be a positive amount (openttd://companies loan_step)';
    if (extra) return extra;
    if (!Array.isArray(raw.actions) || !raw.actions.length || raw.actions.length > LIMITS.actions) return `actions must list 1 to ${LIMITS.actions} actions`;
    if (!finite(raw.cash)) return 'cash must be a number (the money in hand before the first step)';
    if (raw.loan !== undefined && !(finite(raw.loan) && raw.loan >= 0)) return 'loan must be a non-negative number';
    if (raw.max_loan !== undefined && !(finite(raw.max_loan) && raw.max_loan >= 0)) return 'max_loan must be a non-negative number';
    const actions: Action[] = [];
    let total = 0;
    for (const [i, a] of raw.actions.entries()) {
      if (!record(a)) return `actions[${i}] must be an object`;
      const bad = unknownKeys(a, ['id', 'kind', 'label', 'cost', 'income', 'loan', 'repeat', 'amount', 'step', 'after']);
      if (bad) return `actions[${i}]: ${bad}`;
      if (typeof a.id !== 'string' || !a.id) return `actions[${i}].id must be a non-empty string`;
      if (typeof a.kind !== 'string' || !a.kind) return `actions[${i}].kind must be a non-empty string`;
      for (const k of ['cost', 'income', 'loan', 'amount', 'step'] as const) if (a[k] !== undefined && !finite(a[k])) return `actions[${i}].${k} must be a number`;
      if (a.repeat !== undefined && !(integer(a.repeat) && a.repeat >= 1)) return `actions[${i}].repeat must be a positive integer`;
      if (a.repeat !== undefined && a.amount !== undefined) return `actions[${i}]: give repeat or amount, not both`;
      if (a.after !== undefined && !(Array.isArray(a.after) && a.after.every((d) => typeof d === 'string'))) return `actions[${i}].after must list action ids`;
      const presses = a.amount !== undefined ? (a.amount as number) / ((a.step as number | undefined) ?? (a.amount as number)) : ((a.repeat as number | undefined) ?? 1);
      total += Number.isFinite(presses) ? presses : 0;
      if (total > LIMITS.presses) return `the plan would take more than ${LIMITS.presses} presses`;
      // the game's loan actions, filled from its loan step where the caller left them out
      const act = { ...a } as unknown as Action;
      if (raw.loan_step !== undefined && (act.kind === 'repay_loan' || act.kind === 'borrow')) {
        const step = raw.loan_step as number;
        act.step ??= step;
        if (act.kind === 'repay_loan') act.loan ??= -step; else { act.loan ??= step; act.income ??= step; }
      }
      actions.push(act);
    }
    const r = schedule(actions, { cash: raw.cash, loan: raw.loan as number | undefined, maxLoan: raw.max_loan as number | undefined });
    return typeof r === 'string' ? r : { ...r };
  },
};
