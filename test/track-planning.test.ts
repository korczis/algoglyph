// The track planner (src/plates/track-planning/plan.ts) against references that do not share its
// code: a validator written here from OpenTTD's rules re-walks every plan piece by piece (the
// tile, the edge heights from the raw vertex heights, the slope rule, the turn rule, the bridge
// clearance, the tunnel's ground) and re-adds its cost; Dijkstra (the same search without its
// heuristic) is the optimum A* must equal; and maps built by hand force each construct.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { DEFAULT_COSTS, DEFAULT_RULES, plan, unrun, type Costs, type Heading, type Piece, type Plan, type Rules, type TileMap } from '../src/plates/track-planning/plan';
import { data } from '../src/plates/track-planning/data';
import { terrain } from '../src/plates/track-planning/terrain';
import { DEFAULT_SEED } from '../src/core/claims';

const H: Heading[] = ['NE', 'SE', 'SW', 'NW'];
const DX = [-1, 0, 1, 0];
const DY = [0, 1, 0, -1];

/** A map from rows of vertex-height digits and (optionally) rows of type letters, one a vertex. */
function mapOf(heights: string[], types?: string[], roads?: string[]): TileMap {
  const h = heights.length; const w = heights[0].length;
  const m: TileMap = { w, h, heights: new Uint8Array(w * h), types: new Uint8Array(w * h).fill(67) };
  heights.forEach((r, y) => [...r].forEach((c, x) => { m.heights[y * w + x] = Number(c); }));
  types?.forEach((r, y) => [...r].forEach((c, x) => { m.types[y * w + x] = c.charCodeAt(0); }));
  if (roads) { m.roads = new Uint8Array(w * h); roads.forEach((r, y) => [...r].forEach((c, x) => { m.roads![y * w + x] = parseInt(c, 16); })); }
  return m;
}

