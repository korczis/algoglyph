// Merkle trees and hash chains on SHA-256 of one 32-byte block (the tested compression in
// src/plates/hash-avalanche/hash.ts). A leaf hashes a tagged 32-byte record; a parent hashes the
// first 128 bits of each child's digest, side by side, so that it too fits one block. A chain
// link hashes the first 128 bits of the previous link with 128 bits of payload.
import { sha256Words } from '../../plates/hash-avalanche/hash';

export type Digest = Uint32Array;

const LEAF_TAG = 0x6c656166; // 'leaf'

function h(words: number[]): Digest {
  const msg = new Uint32Array(words);
  const out = new Uint32Array(8);
  sha256Words(msg, out);
  return out;
}

/** The digest of block `index` holding six data words. */
export function leafHash(index: number, data: ArrayLike<number>): Digest {
  return h([LEAF_TAG, index >>> 0, ...Array.from({ length: 6 }, (_, k) => (data[k] ?? 0) >>> 0)]);
}

export function nodeHash(l: Digest, r: Digest): Digest {
  return h([l[0], l[1], l[2], l[3], r[0], r[1], r[2], r[3]]);
}

export const same = (a: Digest, b: Digest) => a.every((x, i) => x === b[i]);
export const short = (d: Digest) => d[0].toString(16).padStart(8, '0').slice(0, 4);

/** levels[0] are the leaves' digests, the last level holds the root. Leaves: a power of two. */
export function build(blocks: number[][]): Digest[][] {
  const levels: Digest[][] = [blocks.map((b, i) => leafHash(i, b))];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next: Digest[] = [];
    for (let i = 0; i < prev.length; i += 2) next.push(nodeHash(prev[i], prev[i + 1]));
    levels.push(next);
  }
  return levels;
}

export const root = (levels: Digest[][]) => levels[levels.length - 1][0];

/** The sibling digests from leaf `i` up to the root. */
export function proof(levels: Digest[][], i: number): Digest[] {
  const out: Digest[] = [];
  for (let l = 0; l < levels.length - 1; l++, i >>= 1) out.push(levels[l][i ^ 1]);
  return out;
}

export function verify(rootDigest: Digest, index: number, data: ArrayLike<number>, path: Digest[]): boolean {
  let d = leafHash(index, data);
  let i = index;
  for (const s of path) { d = i & 1 ? nodeHash(s, d) : nodeHash(d, s); i >>= 1; }
  return same(d, rootDigest);
}

export interface Link { payload: number[]; hash: Digest }

export function linkHash(prev: Digest | null, payload: ArrayLike<number>): Digest {
  const p = prev ?? new Uint32Array(8);
  return h([p[0], p[1], p[2], p[3], ...Array.from({ length: 4 }, (_, k) => (payload[k] ?? 0) >>> 0)]);
}

export function append(chain: Link[], payload: number[]) {
  chain.push({ payload, hash: linkHash(chain.length ? chain[chain.length - 1].hash : null, payload) });
}

/**
 * The first link whose stored hash disagrees with its recomputation, or with a digest an
 * auditor anchored earlier (`anchors`: index -> digest); -1 when the chain is intact.
 */
export function audit(chain: Link[], anchors: Map<number, Digest> = new Map()): number {
  let prev: Digest | null = null;
  for (let i = 0; i < chain.length; i++) {
    const want = linkHash(prev, chain[i].payload);
    if (!same(want, chain[i].hash)) return i;
    const a = anchors.get(i);
    if (a && !same(a, chain[i].hash)) return i;
    prev = chain[i].hash;
  }
  return -1;
}
