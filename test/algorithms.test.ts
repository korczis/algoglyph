import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { binary, neighbourhoods, next } from '../src/plates/automaton/rule';
import { fnv1aWords, hex, popcount, sha256Words } from '../src/plates/avalanche/hash';
import { collatz } from '../src/plates/collatz/plate';
import { backtracker, flood, floodStep, grid, passages, path, prim } from '../src/plates/maze/maze';
import { ALGORITHMS, isSorted, type Counter } from '../src/plates/sorting/algorithms';
import { label } from '../src/plates/voronoi/plate';
import { mulberry32, shuffle } from '../src/core/random';

describe('sorting generators', () => {
  for (const [id, algo] of Object.entries(ALGORITHMS)) {
    it(`${id} sorts every permutation it is given`, () => {
      const rnd = mulberry32(7);
      for (const n of [1, 2, 3, 17, 96, 192]) {
        const a = shuffle(Array.from({ length: n }, (_, i) => i), rnd);
        const c: Counter = { cmp: 0, wr: 0 };
        let ops = 0;
        for (const touch of algo.run(a, c)) {
          expect(touch[0]).toBeGreaterThanOrEqual(0);
          expect(touch[1]).toBeLessThan(n);
          ops++;
        }
        expect(isSorted(a)).toBe(true);
        expect(a).toEqual(Array.from({ length: n }, (_, i) => i));
        if (n > 1 && id !== 'radix') expect(c.cmp).toBeGreaterThan(0);
        if (n > 1) expect(ops).toBeGreaterThan(0);
      }
    });
  }

  it('radix sort never compares', () => {
    const a = shuffle(Array.from({ length: 128 }, (_, i) => i), mulberry32(3));
    const c: Counter = { cmp: 0, wr: 0 };
    for (const _ of ALGORITHMS.radix.run(a, c)) { /* drain */ }
    expect(c.cmp).toBe(0);
    expect(c.wr).toBe(128 * 4);
  });

  it('insertion sort on sorted input costs n - 1 comparisons and no writes', () => {
    const a = Array.from({ length: 50 }, (_, i) => i);
    const c: Counter = { cmp: 0, wr: 0 };
    for (const _ of ALGORITHMS.insertion.run(a, c)) { /* drain */ }
    expect(c).toEqual({ cmp: 49, wr: 0 });
  });
});

describe('maze', () => {
  for (const [name, gen] of [['backtracker', backtracker], ['prim', prim]] as const) {
    it(`${name} carves a spanning tree that BFS fully reaches`, () => {
      const g = grid(23, 17);
      const source = 8 * 23 + 11;
      for (const _ of gen(g, mulberry32(11), source)) { /* drain */ }
      expect(passages(g)).toBe(23 * 17 - 1);
      const f = flood(g, source);
      while (floodStep(g, f)) { /* expand */ }
      expect(f.tail).toBe(23 * 17);
      expect(Array.from(f.dist).every((d) => d >= 0)).toBe(true);
      const route = path(g, f, f.far);
      expect(route[route.length - 1]).toBe(source);
      expect(route.length).toBe(f.max + 1);
    });
  }
});

describe('elementary automata', () => {
  const run = (rule: number, width: number, gens: number) => {
    let row = new Uint8Array(width);
    row[Math.floor(width / 2)] = 1;
    const hood = new Uint8Array(width);
    let out = new Uint8Array(width);
    const rows = [Array.from(row).join('')];
    for (let g = 0; g < gens; g++) {
      neighbourhoods(row, hood);
      next(rule, hood, out);
      [row, out] = [out, row];
      rows.push(Array.from(row).join(''));
    }
    return rows;
  };

  it('rule 90 draws Sierpiński\'s triangle', () => {
    expect(run(90, 9, 3)).toEqual(['000010000', '000101000', '001000100', '010101010']);
  });

  it('rule 30 matches its known first rows', () => {
    expect(run(30, 11, 3)).toEqual(['00000100000', '00001110000', '00011001000', '00110111100']);
  });

  it('prints rules as eight bits', () => {
    expect(binary(30)).toBe('00011110');
    expect(binary(255)).toBe('11111111');
  });
});

describe('hashes', () => {
  const words = (bytes: Buffer) => {
    const w = new Uint32Array(8);
    for (let i = 0; i < 8; i++) w[i] = bytes.readUInt32BE(i * 4);
    return w;
  };

  it('SHA-256 of 32 zero bytes matches the reference digest', () => {
    const out = new Uint32Array(8);
    sha256Words(new Uint32Array(8), out);
    expect(hex(out)).toBe('66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925');
  });

  it('SHA-256 agrees with node:crypto on random 32-byte messages', () => {
    const rnd = mulberry32(99);
    const out = new Uint32Array(8);
    for (let t = 0; t < 200; t++) {
      const bytes = Buffer.from(Array.from({ length: 32 }, () => Math.floor(rnd() * 256)));
      sha256Words(words(bytes), out);
      expect(hex(out)).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
  });

  it('FNV-1a 32 agrees with a byte-wise reference', () => {
    const rnd = mulberry32(5);
    const out = new Uint32Array(1);
    for (let t = 0; t < 100; t++) {
      const bytes = Buffer.from(Array.from({ length: 32 }, () => Math.floor(rnd() * 256)));
      let h = 0x811c9dc5;
      for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
      fnv1aWords(words(bytes), out);
      expect(out[0]).toBe(h);
    }
  });

  it('popcount counts bits', () => {
    expect(popcount(0)).toBe(0);
    expect(popcount(0xffffffff)).toBe(32);
    expect(popcount(0b1011)).toBe(3);
  });
});

describe('collatz', () => {
  it('27 takes 111 steps and peaks at 9232', () => {
    const orbit = collatz(27);
    expect(orbit.length - 1).toBe(111);
    expect(Math.max(...orbit)).toBe(9232);
    expect(orbit[orbit.length - 1]).toBe(1);
  });
});

describe('voronoi labelling', () => {
  it('bucket search equals brute force', () => {
    const rnd = mulberry32(21);
    const w = 61;
    const h = 37;
    const sites = Array.from({ length: 40 }, () => ({ x: rnd() * w, y: rnd() * h, hue: 0 }));
    const owner = new Int32Array(w * h);
    const d2 = new Float32Array(w * h);
    label(sites, w, h, owner, d2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let best = Infinity;
        for (const s of sites) best = Math.min(best, (s.x - x) ** 2 + (s.y - y) ** 2);
        expect(d2[y * w + x]).toBeCloseTo(best, 3);
      }
    }
  });
});
