// action-plan (src/plates/action-plan) against references outside its code: every dependency must
// run before what waits on it in the step list, checked edge by edge; the cash and loan after each
// step are re-added from the actions; random DAGs agree with a brute-force longest-chain wave count;
// and the owner's example — repay 50k as five presses of 10k — is one plan of five steps.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { data } from '../src/plates/action-plan/data';
import { schedule, type Action } from '../src/plates/action-plan/plan';
import { demoPlan } from '../src/plates/action-plan/demo';

/** Re-walk a schedule from its actions: order respects every edge, and cash and loan add up. */
function check(actions: Action[], cash0: number, loan0: number, r: Exclude<ReturnType<typeof schedule>, string>) {
  const first = new Map<string, number>(); const last = new Map<string, number>();
  for (const s of r.steps) { if (!first.has(s.action)) first.set(s.action, s.n); last.set(s.action, s.n); }
  for (const a of actions) for (const d of a.after ?? []) expect(last.get(d)!, `${d} before ${a.id}`).toBeLessThan(first.get(a.id)!);
  let cash = cash0; let loan = loan0;
  const byId = new Map(actions.map((a) => [a.id, a]));
  for (const s of r.steps) {
    const a = byId.get(s.action)!;
    cash += (a.income ?? 0) - (a.cost ?? 0); loan += a.loan ?? 0;
    expect([s.cash, s.loan]).toEqual([cash, loan]);
  }
  expect(r.final).toEqual({ cash, loan });
}

describe('action-plan: the owner\'s example and the refusals', () => {
  it('repays 50k as one plan of five presses of 10k, the loan and cash after each', () => {
    const actions: Action[] = [{ id: 'repay', kind: 'repay_loan', amount: 50_000, step: 10_000, cost: 10_000, loan: -10_000 }];
    const r = schedule(actions, { cash: 80_000, loan: 50_000 });
    if (typeof r === 'string') throw new Error(r);
    expect(r.steps.map((s) => [s.press, s.presses, s.cash, s.loan])).toEqual([
      [1, 5, 70_000, 40_000], [2, 5, 60_000, 30_000], [3, 5, 50_000, 20_000], [4, 5, 40_000, 10_000], [5, 5, 30_000, 0],
    ]);
    check(actions, 80_000, 50_000, r);
  });

  it('refuses a plan that overdraws, overrepays, overborrows, or waits on itself', () => {
    expect(schedule([{ id: 'r', kind: 'repay_loan', amount: 50_000, step: 10_000, cost: 10_000, loan: -10_000 }], { cash: 30_000, loan: 50_000 })).toMatch(/press 4 of r .* overdraws/);
    expect(schedule([{ id: 'r', kind: 'repay_loan', repeat: 2, loan: -10_000 }], { cash: 90_000, loan: 10_000 })).toMatch(/press 2 of r .* already repaid/);
    expect(schedule([{ id: 'b', kind: 'borrow', repeat: 3, income: 10_000, loan: 10_000 }], { cash: 0, loan: 0, maxLoan: 20_000 })).toMatch(/beyond the limit 20000/);
    expect(schedule([{ id: 'a', kind: 'x', after: ['b'] }, { id: 'b', kind: 'x', after: ['a'] }, { id: 'c', kind: 'x' }], { cash: 0 })).toMatch(/cycle: a, b/);
    expect(schedule([{ id: 'a', kind: 'x', after: ['ghost'] }], { cash: 0 })).toMatch(/ghost/);
    expect(schedule([{ id: 'a', kind: 'x' }, { id: 'a', kind: 'y' }], { cash: 0 })).toMatch(/twice/);
    expect(schedule([{ id: 'a', kind: 'x', amount: 25_000, step: 10_000 }], { cash: 0 })).toMatch(/whole number of steps/);
  });

  it('moves cash and loan for a repay or borrow given only its amount and step (openttd-80\'s case)', () => {
    const r = schedule([{ id: 'repay', kind: 'repay', amount: 50_000, step: 10_000 }], { cash: 120_000, loan: 300_000 });
    if (typeof r === 'string') throw new Error(r);
    expect(r.steps.map((s) => [s.cash, s.loan])).toEqual([[110_000, 290_000], [100_000, 280_000], [90_000, 270_000], [80_000, 260_000], [70_000, 250_000]]);
    const chain = schedule([
      { id: 'borrow', kind: 'borrow', amount: 20_000, step: 10_000 },
      { id: 'build', kind: 'build_rail', cost: 25_000, after: ['borrow'] },
      { id: 'repay', kind: 'repay', amount: 10_000, after: ['build'] },
    ], { cash: 30_000, loan: 0, loanStep: 10_000 });
    if (typeof chain === 'string') throw new Error(chain);
    expect(chain.final).toEqual({ cash: 15_000, loan: 10_000 });
    expect(schedule([{ id: 'r', kind: 'repay', amount: 50_000 }], { cash: 1e6, loan: 1e6 })).toMatch(/needs its step or the game's loan_step/);
  });

  it('repays as the game does: a press takes min(loan, step) from cash', () => {
    const r = schedule([{ id: 'r', kind: 'repay_loan', repeat: 2, loan: -10_000 }], { cash: 50_000, loan: 15_000 });
    if (typeof r === 'string') throw new Error(r);
    expect(r.steps.map((s) => [s.cash, s.loan])).toEqual([[40_000, 5_000], [35_000, 0]]);
  });

  it('borrows before it builds when the build needs the money, because the plan says so', () => {
    const actions: Action[] = [
      { id: 'build', kind: 'build_rail', cost: 90_000, after: ['borrow'] },
      { id: 'borrow', kind: 'borrow', amount: 60_000, step: 10_000, income: 10_000, loan: 10_000 },
      { id: 'trains', kind: 'buy_vehicle', repeat: 2, cost: 20_000, after: ['build'] },
    ];
    const r = schedule(actions, { cash: 80_000, loan: 0, maxLoan: 300_000 });
    if (typeof r === 'string') throw new Error(r);
    expect(r.waves).toEqual([['borrow'], ['build'], ['trains']]);
    expect(r.final).toEqual({ cash: 10_000, loan: 60_000 });
    expect(r.lowest).toEqual({ cash: 10_000, at: 9 });
    check(actions, 80_000, 0, r);
  });
});

describe('action-plan: the plate\'s plan, the one its claims read', () => {
  it('borrows, builds, runs and repays: 84 presses in 6 waves, ending with nothing owed', () => {
    const d = demoPlan({ cash: 100_000, step: 10_000, trains: 3, months: 12 });
    const r = schedule(d.actions, { cash: d.cash, loan: 0, maxLoan: 500_000 });
    if (typeof r === 'string') throw new Error(r);
    expect(r.steps.length).toBe(84);
    expect(r.waves.length).toBe(6);
    expect(r.final.loan).toBe(0);
    check(d.actions, d.cash, 0, r);
  });
});

describe('action-plan: waves on random DAGs', () => {
  it('puts each action in the wave of its longest chain of dependencies, counted by brute force', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rnd = mulberry32(seed);
      const n = 2 + Math.floor(rnd() * 25);
      const actions: Action[] = Array.from({ length: n }, (_, i) => ({ id: `a${i}`, kind: 'k', after: [] as string[] }));
      // edges only from lower to higher index: a DAG by construction
      for (let v = 1; v < n; v++) for (let u = 0; u < v; u++) if (rnd() < 0.15) actions[v].after!.push(`a${u}`);
      const r = schedule(actions, { cash: 0 });
      if (typeof r === 'string') throw new Error(r);
      const depth = (i: number): number => Math.max(0, ...actions[i].after!.map((d) => depth(Number(d.slice(1))) + 1));
      for (const node of r.graph.nodes) expect(node.wave, `seed ${seed} ${node.id}`).toBe(depth(Number(node.id.slice(1))));
      check(actions, 0, 0, r);
    }
  });
});

