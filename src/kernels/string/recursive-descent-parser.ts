import { S, type StringKernel, type StringOps } from '../../engines/string/trace';
import { apply } from './_expr';

// One procedure per rule of the grammar
//   expr    → term (('+' | '-') term)*
//   term    → factor ('*' factor)*
//   factor  → primary ('^' factor)?
//   primary → number | '(' expr ')'
// Repetition makes + - * left associative, the recursion in factor makes ^ right associative,
// and the depth of the call stack follows the depth of the parse tree.
export const kernel: StringKernel<'expression', { value: number; postfix: string[] }> = {
  input: 'expression',
  counters: { call: 'Procedure calls', token: 'Tokens consumed' },
  chart: { title: 'Call depth while parsing', x: 'procedure call', y: 'depth' },
  run(ops: StringOps, { infix }) {
    ops.row('in', infix, { label: 'Tokens' });
    ops.list('calls', [], { label: 'Call stack', lines: 2 });
    ops.list('out', [], { label: 'Postfix emitted', lines: 1 });
    let at = 0;
    let depth = 0;
    const postfix: string[] = [];
    const peek = () => infix[at];
    const take = (want?: string) => {
      const t = infix[at];
      if (t === undefined || (want !== undefined && t !== want)) throw new Error(`expected ${want ?? 'a token'} at ${at}`);
      ops.tick('token');
      ops.mark('in', at, S.done);
      at++;
      if (at < infix.length) ops.mark('in', at, S.focus);
      return t;
    };
    const emit = (t: string) => { postfix.push(t); ops.push('out', t, S.done); };
    const call = <T>(rule: string, body: () => T): T => {
      ops.tick('call');
      depth++;
      ops.push('calls', rule, S.alt);
      ops.plot('Call depth', ops.count('call'), depth);
      ops.note(`${rule} at token ${at}`);
      const v = body();
      ops.pop('calls');
      depth--;
      return v;
    };
    const expr = (): number => call('expr', () => {
      let v = term();
      while (peek() === '+' || peek() === '-') { const op = take(); const r = term(); v = apply(op, v, r); emit(op); }
      return v;
    });
    const term = (): number => call('term', () => {
      let v = factor();
      while (peek() === '*') { take(); const r = factor(); v = apply('*', v, r); emit('*'); }
      return v;
    });
    const factor = (): number => call('factor', () => {
      const b = primary();
      if (peek() !== '^') return b;
      take();
      const e = factor();
      emit('^');
      return apply('^', b, e);
    });
    const primary = (): number => call('primary', () => {
      if (peek() === '(') { take('('); const v = expr(); take(')'); return v; }
      const t = take();
      if (!/^\d+$/.test(t)) throw new Error(`expected a number at ${at - 1}`);
      emit(t);
      return Number(t);
    });
    ops.mark('in', 0, S.focus);
    const value = expr();
    if (at !== infix.length) throw new Error(`trailing input at ${at}`);
    ops.note('parsed: the call stack is empty again');
    ops.stat('Value', String(value));
    return { value, postfix };
  },
};
