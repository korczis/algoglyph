/**
 * Letters that carry their mark in the letter itself, so canonical decomposition leaves them
 * whole: folded to the spelling they are usually transliterated to.
 */
const WHOLE: Record<string, string> = {
  Ł: 'L', ł: 'l', ß: 'ss', ẞ: 'SS', Ø: 'O', ø: 'o', Đ: 'D', đ: 'd', Ħ: 'H', ħ: 'h', ı: 'i',
  Æ: 'AE', æ: 'ae', Œ: 'OE', œ: 'oe', Þ: 'TH', þ: 'th',
};
const WHOLE_RE = new RegExp(`[${Object.keys(WHOLE).join('')}]`, 'g');

/** Fold diacritics: canonical decomposition, drop the combining marks, then the whole letters. */
export const foldMarks = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(WHOLE_RE, (c) => WHOLE[c]);

/** Academic titles written before or after Czech names, with their dots removed. */
export const TITLE_TOKENS = new Set(['ing', 'mgr', 'bc', 'mudr', 'judr', 'phdr', 'rndr', 'doc',
  'prof', 'phd', 'csc', 'mba', 'dis']);

/** Legal forms by the letters of their trailing tokens joined, to a canonical key. */
export const FORMS: Record<string, string> = {
  sro: 'sro', spolsro: 'sro', as: 'as', akciovaspolecnost: 'as', vos: 'vos', ks: 'ks', zs: 'zs',
  gmbh: 'gmbh', ltd: 'ltd', limited: 'ltd', inc: 'inc',
};

export interface Normal { folded: string; tokens: string[]; titles: string[]; form: string; key: string }

/** The canonical form of a person's or a company's name. */
export function normalise(name: string): Normal {
  const folded = foldMarks(name).toLowerCase();
  let tokens = folded.split(/[\s,;]+/).map((t) => t.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  const titles = tokens.filter((t) => TITLE_TOKENS.has(t));
  tokens = tokens.filter((t) => !TITLE_TOKENS.has(t));
  let form = '';
  for (let k = Math.min(4, tokens.length - 1); k >= 1; k--) {
    const f = FORMS[tokens.slice(tokens.length - k).join('')];
    if (f) { form = f; tokens = tokens.slice(0, tokens.length - k); break; }
  }
  const sorted = tokens.slice().sort();
  return { folded, tokens: sorted, titles, form, key: sorted.join(' ') + (form ? ` ${form}` : '') };
}

/** Jaro–Winkler similarity with Winkler's prefix bonus (scale 0.1, prefix up to 4, boost above 0.7). */
export function jaroWinkler(a: string, b: string, eq: (i: number, j: number) => boolean = (i, j) => a[i] === b[j]) {
  const la = a.length; const lb = b.length;
  if (!la && !lb) return { jaro: 1, jw: 1, m: 0, t: 0, matchA: [] as number[], matchB: [] as number[], prefix: 0 };
  const win = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const usedB = new Array<boolean>(lb).fill(false);
  const matchA: number[] = new Array(la).fill(-1);
  for (let i = 0; i < la; i++) {
    for (let j = Math.max(0, i - win); j <= Math.min(lb - 1, i + win); j++) {
      if (usedB[j]) continue;
      if (eq(i, j)) { usedB[j] = true; matchA[i] = j; break; }
    }
  }
  const ia = matchA.map((j, i) => (j >= 0 ? i : -1)).filter((i) => i >= 0);
  const jb = usedB.map((u, j) => (u ? j : -1)).filter((j) => j >= 0);
  const m = ia.length;
  let half = 0;
  for (let k = 0; k < m; k++) if (a[ia[k]] !== b[jb[k]]) half++;
  const t = half / 2;
  const jaro = m ? (m / la + m / lb + (m - t) / m) / 3 : 0;
  let prefix = 0;
  while (prefix < Math.min(4, la, lb) && a[prefix] === b[prefix]) prefix++;
  const jw = jaro > 0.7 ? jaro + prefix * 0.1 * (1 - jaro) : jaro;
  return { jaro, jw, m, t, matchA, matchB: jb, prefix };
}

/** FNV-1a, 32 bits, over UTF-16 code units. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** The 32-bit finaliser of MurmurHash3: a seeded member of a family of mixing functions. */
export function mix32(x: number, seed: number): number {
  let h = (x ^ Math.imul(seed, 0x9e3779b9)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Word k-shingles of a text. */
export function shingles(text: string, k: number): string[] {
  const w = text.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(' '));
  if (!out.size && w.length) out.add(w.join(' '));
  return [...out];
}

export function jaccard(a: Set<string> | Set<number>, b: Set<string> | Set<number>): number {
  let inter = 0;
  for (const x of a as Set<unknown>) if ((b as Set<unknown>).has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni ? inter / uni : 1;
}

export class UnionFind {
  parent: number[];
  constructor(n: number) { this.parent = Array.from({ length: n }, (_, i) => i); }
  find(x: number): number {
    while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x]; }
    return x;
  }
  union(a: number, b: number): boolean {
    const ra = this.find(a); const rb = this.find(b);
    if (ra === rb) return false;
    this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
    return true;
  }
}
