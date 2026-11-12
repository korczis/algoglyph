// Every live string kernel of the catalogue, checked by one harness: each runs on every input
// shape at several sizes, its replayed counts equal its recorded counts, and its result agrees
// with an independent reference (ADR 0004 §4; rule project.no-fake-science).
import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { Board } from '../src/engines/string/board';
import { input, KINDS, type InputKind } from '../src/engines/string/inputs';
import { OP, S, trace, type Ev, type StringKernel, type Trace } from '../src/engines/string/trace';

type K = StringKernel<InputKind, unknown>;
const modules = import.meta.glob<K>('../src/kernels/string/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/string/${id}.ts`];
const live = ENTRIES.filter((e) => e.engine === 'string' && e.status === 'live');
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];

const run = <R>(id: string, x: unknown, params: Record<string, string | number | boolean> = {}) => {
  const t = trace(kernelOf(id), x as never, params);
  expect(t.truncated, `${id} ran to its end`).toBe(false);
  return t.result as R;
};
const inputs = <Kd extends InputKind>(kind: Kd, n?: number, shape = '') =>
  SEEDS.map((s) => input(kind, n ?? KINDS[kind].size.value, shape, 100 + s));

// --- independent references: written here, never imported from the code under test
const ref = {
  /** Every start of pattern in text, by String.prototype.indexOf. */
  findAll(text: string, pattern: string): number[] {
    const out: number[] = [];
    // indexOf finds the empty pattern at every k from 0 to the length (and clamps beyond it)
    if (!pattern.length) { for (let k = 0; k <= text.length; k++) out.push(text.indexOf('', k)); return out; }
    for (let i = text.indexOf(pattern); i >= 0; i = text.indexOf(pattern, i + 1)) out.push(i);
    return out;
  },
  /** JavaScript's own evaluation of the infix tokens (^ is **, right associative in both). */
  evalInfix: (t: string[]) => Number(new Function(`return ${t.join(' ').replace(/\^/g, '**')};`)()),
  evalPostfix(t: string[]): number {
    const st: number[] = [];
    for (const x of t) {
      if (/^\d+$/.test(x)) { st.push(Number(x)); continue; }
      const b = st.pop() as number; const a = st.pop() as number;
      st.push(x === '+' ? a + b : x === '-' ? a - b : x === '*' ? a * b : a ** b);
    }
    expect(st.length).toBe(1);
    return st[0];
  },
  lzwDecode(codes: number[]): string {
    const dict: string[] = Array.from({ length: 256 }, (_, c) => String.fromCharCode(c));
    if (!codes.length) return '';
    let w = dict[codes[0]]; let out = w;
    for (const c of codes.slice(1)) {
      const e = c < dict.length ? dict[c] : w + w[0];
      out += e;
      if (dict.length < 4096) dict.push(w + e[0]);
      w = e;
    }
    return out;
  },
  entropy(b: number[]): number {
    const f = new Map<number, number>();
    for (const x of b) f.set(x, (f.get(x) ?? 0) + 1);
    let h = 0;
    for (const c of f.values()) h -= (c / b.length) * Math.log2(c / b.length);
    return h;
  },
  icoValid(s: string): boolean {
    const d = [...s].map(Number);
    const sum = d.slice(0, 7).reduce((t, x, i) => t + x * (8 - i), 0);
    const r = sum % 11;
    return d[7] === (r === 0 ? 1 : r === 1 ? 0 : 11 - r);
  },
  levenshtein(a: string, b: string): number {
    const memo = new Map<string, number>();
    const go = (i: number, j: number): number => {
      if (!i) return j;
      if (!j) return i;
      const k = `${i},${j}`;
      const hit = memo.get(k);
      if (hit !== undefined) return hit;
      const v = Math.min(go(i - 1, j) + 1, go(i, j - 1) + 1, go(i - 1, j - 1) + (a[i - 1] === b[j - 1] ? 0 : 1));
      memo.set(k, v);
      return v;
    };
    return go(a.length, b.length);
  },
  lcs(a: string[], b: string[]): number {
    const t = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      t[i][j] = a[i - 1] === b[j - 1] ? t[i - 1][j - 1] + 1 : Math.max(t[i - 1][j], t[i][j - 1]);
    }
    return t[a.length][b.length];
  },
  /** pg_trgm's trigram set, from its documented definition. */
  trigramSet(s: string): Set<string> {
    const out = new Set<string>();
    for (const w of s.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (!w) continue;
      const p = `  ${w} `;
      for (let i = 0; i < p.length - 2; i++) out.add(p.substring(i, i + 3));
    }
    return out;
  },
  jaccard<T>(a: Set<T>, b: Set<T>): number {
    const inter = [...a].filter((x) => b.has(x)).length;
    return inter / (a.size + b.size - inter || 1);
  },
  shingleSet(text: string, k = 3): Set<string> {
    const w = text.toLowerCase().split(/\s+/).filter(Boolean);
    const out = new Set<string>();
    for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(' '));
    return out;
  },
};

