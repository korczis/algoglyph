// Every exact count or hard inequality the strings wing states in a bound (catalogue/entries/*.md,
// ADR 0006 §4), driven at several sizes and compared with what the kernel counts: the counters are
// the plate's readouts (src/engines/string/trace.ts, the graph engine's Edges examined and
// Merging matches). Asymptotic bounds are stated as the notes state them and not checked here:
//   knuth-morris-pratt's linear count against brute force's n² on Repetitive input:
//   test/kernels-string.test.ts (the knuth-morris-pratt check, two-point slopes n = 256 … 2048)
//   boyer-moore's O(n m) and about n / m, rabin-karp's O(n + m) expected and O(n m), huffman-coding's
//   O(n lg n), myers-diff's and diff3-merge's O((N + M) D) and the sort inside blocking: no test
//   measures their growth; test/kernels-string.test.ts and test/kernels-tree.test.ts check only
//   that each result agrees with an independent reference
import { describe, expect, it } from 'vitest';
import { makeGraph } from '../src/engines/graph/graph';
import { defaultParams, E, OP as GOP, trace as graphTrace } from '../src/engines/graph/trace';
import { input, KINDS, type InputKind } from '../src/engines/string/inputs';
import { OP, trace, type StringKernel, type Trace } from '../src/engines/string/trace';
import { kernel as mergeKernel } from '../src/kernels/graph/union-find-entity-merge';
import { normalise } from '../src/kernels/string/_normalise';
import { TAPS } from '../src/kernels/string/lfsr-keystream';