/** Re-walk a plan from OpenTTD's rules; returns its cost, or throws naming the first broken rule. */
function validate(m: TileMap, from: { x: number; y: number; dir: Heading }, to: { x: number; y: number }, p: Plan, costs: Costs = DEFAULT_COSTS, rules: Rules = DEFAULT_RULES): number {
  const hv = (x: number, y: number) => m.heights[y * m.w + x];
  // corners N, E, S, W; side s (NE, SE, SW, NW) holds corners s and s + 1
  const c = (x: number, y: number) => [hv(x, y), hv(x, y + 1), hv(x + 1, y + 1), hv(x + 1, y)];
  const type = (x: number, y: number) => String.fromCharCode(m.types[y * m.w + x]);
  const top = (x: number, y: number) => Math.max(...c(x, y));
  const flat = (x: number, y: number) => Math.max(...c(x, y)) === Math.min(...c(x, y));
  // the sides each TrackBits piece joins
  const SIDES: Record<number, [number, number]> = { 1: [0, 2], 2: [1, 3], 4: [3, 0], 32: [0, 1], 8: [1, 2], 16: [2, 3] };
  let x = from.x + DX[H.indexOf(from.dir)]; let y = from.y + DY[H.indexOf(from.dir)];
  let d = H.indexOf(from.dir); let z = top(from.x, from.y); let motion = 2 * d; let cost = 0;
  const turnCost = (next: number) => {
    const a = Math.min(Math.abs(motion - next) % 8, 8 - (Math.abs(motion - next) % 8));
    if (a >= 3 || (a === 2 && rules.forbid90)) throw new Error(`a ${a * 45} degree turn at (${x}, ${y})`);
    motion = next;
    return a * costs.curve;
  };
  for (const q of p.pieces as Piece[]) {
    if (q.kind === 'track') {
      expect([q.x, q.y], 'pieces are contiguous').toEqual([x, y]);
      const t = type(x, y);
      if (!['C', 'T', 'r'].includes(t)) throw new Error(`track on a ${t} tile at (${x}, ${y})`);
      const [s1, s2] = SIDES[q.track];
      const entry = (d + 2) % 4;
      if (s1 !== entry && s2 !== entry) throw new Error(`piece ${q.track} at (${x}, ${y}) has no side ${entry}`);
      const exit = s1 === entry ? s2 : s1;
      const k = c(x, y); const lo = Math.min(...k); const hi = Math.max(...k);
      const ein = [k[entry], k[(entry + 1) % 4]]; const eout = [k[exit], k[(exit + 1) % 4]];
      let zin: number; let zout: number; let extra = 0;
      if (lo === hi) { zin = zout = lo; } else if ((entry + 2) % 4 === exit && hi - lo === 1 && ein[0] === ein[1] && eout[0] === eout[1]) {
        zin = ein[0]; zout = eout[0]; extra += costs.incline;
      } else {
        if (hi - lo === 2 && !rules.steep) throw new Error(`track on a steep slope at (${x}, ${y})`);
        zin = zout = hi; extra += costs.foundation;
      }
      if (zin !== z) throw new Error(`the edge into (${x}, ${y}) is at ${zin}, the track arrives at ${z}`);
      if (t === 'T') extra += costs.clear;
      if (t === 'r') {
        const bits = m.roads?.[y * m.w + x];
        if (lo !== hi || exit !== (entry + 2) % 4 || bits !== (exit % 2 === 0 ? 5 : 10)) throw new Error(`no level crossing fits at (${x}, ${y})`);
        extra += costs.crossing;
      }
      const straight = exit === (entry + 2) % 4;
      cost += (straight ? 1 : Math.SQRT1_2) + extra + turnCost(straight ? 2 * exit : exit === (d + 1) % 4 ? 2 * d + 1 : (2 * d + 7) % 8);
      d = exit; z = zout; x += DX[d]; y += DY[d];
    } else {
      expect(q.from, `${q.kind} starts where the track is`).toEqual([x, y]);
      expect(q.heading).toBe(H[d]);
      cost += turnCost(2 * d);
      const n = q.length;
      if (q.kind === 'bridge') {
        const ends = [[x, y], [x + DX[d] * (n + 1), y + DY[d] * (n + 1)]];
        for (const [ex, ey] of ends) {
          if (!['C', 'T'].includes(type(ex, ey)) || top(ex, ey) !== z) throw new Error(`a bridge head at (${ex}, ${ey}) is not level at ${z}`);
          cost += 1 + (flat(ex, ey) ? 0 : costs.foundation) + (type(ex, ey) === 'T' ? costs.clear : 0);
        }
        for (let i = 1; i <= n; i++) {
          const mx = x + DX[d] * i; const my = y + DY[d] * i;
          if (top(mx, my) > z || !['C', 'T', 'W', 'r', 'R'].includes(type(mx, my))) throw new Error(`the bridge does not clear (${mx}, ${my})`);
        }
        cost += n * costs.bridge;
        expect(n).toBeLessThanOrEqual(rules.maxBridge);
      } else {
        const a = (d + 2) % 4;
        const k0 = c(x, y);
        if (!(k0[a] === z && k0[(a + 1) % 4] === z && k0[d] === z + 1 && k0[(d + 1) % 4] === z + 1)) throw new Error(`no tunnel portal rises at (${x}, ${y})`);
        for (let i = 1; i <= n; i++) { const tx = x + DX[d] * i; const ty = y + DY[d] * i; if (Math.min(...c(tx, ty)) < z + 1) throw new Error(`the tunnel surfaces at (${tx}, ${ty})`); }
        const ex = x + DX[d] * (n + 1); const ey = y + DY[d] * (n + 1); const k1 = c(ex, ey);
        if (!(k1[a] === z + 1 && k1[(a + 1) % 4] === z + 1 && k1[d] === z && k1[(d + 1) % 4] === z)) throw new Error(`no tunnel portal falls at (${ex}, ${ey})`);
        for (const [px, py] of [[x, y], [ex, ey]]) cost += 1 + (type(px, py) === 'T' ? costs.clear : 0);
        cost += n * costs.tunnel;
        expect(n).toBeLessThanOrEqual(rules.maxTunnel);
      }
      x += DX[d] * (n + 2); y += DY[d] * (n + 2);
    }
  }
  expect([x, y], 'the plan ends entering the goal').toEqual([to.x, to.y]);
  expect(z, 'at the goal\'s height').toBe(top(to.x, to.y));
  return cost;
}

