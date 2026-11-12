import { S, type StringKernel } from '../../engines/string/trace';

const MAX_RUN = 255;

// Read the text once; while the next symbol equals the current one the run grows, otherwise the
// run is emitted as (count, symbol) and a new run starts. A count is one byte, so a run longer
// than 255 is emitted in pieces.
export const kernel: StringKernel<'text', [number, string][]> = {
  input: 'text',
  shape: 'runs',
  counters: { compare: 'Symbol comparisons', emit: 'Pairs emitted' },
  chart: { title: 'Bytes in and out', x: 'symbols read', y: 'bytes' },
  *run(ops, { text }) {
    ops.row('in', [...text], { label: 'Input' });
    ops.list('out', [], { label: 'Count × symbol', lines: 3 });
    const out: [number, string][] = [];
    const emit = (count: number, sym: string, end: number) => {
      out.push([count, sym]);
      ops.tick('emit');
      ops.push('out', `${count}×${sym === ' ' ? '␣' : sym}`, S.done);
      ops.plot('Input bytes', end, end);
      ops.plot('Output bytes', end, 2 * out.length);
    };
    let i = 0;
    while (i < text.length) {
      yield null;
      let j = i + 1;
      ops.mark('in', i, S.focus);
      while (j < text.length && j - i < MAX_RUN && ops.eq('compare', text[j], text[i])) { ops.mark('in', j, S.hit); j++; }
      if (j < text.length && j - i < MAX_RUN) ops.mark('in', j, S.miss);
      emit(j - i, text[i], j);
      ops.note(`run of ${j - i} × '${text[i]}'`);
      ops.clear('in');
      for (let k = i; k < j; k++) ops.mark('in', k, S.done);
      i = j;
    }
    ops.stat('Output / input', text.length ? `${(2 * out.length)} / ${text.length} bytes (${((200 * out.length) / text.length).toFixed(0)}%)` : '0');
    return out;
  },
};
