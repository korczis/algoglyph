import { S, type StringKernel } from '../../engines/string/trace';
import { FORMS, foldMarks, TITLE_TOKENS } from './_normalise';

// Decompose each character and drop its combining marks (Novák → Novak), fold the letters that
// carry their mark whole (Łukasz → Lukasz, Weiß → Weiss), lower the case, split
// on spaces and commas and strip punctuation from the tokens, drop academic titles, recognise a
// legal form from the joined letters of the last tokens (s. r. o., spol. s r.o. and sro are all
// sro), then sort the remaining tokens so that word order no longer matters.
export const kernel: StringKernel<'names', string[]> = {
  input: 'names',
  counters: { char: 'Characters folded', token: 'Tokens examined' },
  speed: 2,
  run(ops, { names, entity }) {
    ops.list('keys', [], { label: 'Canonical', lines: 3 });
    const keys: string[] = [];
    for (const name of names) {
      ops.row('raw', [...name], { label: 'Name' });
      let folded = '';
      [...name].forEach((ch, i) => {
        ops.tick('char');
        const f = foldMarks(ch).toLowerCase();
        folded += f;
        if (f !== ch) { ops.set('raw', i, f); ops.mark('raw', i, S.alt); }
      });
      ops.note('fold diacritics and case');
      const raw = folded.split(/[\s,;]+/).map((t) => t.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
      ops.list('tok', raw, { label: 'Tokens', lines: 1 });
      let tokens: string[] = [];
      raw.forEach((t, i) => {
        ops.tick('token');
        if (TITLE_TOKENS.has(t)) ops.mark('tok', i, S.miss);
        else tokens.push(t);
      });
      ops.note('drop titles');
      let form = '';
      for (let k = Math.min(4, tokens.length - 1); k >= 1; k--) {
        ops.tick('token', k);
        const f = FORMS[tokens.slice(tokens.length - k).join('')];
        if (f) {
          form = f;
          tokens = tokens.slice(0, tokens.length - k);
          ops.note(`legal form ${f}`);
          break;
        }
      }
      if (form) {
        let left = tokens.length;
        raw.forEach((t, i) => { if (!TITLE_TOKENS.has(t)) { if (left-- <= 0) ops.mark('tok', i, S.alt); } });
      }
      const key = tokens.slice().sort().join(' ') + (form ? ` ${form}` : '');
      keys.push(key);
      const seen = keys.indexOf(key) < keys.length - 1;
      ops.push('keys', key, seen ? S.hit : S.done);
      ops.note(`${name} → ${key}${seen ? ' (already seen)' : ''}`);
      ops.stat('Distinct names as written', String(new Set(names.slice(0, keys.length)).size));
      ops.stat('Distinct canonical keys', String(new Set(keys).size));
      ops.stat('Entities in the input', String(new Set(entity.slice(0, keys.length)).size));
    }
    return keys;
  },
};