/**
 * An OpenTTD-like map: smooth noise rounded to heights, flat station sites around `sites`,
 * neighbouring vertices at most 1 apart (OpenTTD's rule), water at 0, scattered houses and trees.
 */
function randomMap(seed: number, w: number, h: number, sites: [number, number][] = []): TileMap {
  const rnd = mulberry32(seed);
  const m: TileMap = { w, h, heights: new Uint8Array(w * h), types: new Uint8Array(w * h).fill(67) };
  const px = rnd() * 6; const py = rnd() * 6; const cx = rnd() * w; const cy = rnd() * h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = 2.5 + 1.5 * Math.sin(x / 3.3 + px) + 1.2 * Math.cos(y / 2.9 + py) - 0.12 * Math.hypot(x - cx, y - cy);
    m.heights[y * w + x] = Math.max(0, Math.round(v));
  }
  const fixed = new Uint8Array(w * h);
  for (const [sx, sy] of sites) {
    const z = Math.max(1, m.heights[sy * w + sx]);
    for (let y = sy - 1; y <= sy + 2; y++) for (let x = sx - 1; x <= sx + 2; x++) if (x >= 0 && y >= 0 && x < w && y < h) { m.heights[y * w + x] = z; fixed[y * w + x] = 1; }
  }
  for (let changed = true; changed;) {
    changed = false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
      if (nx >= w || ny >= h) continue;
      const i = y * w + x; const j = ny * w + nx;
      const [hi, lo] = m.heights[i] > m.heights[j] ? [i, j] : [j, i];
      if (m.heights[hi] - m.heights[lo] <= 1) continue;
      if (!fixed[hi]) m.heights[hi] = m.heights[lo] + 1; else m.heights[lo] = m.heights[hi] - 1;
      changed = true;
    }
  }
  const site = (x: number, y: number) => sites.some(([sx, sy]) => Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1);
  for (let y = 0; y + 1 < h; y++) for (let x = 0; x + 1 < w; x++) {
    const k = [m.heights[y * w + x], m.heights[y * w + x + 1], m.heights[(y + 1) * w + x], m.heights[(y + 1) * w + x + 1]];
    if (Math.max(...k) === 0) m.types[y * w + x] = 87; // W
    else if (site(x, y)) continue;
    else if (rnd() < 0.06) m.types[y * w + x] = 72; // H
    else if (rnd() < 0.08) m.types[y * w + x] = 84; // T
  }
  return m;
}

