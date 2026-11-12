// The string engine's seeded inputs: a pure function of (kind, size, shape, seed). Texts and
// patterns, expressions, noisy names with diacritics and legal forms, record sets with known
// duplicates, document sets with near-duplicate families, version pairs and triples, bytes.
import { mulberry32, shuffle } from '../../core/random';
import { AGENCIES, ENGLISH, GIVEN, LEGAL_FORMS, OUTLETS, SPELLINGS, SURNAME, TITLES, TOWN, TRADE } from './corpus';

export interface Rec { id: number; given: string; surname: string; year: number; town: string; entity: number }
export interface Doc { id: number; outlet: string; title: string; text: string; credit: string; family: number; time: number }
export interface Section { start: number; end: number; kind: string }

export interface Inputs {
  search: { text: string; pattern: string };
  expression: { infix: string[]; postfix: string[] };
  words: { words: string[] };
  regex: { pattern: string; text: string };
  text: { text: string };
  message: { text: string; bytes: number[] };
  binary: { bytes: number[]; sections: Section[] };
  ico: { numbers: string[]; corrupted: boolean[] };
  register: { fill: number; message: string };
  cipher: { plaintext: string; key: string };
  records: { records: Rec[] };
  pair: { a: string; b: string };
  names: { names: string[]; entity: number[] };
  documents: { docs: Doc[] };
  versions: { a: string[]; b: string[] };
  merge: { base: string[]; ours: string[]; theirs: string[] };
}
export type InputKind = keyof Inputs;

interface KindDef {
  size: { label: string; min: number; max: number; step: number; value: number };
  /** Sizes a lab measures the growth of work over. */
  scale: number[];
  shapes: { value: string; label: string }[];
  /** opts: the kernel's own params, its defaults filled in; an absent key is the old constant. */
  make(rnd: () => number, n: number, shape: string, opts: InputOpts): unknown;
}

/** A kernel's params that shape its input (src/engines/string/index.ts optsOf). */
export type InputOpts = Readonly<Record<string, string | number | boolean>>;

type Rnd = () => number;
const pick = <T>(rnd: Rnd, a: ArrayLike<T>): T => a[Math.floor(rnd() * a.length)];
const int = (rnd: Rnd, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

const ZIPF = (() => {
  const w = ENGLISH.map((_, i) => 1 / (i + 1));
  const total = w.reduce((s, x) => s + x, 0);
  let acc = 0;
  return w.map((x) => (acc += x / total));
})();
function word(rnd: Rnd): string {
  const u = rnd();
  const i = ZIPF.findIndex((c) => u <= c);
  return ENGLISH[i < 0 ? ENGLISH.length - 1 : i];
}
export function prose(rnd: Rnd, chars: number): string {
  const out: string[] = [];
  let len = 0;
  while (len < chars) { const w = word(rnd); out.push(w); len += w.length + 1; }
  return out.join(' ').slice(0, chars);
}

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** One typing slip: swap, drop, double or replace a letter (never the first). */
function typo(rnd: Rnd, s: string): string {
  if (s.length < 3) return s;
  const i = int(rnd, 1, s.length - 2);
  switch (int(rnd, 0, 3)) {
    case 0: return s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
    case 1: return s.slice(0, i) + s.slice(i + 1);
    case 2: return s.slice(0, i) + s[i] + s.slice(i);
    default: return s.slice(0, i) + pick(rnd, 'aeiouynrst') + s.slice(i + 1);
  }
}

// --- expressions: a random tree printed with the fewest parentheses its precedence needs
type Node = { v: string } | { op: string; l: Node; r: Node };
const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '^': 3 };
function tree(rnd: Rnd, leaves: number): Node {
  if (leaves <= 1) return { v: String(int(rnd, 1, 9)) };
  if (leaves === 2 && rnd() < 0.2) return { op: '^', l: { v: String(int(rnd, 1, 4)) }, r: { v: String(int(rnd, 2, 3)) } };
  const left = int(rnd, 1, leaves - 1);
  const u = rnd();
  return { op: u < 0.4 ? '+' : u < 0.7 ? '-' : '*', l: tree(rnd, left), r: tree(rnd, leaves - left) };
}
function infix(n: Node, out: string[], parent = 0, side: 'l' | 'r' = 'l'): void {
  if ('v' in n) { out.push(n.v); return; }
  const p = PREC[n.op];
  const right = n.op === '^';
  const paren = p < parent || (p === parent && (right ? side === 'l' : side === 'r'));
  if (paren) out.push('(');
  infix(n.l, out, p, 'l');
  out.push(n.op);
  infix(n.r, out, p, 'r');
  if (paren) out.push(')');
}
function postfix(n: Node, out: string[]): void {
  if ('v' in n) { out.push(n.v); return; }
  postfix(n.l, out); postfix(n.r, out); out.push(n.op);
}

