import { S, type StringKernel } from '../../engines/string/trace';

const MAX_CODES = 4096;

// The dictionary starts with every single byte (codes 0-255). Extend the current phrase while
// phrase + next character is known; when it is not, emit the phrase's code, add phrase +
// character as the next code (until 12-bit codes run out) and restart from that character.
export const kernel: StringKernel<'text', number[]> = {
  input: 'text',
  shape: 'repetitive',
  counters: { lookup: 'Dictionary lookups', emit: 'Codes emitted' },
  chart: { title: 'Compressed size as the text is read', x: 'characters read', y: 'percent of the input bits' },
  run(ops, { text }) {
    ops.row('in', [...text], { label: 'Input' });
    ops.list('out', [], { label: 'Codes out', lines: 2 });
    ops.list('dict', [], { label: 'New phrases', lines: 3 });
    const dict = new Map<string, number>();
    for (let c = 0; c < 256; c++) dict.set(String.fromCharCode(c), c);
    const out: number[] = [];
    let bits = 0;
    const emit = (code: number, read: number) => {
      out.push(code);
      // variable width: as many bits as the largest code the decoder may see next
      bits += Math.max(9, Math.ceil(Math.log2(Math.min(MAX_CODES, dict.size + 1))));
      ops.tick('emit');
      ops.push('out', String(code), S.done);
      ops.plot('LZW output', read, (100 * bits) / (8 * Math.max(1, read)));
    };
    let w = '';
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const wc = w + c;
      ops.tick('lookup');
      ops.mark('in', i, S.focus);
      if (dict.has(wc)) { w = wc; ops.mark('in', i, S.hit); continue; }
      emit(dict.get(w) as number, i);
      if (dict.size < MAX_CODES) {
        dict.set(wc, dict.size);
        ops.push('dict', `${dict.size - 1}=${wc.replace(/ /g, '␣')}`, S.alt);
      }
      ops.note(`emit ${dict.get(w)} for '${w}', learn '${wc}'`);
      ops.clear('in');
      for (let k = start; k < i; k++) ops.mark('in', k, S.done);
      start = i;
      w = c;
      ops.mark('in', i, S.hit);
    }
    if (w) emit(dict.get(w) as number, text.length);
    ops.stat('Codes', String(out.length));
    ops.stat('Output / input', `${bits} / ${8 * text.length} bits`);
    return out;
  },
};