describe('track planning: constructs on maps built by hand', () => {
  it('lays a straight line on flat land, one X piece a tile', () => {
    const m = mapOf(Array(6).fill('000000000000'));
    const p = plan(m, { x: 0, y: 2, dir: 'SW' }, { x: 9, y: 2 });
    expect(p.status).toBe('found');
    expect(p.pieces.map((q) => (q.kind === 'track' ? q.track : 0))).toEqual(Array(8).fill(1));
    expect(p.cost).toBe(8);
    expect(validate(m, { x: 0, y: 2, dir: 'SW' }, { x: 9, y: 2 }, p)).toBeCloseTo(p.cost, 12);
  });

  it('runs diagonally as alternating corner pieces, each half a tile\'s diagonal, never turning 90 degrees', () => {
    const m = mapOf(Array(12).fill('000000000000'));
    const from = { x: 0, y: 0, dir: 'SW' as Heading }; const to = { x: 8, y: 9 };
    const p = plan(m, from, to);
    expect(p.status).toBe('found');
    const corners = p.pieces.filter((q) => q.kind === 'track' && q.piece !== 'x' && q.piece !== 'y');
    expect(corners.length).toBeGreaterThan(8);
    expect(p.counts.sharp).toBe(0);
    expect(validate(m, from, to, p)).toBeCloseTo(p.cost, 9);
    // cheaper than the best route of straight pieces only, an L of 8 + 9 tiles and two 90-degree turns made as curves
    expect(p.cost).toBeLessThan(17);
  });

  it('bridges a river it cannot lay track across, at the height of its banks', () => {
    // vertices 5..7 at 0: tiles 5 and 6 are the river, 4 and 7 its banks sloping down
    const rows = Array(7).fill('1111100011111');
    const types = Array(7).fill('CCCCCWWCCCCCC');
    const m = mapOf(rows, types);
    const from = { x: 0, y: 3, dir: 'SW' as Heading }; const to = { x: 11, y: 3 };
    const p = plan(m, from, to);
    expect(p.status).toBe('found');
    expect(p.counts.bridges).toBe(1);
    const b = p.pieces.find((q) => q.kind === 'bridge')!;
    expect(b.kind === 'bridge' && b.z).toBe(1);
    expect(validate(m, from, to, p)).toBeCloseTo(p.cost, 9);
    // without bridges there is no way across
    expect(plan(m, from, to, DEFAULT_COSTS, { ...DEFAULT_RULES, maxBridge: 0 }).status).toBe('unreachable');
  });

  it('tunnels through a ridge whose top is built over, between an incline up and an incline down', () => {
    // a ridge across the map: vertices 5..9 at 1, 6..8 at 2, houses on its top
    const rows = Array(7).fill('0000012221000000');
    const types = Array(7).fill('CCCCCHHHHCCCCCCC');
    const m = mapOf(rows, types);
    const from = { x: 0, y: 3, dir: 'SW' as Heading }; const to = { x: 14, y: 3 };
    const p = plan(m, from, to);
    expect(p.status).toBe('found');
    expect(p.counts.tunnels).toBe(1);
    const t = p.pieces.find((q) => q.kind === 'tunnel')!;
    expect(t.kind === 'tunnel' && [t.from, t.to, t.length]).toEqual([[4, 3], [9, 3], 4]);
    expect(validate(m, from, to, p)).toBeCloseTo(p.cost, 9);
  });

  it('climbs an incline with a straight piece and needs a foundation for anything else on a slope', () => {
    const rows = Array(6).fill('0000111111');
    const m = mapOf(rows);
    const from = { x: 0, y: 2, dir: 'SW' as Heading }; const to = { x: 7, y: 2 };
    const p = plan(m, from, to);
    expect(p.counts.inclines).toBe(1);
    expect(p.counts.foundations).toBe(0);
    expect(validate(m, from, to, p)).toBeCloseTo(p.cost, 9);
  });

  it('refuses a steep slope unless steep track is allowed, and then levels it on a foundation', () => {
    // tile row 2 runs from a plateau at 2 over tiles (2..5, 2), two of them steep (3 and 4),
    // every one on a foundation at 2; columns 3 and 4 of every other row are houses
    const rows = ['2222222', '2222222', '2222122', '2221012', '2221112', '2222222'];
    const types = ['CCCHHCC', 'CCCHHCC', 'CCCCCCC', 'CCCHHCC', 'CCCHHCC', 'CCCHHCC'];
    const m = mapOf(rows, types);
    const from = { x: 0, y: 2, dir: 'SW' as Heading }; const to = { x: 5, y: 2 };
    expect(plan(m, from, to).status).toBe('unreachable');
    const rules = { ...DEFAULT_RULES, steep: true };
    const p = plan(m, from, to, DEFAULT_COSTS, rules);
    expect(p.status).toBe('found');
    expect(p.counts.foundations).toBeGreaterThanOrEqual(2);
    expect(validate(m, from, to, p, DEFAULT_COSTS, rules)).toBeCloseTo(p.cost, 9);
  });

  it('crosses a road at a level crossing only where the road runs straight across the line', () => {
    const rows = Array(6).fill('00000000');
    const types = Array(6).fill('CCCrCCCC');
    const ok = mapOf(rows, types, Array(6).fill('00050000'));
    const from = { x: 0, y: 2, dir: 'SW' as Heading }; const to = { x: 6, y: 2 };
    const p = plan(ok, from, to);
    expect(p.counts.crossings).toBe(1);
    expect(validate(ok, from, to, p)).toBeCloseTo(p.cost, 9);
    // a road along the line, or no road layer at all: no crossing, so the line must bridge it
    const along = plan(mapOf(rows, types, Array(6).fill('000a0000')), from, to);
    expect(along.counts.crossings).toBe(0);
    expect(plan(mapOf(rows, types), from, to).counts.crossings).toBe(0);
  });

  it('forbids a 90-degree turn by default and takes one when allowed', () => {
    const m = mapOf(Array(8).fill('00000000'));
    const from = { x: 1, y: 1, dir: 'SW' as Heading }; const to = { x: 2, y: 4, dir: 'SE' as Heading };
    const strict = plan(m, from, to);
    expect(strict.counts.sharp).toBe(0);
    const loose = plan(m, from, to, DEFAULT_COSTS, { ...DEFAULT_RULES, forbid90: false });
    expect(loose.cost).toBeLessThanOrEqual(strict.cost);
    expect(validate(m, from, to, loose, DEFAULT_COSTS, { ...DEFAULT_RULES, forbid90: false })).toBeCloseTo(loose.cost, 9);
  });
});

