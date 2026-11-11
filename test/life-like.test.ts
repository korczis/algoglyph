import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  bounds, Life, parseRule, PATTERNS, ruleString, type Pattern,
} from '../src/plates/life-like-automata/life';

const LIFE = parseRule('B3/S23')!;

function board(w: number, h: number, pattern: Pattern, x0: number, y0: number): Life {
  const g = new Life(w, h);
  g.place(pattern, x0, y0);
  g.perturbed();
  return g;
}

function live(g: Life): string[] {
  const out: string[] = [];
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) if (g.get(x, y)) out.push(`${x},${y}`);
  }
  return out.sort();
}

/** Conway's rule written out directly, on a torus, with no masks and no shared code. */
function conway(cells: number[][]): number[][] {
  const h = cells.length;
  const w = cells[0].length;
  return cells.map((row, y) => row.map((alive, x) => {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx || dy) n += cells[(y + dy + h) % h][(x + dx + w) % w];
      }
    }
    return n === 3 || (alive === 1 && n === 2) ? 1 : 0;
  }));
}

describe('life-like rules', () => {
  it('parses B/S notation and rejects malformed strings', () => {
    expect(parseRule('B3/S23')).toEqual({ birth: 1 << 3, survive: (1 << 2) | (1 << 3) });
    expect(parseRule('b36/s23')).toEqual({ birth: (1 << 3) | (1 << 6), survive: 12 });
    expect(parseRule('B2/S')).toEqual({ birth: 4, survive: 0 });
    expect(parseRule(' B3678/S34678 ')).not.toBeNull();
    for (const bad of ['', 'B3S23', '23/3', 'S23/B3', 'B9/S23', 'B33/S23', 'B3/S2a', 'B3/S23/',
      'Life', 'B-3/S23']) {
      expect(parseRule(bad), bad).toBeNull();
    }
    for (const s of ['B3/S23', 'B36/S23', 'B3678/S34678', 'B2/S', 'B/S012345678']) {
      expect(ruleString(parseRule(s)!)).toBe(s);
    }
  });

  it('B3/S23 equals Conway\'s Life written out by hand, on random soups', () => {
    const rnd = mulberry32(7);
    for (let trial = 0; trial < 5; trial++) {
      const g = new Life(23, 17);
      g.soup(0.35, rnd);
      let ref = Array.from({ length: g.h }, (_, y) => Array.from({ length: g.w },
        (_, x) => g.get(x, y)));
      for (let gen = 0; gen < 30; gen++) {
        g.step(LIFE);
        ref = conway(ref);
        let pop = 0;
        for (let y = 0; y < g.h; y++) {
          for (let x = 0; x < g.w; x++) {
            expect(g.get(x, y)).toBe(ref[y][x]);
            pop += ref[y][x];
          }
        }
        expect(g.population).toBe(pop);
      }
    }
  });

  it('Day & Night commutes with swapping live and dead; Seeds keeps no cell alive', () => {
    const dn = parseRule('B3678/S34678')!;
    const seeds = parseRule('B2/S')!;
    const rnd = mulberry32(11);
    const a = new Life(31, 19);
    a.soup(0.45, rnd);
    const b = new Life(31, 19);
    for (let i = 0; i < a.cells.length; i++) b.cells[i] = 1 - a.cells[i];
    for (let gen = 0; gen < 25; gen++) {
      a.step(dn);
      b.step(dn);
      for (let i = 0; i < a.cells.length; i++) expect(b.cells[i]).toBe(1 - a.cells[i]);
    }
    const before = Uint8Array.from(a.cells);
    a.step(seeds);
    for (let i = 0; i < a.cells.length; i++) if (before[i]) expect(a.cells[i]).toBe(0);
    expect(a.deaths).toBe(before.reduce((s, v) => s + v, 0));
  });

  it('a blinker has period 2 and a block is still', () => {
    const b = board(16, 16, PATTERNS.blinker, 6, 7);
    const start = live(b);
    b.step(LIFE);
    expect(live(b)).not.toEqual(start);
    b.step(LIFE);
    expect(live(b)).toEqual(start);
    expect(b.period).toBe(2);
    expect(b.cycleStart).toBe(0);
    expect(b.births).toBe(2);
    expect(b.deaths).toBe(2);

    const k = board(16, 16, PATTERNS.block, 6, 7);
    const block = live(k);
    k.step(LIFE);
    expect(live(k)).toEqual(block);
    expect(k.period).toBe(1);
    expect(k.births + k.deaths).toBe(0);
  });

  it('a glider returns to its shape moved by (1, 1) after 4 generations', () => {
    const g = board(20, 20, PATTERNS.glider, 5, 5);
    const shifted = PATTERNS.glider.map(([x, y]) => `${x + 6},${y + 6}`).sort();
    for (let k = 0; k < 4; k++) {
      g.step(LIFE);
      expect(g.population).toBe(5);
    }
    expect(live(g)).toEqual(shifted);
    expect(g.period).toBe(0);
  });

  it('wraps exactly: a glider comes back after 4·lcm(w, h) generations', () => {
    const g = board(12, 12, PATTERNS.glider, 9, 9);
    const start = live(g);
    for (let k = 0; k < 47; k++) {
      g.step(LIFE);
      expect(live(g)).not.toEqual(start);
    }
    g.step(LIFE);
    expect(live(g)).toEqual(start);
    expect(g.period).toBe(48);

    // on a 12 × 8 torus the glider repeats only after 4 · lcm(12, 8) = 96 generations
    const r = board(12, 8, PATTERNS.glider, 2, 2);
    for (let k = 0; k < 96; k++) r.step(LIFE);
    expect(r.period).toBe(96);
    expect(r.cycleStart).toBe(0);

    // a blinker straddling the corner behaves like one in the middle, shifted
    const corner = board(10, 10, PATTERNS.blinker, 9, 0);
    const middle = board(10, 10, PATTERNS.blinker, 4, 5);
    corner.step(LIFE);
    middle.step(LIFE);
    const moved = live(middle).map((c) => {
      const [x, y] = c.split(',').map(Number);
      return `${(x + 5) % 10},${(y + 5) % 10}`;
    }).sort();
    expect(live(corner)).toEqual(moved);
  });

  it('the Gosper gun adds one glider (5 cells) every 30 generations', () => {
    const gun = PATTERNS.gosperGun;
    expect(gun.length).toBe(36);
    expect(bounds(gun)).toEqual({ w: 36, h: 9 });
    const g = board(220, 220, gun, 4, 4);
    const pops: number[] = [g.population];
    for (let k = 0; k < 420; k++) {
      g.step(LIFE);
      pops.push(g.population);
    }
    for (let t = 30; t + 30 < pops.length; t++) expect(pops[t + 30] - pops[t]).toBe(5);
    expect(g.period).toBe(0);
  });
});
