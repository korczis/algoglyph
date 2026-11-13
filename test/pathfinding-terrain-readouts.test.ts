// pathfinding-terrain (wave 7a). D5: search.ts carried its own lazy binary heap; it now uses the
// shared one (src/kernels/geometry/_heap.ts Heap<T>), with the same sift comparisons, so the pop
// order is unchanged. The proof runs the old inline heap, kept here as the reference, beside the
// library one in the same run and asserts the same expansion order, distances and path on every
// map, kind and weight below.
// The latent crash: the plate tries 20 maps for one with a passable start, goal and a path
// between; if every attempt failed, `search` stayed unset and the first pace() or draw() threw.
// The test makes every attempt fail by drawing the terrain with every cell a wall (wall level 0,
// as a lower wall height would) and asks for a plate that says so instead.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { HOLD_FRAMES } from '../src/core/pace';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import type { Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { Search, terrain, type Kind, type Terrain } from '../src/plates/pathfinding-terrain/search';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

/** The plate's default map: 800 × 500 px (aspect 16/10) at 12 px cells. */
const W = 66;
const H = 41;
const WALL = 0.8;

/** The heap search.ts carried before D5, verbatim: parallel key and value arrays. */
class OldHeap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size(): number { return this.keys.length; }
  push(key: number, val: number): void {
    const k = this.keys; const v = this.vals;
    k.push(key); v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (k[parent] <= k[i]) break;
      [k[parent], k[i]] = [k[i], k[parent]];
      [v[parent], v[i]] = [v[i], v[parent]];
      i = parent;
    }
  }
  pop(): number {
    const k = this.keys; const v = this.vals;
    const top = v[0];
    const lk = k.pop() as number; const lv = v.pop() as number;
    if (k.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1; const r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

/** The old Search.step loop over the old heap: the cells in the order they are expanded. */
function oldRun(t: Terrain, start: number, goal: number, kind: Kind, weight: number) {
  const n = t.w * t.h;
  const g = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const h = (i: number) => (Math.abs((i % t.w) - (goal % t.w))
    + Math.abs(Math.floor(i / t.w) - Math.floor(goal / t.w))) * t.minCost;
  const pri = (i: number) => (kind === 'dijkstra' ? g[i] : kind === 'greedy' ? h(i) : g[i] + weight * h(i));
  const heap = new OldHeap();
  g[start] = 0;
  heap.push(pri(start), start);
  const order: number[] = [];
  while (heap.size) {
    const i = heap.pop();
    if (closed[i]) continue;
    closed[i] = 1;
    order.push(i);
    if (i === goal) return { order, g, parent, found: true };
    const x = i % t.w; const y = Math.floor(i / t.w);
    for (const j of [x > 0 ? i - 1 : -1, x < t.w - 1 ? i + 1 : -1, y > 0 ? i - t.w : -1, y < t.h - 1 ? i + t.w : -1]) {
      if (j < 0 || closed[j] || !Number.isFinite(t.cost[j])) continue;
      const ng = g[i] + t.cost[j];
      if (ng < g[j]) { g[j] = ng; parent[j] = i; heap.push(pri(j), j); }
    }
  }
  return { order, g, parent, found: false };
}

/** The library-heap Search, stepped one expansion at a time: the cells in expansion order. */
function newRun(t: Terrain, start: number, goal: number, kind: Kind, weight: number) {
  const s = new Search(t, start, goal, kind, weight);
  const order: number[] = [];
  const seen = new Uint8Array(t.w * t.h);
  while (s.status === 'running') {
    const before = s.expanded;
    s.step();
    if (s.expanded === before) continue;
    for (let i = 0; i < seen.length; i++) if (s.closed[i] && !seen[i]) { seen[i] = 1; order.push(i); }
  }
  return { order, s };
}

/** The plate's start and goal: the cheapest passable cell of column 1 and of column w − 2. */
function endpoints(t: Terrain): [number, number] {
  const pick = (x: number) => {
    let best = -1;
    for (let y = 1; y < t.h - 1; y++) {
      const i = y * t.w + x;
      if (Number.isFinite(t.cost[i]) && (best < 0 || t.cost[i] < t.cost[best])) best = i;
    }
    return best;
  };
  return [pick(1), pick(t.w - 2)];
}

describe('pathfinding-terrain: the shared heap keeps the pop order (D5)', () => {
  it('search.ts keeps no heap of its own and uses the shared one', () => {
    const src = readFileSync('src/plates/pathfinding-terrain/search.ts', 'utf8');
    expect(src).not.toMatch(/class Heap/);
    expect(src).toMatch(/from '\.\.\/\.\.\/kernels\/geometry\/_heap'/);
  });

  it('expands the same cells in the same order as the old inline heap, with the same distances and path', () => {
    let maps = 0;
    for (const seed of [4242, 7, 1, 99]) {
      for (const rough of [0, 1.2, 3]) {
        const { terrain: t } = terrain(W, H, mulberry32(seed), rough, WALL);
        const [start, goal] = endpoints(t);
        if (start < 0 || goal < 0) continue;
        maps++;
        for (const [kind, weight] of [['dijkstra', 1], ['astar', 1], ['astar', 2.5], ['astar', 5], ['greedy', 1]] as [Kind, number][]) {
          const at = `seed ${seed} rough ${rough} ${kind} ${weight}`;
          const old = oldRun(t, start, goal, kind, weight);
          const { order, s } = newRun(t, start, goal, kind, weight);
          expect(order, at).toEqual(old.order);
          expect(s.expanded, at).toBe(old.order.length);
          expect(s.status, at).toBe(old.found ? 'found' : 'failed');
          expect(Array.from(s.g), at).toEqual(Array.from(old.g));
          expect(Array.from(s.parent), at).toEqual(Array.from(old.parent));
        }
      }
    }
    expect(maps).toBeGreaterThanOrEqual(10);
  });
});

describe('pathfinding-terrain: a map whose every attempt fails (the latent crash)', () => {
  it('shows that no map was found instead of throwing', async () => {
    vi.resetModules();
    vi.doMock('../src/plates/pathfinding-terrain/search', async (importOriginal) => {
      const real = await importOriginal<typeof import('../src/plates/pathfinding-terrain/search')>();
      // every height is at least 0, so wall level 0 makes every cell a wall: no start, no goal
      return { ...real, terrain: (w: number, h: number, rnd: () => number, rough: number) => real.terrain(w, h, rnd, rough, 0) };
    });
    try {
      const plate = (await import('../src/plates/pathfinding-terrain/plate')).default as PlateCode;
      const params: Params = { ...Object.fromEntries(plate.params.map((d) => [d.key, d.value])), loop: false };
      const ground = GROUNDS.dark;
      let rows: Stat[] = [];
      const ctx: PlateContext = {
        width: 800, height: 500, params, seed: 4242, rnd: mulberry32(4242), theme: 'dark',
        bg: ground.bg, fg: ground.fg, thumbnail: false, palette: () => lookupPalette('phosphor'),
        stats(r) { rows = r; }, chart() {},
      };
      const sim = plate.create(p5Stub(), ctx);
      sim.setup();
      for (let f = 0; f < 10; f++) sim.draw();
      expect(sim.pace?.()).toMatchObject({ done: true });
      const value = (label: string) => rows.find((r) => r.label === label)?.value;
      expect(value('path cost')).toBe('no map found');
      expect(value('expanded cells')).toBe('0');
      // with a new map asked for when done, every later map fails too and the plate keeps going
      params.loop = true;
      for (let f = 0; f < 3 * HOLD_FRAMES; f++) sim.draw();
      expect(value('path cost')).toBe('no map found');
    } finally {
      vi.doUnmock('../src/plates/pathfinding-terrain/search');
      vi.resetModules();
    }
  });
});