describe('track planning: optimality and occupancy on generated maps', () => {
  it('A* finds Dijkstra\'s optimum with no more expansions, and every plan validates', () => {
    let found = 0;
    for (let s = 1; s <= 30; s++) {
      const m = randomMap(s, 26, 18, [[1, 8], [23, 9]]);
      const from = { x: 1, y: 8, dir: 'SW' as Heading }; const to = { x: 23, y: 9 };
      const a = plan(m, from, to);
      const b = plan(m, from, to, DEFAULT_COSTS, DEFAULT_RULES, false);
      expect(a.status, `seed ${s}`).toBe(b.status);
      if (a.status !== 'found') continue;
      found++;
      expect(a.cost, `seed ${s}`).toBeCloseTo(b.cost, 9);
      expect(a.expanded, `seed ${s}`).toBeLessThanOrEqual(b.expanded);
      expect(validate(m, from, to, a), `seed ${s}`).toBeCloseTo(a.cost, 9);
    }
    expect(found).toBeGreaterThan(15);
  });

  it('says each plan compactly as runs, which lay back out as exactly its track pieces', () => {
    for (let s = 1; s <= 30; s++) {
      const m = randomMap(s, 26, 18, [[1, 8], [23, 9]]);
      const p = plan(m, { x: 1, y: 8, dir: 'SW' }, { x: 23, y: 9 });
      if (p.status !== 'found') continue;
      const track = p.pieces.filter((q) => q.kind === 'track').map((q) => (q.kind === 'track' ? { x: q.x, y: q.y, track: q.track } : null));
      expect(unrun(p.runs), `seed ${s}`).toEqual(track);
      expect(p.runs.length, `seed ${s}`).toBeLessThanOrEqual(p.pieces.length);
    }
  });

  it('replans around tiles taken since the export, never more cheaply', () => {
    const m = randomMap(7, 26, 18, [[1, 8], [23, 9]]);
    const from = { x: 1, y: 8, dir: 'SW' as Heading }; const to = { x: 23, y: 9 };
    const first = plan(m, from, to);
    expect(first.status).toBe('found');
    const taken = first.pieces.filter((q) => q.kind === 'track').slice(3, 6) as { x: number; y: number }[];
    m.blocked = new Uint8Array(m.w * m.h);
    for (const t of taken) m.blocked[t.y * m.w + t.x] = 1;
    const again = plan(m, from, to);
    if (again.status === 'found') {
      expect(again.cost).toBeGreaterThanOrEqual(first.cost - 1e-9);
      for (const q of again.pieces) if (q.kind === 'track') expect(taken.some((t) => t.x === q.x && t.y === q.y)).toBe(false);
      expect(validate(m, from, to, again)).toBeCloseTo(again.cost, 9);
    }
  });
});

