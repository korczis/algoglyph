// The bowyer-watson-delaunay plate's lattice side: a control whose default is the constant it
// replaced (4096, the exactness ceiling), which round-trips through a shared link and leaves the
// mesh's counting identities exact on every lattice, however many points a coarse one merges.
import { describe, expect, it } from 'vitest';
import { defaults, type SelectParam } from '../src/core/plate';
import { DEFAULT_SEED } from '../src/core/claims';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { Delaunay, LATTICE, orient } from '../src/plates/bowyer-watson-delaunay/bowyer';
import { scatter } from '../src/plates/bowyer-watson-delaunay/plate';
import { loadPlate } from '../src/registry';
import { nthNumber, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const PLATE = 'bowyer-watson-delaunay';
const probe = (readout: string, lattice: string, expect: Claim['expect']): Claim =>
  ({ id: 'probe', statement: '', readout, expect, setup: { params: { lattice } } });

type Pt = [number, number];

/** The plate's points for a claim's run, snapped to the lattice the way the plate snaps them, and
 * deduplicated: the default 700 clustered points on the 800-wide canvas the instrument uses. */
function snapped(side: number): Pt[] {
  const W = 800;
  const H = 500;
  const s = (side - 1) / Math.max(W, H);
  const snap = (v: number) => Math.min(side - 1, Math.max(0, Math.round(v * s)));
  const seen = new Set<string>();
  const out: Pt[] = [];
  for (const [x, y] of scatter('clustered', 700, W, H, mulberry32(DEFAULT_SEED))) {
    const p: Pt = [snap(x), snap(y)];
    if (seen.has(`${p}`)) continue;
    seen.add(`${p}`);
    out.push(p);
  }
  return out;
}

/** Andrew's monotone chain: the hull corners alone (strict), or every point on the boundary. */
function hull(points: Pt[], strict: boolean): number {
  const ps = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const chain = (list: Pt[]): Pt[] => {
    const out: Pt[] = [];
    for (const p of list) {
      while (out.length >= 2) {
        const o = orient(...out[out.length - 2], ...out[out.length - 1], ...p);
        if (strict ? o > 0 : o >= 0) break;
        out.pop();
      }
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return chain(ps).length + chain([...ps].reverse()).length;
}

describe('bowyer-watson-delaunay lattice', () => {
  it('is a select of 64, 256, 1024 and 4096 whose default is the old constant 4096', async () => {
    const plate = await loadPlate('bowyer-watson-delaunay');
    const d = plate!.params.find((p) => p.key === 'lattice') as SelectParam | undefined;
    expect(d).toBeDefined();
    expect(d!.kind).toBe('select');
    expect(d!.label).toBe('Lattice side');
    expect(d!.value).toBe('4096');
    expect(d!.rebuild).toBe(true);
    expect(d!.options.map((o) => o.value)).toEqual(['64', '256', '1024', '4096']);
    expect(Number(d!.value)).toBe(LATTICE);
  });

  it('round-trips through a shared link', async () => {
    const plate = await loadPlate('bowyer-watson-delaunay');
    const want = { ...defaults(plate!), lattice: '256' };
    const back = parse(plate!.params, serialise(plate!.params, want, 7));
    expect(back.seed).toBe(7);
    expect(back.params.lattice).toBe('256');
  });

  it('takes its side as a constructor argument, never above the exact 4096', () => {
    expect(new Delaunay().side).toBe(LATTICE);
    const d = new Delaunay(64);
    expect(d.side).toBe(64);
    expect(() => d.insert(64, 0)).toThrow(RangeError);
    expect(() => d.insert(0, 64)).toThrow(RangeError);
    expect(d.insert(63, 63)).not.toBeNull();
    expect(() => new Delaunay(2 * LATTICE)).toThrow(RangeError);
    expect(() => new Delaunay(0)).toThrow(RangeError);
  });

  it('counts a point on a hull edge as a hull vertex: 2n − 2 − h holds on collinear hulls', () => {
    const d = new Delaunay(64);
    for (const [x, y] of [[0, 0], [10, 0], [10, 10], [0, 10], [5, 0], [0, 5]]) d.insert(x, y);
    const c = d.counts();
    // six points, all on the square's boundary (two in the middle of an edge): h = 6
    expect(c.hull).toBe(6);
    expect(c.triangles).toBe(2 * 6 - 2 - 6);
    expect(6 - c.edges + c.triangles + 1).toBe(2);
  });

  // Budget, counted: each queued point costs one visibility walk, and a new vertex its cavity
  // tests too. A coarse lattice merges points, so it has fewer vertices to walk over and skips
  // the cavity of every duplicate. At the largest point count, seed 4242, no lattice does more
  // than the heaviest distribution did at 4096 (clustered, 172142 walk steps and tests; 1024
  // can sit a hair above 4096 on one distribution, uniform 169835 against 169683).
  it('is never heavier than the old heaviest setting, at the largest point count', () => {
    type Locate = (x: number, y: number) => { t: number; steps: number };
    const proto = Delaunay.prototype as unknown as { locate: Locate };
    const locate = proto.locate;
    let steps = 0;
    proto.locate = function (this: unknown, x: number, y: number) {
      const r = locate.call(this, x, y);
      steps += r.steps;
      return r;
    };
    try {
      const W = 800;
      const H = 500;
      const all: Record<string, Record<string, number>> = {};
      for (const kind of ['uniform', 'clustered', 'poisson', 'circle']) {
        const cost: Record<string, number> = {};
        for (const side of [64, 256, 1024, LATTICE]) {
          const s = (side - 1) / Math.max(W, H);
          const snap = (v: number) => Math.min(side - 1, Math.max(0, Math.round(v * s)));
          const d = new Delaunay(side);
          steps = 0;
          let tested = 0;
          for (const [x, y] of scatter(kind, 3000, W, H, mulberry32(DEFAULT_SEED))) {
            const ins = d.insert(snap(x), snap(y));
            if (ins) tested += ins.tested;
          }
          cost[side] = steps + tested;
        }
        all[kind] = cost;
      }
      // the heaviest the plate was before the control: its heaviest distribution at 4096
      const top = Math.max(...Object.values(all).map((c) => c[LATTICE]));
      for (const [kind, cost] of Object.entries(all)) {
        for (const side of [64, 256, 1024]) {
          expect(cost[side], `${kind} at ${side}`).toBeLessThanOrEqual(top);
        }
        // the coarsest lattice is lighter than the default on every distribution
        expect(cost[64], kind).toBeLessThan(cost[LATTICE]);
      }
    } finally {
      proto.locate = locate;
    }
  });

  for (const lattice of ['64', '256']) {
    it(`keeps V − E + F = 2 and 2n − 2 − h triangles on the ${lattice} lattice`, async () => {
      const euler = await read(PLATE, probe('V − E + F', lattice, { value: 2 }));
      expect(euler.reason).toBeUndefined();
      expect(euler.value).toBe(2);
      const tri = await read(PLATE,
        probe('triangles', lattice, { against: 'triangles', against_number: 4, tolerance: 0 }));
      expect(tri.reason).toBeUndefined();
      expect(tri.value, tri.text).toBe(0);
      // n there is the vertex count after duplicates: the 64 lattice merges many of the 700
      const ins = await read(PLATE, probe('points inserted', lattice, { value: 0 }));
      const dup = await read(PLATE, probe('duplicates skipped', lattice, { value: 0 }));
      expect((ins.value as number) + (dup.value as number)).toBe(nthNumber(ins.text!, 2));
      if (lattice === '64') expect(dup.value).toBeGreaterThan(0);
      // h, as the plate counts it (its ghost triangles, one per hull edge), is every point on
      // the hull's boundary, collinear ones included: the h for which 2n − 2 − h is exact
      const pts = snapped(Number(lattice));
      expect(pts.length).toBe(ins.value);
      const h = await read(PLATE, probe('hull vertices h', lattice, { value: 0 }));
      expect(h.value).toBe(hull(pts, false));
      expect(nthNumber(tri.text!, 1)).toBe(2 * pts.length - 2 - hull(pts, false));
      // the coarse lattice lines points up along the hull (seed 4242: 29 on it, 14 corners)
      if (lattice === '64') expect(hull(pts, true)).toBeLessThan(hull(pts, false));
    }, 120_000);
  }
});