// --- regular expressions over a small alphabet, with a sample string that matches
type Re = { s: string; sample: (rnd: Rnd) => string; atom: boolean };
function regex(rnd: Rnd, depth: number): Re {
  const u = rnd();
  if (depth <= 0 || u < 0.3) {
    const c = rnd() < 0.15 ? '.' : pick(rnd, 'abc');
    return { s: c, atom: true, sample: (r) => (c === '.' ? pick(r, 'abc') : c) };
  }
  if (u < 0.6) {
    const parts = [regex(rnd, depth - 1), regex(rnd, depth - 1), ...(rnd() < 0.4 ? [regex(rnd, depth - 1)] : [])];
    return { s: parts.map((p) => p.s).join(''), atom: false, sample: (r) => parts.map((p) => p.sample(r)).join('') };
  }
  if (u < 0.8) {
    const a = regex(rnd, depth - 1); const b = regex(rnd, depth - 1);
    return { s: `(${a.s}|${b.s})`, atom: true, sample: (r) => (r() < 0.5 ? a : b).sample(r) };
  }
  const a = regex(rnd, depth - 1);
  const base = a.atom ? a.s : `(${a.s})`;
  const q = pick(rnd, '*+?');
  return {
    s: base + q, atom: false,
    sample: (r) => {
      const k = q === '*' ? int(r, 0, 3) : q === '+' ? int(r, 1, 3) : int(r, 0, 1);
      return Array.from({ length: k }, () => a.sample(r)).join('');
    },
  };
}

// --- names
function person(rnd: Rnd) { return { given: pick(rnd, GIVEN), surname: pick(rnd, SURNAME) }; }
function company(rnd: Rnd) {
  const words = [pick(rnd, TRADE), ...(rnd() < 0.6 ? [pick(rnd, TRADE)] : [])];
  return { words: [...new Set(words)], form: pick(rnd, LEGAL_FORMS) };
}
/** Variants a normaliser must fold: case, diacritics, titles, legal-form spelling, order. */
function personVariant(rnd: Rnd, g: string, s: string): string {
  let a = g; let b = s;
  if (rnd() < 0.4) { a = fold(a); b = fold(b); }
  if (rnd() < 0.25) { a = a.toUpperCase(); b = b.toUpperCase(); }
  let name = rnd() < 0.3 ? `${b}, ${a}` : rnd() < 0.2 ? `${b} ${a}` : `${a} ${b}`;
  if (rnd() < 0.4) name = `${pick(rnd, TITLES.slice(0, 8))} ${name}`;
  if (rnd() < 0.2) name = `${name}, ${pick(rnd, TITLES.slice(9))}`;
  if (rnd() < 0.15) name = name.replace(' ', '  ');
  return name;
}
function companyVariant(rnd: Rnd, words: string[], form: { spellings: string[] }): string {
  let w = words.join(' ');
  if (rnd() < 0.4) w = fold(w);
  if (rnd() < 0.3) w = w.toUpperCase();
  const sep = rnd() < 0.3 ? ', ' : ' ';
  return `${w}${sep}${pick(rnd, form.spellings)}`;
}

function noisyName(rnd: Rnd, s: string): string {
  let out = s;
  const k = int(rnd, 1, 3);
  for (let t = 0; t < k; t++) {
    const u = rnd();
    if (u < 0.35) out = fold(out);
    else if (u < 0.75) {
      const parts = out.split(' ');
      const i = Math.floor(rnd() * parts.length);
      parts[i] = typo(rnd, parts[i]);
      out = parts.join(' ');
    } else if (u < 0.9) out = out.toUpperCase();
    else { const parts = out.split(' '); out = [...parts.slice(1), parts[0]].join(' '); }
  }
  return out === s ? typo(rnd, s) : out;
}

