import { S, type StringKernel } from '../../engines/string/trace';

/** Trigrams as PostgreSQL's pg_trgm takes them: per word of letters and digits, lower case,
 * padded with two spaces in front and one behind. */
export function trigrams(s: string, tick: () => void = () => {}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    const p = `  ${w} `;
    for (let i = 0; i + 3 <= p.length; i++) {
      tick();
      const g = p.slice(i, i + 3);
      if (!seen.has(g)) { seen.add(g); out.push(g); }
    }
  }
  return out;
}

// Each string becomes the set of its padded three-character slices; the similarity is the size
// of the intersection over the size of the union (Jaccard), so a typo costs only the few
// trigrams that cover it and word order does not matter at all.
export const kernel: StringKernel<'pair', number> = {
  input: 'pair',
  counters: { gram: 'Trigrams sliced', lookup: 'Set lookups' },
  run(ops, { a, b }) {
    const show = (g: string) => g.replace(/ /g, '·');
    ops.row('a', [...a], { label: 'First' });
    ops.row('b', [...b], { label: 'Second' });
    const ga = trigrams(a, () => ops.tick('gram'));
    ops.list('A', ga.map(show), { label: 'Trigrams 1', lines: 3 });
    const gb = trigrams(b, () => ops.tick('gram'));
    ops.list('B', gb.map(show), { label: 'Trigrams 2', lines: 3 });
    const setB = new Set(gb);
    let inter = 0;
    ga.forEach((g, i) => {
      ops.tick('lookup');
      const hit = setB.has(g);
      if (hit) {
        inter++;
        const j = gb.indexOf(g);
        ops.mark('A', i, S.hit); ops.mark('B', j, S.hit);
        ops.link('A', i, 'B', j, S.hit);
      } else ops.mark('A', i, S.miss);
      ops.note(`'${show(g)}' ${hit ? 'is shared' : 'is only in the first'}`);
    });
    gb.forEach((g, j) => { if (!ga.includes(g)) ops.mark('B', j, S.miss); });
    const union = ga.length + gb.length - inter;
    const sim = union ? inter / union : 1;
    ops.unlink();
    ops.note(`${inter} shared of ${union} distinct trigrams`);
    ops.stat('Shared trigrams', String(inter));
    ops.stat('Distinct trigrams', String(union));
    ops.stat('Similarity', sim.toFixed(4));
    return sim;
  },
};
