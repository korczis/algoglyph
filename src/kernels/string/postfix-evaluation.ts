import { S, type StringKernel } from '../../engines/string/trace';
import { apply, isOp } from './_expr';

// Read left to right: push each operand; an operator pops its right then its left operand and
// pushes the result. A well-formed expression leaves exactly one value.
export const kernel: StringKernel<'expression', number> = {
  input: 'expression',
  counters: { stack: 'Stack pushes and pops', arith: 'Arithmetic operations' },
  chart: { title: 'Stack depth', x: 'token', y: 'values on the stack' },
  run(ops, { postfix }) {
    ops.row('in', postfix, { label: 'Postfix' });
    ops.list('stack', [], { label: 'Value stack', lines: 2 });
    const st: number[] = [];
    postfix.forEach((t, i) => {
      ops.clear('in');
      ops.mark('in', i, S.focus);
      if (isOp(t)) {
        const b = st.pop() as number; ops.tick('stack'); ops.pop('stack');
        const a = st.pop() as number; ops.tick('stack'); ops.pop('stack');
        const v = apply(t, a, b);
        ops.tick('arith');
        st.push(v); ops.tick('stack'); ops.push('stack', String(v), S.hit);
        ops.note(`${a} ${t} ${b} = ${v}`);
      } else {
        st.push(Number(t)); ops.tick('stack'); ops.push('stack', t);
      }
      ops.mark('in', i, S.done);
      ops.plot('Stack depth', i + 1, st.length);
    });
    if (st.length !== 1) throw new Error(`malformed postfix: ${st.length} values left`);
    ops.stat('Value', String(st[0]));
    return st[0];
  },
};
