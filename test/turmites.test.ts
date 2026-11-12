import { describe, expect, it } from 'vitest';
import { MOVES, parseTurmite, Turmite } from '../src/plates/langton-turmites/ant';

describe('Langton\'s ant', () => {
  it('parses turmite strings', () => {
    expect(parseTurmite('RL')).toEqual([1, 3]);
    expect(parseTurmite('llrr')).toEqual([3, 3, 1, 1]);
    expect(parseTurmite('RNU')).toEqual([1, 0, 2]);
    for (const bad of ['', 'R', 'RX', 'R L', 'RLRLRLRLRLRLR']) {
      expect(parseTurmite(bad), bad).toBeNull();
    }
  });

  it('follows the rule by hand for the first steps', () => {
    const t = new Turmite(9, 9, [1, 3], [{ x: 4, y: 4, dir: 0 }]);
    // on white it turns right, blackens the cell and steps: right, down, left, up
    const path: string[] = [];
    for (let k = 0; k < 4; k++) {
      t.step();
      path.push(`${t.ants[0].x},${t.ants[0].y}`);
    }
    expect(path).toEqual(['5,4', '5,5', '4,5', '4,4']);
    expect(t.coloured).toBe(4);
    // back on a black cell: it turns left (now facing left), whitens it and steps
    t.step();
    expect(t.ants[0]).toEqual({ x: 3, y: 4, dir: 3 });
    expect(t.colourAt(4, 4)).toBe(0);
    expect(t.coloured).toBe(3);
    expect(t.visitedCount).toBe(5);
  });

  it('wraps exactly at the torus edge', () => {
    const t = new Turmite(5, 4, [1, 3], [{ x: 4, y: 0, dir: 0 }]);
    t.step();
    expect(t.ants[0]).toEqual({ x: 0, y: 0, dir: 1 });
    t.step();
    expect(t.ants[0]).toEqual({ x: 0, y: 1, dir: 2 });
    t.step();
    expect(t.ants[0]).toEqual({ x: 4, y: 1, dir: 3 });
  });

  it('builds its highway near step 10 000: period 104, 2 cells diagonally', () => {
    const t = new Turmite(400, 400, [1, 3], [{ x: 200, y: 200, dir: 0 }]);
    for (let k = 0; k < 9000; k++) t.step();
    expect(t.highway()).toBeNull();
    for (let k = 0; k < 2000; k++) t.step();
    const hw = t.highway();
    expect(hw).not.toBeNull();
    expect(hw!.period).toBe(104);
    expect(Math.abs(hw!.dx)).toBe(2);
    expect(Math.abs(hw!.dy)).toBe(2);
    expect(hw!.since).toBeGreaterThan(9000);
    expect(hw!.since).toBeLessThan(11000);
    // independent check: the position after 104 more steps is shifted by exactly (dx, dy)
    const before = { ...t.ants[0] };
    for (let k = 0; k < 104; k++) t.step();
    expect(t.ants[0].x - before.x).toBe(hw!.dx);
    expect(t.ants[0].y - before.y).toBe(hw!.dy);
    expect(t.ants[0].dir).toBe(before.dir);
  });

  it('keeps the highway\'s start once the move memory has rolled past it', () => {
    const t = new Turmite(1000, 1000, [1, 3], [{ x: 500, y: 500, dir: 0 }]);
    const starts: number[] = [];
    for (let k = 1; k <= 30; k++) {
      for (let s = 0; s < 1000; s++) t.step();
      const hw = t.highway();
      if (k >= 11) {
        expect(hw?.period).toBe(104);
        starts.push(hw!.since);
        expect(hw!.exact).toBe(true);
      }
    }
    expect(t.steps).toBeGreaterThan(MOVES + 10000);
    expect(new Set(starts)).toEqual(new Set([starts[0]]));
    expect(starts[0]).toBeGreaterThan(9000);
    expect(starts[0]).toBeLessThan(11000);

    // seen for the first time long after it began: only a bound, and an honest one
    const late = new Turmite(1000, 1000, [1, 3], [{ x: 500, y: 500, dir: 0 }]);
    for (let s = 0; s < 30000; s++) late.step();
    const hw = late.highway()!;
    expect(hw.exact).toBe(false);
    expect(hw.since).toBe(30000 - MOVES);
    expect(hw.since).toBeGreaterThanOrEqual(starts[0]);
  });
});
