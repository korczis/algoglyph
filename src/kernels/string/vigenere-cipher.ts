import { S, type StringKernel } from '../../engines/string/trace';

/** Relative frequencies of the letters A–Z in English text (percent). */
export const ENGLISH_FREQ = [8.17, 1.49, 2.78, 4.25, 12.7, 2.23, 2.02, 6.09, 6.97, 0.15, 0.77, 4.03,
  2.41, 6.75, 7.51, 1.93, 0.1, 5.99, 6.33, 9.06, 2.76, 0.98, 2.36, 0.15, 1.97, 0.07];
const A = 65;
const MAX_KEY = 16;

// Encrypt: letter i is shifted by the key letter i mod L. Attack, from the ciphertext alone:
// Kasiski's distances between repeated trigrams hint at multiples of L; for every candidate L
// the columns i mod L are each a Caesar cipher, so their mean index of coincidence rises to
// that of English at the true length (the smallest L within 90% of the best is taken). Each
// column's shift is the one whose letter counts are closest, by chi-squared, to English.
export const kernel: StringKernel<'cipher', { ciphertext: string; length: number; key: string }> = {
  input: 'cipher',
  counters: { shift: 'Letter shifts', count: 'Letters tallied' },
  speed: 6,
  chart: { title: 'Index of coincidence by key length', x: 'candidate key length', y: 'mean index of coincidence' },
  run(ops, { plaintext, key }) {
    const n = plaintext.length; const L0 = key.length;
    ops.row('pt', [...plaintext], { label: 'Plaintext' });
    ops.row('key', Array.from({ length: n }, (_, i) => key[i % L0]), { label: 'Key', align: 'pt' });
    ops.row('ct', new Array<string>(n).fill(''), { label: 'Ciphertext', align: 'pt' });
    let ct = '';
    for (let i = 0; i < n; i++) {
      ops.tick('shift');
      const c = String.fromCharCode(A + ((plaintext.charCodeAt(i) - A + key.charCodeAt(i % L0) - A) % 26));
      ct += c;
      ops.set('ct', i, c);
      ops.clear('pt'); ops.clear('key');
      ops.mark('pt', i, S.focus); ops.mark('key', i, S.alt);
    }
    ops.clear('pt'); ops.clear('key');
    ops.note('the attacker sees only the ciphertext');
    // Kasiski: distances between consecutive repeats of each trigram
    ops.list('kas', [], { label: 'Repeat distances', lines: 1 });
    const seen = new Map<string, number>();
    const dist: number[] = [];
    for (let i = 0; i + 3 <= n; i++) {
      const g = ct.slice(i, i + 3);
      const j = seen.get(g);
      if (j !== undefined) { dist.push(i - j); if (dist.length <= 40) ops.push('kas', `${g} ${i - j}`); }
      seen.set(g, i);
    }
    const factors = new Array<number>(MAX_KEY + 1).fill(0);
    for (const d of dist) for (let f = 2; f <= MAX_KEY; f++) if (d % f === 0) factors[f]++;
    // Friedman: mean index of coincidence of the columns for each candidate length
    const ioc: number[] = [0];
    for (let L = 1; L <= Math.min(MAX_KEY, Math.floor(n / 4)); L++) {
      let s = 0;
      for (let c = 0; c < L; c++) {
        const f = new Array<number>(26).fill(0);
        let m = 0;
        for (let i = c; i < n; i += L) { ops.tick('count'); f[ct.charCodeAt(i) - A]++; m++; }
        s += m > 1 ? f.reduce((t, x) => t + x * (x - 1), 0) / (m * (m - 1)) : 0;
      }
      ioc.push(s / L);
      ops.plot('Mean column IoC', L, s / L);
      ops.note(`key length ${L}: mean index of coincidence ${(s / L).toFixed(4)}`);
    }
    const best = Math.max(...ioc);
    const length = ioc.findIndex((v, L) => L > 0 && v >= 0.9 * best);
    ops.stat('Key length found', String(length));
    const kas = factors.reduce((b, v, f) => (v > factors[b] ? f : b), 2);
    ops.stat('Commonest Kasiski factor', dist.length ? String(kas) : 'no repeats');
    // chi-squared per column
    ops.row('guess', new Array<string>(length).fill('?'), { label: 'Recovered key' });
    let found = '';
    for (let c = 0; c < length; c++) {
      const f = new Array<number>(26).fill(0);
      let m = 0;
      for (let i = c; i < n; i += length) { ops.tick('count'); f[ct.charCodeAt(i) - A]++; m++; }
      let bestK = 0; let bestX = Infinity;
      for (let k = 0; k < 26; k++) {
        let x = 0;
        for (let l = 0; l < 26; l++) {
          const e = (ENGLISH_FREQ[l] / 100) * m;
          const o = f[(l + k) % 26];
          x += ((o - e) * (o - e)) / e;
        }
        if (x < bestX) { bestX = x; bestK = k; }
      }
      const letter = String.fromCharCode(A + bestK);
      found += letter;
      ops.set('guess', c, letter);
      ops.mark('guess', c, letter === key[c % L0] && length === L0 ? S.hit : S.miss);
      ops.note(`column ${c}: shift ${letter} fits English best (χ² ${bestX.toFixed(1)})`);
    }
    ops.stat('Recovered key', found);
    ops.stat('Correct', found === key ? 'yes' : 'no');
    return { ciphertext: ct, length, key: found };
  },
};