type K = StringKernel<InputKind, unknown>;
const modules = import.meta.glob<K>('../src/kernels/string/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/string/${id}.ts`];
const SEEDS = [1, 2, 3, 5, 8];

function run<R>(id: string, x: unknown, params: Record<string, string | number> = {}): Trace<R> {
  const t = trace(kernelOf(id), x as never, params) as Trace<R>;
  expect(t.truncated, `${id} ran to its end`).toBe(false);
  return t;
}
const count = (t: Trace, counter: string) => t.counts[t.counters.indexOf(counter)];
const shapes = (kind: InputKind) => (KINDS[kind].shapes.length ? KINDS[kind].shapes.map((s) => s.value) : ['']);
/** Seeded inputs of a kind at several sizes and every shape. */
function* inputs<Kd extends InputKind>(kind: Kd, sizes: number[]) {
  for (const shape of shapes(kind)) for (const n of sizes) for (const s of SEEDS) yield input(kind, n, shape, 300 + n + s);
}
const pairs = (n: number) => (n * (n - 1)) / 2;

describe('strings: exact bounds against counted runs', () => {
  it('brute-force-search: at most m(n − m + 1) comparisons, all of them when every alignment matches', () => {
    for (const x of inputs('search', [16, 96, 512])) {
      const n = x.text.length; const m = x.pattern.length;
      expect(count(run('brute-force-search', x), 'compare')).toBeLessThanOrEqual(m <= n ? m * (n - m + 1) : 0);
    }
    for (const [n, m] of [[8, 1], [20, 5], [64, 63], [100, 100]]) {
      const t = run('brute-force-search', { text: 'a'.repeat(n), pattern: 'a'.repeat(m) });
      expect(count(t, 'compare'), `n=${n} m=${m}`).toBe(m * (n - m + 1));
    }
  });

  it('knuth-morris-pratt: at most 2m comparisons in the prefix function and 2n in the search', () => {
    for (const x of inputs('search', [16, 96, 512, 2048])) {
      const t = run('knuth-morris-pratt', x);
      const c = t.counters.indexOf('compare');
      // the prefix function runs before the search slides the pattern for the first time
      let prefix = 0; let search = 0; let searching = false;
      for (const e of t.events.toArray()) {
        if (e.o === OP.offset) searching = true;
        else if (e.o === OP.tick && e.i === c) { if (searching) search += e.v; else prefix += e.v; }
      }
      expect(prefix + search).toBe(count(t, 'compare'));
      expect(prefix).toBeLessThanOrEqual(2 * x.pattern.length);
      expect(search).toBeLessThanOrEqual(2 * x.text.length);
    }
  });

  it('boyer-moore: the alignments tried and the Alignments skipped readout add up to n − m + 1', () => {
    const fixed: [string, string][] = [['abracadabra', 'abra'], ['aaaaaa', 'aa'], ['xyz', 'xyz'], ['ab', 'abc'],
      ['GCATCGCAGAGAGTATACAGTACG', 'GCAGAGAG'], ['', 'a']];
    for (const x of [...inputs('search', [16, 48, 96, 200, 1024]), ...fixed.map(([text, pattern]) => ({ text, pattern }))]) {
      const t = run('boyer-moore', x);
      const tried = t.events.toArray().filter((e) => e.o === OP.offset).length;
      let skipped = 0;
      for (const e of t.events.toArray()) if (e.o === OP.stat && e.s === 'Alignments skipped') skipped = Number(e.ss?.[0]);
      // every alignment 0 … n − m is either tried or skipped, and none beyond the last is counted
      expect(tried + skipped, `${x.pattern} in ${x.text.length} characters`).toBe(Math.max(0, x.text.length - x.pattern.length + 1));
    }
  });

  it('recursive-descent-parser: every one of the n tokens is consumed exactly once', () => {
    for (const x of inputs('expression', [2, 5, 9, 16])) expect(count(run('recursive-descent-parser', x), 'token')).toBe(x.infix.length);
  });

  it('regex-nfa: at most m + 3 states in the set and m + 2 examined per character, for m pattern characters', () => {
    for (const x of inputs('regex', [8, 36, 120, 200])) {
      const t = run('regex-nfa', x);
      const m = x.pattern.length;
      expect(count(t, 'trans'), x.pattern).toBeLessThanOrEqual((m + 2) * x.text.length);
      // the chart's Active states series is the size of the set after every text character
      const sizes = t.events.toArray().filter((e) => e.o === OP.plot && e.s === 'Active states').map((e) => Number(e.ss?.[0]));
      expect(sizes.length).toBe(x.text.length);
      expect(Math.max(0, ...sizes), x.pattern).toBeLessThanOrEqual(m + 3);
    }
  });

  it('run-length-encoding: n − 1 symbol comparisons, fewer only where a run is cut at 255', () => {
    for (const x of inputs('text', [16, 120, 1024])) {
      const t = run<[number, string][]>('run-length-encoding', x);
      const n = x.text.length;
      const cut = t.result.slice(0, -1).filter(([c]) => c === 255).length;
      expect(count(t, 'compare')).toBe(n - 1 - cut);
    }
    expect(count(run('run-length-encoding', { text: 'a'.repeat(600) }), 'compare')).toBe(599 - 2);
  });

  it('lzw-compression: one dictionary lookup per byte of the UTF-8 input', () => {
    const texts = [...inputs('text', [16, 120, 1024])].map((x) => x.text)
      .concat(['kůň', 'Příliš žluťoučký kůň úpěl ďábelské ódy', 'Łódź → 東京 🙂']);
    for (const text of texts) expect(count(run('lzw-compression', { text }), 'lookup')).toBe(new TextEncoder().encode(text).length);
  });

  it('bpe-tokenisation: at most k(n − 1) pairs counted for a budget of k merges, n − 1 replacements', () => {
    for (const x of inputs('text', [16, 96, 400])) {
      for (const k of [1, 5, 30]) {
        const t = run('bpe-tokenisation', x, { merges: k });
        const n = [...x.text].length;
        expect(count(t, 'count')).toBeLessThanOrEqual(k * (n - 1));
        expect(count(t, 'merge')).toBeLessThanOrEqual(n - 1);
      }
    }
  });

  it('crc-division: n division steps and at most (w + 1) n bit XORs for n message bits', () => {
    const width: Record<string, number> = { crc8: 8, crc16: 16, crc24: 24, crc32: 32 };
    for (const x of inputs('message', [1, 4, 32])) {
      for (const [model, w] of Object.entries(width)) {
        const t = run('crc-division', x, { model });
        const n = 8 * x.bytes.length;
        expect(count(t, 'step')).toBe(n);
        // the generator's w + 1 bits are XORed in as a whole, wherever the leading bit is 1
        expect(count(t, 'xor') % (w + 1)).toBe(0);
        expect(count(t, 'xor')).toBeLessThanOrEqual((w + 1) * n);
      }
    }
  });

  it('entropy-map: at most 2n histogram updates for n bytes, whatever the window', () => {
    for (const x of inputs('binary', [4, 16, 64])) {
      for (const w of [64, 128, 256]) {
        const t = run('entropy-map', x, { window: String(w) });
        const n = x.bytes.length;
        // w for the first window, then one down and one up for each of the w/8 bytes of a slide
        expect(count(t, 'update')).toBe(w + 2 * (w / 8) * (count(t, 'window') - 1));
        expect(count(t, 'update')).toBeLessThanOrEqual(2 * n);
      }
    }
  });

  it('ico-check-digit: seven digits weighted and one check per number', () => {
    for (const x of inputs('ico', [4, 12, 48])) {
      const t = run('ico-check-digit', x);
      expect(count(t, 'mul')).toBe(7 * x.numbers.length);
      expect(count(t, 'check')).toBe(x.numbers.length);
    }
  });

  it('lfsr-keystream: one shift and t − 1 tap XORs per keystream bit, at least one per message bit', () => {
    for (let w = 3; w <= 16; w++) {
      for (const x of inputs('register', [1, 6, 32])) {
        const t = run('lfsr-keystream', x, { width: w });
        expect(count(t, 'xor')).toBe((TAPS[w].length - 1) * count(t, 'shift'));
        expect(count(t, 'shift')).toBeGreaterThanOrEqual(8 * x.message.length);
      }
    }
  });

  it('vigenere-cipher: n letter shifts and n(L_max + 1) letters tallied', () => {
    for (const x of inputs('cipher', [60, 420, 1500])) {
      const t = run('vigenere-cipher', x);
      const n = x.plaintext.length;
      // the candidate key lengths the chart plots: 1 to 16, and no more than n / 4
      const lmax = Math.min(16, Math.floor(n / 4));
      expect(count(t, 'shift')).toBe(n);
      expect(count(t, 'count')).toBe(n * (lmax + 1));
    }
  });

  it('blocking-sorted-neighbourhood: Σ min(w − 1, n − 1 − i) ≤ (w − 1) n candidate pairs', () => {
    for (const x of inputs('records', [4, 16, 60])) {
      const n = x.records.length;
      for (const w of [2, 4, 12]) {
        const t = run('blocking-sorted-neighbourhood', x, { method: 'sorted', window: w });
        let want = 0;
        for (let i = 0; i < n; i++) want += Math.min(w - 1, n - 1 - i);
        expect(count(t, 'pair')).toBe(want);
        expect(count(t, 'pair')).toBeLessThanOrEqual((w - 1) * n);
        expect(count(t, 'pair')).toBeLessThanOrEqual(pairs(n));
      }
    }
  });

  it('source-family: n(n − 1)/2 pairs compared and at most n − 1 unions', () => {
    for (const x of inputs('documents', [2, 5, 12])) {
      const t = run('source-family', x);
      const n = x.docs.length;
      expect(count(t, 'pair')).toBe(pairs(n));
      expect(count(t, 'union')).toBeLessThanOrEqual(n - 1);
    }
  });

  it('fellegi-sunter: four field comparisons per pair, one update per pair in each EM iteration', () => {
    for (const x of inputs('records', [4, 16, 32])) {
      const t = run<{ loglik: number[] }>('fellegi-sunter', x);
      const p = pairs(x.records.length);
      expect(count(t, 'compare')).toBe(4 * p);
      expect(count(t, 'em')).toBe(p * t.result.loglik.length);
    }
  });

  it('jaro-winkler: at most |a| · min(|b|, 2w + 1) comparisons for the window w', () => {
    for (const x of inputs('pair', [4, 12, 48])) {
      for (const [a, b] of [[x.a, x.b], [x.b, x.a]]) {
        const w = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
        const c = count(run('jaro-winkler', { a, b }), 'compare');
        expect(c).toBeLessThanOrEqual(a.length * Math.min(b.length, 2 * w + 1));
        expect(c).toBeLessThanOrEqual(a.length * b.length);
      }
    }
  });

  it('levenshtein-matrix: (|a| + 1)(|b| + 1) cells written and |a| · |b| comparisons', () => {
    const fixed = [['', ''], ['', 'abc'], ['kitten', 'sitting']];
    for (const [a, b] of [...[...inputs('pair', [4, 12, 48])].map((x) => [x.a, x.b]), ...fixed]) {
      const t = run('levenshtein-matrix', { a, b });
      expect(count(t, 'cell')).toBe((a.length + 1) * (b.length + 1));
      expect(count(t, 'compare')).toBe(a.length * b.length);
    }
  });

  it('union-find-entity-merge: every candidate pair examined once, at most n − 1 merging matches', () => {
    for (const n of [4, 36, 160]) {
      for (const seed of SEEDS) {
        const g = makeGraph('records', n, seed);
        for (const threshold of [0.2, 0.45, 0.9]) {
          const t = graphTrace(mergeKernel, g, { s: g.s, t: g.t, p: { ...defaultParams(mergeKernel), threshold } }, seed);
          expect(t.truncated).toBe(false);
          let merges = 0;
          for (let k = 0; k < t.length; k++) if (t.events[5 * k] === GOP.edge && t.events[5 * k + 2] === E.tree) merges++;
          expect(t.counts.scans).toBe(g.m);
          expect(merges).toBeLessThanOrEqual(g.n - 1);
          // each merging match joins two clusters into one
          expect(new Set(t.result?.comp).size).toBe(g.n - merges);
        }
      }
    }
  });

  it('minhash-lsh: b·r hash evaluations per distinct shingle of each document, N insertions per band', () => {
    // word 3-shingles, as the notes define them; a document of fewer words is one shingle
    const shingles = (text: string) => {
      const w = text.toLowerCase().split(/\s+/).filter(Boolean);
      const out = new Set<string>();
      for (let i = 0; i + 3 <= w.length; i++) out.add(w.slice(i, i + 3).join(' '));
      if (!out.size && w.length) out.add(w.join(' '));
      return out.size;
    };
    for (const x of inputs('documents', [2, 5, 12])) {
      for (const [bands, rows] of [[2, 1], [8, 4], [16, 6]]) {
        const t = run('minhash-lsh', x, { bands, rows });
        const s = x.docs.reduce((sum, d) => sum + shingles(d.text), 0);
        expect(count(t, 'hash')).toBe(bands * rows * s);
        expect(count(t, 'bucket')).toBe(bands * x.docs.length);
      }
    }
  });

  it('name-normalisation: one character folded per character of the name', () => {
    for (const x of inputs('names', [4, 12, 40])) {
      expect(count(run('name-normalisation', x), 'char')).toBe(x.names.reduce((s, name) => s + [...name].length, 0));
    }
  });

  it('double-metaphone: at most n letters coded and n rules applied for n letters', () => {
    for (const x of inputs('names', [4, 12, 40])) {
      const t = run('double-metaphone', x);
      const words = x.names.flatMap((name) => normalise(name).tokens.map((w) => w.toUpperCase()));
      expect(count(t, 'letter')).toBeLessThanOrEqual(words.reduce((s, w) => s + w.replace(/[^A-Z]/g, '').length, 0));
      expect(count(t, 'rule')).toBeLessThanOrEqual(words.reduce((s, w) => s + w.length, 0));
    }
  });

  it('simhash: 64 bit votes per distinct word, 64 bits compared per pair of fingerprints', () => {
    for (const x of inputs('documents', [2, 5, 12])) {
      const t = run('simhash', x);
      const f = x.docs.reduce((s, d) => s + new Set(d.text.toLowerCase().split(/\s+/).filter(Boolean)).size, 0);
      expect(count(t, 'vote')).toBe(64 * f);
      expect(count(t, 'xor')).toBe(64 * pairs(x.docs.length));
    }
  });

  it('trigram-similarity: |w| + 1 trigrams per word, one lookup per distinct trigram of the first', () => {
    // pg_trgm's words: runs of letters and digits, lower-cased, padded "  w "
    const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const grams = (s: string) => {
      const out = new Set<string>();
      for (const w of words(s)) { const p = `  ${w} `; for (let i = 0; i + 3 <= p.length; i++) out.add(p.slice(i, i + 3)); }
      return out;
    };
    const fixed = [['word', 'two words'], ['Novák', 'NOVAK'], ['a', '']];
    for (const [a, b] of [...[...inputs('pair', [4, 12, 48])].map((x) => [x.a, x.b]), ...fixed]) {
      const t = run('trigram-similarity', { a, b });
      const sliced = [...words(a), ...words(b)].reduce((s, w) => s + w.length + 1, 0);
      expect(count(t, 'gram'), `${a} | ${b}`).toBe(sliced);
      expect(count(t, 'lookup')).toBe(grams(a).size);
    }
  });

  it('myers-diff: d + 1 paths extended in round d, at most (D + 1)(D + 2)/2 in all', () => {
    const fixed: [string[], string[]][] = [[[...'ABCABBA'], [...'CBABAC']], [[], [...'AB']], [[...'SAME'], [...'SAME']]];
    for (const [a, b] of [...[...inputs('versions', [4, 14, 48])].map((x) => [x.a, x.b] as [string[], string[]]), ...fixed]) {
      const t = run<{ d: number }>('myers-diff', { a, b });
      const D = t.result.d;
      // rounds 0 … D − 1 extend all their d + 1 paths; round D stops at the one that reaches the corner
      expect(count(t, 'reach')).toBeGreaterThanOrEqual((D * (D + 1)) / 2 + 1);
      expect(count(t, 'reach')).toBeLessThanOrEqual(((D + 1) * (D + 2)) / 2);
    }
  });

  it('diff3-merge: at most one chunk resolved per line of the three versions', () => {
    for (const x of inputs('merge', [4, 12, 40])) {
      const t = run('diff3-merge', x);
      expect(count(t, 'chunk')).toBeLessThanOrEqual(x.base.length + x.ours.length + x.theirs.length);
    }
  });
});
