// Every exact count the foundations wing states in a bound (catalogue/entries/*.md, ADR 0006 §4),
// driven at several n and compared with what the plate or kernel counts. Asymptotic bounds
// (Θ, O, α(n)) are not checked here. Exact counts already proved elsewhere, so each has one test:
//   towers-of-hanoi 2ⁿ − 1 moves, ruler-drawing 2ⁿ⁺¹ − 1 calls and josephus-circle's
//   (N − 1)(M − 1) links: test/plates-custom.test.ts
//   fibonacci-memo 2F(n+1) − 1 naive and 2n − 1 memoised calls, matrix-chain's two reads per split
//   plus the traceback's one: test/kernels-grid.test.ts
import { describe, expect, it } from 'vitest';
import { input } from '../src/engines/string/inputs';
import { trace, type StringKernel } from '../src/engines/string/trace';
import { kernel as infixToPostfix } from '../src/kernels/string/infix-to-postfix';
import { josephus } from '../src/plates/josephus-circle/josephus';
import { heap, johnsonTrotter } from '../src/plates/permutation-generation/perm';
import { hanoi } from '../src/plates/towers-of-hanoi/hanoi';

const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));

describe('foundations: exact bounds against counted runs', () => {
  it('towers-of-hanoi: the moves come from n nested calls (space: recursion depth n)', () => {
    for (let n = 1; n <= 12; n++) {
      const moves = [...hanoi(n)];
      expect(moves.length).toBe(2 ** n - 1);
      // depth is 0 for the outermost call, so n nested levels reach depth n − 1
      expect(Math.max(...moves.map((m) => m.depth)) + 1).toBe(n);
    }
  });

  it('josephus-circle: (N − 1)(M − 1) links followed and N − 1 removals', () => {
    for (const n of [2, 5, 13, 41]) {
      for (const m of [1, 2, 3, 7]) {
        const r = josephus(n, m);
        expect(r.links).toBe((n - 1) * (m - 1));
        expect(r.order.length).toBe(n - 1);
      }
    }
  });

  it('infix-to-postfix: every operator and opening parenthesis is pushed once and popped once', () => {
    const k = infixToPostfix as unknown as StringKernel;
    for (const n of [3, 9, 25]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const x = input('expression', n, '', seed);
        const t = trace(k, x as never, {});
        expect(t.truncated).toBe(false);
        const stacked = x.infix.filter((tok) => tok === '(' || !/^\d+$|^\)$/.test(tok)).length;
        expect(t.counts[t.counters.indexOf('stack')]).toBe(2 * stacked);
      }
    }
  });

  for (const [name, gen] of [['Heap', heap], ['Johnson–Trotter', johnsonTrotter]] as const) {
    it(`permutation-generation (${name}): n! − 1 exchanges for the n! permutations`, () => {
      for (let n = 1; n <= 7; n++) {
        const steps = [...gen(n)];
        expect(steps.length).toBe(fact(n));
        // the first permutation is the input; every later one records the exchange that made it
        expect(steps.filter((s) => s.i >= 0 && s.j >= 0).length).toBe(fact(n) - 1);
      }
    });
  }
});
