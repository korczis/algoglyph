import { describe, expect, it } from 'vitest';
import { parseTurmite, Turmite } from '../src/plates/langton-turmites/ant';

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
});
