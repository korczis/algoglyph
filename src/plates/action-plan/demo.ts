import type { Action } from './plan';

/**
 * The plate's plan, a railway founded on borrowed money: borrow in presses of the loan step, buy
 * the land and build the line, stations and depot, buy the trains, run the line for some months,
 * then repay the loan in presses of the step. The numbers are the parameters', never a game's.
 */
export function demoPlan(p: { cash: number; step: number; trains: number; months: number }): { actions: Action[]; cash: number } {
  const borrow = Math.ceil(Math.max(0, 260_000 + p.trains * 45_000 - p.cash + 20_000) / p.step) * p.step;
  const income = p.trains * 9_000;
  const profit = p.months * income;
  const repay = Math.min(borrow, Math.floor((p.cash - 20_000 + borrow - 260_000 - p.trains * 45_000 + profit) / p.step) * p.step);
  const actions: Action[] = [
    { id: 'borrow', kind: 'borrow', label: `Borrow ${borrow / 1000}k`, amount: borrow, step: p.step, income: p.step, loan: p.step },
    { id: 'survey', kind: 'plan_route', label: 'Plan the line' },
    { id: 'track', kind: 'build_rail', label: 'Build the track', cost: 180_000, after: ['borrow', 'survey'] },
    { id: 'stations', kind: 'build_station', label: 'Two stations', repeat: 2, cost: 30_000, after: ['survey', 'borrow'] },
    { id: 'depot', kind: 'build_depot', label: 'Depot', cost: 20_000, after: ['track'] },
    { id: 'trains', kind: 'buy_vehicle', label: `${p.trains} trains`, repeat: p.trains, cost: 45_000, after: ['depot', 'stations'] },
    { id: 'run', kind: 'operate', label: `Run ${p.months} months`, repeat: p.months, income, after: ['trains'] },
  ];
  if (repay > 0) actions.push({ id: 'repay', kind: 'repay_loan', label: `Repay ${repay / 1000}k`, amount: repay, step: p.step, cost: p.step, loan: -p.step, after: ['run'] });
  return { actions, cash: p.cash };
}
