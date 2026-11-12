// The first plates that read a reader's own data (ADR 0010), each checked against a reference
// that shares no code with it: the polynomial the points were made from, a brute-force hull, and
// the arithmetic of one scale and one offset.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { optionValue, parseData, type DataTable } from '../src/core/data';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import { defaults, type Params, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { fitToBox, H, makeInput, W } from '../src/engines/geometry/input';
import { record, type GeometryKernel, type Pt } from '../src/engines/geometry/trace';
import { kernel as leastSquares } from '../src/kernels/numeric/least-squares';
import { loadPlate } from '../src/registry';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

const entry = (id: string) => ENTRIES.find((e) => e.id === id)!;
const tableFor = (id: string, rows: number[][]): DataTable => {
  const decl = entry(id).data[0];
  const r = parseData(decl, rows.map((r) => r.join(',')).join('\n'));
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.table;
};

describe('least squares on a reader\'s points', () => {
  // y = 1 − 2x + 3x², at x from 10 to 49 m: the fit of degree 2 is exact, on either half
  const rows = Array.from({ length: 40 }, (_, i) => { const x = 10 + i; return [x, 1 - 2 * x + 3 * x * x]; });
  const table = tableFor('least-squares', rows);
  const run = leastSquares.run({ seed: 7, params: { target: optionValue('points') }, data: (id) => (id === 'points' ? table : null) });
  const stat = (step: number, label: string) => run.steps[step].stats!.find((s) => s.label === label)?.value ?? '';

  it('fits the reader\'s points, not the function', () => {
    const quad = run.steps[2];
    expect(stat(2, 'Degree')).toBe('2');
    // the residual of an exact fit is round-off relative to y (up to 7000 here)
    expect(Number(stat(2, 'RMS on held-out samples').replace(/[^0-9.e+-]/g, ''))).toBeLessThan(1e-6);
    expect(Number(stat(1, 'RMS on held-out samples').replace(/[^0-9.e+-]/g, ''))).toBeGreaterThan(1);
    // no reference curve: nobody knows the truth of a reader's data
    expect(quad.layers.some((l) => l.kind === 'curve' && l.alpha === 0.3)).toBe(false);
  });

  it('says what it did with them: rows, the split and the mapping of x', () => {
    expect(stat(0, 'Input')).toBe('your data, 40 rows: 20 train, 20 held out');
    expect(stat(0, 'x mapped onto [−1, 1] from')).toMatch(/^\[10, 49\] 1$/);
    expect(run.panels[0].title).toContain('Your points (40)');
  });

  it('falls back to the function when no data is attached', () => {
    const plain = leastSquares.run({ seed: 7, params: { target: optionValue('points') } });
    expect(plain.steps[0].stats!.some((s) => s.label === 'Input')).toBe(false);
  });
});

describe('a reader\'s points on the geometry grid', () => {
  it('keeps proportions with one scale and centres the points in the box', () => {
    const t = tableFor('quickhull', [[0, 0], [10, 0], [0, 5], [10, 5]]);
    const f = fitToBox(t);
    const xs = f.points.map((p) => p.x); const ys = f.points.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs); const h = Math.max(...ys) - Math.min(...ys);
    expect(w / h).toBe(2);
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBe(W / 2);
    expect((Math.max(...ys) + Math.min(...ys)) / 2).toBe(H / 2);
    expect(f.merged).toBe(0);
  });

  it('merges points that round to one grid position, and counts them', () => {
    const t = tableFor('quickhull', [[0, 0], [1000, 0], [0, 500], [1000, 500], [0.0001, 0.0001]]);
    const f = fitToBox(t);
    expect(f.points.length).toBe(4);
    expect(f.merged).toBe(1);
  });

  it('a hull kernel finds the hull of the reader\'s points (brute force)', async () => {
    const rnd = mulberry32(11);
    const rows = Array.from({ length: 60 }, () => [rnd() * 3 - 1.5, rnd() * 2]);
    const f = fitToBox(tableFor('quickhull', rows));
    const kernel = ((await import('../src/kernels/geometry/quickhull')) as { kernel: GeometryKernel }).kernel;
    const t = record(kernel, makeInput('points', 'data', 0, 3, {}, f.points), {}, 3, true);
    // Andrew's monotone chain, strict turns only: an algorithm quickhull does not use
    const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const s = [...f.points].sort((p, q) => p.x - q.x || p.y - q.y);
    const half = (pts: Pt[]) => {
      const h: Pt[] = [];
      for (const p of pts) {
        while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
        h.push(p);
      }
      return h.slice(0, -1);
    };
    const hull = [...half(s), ...half([...s].reverse())];
    expect(t.outcome.rows?.find((r) => r.label === 'Hull vertices')?.value).toBe(String(hull.length));
    expect(t.outcome.rows?.find((r) => r.label === 'Encloses every point')?.value).toBe('yes, checked edge by edge');
  });

  it('a geometry plate on a reader\'s points reads them and says so', async () => {
    const plate = (await loadPlate('quickhull'))!;
    const table = tableFor('quickhull', [[0, 0], [4, 0], [4, 3], [0, 3], [2, 1]]);
    let rows: Stat[] = [];
    const params: Params = { ...defaults(plate), shape: optionValue('points') };
    const ground = GROUNDS.dark;
    const ctx: PlateContext = {
      width: 800, height: 500, params, seed: 5, rnd: mulberry32(5), theme: 'dark', bg: ground.bg, fg: ground.fg,
      thumbnail: false, palette: () => lookupPalette('spectral'), stats(r) { rows = r; }, chart() {},
      data: (id) => (id === 'points' ? table : null),
    };
    const sim = plate.create(p5Stub(), ctx);
    sim.setup();
    for (let i = 0; i < 400 && !rows.some((r) => r.label === 'Input'); i++) sim.draw();
    expect(rows.find((r) => r.label === 'Input')?.value).toBe('your data, 5 points');
    expect(rows.find((r) => r.label === 'Mapped from')?.value).toMatch(/^x \[0, 4\] 1, y \[0, 3\] 1; /);
  });
});