/** Independent checks, one per kernel id: the reference never calls the code under test. */
const CHECKS: Record<string, () => void> = {
  'brute-force-search': () => searchCheck('brute-force-search'),
  'knuth-morris-pratt': () => {
    searchCheck('knuth-morris-pratt');
    // on Repetitive input the pattern grows with the text: brute force's comparisons grow as
    // n², the prefix function keeps KNUTH-MORRIS-PRATT's linear (two-point slopes, n = 256 … 2048)
    const growth = (id: string) => {
      const [a, b] = [256, 2048].map((n) => trace(kernelOf(id), input('search', n, 'repetitive', 9) as never, {}).counts[0]);
      return Math.log(b / a) / Math.log(8);
    };
    expect(growth('brute-force-search')).toBeGreaterThan(1.8);
    expect(growth('knuth-morris-pratt')).toBeLessThan(1.1);
  },
  'boyer-moore': () => searchCheck('boyer-moore'),
  'rabin-karp': () => {
    searchCheck('rabin-karp');
    for (const x of inputs('search')) expect(run('rabin-karp', x, { q: 13 })).toEqual(ref.findAll(x.text, x.pattern));
  },
  'infix-to-postfix': () => {
    for (const n of [2, 5, 9, 16]) for (const x of inputs('expression', n)) {
      expect(ref.evalPostfix(run<string[]>('infix-to-postfix', x))).toBe(ref.evalInfix(x.infix));
    }
    expect(run('infix-to-postfix', { infix: '2 ^ 3 ^ 2'.split(' '), postfix: [] })).toEqual('2 3 2 ^ ^'.split(' '));
    expect(run('infix-to-postfix', { infix: '( 1 + 2 ) * 3 - 4'.split(' '), postfix: [] })).toEqual('1 2 + 3 * 4 -'.split(' '));
  },
  'postfix-evaluation': () => {
    for (const n of [2, 5, 9, 16]) for (const x of inputs('expression', n)) expect(run('postfix-evaluation', x)).toBe(ref.evalInfix(x.infix));
    expect(run('postfix-evaluation', { infix: [], postfix: '5 1 2 + 4 * + 3 -'.split(' ') })).toBe(14);
  },
  'recursive-descent-parser': () => {
    for (const n of [2, 5, 9, 16]) for (const x of inputs('expression', n)) {
      const r = run<{ value: number; postfix: string[] }>('recursive-descent-parser', x);
      expect(r.value).toBe(ref.evalInfix(x.infix));
      expect(ref.evalPostfix(r.postfix)).toBe(r.value);
    }
    expect(run<{ value: number }>('recursive-descent-parser', { infix: '2 ^ 3 ^ 2'.split(' '), postfix: [] }).value).toBe(512);
    expect(run<{ value: number }>('recursive-descent-parser', { infix: '8 - 3 - 2'.split(' '), postfix: [] }).value).toBe(3);
  },
  'regex-nfa': () => {
    for (const n of [8, 36, 120]) for (const x of inputs('regex', n)) {
      const re = new RegExp(`(?:${x.pattern})$`);
      const want = Array.from({ length: x.text.length + 1 }, (_, j) => j).filter((j) => re.test(x.text.slice(0, j)));
      expect(run('regex-nfa', x), `${x.pattern} on ${x.text}`).toEqual(want);
    }
    expect(run('regex-nfa', { pattern: '(a|b)*abb', text: 'babbaabb' })).toEqual([4, 8]);
    expect(run('regex-nfa', { pattern: 'a(b|c|d)+', text: 'xabcx' })).toEqual([3, 4]);
  },
  'three-way-radix-quicksort': () => {
    for (const n of [4, 14, 64]) for (const x of inputs('words', n)) expect(run('three-way-radix-quicksort', x)).toEqual(x.words.slice().sort());
    const w = ['she', 'sells', 'seashells', 'by', 'the', 'sea', 'shore', 'the', 'shells', 'she', 'sells', 'are', 'surely', 'seashells'];
    expect(run('three-way-radix-quicksort', { words: w })).toEqual(w.slice().sort());
  },
  'run-length-encoding': () => {
    for (const shape of ['runs', 'prose', 'repetitive']) for (const x of inputs('text', 300, shape)) {
      const r = run<[number, string][]>('run-length-encoding', x);
      expect(r.map(([c, s]) => s.repeat(c)).join('')).toBe(x.text);
      for (const [c] of r) expect(c).toBeGreaterThanOrEqual(1);
      for (let i = 1; i < r.length; i++) if (r[i][1] === r[i - 1][1]) expect(r[i - 1][0]).toBe(255);
    }
    expect(run('run-length-encoding', { text: 'WWWWBBBW' })).toEqual([[4, 'W'], [3, 'B'], [1, 'W']]);
    expect(run<[number, string][]>('run-length-encoding', { text: 'a'.repeat(600) }).map((p) => p[0])).toEqual([255, 255, 90]);
  },
  'lzw-compression': () => {
    for (const shape of ['repetitive', 'prose', 'runs']) for (const x of inputs('text', 400, shape)) {
      const codes = run<number[]>('lzw-compression', x);
      expect(ref.lzwDecode(codes)).toBe(x.text);
      if (shape === 'repetitive') expect(codes.length).toBeLessThan(x.text.length / 2);
    }
    // the classic case where the decoder meets a code it has not yet defined
    expect(ref.lzwDecode(run<number[]>('lzw-compression', { text: 'abababababab' }))).toBe('abababababab');
    expect(run('lzw-compression', { text: 'TOBEORNOTTOBEORTOBEORNOT' })).toEqual(
      [84, 79, 66, 69, 79, 82, 78, 79, 84, 256, 258, 260, 265, 259, 261, 263]);
    // text beyond one byte per character is read as UTF-8 bytes: every code defined, round trip exact
    for (const text of ['kůň', 'Příliš žluťoučký kůň úpěl ďábelské ódy, kůň kůň', 'Łódź → 東京 🙂🙂']) {
      const codes = run<number[]>('lzw-compression', { text });
      expect(codes.every((c) => Number.isInteger(c)), text).toBe(true);
      const bytes = Uint8Array.from(ref.lzwDecode(codes), (c) => c.charCodeAt(0));
      expect(new TextDecoder().decode(bytes)).toBe(text);
    }
  },
  'bpe-tokenisation': () => {
    for (const x of inputs('text', 160, 'prose')) {
      const r = run<{ merges: [string, string][]; tokens: string[] }>('bpe-tokenisation', x, { merges: 40 });
      expect(r.tokens.join('')).toBe(x.text);
      let t = [...x.text];
      for (const [a, b] of r.merges) {
        const counts = new Map<string, number>();
        for (let i = 0; i + 1 < t.length; i++) counts.set(`${t[i]}\u0001${t[i + 1]}`, (counts.get(`${t[i]}\u0001${t[i + 1]}`) ?? 0) + 1);
        const top = Math.max(...counts.values());
        expect(counts.get(`${a}\u0001${b}`), `merge ${a}+${b} was a most frequent pair`).toBe(top);
        const next: string[] = [];
        for (let i = 0; i < t.length; i++) {
          if (t[i] === a && t[i + 1] === b && i + 1 < t.length) { next.push(a + b); i++; } else next.push(t[i]);
        }
        t = next;
      }
      expect(t).toEqual(r.tokens);
    }
  },
  'crc-division': () => {
    const check = (model: string) => run<number>('crc-division', { text: '123456789', bytes: [...'123456789'].map((c) => c.charCodeAt(0)) }, { model });
    expect(check('crc8')).toBe(0xf4);
    expect(check('crc16')).toBe(0x29b1);
    expect(check('crc24')).toBe(0x21cf02);
    expect(check('crc32')).toBe(0xcbf43926);
    for (const n of [1, 4, 17, 32]) for (const x of inputs('message', n, 'text')) {
      expect(run('crc-division', x, { model: 'crc32' })).toBe(crc32(Buffer.from(x.bytes)));
    }
  },
  'entropy-map': () => {
    for (const w of [64, 128, 256]) {
      const x = inputs('binary', 8)[0];
      const r = run<{ offsets: number[]; entropy: number[] }>('entropy-map', x, { window: String(w) });
      r.offsets.forEach((o, k) => expect(r.entropy[k]).toBeCloseTo(ref.entropy(x.bytes.slice(o, o + w)), 9));
    }
    const uniform = Array.from({ length: 512 }, (_, i) => i % 256);
    const r = run<{ entropy: number[] }>('entropy-map', { bytes: uniform, sections: [] }, { window: '256' });
    for (const h of r.entropy) expect(h).toBeCloseTo(8, 9);
    const zero = run<{ entropy: number[] }>('entropy-map', { bytes: new Array(512).fill(0), sections: [] }, { window: '128' });
    for (const h of zero.entropy) expect(h).toBe(0);
  },
  'ico-check-digit': () => {
    // published company numbers that check, and the same with one digit changed
    const valid = ['00006947', '25596641', '45274649'];
    expect(run('ico-check-digit', { numbers: valid, corrupted: valid.map(() => false) })).toEqual(valid.map(() => true));
    expect(run('ico-check-digit', { numbers: ['00006948', '25596614'], corrupted: [true, true] })).toEqual([false, false]);
    for (const x of inputs('ico', 48)) expect(run('ico-check-digit', x)).toEqual(x.numbers.map(ref.icoValid));
    const rnd = Array.from({ length: 400 }, (_, i) => String((i * 7919 * 104729 + 12345) % 1e8).padStart(8, '0'));
    expect(run('ico-check-digit', { numbers: rnd, corrupted: rnd.map(() => false) })).toEqual(rnd.map(ref.icoValid));
  },
  'lfsr-keystream': () => {
    for (let w = 3; w <= 16; w++) {
      const x = { fill: 0x1234567, message: 'key' };
      const r = run<{ keystream: number[]; period: number; cipher: number[] }>('lfsr-keystream', x, { width: w });
      expect(r.period, `width ${w} is maximal`).toBe(2 ** w - 1);
      const bits = [...x.message].flatMap((c) => Array.from({ length: 8 }, (_, k) => (c.charCodeAt(0) >> (7 - k)) & 1));
      expect(r.cipher.map((c, i) => c ^ r.keystream[i])).toEqual(bits);
    }
  },
  'vigenere-cipher': () => {
    let recovered = 0; let total = 0;
    for (const x of inputs('cipher', 600)) {
      const r = run<{ ciphertext: string; length: number; key: string }>('vigenere-cipher', x);
      const plain = [...r.ciphertext].map((c, i) => String.fromCharCode(65 + ((c.charCodeAt(0) - x.key.charCodeAt(i % x.key.length) + 26) % 26))).join('');
      expect(plain).toBe(x.plaintext);
      total++;
      if (r.key === x.key) recovered++;
    }
    expect(recovered, 'the attack recovers the key from 600 letters').toBeGreaterThanOrEqual(total - 1);
    expect(run<{ ciphertext: string }>('vigenere-cipher', { plaintext: 'ATTACKATDAWN', key: 'LEMON' }).ciphertext).toBe('LXFOPVEFRNHR');
  },
  'blocking-sorted-neighbourhood': () => {
    type C = { pairs: [number, number][] };
    for (const x of inputs('records', 30)) {
      const n = x.records.length;
      for (const w of [2, 4, 9]) {
        const r = run<C>('blocking-sorted-neighbourhood', x, { method: 'sorted', window: w });
        let want = 0;
        for (let i = 0; i < n; i++) want += Math.min(w - 1, n - 1 - i);
        expect(r.pairs.length).toBe(want);
        expect(new Set(r.pairs.map((p) => p.join())).size).toBe(want);
      }
      const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z]/g, '');
      const key = (i: number) => fold(x.records[i].surname).slice(0, 3) + fold(x.records[i].given).slice(0, 1);
      const want = new Set<string>();
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (key(i) === key(j)) want.add(`${i},${j}`);
      const got = run<C>('blocking-sorted-neighbourhood', x, { method: 'blocking' }).pairs.map((p) => p.join());
      expect(new Set(got)).toEqual(want);
      expect(got.length).toBe(want.size);
    }
  },
  'fellegi-sunter': () => {
    type R = { m: number[]; u: number[]; p: number; loglik: number[]; scores: number[]; pairs: [number, number][]; threshold: number };
    let tp = 0; let fp = 0; let fn = 0;
    for (const x of inputs('records', 24)) {
      const r = run<R>('fellegi-sunter', x);
      for (let k = 1; k < r.loglik.length; k++) expect(r.loglik[k]).toBeGreaterThanOrEqual(r.loglik[k - 1] - 1e-6);
      r.m.forEach((m, k) => expect(m).toBeGreaterThan(r.u[k]));
      expect(r.threshold).toBeCloseTo(Math.log2((1 - r.p) / r.p), 12);
      r.pairs.forEach(([i, j], q) => {
        const same = x.records[i].entity === x.records[j].entity;
        const call = r.scores[q] > r.threshold;
        if (call && same) tp++; else if (call) fp++; else if (same) fn++;
      });
    }
    expect(tp / (tp + fp), 'precision').toBeGreaterThan(0.8);
    expect(tp / (tp + fn), 'recall').toBeGreaterThan(0.8);
  },
  'jaro-winkler': () => {
    const jw = (a: string, b: string) => run<{ jaro: number; jw: number }>('jaro-winkler', { a, b });
    expect(jw('MARTHA', 'MARHTA').jaro).toBeCloseTo(0.9444, 4);
    expect(jw('MARTHA', 'MARHTA').jw).toBeCloseTo(0.9611, 4);
    expect(jw('DWAYNE', 'DUANE').jw).toBeCloseTo(0.84, 4);
    expect(jw('DIXON', 'DICKSONX').jw).toBeCloseTo(0.8133, 4);
    expect(jw('ABC', 'XYZ').jw).toBe(0);
    for (const x of inputs('pair')) {
      const r = jw(x.a, x.b);
      expect(r.jw).toBeGreaterThanOrEqual(r.jaro);
      expect(r.jw).toBeLessThanOrEqual(1);
      expect(jw(x.a, x.a).jw).toBe(1);
      expect(jw(x.b, x.a).jaro).toBeCloseTo(r.jaro, 12);
    }
  },
  'levenshtein-matrix': () => {
    const lev = (a: string, b: string) => run<{ distance: number; script: string[] }>('levenshtein-matrix', { a, b });
    expect(lev('kitten', 'sitting').distance).toBe(3);
    expect(lev('flaw', 'lawn').distance).toBe(2);
    expect(lev('', 'abc').distance).toBe(3);
    for (const shape of ['person', 'company']) for (const x of inputs('pair', 14, shape)) {
      const r = lev(x.a, x.b);
      expect(r.distance).toBe(ref.levenshtein(x.a, x.b));
      // the script rewrites a into b with exactly `distance` edits
      let out = '';
      for (const s of r.script) if (s[0] === '=') out += s[1]; else if (s[0] === '~') out += s[2]; else if (s[0] === '+') out += s[1];
      expect(out).toBe(x.b);
      expect(r.script.filter((s) => s[0] !== '=').length).toBe(r.distance);
    }
  },
  'minhash-lsh': () => {
    type R = { sig: number[][]; candidates: [number, number][]; bands: number; rows: number };
    let err = 0; let pairs = 0;
    for (const x of inputs('documents', 6)) {
      const r = run<R>('minhash-lsh', x, { bands: 8, rows: 4 });
      const sets = x.docs.map((d) => ref.shingleSet(d.text));
      const want = new Set<string>();
      for (let i = 0; i < x.docs.length; i++) {
        for (let j = i + 1; j < x.docs.length; j++) {
          for (let b = 0; b < r.bands; b++) {
            if (r.sig[i].slice(b * r.rows, (b + 1) * r.rows).join() === r.sig[j].slice(b * r.rows, (b + 1) * r.rows).join()) want.add(`${i},${j}`);
          }
          const exact = ref.jaccard(sets[i], sets[j]);
          const est = r.sig[i].filter((v, h) => v === r.sig[j][h]).length / r.sig[i].length;
          err += Math.abs(est - exact); pairs++;
          if (exact >= 0.9) expect(want.has(`${i},${j}`), 'a near-duplicate pair is a candidate').toBe(true);
        }
      }
      expect(new Set(r.candidates.map((c) => c.join()))).toEqual(want);
    }
    expect(err / pairs, 'mean error of the Jaccard estimate').toBeLessThan(0.06);
  },
  'name-normalisation': () => {
    const keys = (names: string[]) => run<string[]>('name-normalisation', { names, entity: names.map((_, i) => i) });
    expect(keys(['Ing. Jan Novák, Ph.D.', 'NOVAK Jan', 'Novák, Jan', 'Mgr.  Jan  Novak'])).toEqual(['jan novak', 'jan novak', 'jan novak', 'jan novak']);
    expect(keys(['Alfa Stavby s.r.o.', 'ALFA STAVBY, spol. s r. o.', 'Alfa Stavby sro', 'Alfa Stavby a.s.']))
      .toEqual(['alfa stavby sro', 'alfa stavby sro', 'alfa stavby sro', 'alfa stavby as']);
    expect(keys(['Šárka Říhová'])).toEqual(['rihova sarka']);
    // letters with no canonical decomposition fold to their usual spelling, not left whole
    expect(keys(['Łukasz Wałęsa', 'Weiß Straße', 'Søren Ørsted', 'Đorđe Æbelø'])).toEqual(['lukasz walesa', 'strasse weiss', 'orsted soren', 'aebelo dorde']);
    for (const shape of ['people', 'companies', 'mixed']) for (const x of inputs('names', 30, shape)) {
      const k = run<string[]>('name-normalisation', x);
      const byEntity = new Map<number, Set<string>>();
      x.entity.forEach((e, i) => byEntity.set(e, (byEntity.get(e) ?? new Set()).add(k[i])));
      for (const [e, set] of byEntity) expect(set.size, `entity ${e}: ${[...set].join(' | ')}`).toBe(1);
      expect(keys(k)).toEqual(k);
    }
  },
  'double-metaphone': () => {
    type P = { soundex: string; primary: string; alternate: string }[];
    const keys = (names: string[]) => run<P>('double-metaphone', { names, entity: names.map(() => 0) });
    const sx = keys(['Robert', 'Rupert', 'Rubin', 'Ashcraft', 'Ashcroft', 'Tymczak', 'Pfister', 'Honeyman']).map((k) => k.soundex);
    expect(sx).toEqual(['R163', 'R163', 'R150', 'A261', 'A261', 'T522', 'P236', 'H555']);
    const dm: [string, string, string][] = [['Smith', 'SM0', 'XMT'], ['Schmidt', 'XMT', 'SMT'], ['Dumb', 'TM', 'TM'],
      ['Caesar', 'SSR', 'SSR'], ['Chianti', 'KNT', 'KNT'], ['Michael', 'MKL', 'MXL'], ['Chemistry', 'KMST', 'KMST'],
      ['Edge', 'AJ', 'AJ'], ['Edgar', 'ATKR', 'ATKR'], ['Gough', 'KF', 'KF'], ['Thomas', 'TMS', 'TMS'], ['Knight', 'NT', 'NT'],
      ['Arnow', 'ARN', 'ARNF'], ['Arnoff', 'ARNF', 'ARNF'], ['Tichner', 'TXNR', 'TKNR'], ['Wright', 'RT', 'RT'],
      ['Jankelowicz', 'JNKL', 'ANKL'], ['Laugh', 'LF', 'LF'],
      // rules that read the end of the word, which the original pads with spaces
      ['Koch', 'KK', 'KK'], ['Jose', 'HS', 'HS'], ['Rogier', 'RJ', 'RJR']];
    expect(keys(dm.map((d) => d[0])).map((k) => [k.primary, k.alternate])).toEqual(dm.map((d) => [d[1], d[2]]));
    expect(keys(['Šimek'])[0].primary).toBe(keys(['Simek'])[0].primary);
  },
  simhash: () => {
    type R = { prints: number[][]; distance: number[][] };
    let inS = 0; let inN = 0; let outS = 0; let outN = 0;
    for (const x of inputs('documents', 6)) {
      const r = run<R>('simhash', x);
      for (let i = 0; i < x.docs.length; i++) {
        for (let j = i + 1; j < x.docs.length; j++) {
          expect(r.distance[i][j]).toBe(r.prints[i].filter((b, k) => b !== r.prints[j][k]).length);
          if (x.docs[i].text === x.docs[j].text) expect(r.distance[i][j]).toBe(0);
          if (x.docs[i].family === x.docs[j].family) { inS += r.distance[i][j]; inN++; } else { outS += r.distance[i][j]; outN++; }
        }
      }
    }
    expect(inS / inN, 'copies of one story lie closer than different stories').toBeLessThan(outS / outN / 2);
  },
  'trigram-similarity': () => {
    const sim = (a: string, b: string) => run<number>('trigram-similarity', { a, b });
    // the values PostgreSQL's pg_trgm documents for similarity()
    expect(sim('word', 'two words')).toBeCloseTo(4 / 11, 9);
    expect(sim('word', 'words')).toBeCloseTo(4 / 7, 9);
    for (const shape of ['person', 'company']) for (const x of inputs('pair', 14, shape)) {
      expect(sim(x.a, x.b)).toBeCloseTo(ref.jaccard(ref.trigramSet(x.a), ref.trigramSet(x.b)), 12);
    }
  },
  'myers-diff': () => {
    type R = { d: number; script: ['=' | '-' | '+', string][] };
    const check = (a: string[], b: string[]) => {
      const r = run<R>('myers-diff', { a, b });
      expect(r.d).toBe(a.length + b.length - 2 * ref.lcs(a, b));
      expect(r.script.filter((e) => e[0] !== '+').map((e) => e[1])).toEqual(a);
      expect(r.script.filter((e) => e[0] !== '-').map((e) => e[1])).toEqual(b);
      expect(r.script.filter((e) => e[0] !== '=').length).toBe(r.d);
    };
    check([...'ABCABBA'], [...'CBABAC']);
    expect(run<R>('myers-diff', { a: [...'ABCABBA'], b: [...'CBABAC'] }).d).toBe(5);
    check([], [...'AB']); check([...'AB'], []); check([...'SAME'], [...'SAME']);
    for (const shape of ['letters', 'lines']) for (const n of [4, 14, 40]) for (const x of inputs('versions', n, shape)) check(x.a, x.b);
  },
  'diff3-merge': () => {
    type R = { merged: string[]; conflicts: number };
    const merge = (base: string[], ours: string[], theirs: string[]) => {
      const r = run<R>('diff3-merge', { base, ours, theirs });
      return { merged: r.merged, conflicts: r.conflicts };
    };
    for (const x of inputs('merge', 20)) {
      expect(merge(x.base, x.ours, x.base)).toEqual({ merged: x.ours, conflicts: 0 });
      expect(merge(x.base, x.base, x.theirs)).toEqual({ merged: x.theirs, conflicts: 0 });
      expect(merge(x.base, x.ours, x.ours)).toEqual({ merged: x.ours, conflicts: 0 });
      const r = merge(x.base, x.ours, x.theirs);
      expect(r.merged.filter((l) => l.startsWith('<<<<<<<')).length).toBe(r.conflicts);
    }
    // disjoint edits far apart both survive
    const base = 'a b c d e f g h'.split(' ');
    expect(merge(base, 'A b c d e f g h'.split(' '), 'a b c d e f g H'.split(' '))).toEqual({ merged: 'A b c d e f g H'.split(' '), conflicts: 0 });
    // the same line changed two ways is a conflict with both versions
    expect(merge(base, 'a b X d e f g h'.split(' '), 'a b Y d e f g h'.split(' ')).merged)
      .toEqual(['a', 'b', '<<<<<<< ours', 'X', '=======', 'Y', '>>>>>>> theirs', 'd', 'e', 'f', 'g', 'h']);
  },
  'source-family': () => {
    for (const n of [3, 5, 8]) for (const x of inputs('documents', n)) {
      const r = run<{ family: number[] }>('source-family', x);
      for (let i = 0; i < x.docs.length; i++) {
        for (let j = i + 1; j < x.docs.length; j++) {
          expect(r.family[i] === r.family[j], `${i} ${j}`).toBe(x.docs[i].family === x.docs[j].family);
        }
      }
    }
  },
};