describe('action-plan: the data form', () => {
  it('answers the steps and the DAG to draw, and refuses a malformed plan with the field named', () => {
    const r = data.solve({ actions: [{ id: 'repay', kind: 'repay_loan', amount: 50000, step: 10000, cost: 10000, loan: -10000 }], cash: 80000, loan: 50000 });
    if (typeof r === 'string') throw new Error(r);
    expect((r.steps as unknown[]).length).toBe(5);
    expect(r.graph).toMatchObject({ nodes: [{ id: 'repay', presses: 5, wave: 0 }], edges: [] });
    // the game's loan step fills a loan action's step and its cash and loan effects
    const filled = data.solve({ actions: [{ id: 'repay', kind: 'repay_loan', amount: 50000 }], cash: 80000, loan: 50000, loan_step: 10000 });
    if (typeof filled === 'string') throw new Error(filled);
    expect((filled.steps as { cash: number; loan: number }[]).map((x) => x.loan)).toEqual([40000, 30000, 20000, 10000, 0]);
    expect(data.solve({ actions: [{ id: 'a', kind: 'x' }], cash: 0, loan_step: 0 })).toMatch(/loan_step/);
    // an action's own arguments ride on every one of its steps, for the executor
    const withArgs = data.solve({ actions: [{ id: 'serve', kind: 'serve_towns', params: { a: 3, b: 7 } }, { id: 'look', kind: 'watch', repeat: 2, params: { seconds: 20 }, after: ['serve'] }], cash: 0 });
    if (typeof withArgs === 'string') throw new Error(withArgs);
    expect((withArgs.steps as { kind: string; params?: unknown }[]).map((x) => [x.kind, x.params])).toEqual([['serve_towns', { a: 3, b: 7 }], ['watch', { seconds: 20 }], ['watch', { seconds: 20 }]]);
    expect(data.solve({ actions: [{ id: 'a', kind: 'x', params: 3 }], cash: 0 })).toMatch(/params must be an object/);
    expect(data.solve({ actions: [], cash: 0 })).toMatch(/actions must list/);
    expect(data.solve({ actions: [{ id: 'a' }], cash: 0 })).toMatch(/actions\[0\].kind/);
    expect(data.solve({ actions: [{ id: 'a', kind: 'x', repeat: 2, amount: 4 }], cash: 0 })).toMatch(/repeat or amount/);
    expect(data.solve({ actions: [{ id: 'a', kind: 'x', when: 'now' }], cash: 0 })).toMatch(/unknown field when/);
    expect(data.solve({ actions: [{ id: 'a', kind: 'x', repeat: 30000 }], cash: 0 })).toMatch(/presses/);
  });
});
