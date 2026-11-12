import { topBits, type HashKernel, type HashOps } from '../../engines/hash/table';

// Extendible hashing: a directory of 2^g entries, indexed by the leading g bits of the hash,
// points at pages of a fixed capacity. A full page splits on its next bit; when its local depth
// already equals g the directory doubles first. Deletion leaves pages unmerged.

function locate(t: HashOps, h: number): number {
  const page = t.dir(topBits(h, t.globalDepth));
  t.load(page);
  return page;
}

function position(t: HashOps, page: number, key: number): number {
  const n = t.len(page);
  for (let i = 0; i < n; i++) if (t.read(page, i) === key) return i;
  return -1;
}

/** Split the page that hash h leads to, on the bit after its local depth. */
function split(t: HashOps, page: number, h: number): void {
  const d = t.depth(page);
  if (d === t.globalDepth) t.doubleDir();
  const g = t.globalDepth;
  const index = topBits(h, g);
  const span = 2 ** (g - d);
  const start = Math.floor(index / span) * span;
  const q = t.newPage(d + 1);
  t.setDepth(page, d + 1);
  // the upper half of the page's directory range now points at the new page
  for (let i = start + span / 2; i < start + span; i++) t.setDir(i, q);
  for (let i = t.len(page) - 1; i >= 0; i--) {
    const v = t.read(page, i);
    if ((t.hash(v) >>> (31 - d)) & 1) {
      t.remove(page, i);
      t.write(q, t.len(q), v, t.len(q));
    }
  }
}

export const kernel: HashKernel = {
  layout: 'pages',
  init(t) {
    const p = t.newPage(0);
    t.setDir(0, p);
  },
  insert(t, key) {
    const h = t.hash(key);
    for (;;) {
      const page = locate(t, h);
      if (position(t, page, key) >= 0) return false;
      const n = t.len(page);
      if (n < t.pageSize) { t.write(page, n, key, n); return true; }
      split(t, page, h);
    }
  },
  search(t, key) {
    return position(t, locate(t, t.hash(key)), key) >= 0;
  },
  remove(t, key) {
    const page = locate(t, t.hash(key));
    const i = position(t, page, key);
    if (i < 0) return false;
    t.remove(page, i);
    return true;
  },
  // Sedgewick's estimates for uniform keys (Algorithms in C, Part 4): about n / (b ln 2) pages,
  // and a directory of about (e / (b ln 2)) n^(1 + 1/b) entries, faster than linear
  growth: {
    label: "Sedgewick's estimate for uniform keys",
    pages: (n, b) => n / (b * Math.LN2),
    directory: (n, b) => (Math.E / (b * Math.LN2)) * n ** (1 + 1 / b),
  },
};