/**
 * Cell states replayed the slow, obvious way: a clear walks every cell of its part. The board
 * clears only the cells marked since its last clear; both must agree after every event.
 */
function naiveStates(events: Ev[], upto: number): number[][] {
  const st: number[][] = [];
  for (const e of events.slice(0, upto)) {
    const q = st[e.p];
    switch (e.o) {
      case OP.part: st[e.p] = new Array<number>(JSON.parse(e.s ?? '{}').kind === 'table' ? e.i * e.j : (e.ss ?? []).length).fill(0); break;
      case OP.mark: if (q && e.i < q.length) q[e.i] = e.j; break;
      case OP.clear: if (q) for (let k = 0; k < q.length; k++) if (e.i || q[k] !== S.done) q[k] = 0; break;
      case OP.push: q?.push(e.i); break;
      case OP.pop: q?.pop(); break;
      case OP.splice: q?.splice(e.i, e.j, ...(e.ss ?? []).map(() => 0)); break;
      case OP.swap: if (q) [q[e.i], q[e.j]] = [q[e.j], q[e.i]]; break;
    }
  }
  return st;
}

function sameStates(t: Trace, label: string): void {
  const b = new Board(t);
  const stops = [0.25, 0.5, 0.75, 1].map((f) => Math.floor(f * t.events.length));
  for (const at of stops) {
    while (b.at < at) b.advance(1);
    const want = naiveStates(t.events.toArray(0, b.at), b.at);
    // swapRows is not replayed by the naive version; tables that use it are compared by size only
    const rowSwaps = t.events.toArray(0, b.at).some((e) => e.o === OP.swapRows);
    b.parts.forEach((q, i) => {
      if (rowSwaps && q.kind === 'table') expect(q.states.length, label).toBe(want[i]?.length);
      else expect(q.states, `${label} part ${i} at event ${b.at}`).toEqual(want[i]);
    });
  }
}

