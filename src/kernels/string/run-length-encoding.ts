import { S, type StringKernel } from '../../engines/string/trace';

// Read the text once; while the next symbol equals the current one the run grows, otherwise the
// run is emitted as (count, symbol) and a new run starts. A count is one byte by default, so a run
// longer than 255 is emitted in pieces (2^b − 1 for a count of b bits).
export const kernel: StringKernel<'text', [number, string][]> = {
  input: 'text',
  shape: 'runs',
  counters: { compare: 'Symbol comparisons', emit: 'Pairs emitted' },
  chart: { title: 'Bytes in and out', x: 'symbols read', y: 'bytes' },
  params: [
    // the scanline input's runs are 1 + ⌊Exp(mean)⌋ symbols (src/engines/string/inputs.ts)
    { kind: 'range', key: 'meanRun', label: 'Mean run', min: 1, max: 400, step: 1, value: 6, rebuild: true },
    {
      kind: 'select', key: 'countBits', label: 'Count width', value: '8', rebuild: true,
      options: [{ value: '8', label: '8 bits, runs up to 255' }, { value: '4', label: '4 bits, up to 15' },
        { value: '2', label: '2 bits, up to 3' }],
    },
  ],
  *run(ops, { text }, params) {
    const bits = Number(params.countBits ?? 8) || 8;
    const MAX_RUN = 2 ** bits - 1;
    // a pair is a count of `bits` and a symbol byte, the output rounded up to whole bytes
    const bytes = (pairs: number) => Math.ceil((pairs * (bits + 8)) / 8);
    ops.row('in', [...text], { label: 'Input' });
    ops.list('out', [], { label: 'Count × symbol', lines: 3 });
    const out: [number, string][] = [];
    const emit = (count: number, sym: string, end: number) => {
      out.push([count, sym]);
      ops.tick('emit');
      ops.push('out', `${count}×${sym === ' ' ? '␣' : sym}`, S.done);
      ops.plot('Input bytes', end, end);
      ops.plot('Output bytes', end, bytes(out.length));
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
    ops.stat('Output / input', text.length ? `${bytes(out.length)} / ${text.length} bytes (${((100 * bytes(out.length)) / text.length).toFixed(0)}%)` : '0');
    return out;
  },
};
