import { S, type StringKernel } from '../../engines/string/trace';
import { doubleMetaphone, soundex } from './_metaphone';
import { normalise } from './_normalise';

export interface PhoneticKeys { soundex: string; primary: string; alternate: string }

// Each name is first normalised (diacritics folded, titles and legal forms dropped) and every
// remaining word is encoded twice. Soundex keeps the first letter and three classes of the
// consonants after it. Double Metaphone walks the word with context rules (sch, cz, wicz, gh,
// th...) and writes a primary key and, where a spelling has two plausible pronunciations, an
// alternate; two names meet when any of their keys agree.
export const kernel: StringKernel<'names', PhoneticKeys[]> = {
  input: 'names',
  shape: 'spellings',
  counters: { letter: 'Letters coded', rule: 'Metaphone rules applied' },
  run(ops, { names, entity }) {
    ops.list('keys', [], { label: 'Keys', lines: 4 });
    const out: PhoneticKeys[] = [];
    names.forEach((name) => {
      const words = normalise(name).tokens.map((t) => t.toUpperCase());
      const word = words.join(' ');
      ops.row('w', [...word], { label: name });
      ops.row('p', [], { label: 'Primary' });
      ops.row('a', [], { label: 'Alternate' });
      const sx = words.map((x) => soundex(x, () => ops.tick('letter'))).join(' ');
      const pk: string[] = []; const ak: string[] = [];
      let base = 0;
      for (const x of words) {
        const [p, a] = doubleMetaphone(x, (from, next, pp, aa) => {
          ops.tick('rule');
          ops.clear('w');
          for (let i = from; i < next; i++) ops.mark('w', base + i, S.focus);
          ops.row('p', [...[...pk, pp].join(' ')], { label: 'Primary' });
          ops.row('a', [...[...ak, aa].join(' ')], { label: 'Alternate' });
          ops.note(`${x.slice(from, next) || x[from]} → ${pp || '·'} / ${aa || '·'}`);
        });
        pk.push(p); ak.push(a);
        base += x.length + 1;
      }
      const keys = { soundex: sx, primary: pk.join(' '), alternate: ak.join(' ') };
      out.push(keys);
      ops.clear('w');
      ops.push('keys', `${name}: ${keys.soundex} · ${keys.primary}${keys.alternate !== keys.primary ? `/${keys.alternate}` : ''}`, S.done);
      ops.note(`Soundex ${keys.soundex}, Double Metaphone ${keys.primary} / ${keys.alternate}`);
      // measured: how many pairs of spellings of one name the keys bring together
      let pairs = 0; let sxMeet = 0; let dmMeet = 0;
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) {
          if (entity[i] !== entity[j] || names[i] === names[j]) continue;
          pairs++;
          if (out[i].soundex === out[j].soundex) sxMeet++;
          const A = [out[i].primary, out[i].alternate]; const B = [out[j].primary, out[j].alternate];
          if (A.some((x) => B.includes(x))) dmMeet++;
        }
      }
      ops.stat('Spelling pairs of one name', String(pairs));
      ops.stat('Meeting on Soundex', String(sxMeet));
      ops.stat('Meeting on Double Metaphone', String(dmMeet));
    });
    return out;
  },
};
