import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { Search, terrain } from '../src/plates/pathfinding-terrain/search';

function maps(count: number) {
  const out = [];
  for (let s = 1; out.length < count && s < 200; s++) {
    const { terrain: t } = terrain(48, 30, mulberry32(s), 1.2, 0.8);
    const start = 15 * 48 + 1;
    const goal = 15 * 48 + 46;
    if (!Number.isFinite(t.cost[start]) || !Number.isFinite(t.cost[goal])) continue;
    out.push({ t, start, goal });
  }
  return out;
}

describe('pathfinding', () => {
  it('A* with an admissible heuristic finds Dijkstra\'s optimum and expands no more', () => {
    for (const { t, start, goal } of maps(25)) {
      const d = new Search(t, start, goal, 'dijkstra');
      const a = new Search(t, start, goal, 'astar', 1);
      expect(a.run()).toBe(d.run());
      if (d.status !== 'found') continue;
      expect(a.g[goal]).toBeCloseTo(d.g[goal], 9);
      expect(a.expanded).toBeLessThanOrEqual(d.expanded);
    }
  });

  it('greedy and weighted A* never beat the optimum', () => {
    for (const { t, start, goal } of maps(25)) {
      const d = new Search(t, start, goal, 'dijkstra');
      if (d.run() !== 'found') continue;
      for (const s of [new Search(t, start, goal, 'greedy'), new Search(t, start, goal, 'astar', 3)]) {
        expect(s.run()).toBe('found');
        expect(s.g[goal]).toBeGreaterThanOrEqual(d.g[goal] - 1e-9);
      }
    }
  });

  it('the path is connected, avoids walls and its cost is the sum of entered cells', () => {
    const [{ t, start, goal }] = maps(1);
    const s = new Search(t, start, goal, 'astar');
    expect(s.run()).toBe('found');
    const path = s.path();
    expect(path[0]).toBe(start);
    expect(path[path.length - 1]).toBe(goal);
    let sum = 0;
    for (let k = 1; k < path.length; k++) {
      const a = path[k - 1];
      const b = path[k];
      const manhattan = Math.abs((a % t.w) - (b % t.w)) + Math.abs(Math.floor(a / t.w) - Math.floor(b / t.w));
      expect(manhattan).toBe(1);
      expect(Number.isFinite(t.cost[b])).toBe(true);
      sum += t.cost[b];
    }
    expect(sum).toBeCloseTo(s.g[goal], 9);
  });

  it('a walled-off goal fails instead of looping', () => {
    const { terrain: t } = terrain(10, 10, mulberry32(3), 1, 2);
    // the goal (9, 0) has two neighbours, 8 and 19: wall both
    for (const i of [8, 19]) t.cost[i] = Infinity;
    expect(new Search(t, 0, 9, 'dijkstra').run()).toBe('failed');
  });
});