describe('track planning: the plate\'s maps, the plans its claims read', () => {
  // the claims instrument draws the plate at 800 × 500 px; at the default 16 px tiles that is 50 × 31 tiles
  const cases: [string, number, Partial<typeof DEFAULT_COSTS>, number][] = [
    ['the default map', DEFAULT_SEED, {}, 68.13],
    ['seed 7', 7, {}, 63.82],
    ['dear tunnels', DEFAULT_SEED, { tunnel: 10 }, 79.07],
  ];
  it.each(cases)('%s: the plan validates, equals Dijkstra and costs what its claim says', (_name, seed, over, claimed) => {
    const { map, a, b } = terrain(50, 31, seed);
    const costs = { ...DEFAULT_COSTS, ...over };
    const from = { x: a[0], y: a[1], dir: 'SW' as Heading }; const to = { x: b[0], y: b[1] };
    const p = plan(map, from, to, costs);
    expect(p.status).toBe('found');
    expect(validate(map, from, to, p, costs)).toBeCloseTo(p.cost, 9);
    expect(plan(map, from, to, costs, DEFAULT_RULES, false).cost).toBeCloseTo(p.cost, 9);
    expect(Math.abs(p.cost - claimed)).toBeLessThan(0.005);
  });

  it('the river crosses every map from edge to edge, so every route bridges it', () => {
    for (const seed of [DEFAULT_SEED, 7, 1, 2, 3]) {
      const { map, a, b } = terrain(50, 31, seed);
      const blocked = plan(map, { x: a[0], y: a[1], dir: 'SW' }, { x: b[0], y: b[1] }, DEFAULT_COSTS, { ...DEFAULT_RULES, maxBridge: 0 });
      expect(blocked.status, `seed ${seed}`).toBe('unreachable');
    }
  });
});

describe('track planning: the data form reads the research export as it comes', () => {
  const hex = (rows: string[]) => rows.map((r) => [...r].map((c) => Number(c).toString(16).padStart(2, '0')).join(''));
  const river = { heights: hex(Array(7).fill('1111100011111')), types: Array(7).fill('CCCCCWWCCCCCC'), from: { x: 0, y: 3, dir: 'SW' }, to: { x: 11, y: 3 } };

  it('plans across the river from hex heights and type letters, with the tiles read on request', () => {
    const r = data.solve({ ...river, meta: true });
    if (typeof r === 'string') throw new Error(r);
    expect(r).toMatchObject({ status: 'found', counts: { bridges: 1 } });
    const meta = r.meta as { tiles: number[]; slopes: string[]; gradients: string[] };
    expect(meta.tiles).toEqual([12, 6]);
    // tile 4 falls towards the river: corners N and E (x = 4) high, W and S (x = 5) low, so SLOPE_NE = N | E = 12
    expect(meta.slopes[3].slice(8, 10)).toBe('0c');
    expect(meta.gradients[3]).toBe('000010010000');
  });

  it('refuses malformed maps and ends with the field named', () => {
    expect(data.solve({ ...river, heights: ['0g'] })).toMatch(/heights/);
    expect(data.solve({ ...river, types: Array(7).fill('CCCCCZWCCCCCC') })).toMatch(/types/);
    expect(data.solve({ ...river, from: { x: 0, y: 3 } })).toMatch(/from.dir/);
    expect(data.solve({ ...river, to: { x: 40, y: 3 } })).toMatch(/to must be a tile inside/);
    expect(data.solve({ ...river, rules: { maxBridge: -1 } })).toMatch(/rules.maxBridge/);
    expect(data.solve({ ...river, costs: { teleport: 1 } })).toMatch(/costs: unknown field teleport/);
    expect(data.solve({ ...river, heights: hex(['0000', '0300', '0000']), types: undefined, from: { x: 0, y: 0, dir: 'SW' }, to: { x: 2, y: 1 } })).toMatch(/more than OpenTTD's 2 apart/);
  });
});