function edits(rnd: Rnd, a: string[], k: number, tok: () => string): string[] {
  const b = a.slice();
  for (let t = 0; t < k; t++) {
    const i = Math.floor(rnd() * (b.length + 1));
    const u = rnd();
    if (u < 0.35 && b.length > 1) b.splice(i, int(rnd, 1, 2));
    else if (u < 0.7) b.splice(i, 0, ...Array.from({ length: int(rnd, 1, 2) }, tok));
    else if (b.length) b[Math.min(i, b.length - 1)] = tok();
  }
  return b;
}

const LINE_KEYS = ['port', 'host', 'retries', 'timeout', 'mode', 'level', 'user', 'path', 'cache',
  'limit', 'region', 'format', 'queue', 'workers', 'backup', 'theme', 'locale', 'proxy'];
const line = (rnd: Rnd) => `${pick(rnd, LINE_KEYS)} = ${pick(rnd, ENGLISH.slice(40, 140))}`;

function icoCheck(d: number[]): number {
  let s = 0;
  for (let i = 0; i < 7; i++) s += d[i] * (8 - i);
  return (11 - (s % 11)) % 10;
}

export const KINDS: Record<InputKind, KindDef> = {
  search: {
    size: { label: 'Text length', min: 16, max: 2048, step: 16, value: 96 },
    scale: [64, 128, 256, 512, 1024, 2048],
    shapes: [{ value: 'words', label: 'English words' }, { value: 'dna', label: 'DNA (ACGT)' },
      { value: 'repetitive', label: 'Repetitive (aaa…ab, pattern grows with n)' }],
    make(rnd, n, shape, opts) {
      // the search kernels' pattern length (src/kernels/string/_search.ts): 'auto' draws it
      const fixed = Number(opts.m) > 0 ? Number(opts.m) : 0;
      if (shape === 'repetitive') {
        // the worst case of the naive search: a pattern a…ab of length n/16 over runs of a whose
        // lone b's lie one to three pattern lengths apart, the last at the end of the text
        const m = fixed ? Math.min(fixed, n) : Math.max(6, Math.floor(n / 16));
        const cells = new Array<string>(n).fill('a');
        for (let at = n - 1; at >= m - 1; at -= m + Math.floor(rnd() * 2 * m)) cells[at] = 'b';
        return { text: cells.join(''), pattern: `${'a'.repeat(m - 1)}b` };
      }
      const text = shape === 'dna' ? Array.from({ length: n }, () => pick(rnd, 'ACGT')).join('') : prose(rnd, n);
      const m = Math.min(text.length, fixed || (shape === 'dna' ? 6 : int(rnd, 4, 7)));
      const at = int(rnd, 0, text.length - m);
      return { text, pattern: text.slice(at, at + m) };
    },
  },
  expression: {
    size: { label: 'Operands', min: 2, max: 16, step: 1, value: 7 },
    scale: [2, 4, 8, 16, 32, 64],
    shapes: [],
    make(rnd, n) {
      const t = tree(rnd, n);
      const a: string[] = []; const b: string[] = [];
      infix(t, a); postfix(t, b);
      return { infix: a, postfix: b };
    },
  },
  words: {
    size: { label: 'Strings', min: 4, max: 64, step: 1, value: 14 },
    scale: [16, 32, 64, 128, 256, 512],
    shapes: [],
    make(rnd, n) {
      const stems = Array.from({ length: Math.max(2, Math.ceil(n / 3)) }, () => pick(rnd, ENGLISH.slice(30)));
      return {
        words: Array.from({ length: n }, () => {
          const s = pick(rnd, stems);
          const u = rnd();
          return u < 0.5 ? s : u < 0.7 ? `${s}s` : u < 0.85 ? `${s}ing` : `${s}er`;
        }),
      };
    },
  },
  regex: {
    size: { label: 'Text length', min: 8, max: 200, step: 4, value: 36 },
    scale: [16, 32, 64, 128, 256, 512],
    shapes: [],
    make(rnd, n, _shape, opts) {
      // the pattern's tree depth, regex-nfa's Pattern nesting
      const depth = Number(opts.depth ?? 3);
      let re = regex(rnd, depth);
      for (let t = 0; t < 50 && (new RegExp(`^(?:${re.s})$`).test('') || re.s.length < 4); t++) re = regex(rnd, depth);
      const chars = Array.from({ length: n }, () => pick(rnd, 'abc'));
      for (let k = 0; k < 2; k++) {
        const s = re.sample(rnd).slice(0, n);
        const at = int(rnd, 0, n - s.length);
        for (let i = 0; i < s.length; i++) chars[at + i] = s[i];
      }
      return { pattern: re.s, text: chars.join('') };
    },
  },
  text: {
    size: { label: 'Characters', min: 16, max: 1024, step: 8, value: 120 },
    scale: [64, 128, 256, 512, 1024, 2048],
    shapes: [{ value: 'prose', label: 'English prose' }, { value: 'repetitive', label: 'Repeated phrases' },
      { value: 'runs', label: 'Scanline runs' }],
    make(rnd, n, shape, opts) {
      if (shape === 'runs') {
        // runs of 1 + ⌊Exp⌋ symbols, the exponential's mean run-length encoding's control
        const mean = Number(opts.meanRun ?? 6);
        let s = '';
        while (s.length < n) s += pick(rnd, '.#').repeat(1 + Math.floor(-Math.log(1 - rnd()) * mean));
        return { text: s.slice(0, n) };
      }
      if (shape === 'repetitive') {
        const phrases = Array.from({ length: 3 }, () => `${word(rnd)} ${word(rnd)} `);
        let s = '';
        while (s.length < n) s += pick(rnd, phrases);
        return { text: s.slice(0, n) };
      }
      return { text: prose(rnd, n) };
    },
  },
  message: {
    size: { label: 'Message bytes', min: 1, max: 32, step: 1, value: 4 },
    scale: [4, 8, 16, 32, 64, 128],
    shapes: [{ value: 'text', label: 'Random text' }, { value: 'check', label: 'Check input 123456789' }],
    make(rnd, n, shape) {
      const text = shape === 'check' ? '123456789' : prose(rnd, n);
      return { text, bytes: [...text].map((c) => c.charCodeAt(0) & 255) };
    },
  },
  binary: {
    size: { label: 'Blocks of 256 bytes', min: 4, max: 64, step: 1, value: 16 },
    scale: [4, 8, 16, 32, 64, 128],
    shapes: [],
    make(rnd, n) {
      const bytes: number[] = [];
      const sections: Section[] = [];
      const add = (kind: string, blocks: number) => {
        const start = bytes.length;
        const len = blocks * 256;
        const ops = Array.from({ length: 40 }, () => int(rnd, 0, 255));
        let v = int(rnd, 0, 1000);
        while (bytes.length < start + len) {
          if (kind === 'header') {
            const h = [0x7f, 0x47, 0x4c, 0x59, 2, 1, 1, 0];
            for (let i = 0; i < len; i++) bytes.push(i < h.length ? h[i] : i < 64 && i % 8 < 2 ? int(rnd, 0, 15) : 0);
          } else if (kind === 'code') {
            const u = rnd();
            bytes.push(u < 0.75 ? ops[Math.floor(Math.pow(rnd(), 2.2) * ops.length)] : int(rnd, 0, 255));
          } else if (kind === 'text') {
            for (const c of prose(rnd, 64) + '\n') bytes.push(c.charCodeAt(0));
          } else if (kind === 'table') {
            v += int(rnd, 1, 40);
            bytes.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, 0);
          } else if (kind === 'zero') bytes.push(0);
          else bytes.push(int(rnd, 0, 255));
        }
        bytes.length = start + len;
        sections.push({ start, end: start + len, kind });
      };
      add('header', 1);
      const kinds = ['code', 'text', 'table', 'zero', 'random'];
      while (bytes.length < n * 256) {
        const left = n - bytes.length / 256;
        add(pick(rnd, kinds), Math.min(left, int(rnd, 1, Math.max(1, Math.ceil(n / 5)))));
      }
      return { bytes, sections };
    },
  },
  ico: {
    size: { label: 'Numbers', min: 4, max: 48, step: 1, value: 12 },
    scale: [8, 16, 32, 64, 128, 256],
    shapes: [],
    make(rnd, n) {
      const numbers: string[] = []; const corrupted: boolean[] = [];
      for (let k = 0; k < n; k++) {
        const d = Array.from({ length: 7 }, () => int(rnd, 0, 9));
        d.push(icoCheck(d));
        let bad = false;
        if (rnd() < 0.4) {
          if (rnd() < 0.5) {
            const i = int(rnd, 0, 7);
            d[i] = (d[i] + int(rnd, 1, 9)) % 10;
            bad = true;
          } else {
            const i = int(rnd, 0, 6);
            if (d[i] !== d[i + 1]) { [d[i], d[i + 1]] = [d[i + 1], d[i]]; bad = true; }
          }
        }
        numbers.push(d.join('')); corrupted.push(bad);
      }
      return { numbers, corrupted };
    },
  },
  register: {
    size: { label: 'Message characters', min: 1, max: 32, step: 1, value: 6 },
    scale: [4, 8, 16, 32, 64, 128],
    shapes: [],
    make(rnd, n) { return { fill: (Math.floor(rnd() * 0xffffffff) >>> 0) | 1, message: prose(rnd, n) }; },
  },
  cipher: {
    size: { label: 'Plaintext letters', min: 60, max: 1500, step: 20, value: 420 },
    scale: [100, 200, 400, 800, 1600, 3200],
    shapes: [],
    make(rnd, n) {
      let letters = '';
      while (letters.length < n) letters += prose(rnd, 200).replace(/[^a-z]/g, '').toUpperCase();
      const keys = ENGLISH.filter((w) => w.length >= 3 && w.length <= 7);
      return { plaintext: letters.slice(0, n), key: pick(rnd, keys).toUpperCase() };
    },
  },
  records: {
    size: { label: 'People', min: 4, max: 60, step: 1, value: 16 },
    scale: [8, 16, 32, 64, 128, 256],
    shapes: [],
    make(rnd, n) {
      const records: Rec[] = [];
      for (let e = 0; e < n; e++) {
        const p = person(rnd);
        const year = int(rnd, 1940, 2005);
        const town = pick(rnd, TOWN);
        const copies = int(rnd, 1, 3);
        for (let c = 0; c < copies; c++) {
          let { given, surname } = p;
          let t = town; let y = year;
          if (c > 0) {
            if (rnd() < 0.35) { given = fold(given); surname = fold(surname); t = fold(t); }
            if (rnd() < 0.3) surname = typo(rnd, surname);
            if (rnd() < 0.15) given = typo(rnd, given);
            if (rnd() < 0.1) y += rnd() < 0.5 ? -1 : 1;
            if (rnd() < 0.1) t = pick(rnd, TOWN);
          }
          records.push({ id: 0, given, surname, year: y, town: t, entity: e });
        }
      }
      for (let i = records.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [records[i], records[j]] = [records[j], records[i]];
      }
      records.forEach((r, i) => { r.id = i; });
      return { records };
    },
  },
  pair: {
    size: { label: 'Name length at least', min: 4, max: 48, step: 1, value: 12 },
    scale: [8, 16, 32, 64, 128, 256],
    shapes: [{ value: 'person', label: 'Person names' }, { value: 'company', label: 'Company names' }],
    make(rnd, n, shape) {
      let a = '';
      if (shape === 'company') {
        const c = company(rnd);
        a = `${c.words.join(' ')} ${c.form.spellings[0]}`;
        while (a.length < n) a = `${pick(rnd, TRADE)} ${a}`;
      } else {
        const p = person(rnd);
        a = `${p.given} ${p.surname}`;
        while (a.length < n) a = `${pick(rnd, GIVEN)} ${a}`;
      }
      return { a, b: noisyName(rnd, a) };
    },
  },
  names: {
    size: { label: 'Names', min: 4, max: 40, step: 1, value: 12 },
    scale: [8, 16, 32, 64, 128, 256],
    shapes: [{ value: 'mixed', label: 'People and companies' }, { value: 'people', label: 'People' },
      { value: 'companies', label: 'Companies' }, { value: 'spellings', label: 'Surnames as spelt abroad' }],
    make(rnd, n, shape) {
      if (shape === 'spellings') {
        const fams = shuffle(SPELLINGS.map((_, i) => i), rnd).slice(0, Math.max(2, Math.ceil(n / 3)));
        const names: string[] = []; const entity: number[] = [];
        for (let k = 0; k < n; k++) {
          const e = fams[k % fams.length];
          names.push(pick(rnd, SPELLINGS[e])); entity.push(e);
        }
        return { names, entity };
      }
      const m = Math.max(2, Math.ceil(n / 2.5));
      const ents = Array.from({ length: m }, (_, e) => {
        const isCo = shape === 'companies' || (shape !== 'people' && e % 2 === 1);
        if (isCo) { const c = company(rnd); return (r: Rnd) => companyVariant(r, c.words, c.form); }
        const p = person(rnd);
        return (r: Rnd) => personVariant(r, p.given, p.surname);
      });
      const names: string[] = []; const entity: number[] = [];
      for (let k = 0; k < n; k++) {
        const e = k < m ? k : Math.floor(rnd() * m);
        names.push(ents[e](rnd)); entity.push(e);
      }
      return { names, entity };
    },
  },
  documents: {
    size: { label: 'Stories', min: 2, max: 12, step: 1, value: 5 },
    scale: [2, 4, 8, 16, 32, 64],
    shapes: [],
    make(rnd, n) {
      const docs: Doc[] = [];
      for (let f = 0; f < n; f++) {
        const title = prose(rnd, int(rnd, 28, 44)).replace(/\s\S*$/, '');
        const body = prose(rnd, int(rnd, 260, 420)).split(' ');
        const agency = rnd() < 0.7 ? pick(rnd, AGENCIES) : '';
        const outlets = shuffle(OUTLETS.slice(), rnd);
        const copies = int(rnd, 1, 4);
        const t0 = int(rnd, 0, 500);
        for (let c = 0; c < copies; c++) {
          let words = body.slice();
          if (c > 0) {
            for (let k = int(rnd, 1, 5); k > 0; k--) words[int(rnd, 0, words.length - 1)] = word(rnd);
            if (rnd() < 0.4) words = words.slice(0, words.length - int(rnd, 3, 12));
            if (rnd() < 0.3) words = ['updated', ...words];
          }
          docs.push({
            id: 0, outlet: outlets[c % outlets.length], title, text: words.join(' '),
            credit: agency && rnd() < 0.7 ? agency : '', family: f, time: t0 + c * int(rnd, 5, 60),
          });
        }
      }
      for (let i = docs.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [docs[i], docs[j]] = [docs[j], docs[i]];
      }
      docs.forEach((d, i) => { d.id = i; });
      return { docs };
    },
  },
  versions: {
    size: { label: 'Tokens', min: 4, max: 48, step: 1, value: 14 },
    scale: [16, 32, 64, 128, 256, 512],
    shapes: [{ value: 'letters', label: 'Letters' }, { value: 'lines', label: 'Lines' }],
    make(rnd, n, shape) {
      const tok = shape === 'lines' ? () => line(rnd) : () => pick(rnd, 'ABCDEF');
      const a = Array.from({ length: n }, tok);
      return { a, b: edits(rnd, a, Math.max(1, Math.round(n / 5)), tok) };
    },
  },
  merge: {
    size: { label: 'Lines', min: 4, max: 40, step: 1, value: 12 },
    scale: [8, 16, 32, 64, 128, 256],
    shapes: [],
    make(rnd, n) {
      const base = Array.from({ length: n }, () => line(rnd));
      const tok = () => line(rnd);
      const ours = edits(rnd, base, Math.max(1, Math.round(n / 6)), tok);
      const theirs = edits(rnd, base, Math.max(1, Math.round(n / 6)), tok);
      return { base, ours, theirs };
    },
  },
};

/** The seeded input of a kind, shaped by the kernel's params (none: every old constant). */
export function input<K extends InputKind>(kind: K, n: number, shape: string, seed: number,
  opts: InputOpts = {}): Inputs[K] {
  const def = KINDS[kind];
  const s = def.shapes.some((x) => x.value === shape) ? shape : def.shapes[0]?.value ?? '';
  return def.make(mulberry32(seed), n, s, opts) as Inputs[K];
}
