import { S, type StringKernel } from '../../engines/string/trace';

const SEP = '\u0000';

// Start from single characters. Count every adjacent pair of tokens; the most frequent pair
// (the first to occur on a tie) becomes a new token and replaces its occurrences left to right.
// Repeat until the merge budget is spent or no pair occurs twice.
export const kernel: StringKernel<'text', { merges: [string, string][]; tokens: string[] }> = {
  input: 'text',
  shape: 'prose',
  size: 96,
  counters: { count: 'Pairs counted', merge: 'Replacements' },
  chart: { title: 'Tokens left after each merge', x: 'merges learned', y: 'tokens' },
  params: [{ kind: 'range', key: 'merges', label: 'Merge budget', min: 1, max: 200, step: 1, value: 30, rebuild: true }],
  run(ops, { text }, params) {
    const budget = Number(params.merges ?? 30) || 30;
    let tokens = [...text];
    const show = (t: string) => t.replace(/ /g, '␣');
    ops.row('tok', tokens.map(show), { label: 'Tokens', w: 1.6 });
    ops.list('merges', [], { label: 'Merges', lines: 3 });
    const merges: [string, string][] = [];
    ops.plot('Tokens', 0, tokens.length);
    while (merges.length < budget) {
      const counts = new Map<string, number>();
      for (let i = 0; i + 1 < tokens.length; i++) {
        ops.tick('count');
        const k = tokens[i] + SEP + tokens[i + 1];
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      let best = ''; let bestN = 1;
      for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
      if (!best) { ops.note('no pair occurs twice: done'); break; }
      const [a, b] = best.split(SEP);
      merges.push([a, b]);
      ops.push('merges', `${show(a)}+${show(b)} ×${bestN}`, S.alt);
      ops.note(`merge '${show(a)}' + '${show(b)}' (${bestN} times)`);
      const next: string[] = [];
      for (let i = 0; i < tokens.length; i++) {
        if (i + 1 < tokens.length && tokens[i] === a && tokens[i + 1] === b) {
          ops.tick('merge');
          ops.splice('tok', next.length, 2, [show(a + b)]);
          ops.mark('tok', next.length, S.hit);
          next.push(a + b);
          i++;
        } else next.push(tokens[i]);
      }
      tokens = next;
      ops.plot('Tokens', merges.length, tokens.length);
      ops.clear('tok');
    }
    ops.stat('Tokens / characters', `${tokens.length} / ${text.length}`);
    ops.stat('Vocabulary learned', String(merges.length));
    return { merges, tokens };
  },
};