function searchCheck(id: string): void {
  for (const shape of KINDS.search.shapes.map((s) => s.value)) {
    for (const n of [16, 48, 200]) {
      for (const x of inputs('search', n, shape)) {
        expect(run(id, x), `${shape} n=${n}`).toEqual(ref.findAll(x.text, x.pattern));
      }
    }
  }
  const fixed: [string, string][] = [['abracadabra', 'abra'], ['aaaaaa', 'aa'], ['abcabcabd', 'abcabd'],
    ['xyz', 'xyz'], ['ab', 'abc'], ['GCATCGCAGAGAGTATACAGTACG', 'GCAGAGAG'], ['abc', ''], ['', ''], ['', 'a']];
  for (const [text, pattern] of fixed) expect(run(id, { text, pattern })).toEqual(ref.findAll(text, pattern));
}

describe('string kernels', () => {
  it('every live string entry has its kernel and its check, and every kernel its entry', () => {
    const files = Object.keys(modules).map((f) => f.replace(/^.*\/(.*)\.ts$/, '$1')).sort();
    expect(files).toEqual(live.map((e) => e.id).sort());
    for (const e of live) expect(CHECKS[e.id], `${e.id} has an independent check`).toBeTypeOf('function');
  });

  for (const e of live) {
    const kernel = kernelOf(e.id);
    describe(e.id, () => {
      it('runs on every input shape and size, and its replay counts what it recorded', () => {
        const def = KINDS[kernel.input];
        const shapes = def.shapes.length ? def.shapes.map((s) => s.value) : [''];
        for (const shape of shapes) {
          for (const n of [def.size.min, kernel.size ?? def.size.value]) {
            const t = trace(kernel, input(kernel.input, n, shape, 7 + n) as never, {});
            expect(t.truncated, `${shape} n=${n}`).toBe(false);
            const b = new Board(t);
            b.advance(Number.MAX_SAFE_INTEGER);
            expect(b.done).toBe(true);
            expect(b.counts).toEqual(t.counts);
            expect(t.counts[0], `${shape} n=${n}: the primary counter counts work`).toBeGreaterThan(0);
            sameStates(t, `${shape} n=${n}`);
          }
        }
      });
      it('agrees with an independent reference', () => CHECKS[e.id]?.());
    });
  }
});
