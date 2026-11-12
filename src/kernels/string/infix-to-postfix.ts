import { S, type StringKernel } from '../../engines/string/trace';
import { isOp, PREC, RIGHT } from './_expr';

// Dijkstra's shunting yard: operands go straight to the output; an operator first pops every
// stacked operator that binds at least as tightly (strictly more tightly when it is right
// associative), then waits on the stack; parentheses fence off a sub-expression.
export const kernel: StringKernel<'expression', string[]> = {
  input: 'expression',
  counters: { stack: 'Stack pushes and pops', prec: 'Precedence comparisons' },
  run(ops, { infix }) {
    ops.row('in', infix, { label: 'Infix' });
    ops.list('stack', [], { label: 'Operator stack', lines: 1 });
    ops.list('out', [], { label: 'Postfix', lines: 2 });
    const stack: string[] = [];
    const out: string[] = [];
    const emit = (t: string) => { out.push(t); ops.push('out', t, S.done); };
    const pop = () => { ops.tick('stack'); ops.pop('stack'); return stack.pop() as string; };
    const push = (t: string) => { ops.tick('stack'); stack.push(t); ops.push('stack', t, S.alt); };
    infix.forEach((t, i) => {
      ops.clear('in');
      ops.mark('in', i, S.focus);
      if (/^\d+$/.test(t)) { emit(t); ops.note(`operand ${t} goes to the output`); } else if (t === '(') { push(t); ops.note('open a sub-expression'); } else if (t === ')') {
        while (stack.length && stack[stack.length - 1] !== '(') emit(pop());
        pop();
        ops.note('close: pop back to the matching parenthesis');
      } else if (isOp(t)) {
        for (;;) {
          const top = stack[stack.length - 1];
          if (top === undefined || top === '(') break;
          ops.tick('prec');
          const binds = PREC[top] > PREC[t] || (PREC[top] === PREC[t] && !RIGHT.has(t));
          if (!binds) break;
          ops.note(`${top} binds at least as tightly as ${t}: pop it`);
          emit(pop());
        }
        push(t);
      }
      ops.mark('in', i, S.done);
    });
    while (stack.length) emit(pop());
    ops.note('input read: pop what remains');
    ops.stat('Postfix', out.join(' '));
    return out;
  },
};
