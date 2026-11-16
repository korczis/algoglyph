// The track planner on a caller's map (src/core/solve.ts): the layers OpenTTD's research export
// gives, read as they come. `heights` are the rows of openttd://map's heights (two hex digits a
// tile, TileHeight, which is the tile's north corner) or rows of numbers; `types` its type letters;
// `roads` the rows of openttd://map/ways roads (one hex digit of RoadBits a tile), without which
// a road is an obstacle; `blocked` the tiles taken since the export. The answer is the plan as
// pieces a builder can lay as they are (TrackBits per tile, each bridge and tunnel with both
// ends), and on request the planner's reading of every tile (`meta`).
import { finite, integer, record, unknownKeys, type DataForm } from '../../core/solve';
import { bridgeMoney, DEFAULT_COSTS, DEFAULT_RULES, HEADINGS, meta as tileMeta, plan, tunnelMoney, type Costs, type Heading, type Piece, type Rules, type TileMap } from './plan';

/** The largest map the form takes, in tiles (a 1024 × 1024 map). */
export const MAX_TILES = 1 << 20;

const rowsOf = (v: unknown): v is unknown[] => Array.isArray(v) && v.length > 0;

function grid(name: string, rows: unknown, w: number, h: number, cell: (s: string, x: number) => number | null, numbers: boolean): Uint8Array | string {
  if (!rowsOf(rows) || rows.length !== h) return `${name} must have ${h} rows, one per row of heights`;
  const out = new Uint8Array(w * h);
  for (const [y, row] of rows.entries()) {
    if (numbers && Array.isArray(row)) {
      if (row.length !== w || !row.every((v) => integer(v) && v >= 0 && v <= 255)) return `${name}[${y}] must have ${w} integers 0..255`;
      out.set(row as number[], y * w);
      continue;
    }
    if (typeof row !== 'string') return `${name}[${y}] must be a string`;
    for (let x = 0; x < w; x++) {
      const v = cell(row, x);
      if (v === null) return `${name}[${y}] is malformed at tile ${x}`;
      out[y * w + x] = v;
    }
  }
  return out;
}

const end = (v: unknown, name: string, needDir: boolean, w: number, h: number): { x: number; y: number; dir?: Heading } | string => {
  if (!record(v) || !integer(v.x) || !integer(v.y)) return `${name} must be {x, y${needDir ? ', dir' : ', dir?'}}`;
  if (v.x < 0 || v.y < 0 || v.x >= w - 1 || v.y >= h - 1) return `${name} must be a tile inside the map (x < ${w - 1}, y < ${h - 1})`;
  if ((needDir || v.dir !== undefined) && !HEADINGS.includes(v.dir as Heading)) return `${name}.dir must be one of ${HEADINGS.join(', ')}`;
  return { x: v.x, y: v.y, ...(v.dir !== undefined ? { dir: v.dir as Heading } : {}) };
};

/**
 * The game's own answers, read as they are served: openttd://map (`heights`, `types`) and
 * openttd://map/ways (`roads`, and `occupancy`, the tiles a train, road vehicle or ship stands on
 * now), so a caller forwards two resources and nothing is translated outside this file. Occupied
 * tiles join `blocked`; the rest of the form is unchanged.
 */
function fromGame(raw: Record<string, unknown>): Record<string, unknown> | string {
  const { map, ways, terrain, prices, bridges, ...rest } = raw;
  if (map === undefined) {
    if (terrain !== undefined || prices !== undefined || bridges !== undefined) return 'terrain, prices and bridges are read with map (openttd://map), not with heights';
    return raw;
  }
  if (!record(map)) return 'map must be openttd://map\'s data ({width, height, heights, types, ...})';
  const out: Record<string, unknown> = { ...rest, heights: map.heights, types: map.types };
  if (ways !== undefined) {
    if (!record(ways)) return 'ways must be openttd://map/ways\' data ({roads, occupancy, ...})';
    if (ways.roads !== undefined) out.roads = ways.roads;
    if (ways.occupancy !== undefined) {
      if (!Array.isArray(ways.occupancy)) return 'ways.occupancy must list {x, y, ...} tiles';
      const taken = ways.occupancy.map((o) => (record(o) ? [o.x, o.y] : null));
      if (taken.some((t) => t === null)) return 'ways.occupancy must list {x, y, ...} tiles';
      out.blocked = [...(Array.isArray(out.blocked) ? out.blocked : Array.isArray(rest.blocked) ? rest.blocked : []), ...(taken as unknown[])];
    }
  }
  if (terrain !== undefined) {
    if (!record(terrain)) return 'terrain must be openttd://map/terrain\'s data ({slopes, buildable, vehicles, ...})';
    out.terrain = terrain;
  }
  if (prices !== undefined) {
    if (!record(prices) || !record(prices.prices)) return 'prices must be openttd://economy/prices\' data ({prices: {build_rail, ...}})';
    const pr = prices.prices as Record<string, unknown>;
    const rail = pr.build_rail;
    if (!finite(rail) || rail <= 0) return 'prices.prices.build_rail must be a positive amount: every cost is a multiple of it';
    // the game's own price ratios, one tile of plain rail the unit; a price the game does not
    // list keeps its default, and costs the caller gives explicitly win over all of them
    const ratio = (name: string) => (finite(pr[name]) && (pr[name] as number) >= 0 ? (pr[name] as number) / rail : undefined);
    const derived: Record<string, number> = {};
    for (const [key, name] of [['bridge', 'build_bridge'], ['tunnel', 'build_tunnel'], ['foundation', 'build_foundation'], ['clear', 'clear_trees']] as const) {
      const r = ratio(name);
      if (r !== undefined) derived[key] = r;
    }
    out.costs = { ...derived, ...(record(rest.costs) ? rest.costs : {}) };
    const types = bridges === undefined ? undefined : record(bridges) && Array.isArray(bridges.types) ? bridges.types.filter((b): b is Record<string, unknown> => record(b) && b.available !== false && finite(b.price) && finite(b.min_length) && finite(b.max_length)) : null;
    if (types === null) return 'bridges must be openttd://bridges\' data ({types: [{price, min_length, max_length, available}]})';
    out.priced = { unit: 'build_rail', build_rail: rail, derived: Object.keys(derived), prices: pr, ...(types ? { bridge_types: types } : {}) };
  }
  return out;
}

interface Priced { build_rail: number; prices: Record<string, unknown>; bridge_types?: Record<string, unknown>[] }

/** The game's exact span prices, in game money, from its prices and bridge types; null where it has none. */
function spanMoney(pr: Priced) {
  const price = (n: string) => (finite(pr.prices[n]) ? (pr.prices[n] as number) : undefined);
  const bb = price('build_bridge'); const bt = price('build_tunnel');
  const bridge = pr.bridge_types && bb !== undefined
    ? (middle: number) => {
      const fits = pr.bridge_types!.filter((t) => (t.min_length as number) <= middle && middle <= (t.max_length as number));
      return fits.length ? Math.min(...fits.map((t) => bridgeMoney(middle, pr.build_rail, bb, t.price as number))) : null;
    }
    : undefined;
  const tunnel = bt !== undefined ? (middle: number) => tunnelMoney(middle, bt) : undefined;
  return { bridge, tunnel };
}

/** A plan's price in the game's money, summed from its pieces (never the search's penalties). */
function moneyOf(pieces: Piece[], pr: Priced): number {
  const price = (n: string) => (finite(pr.prices[n]) ? (pr.prices[n] as number) : 0);
  const span = spanMoney(pr);
  let total = 0;
  for (const q of pieces) {
    if (q.kind === 'track') total += pr.build_rail + (q.foundation ? price('build_foundation') : 0) + (q.cleared ? price('clear_trees') : 0);
    else if (q.kind === 'bridge') total += (span.bridge?.(q.length) ?? (q.length + 2) * pr.build_rail + q.length * price('build_bridge')) + q.foundations * price('build_foundation');
    else total += span.tunnel ? span.tunnel(q.length) : (q.length + 1) * price('build_tunnel');
  }
  return total;
}

/**
 * openttd://map/terrain read against the map: its slope for every tile must be the one the heights
 * give (a snapshot read at another moment is refused, never half-trusted), a tile it marks built
 * on ('x') that the types call clear is taken, and a tile with vehicles standing on it is taken.
 */
function applyTerrain(m: TileMap, t: Record<string, unknown>): string | null {
  const tw = m.w - 1; const th = m.h - 1;
  const rows = (name: string, perTile: number) => {
    const r = t[name];
    if (r === undefined) return null;
    if (!Array.isArray(r) || r.length < th || !r.every((x) => typeof x === 'string' && x.length >= tw * perTile)) return `terrain.${name} must be rows of ${perTile} character${perTile > 1 ? 's' : ''} a tile`;
    return r as string[];
  };
  const slopes = rows('slopes', 2);
  if (typeof slopes === 'string') return slopes;
  const buildable = rows('buildable', 1);
  if (typeof buildable === 'string') return buildable;
  const vehicles = rows('vehicles', 1);
  if (typeof vehicles === 'string') return vehicles;
  m.blocked ??= new Uint8Array(m.w * m.h);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = y * m.w + x;
    if (slopes) {
      const want = parseInt(slopes[y].slice(2 * x, 2 * x + 2), 16);
      const got = tileMeta(m, x, y).slope;
      if (want !== got) return `terrain.slopes[${y}] says tile (${x}, ${y}) has Slope ${want.toString(16)}, its heights give ${got.toString(16)}: read map and terrain at the same moment`;
    }
    const type = String.fromCharCode(m.types[i]);
    if (buildable && buildable[y][x] === 'x' && (type === 'C' || type === 'T')) m.blocked[i] = 1;
    if (vehicles && vehicles[y][x] !== '.') m.blocked[i] = 1;
  }
  return null;
}


export const data: DataForm = {
  input: '{map?: openttd://map data, ways?: openttd://map/ways data | heights: string[] (2 hex digits a tile, openttd://map) | number[][], types?: string[], roads?: string[] (1 hex digit a tile), blocked?: [x, y][], from: {x, y, dir: NE|SE|SW|NW}, to: {x, y, dir?}, costs?, rules?, meta?: boolean}',
  solve(input) {
    if (!record(input)) return 'the input must be an object {heights, types?, roads?, blocked?, from, to, costs?, rules?, meta?} or {map, ways?, from, to, ...}';
    if (input.map !== undefined && input.heights !== undefined) return 'give either map (openttd://map) or heights, not both';
    const raw = fromGame(input);
    if (typeof raw === 'string') return raw;
    const extra = unknownKeys(raw, ['heights', 'types', 'roads', 'blocked', 'from', 'to', 'costs', 'rules', 'meta', 'terrain', 'priced']);
    if (raw.costs !== undefined && record(raw.costs) && ('bridgeSpan' in raw.costs || 'tunnelSpan' in raw.costs)) return 'costs: bridgeSpan and tunnelSpan come from prices, not from the caller';
    if (extra) return extra;
    if (!rowsOf(raw.heights)) return 'heights must list the map\'s rows';
    const first = raw.heights[0];
    const numbers = Array.isArray(first);
    const w = numbers ? (first as unknown[]).length : typeof first === 'string' ? first.length / 2 : 0;
    const h = raw.heights.length;
    if (!Number.isInteger(w) || w < 3 || h < 3 || w * h > MAX_TILES) return `heights: the map must be 3 to ${MAX_TILES} tiles, rows of equal length (2 hex digits a tile, or numbers)`;
    const hex = (s: string, x: number) => { const v = parseInt(s.slice(2 * x, 2 * x + 2), 16); return s.length === 2 * w && Number.isFinite(v) && /^[0-9a-fA-F]{2}$/.test(s.slice(2 * x, 2 * x + 2)) ? v : null; };
    const heights = grid('heights', raw.heights, w, h, hex, true);
    if (typeof heights === 'string') return heights;
    for (let y = 0; y + 1 < h; y++) for (let x = 0; x + 1 < w; x++) {
      const c = [heights[y * w + x], heights[y * w + x + 1], heights[(y + 1) * w + x], heights[(y + 1) * w + x + 1]];
      if (Math.max(...c) - Math.min(...c) > 2) return `heights: tile (${x}, ${y}) has corners ${c.join(', ')}, more than OpenTTD's 2 apart`;
    }
    let types: Uint8Array;
    if (raw.types === undefined) types = new Uint8Array(w * h).fill(67);
    else {
      const t = grid('types', raw.types, w, h, (s, x) => (s.length === w && /[CRrHTSWVIBO]/.test(s[x]) ? s.charCodeAt(x) : null), false);
      if (typeof t === 'string') return `${t} (letters CRrHTSWVIBO, one a tile)`;
      types = t;
    }
    let roads: Uint8Array | undefined;
    if (raw.roads !== undefined) {
      const r = grid('roads', raw.roads, w, h, (s, x) => (s.length === w && /[0-9a-fA-F]/.test(s[x]) ? parseInt(s[x], 16) : null), false);
      if (typeof r === 'string') return r;
      roads = r;
    }
    let blocked: Uint8Array | undefined;
    if (raw.blocked !== undefined) {
      if (!Array.isArray(raw.blocked) || raw.blocked.length > w * h) return 'blocked must list [x, y] tiles';
      blocked = new Uint8Array(w * h);
      for (const [i, b] of raw.blocked.entries()) {
        if (!Array.isArray(b) || b.length !== 2 || !integer(b[0]) || !integer(b[1]) || b[0] < 0 || b[1] < 0 || b[0] >= w || b[1] >= h) return `blocked[${i}] must be [x, y] inside the map`;
        blocked[b[1] * w + b[0]] = 1;
      }
    }
    const from = end(raw.from, 'from', true, w, h);
    if (typeof from === 'string') return from;
    const to = end(raw.to, 'to', false, w, h);
    if (typeof to === 'string') return to;
    const costs: Costs = { ...DEFAULT_COSTS };
    if (raw.costs !== undefined) {
      if (!record(raw.costs)) return 'costs must be an object';
      const bad = unknownKeys(raw.costs, Object.keys(DEFAULT_COSTS));
      if (bad) return `costs: ${bad}`;
      for (const [k, v] of Object.entries(raw.costs)) {
        if (!finite(v) || v < 0 || v > 1e6) return `costs.${k} must be a number 0..1e6`;
        (costs as unknown as Record<string, number>)[k] = v;
      }
    }
    const rules: Rules = { ...DEFAULT_RULES };
    if (raw.rules !== undefined) {
      if (!record(raw.rules)) return 'rules must be an object';
      const bad = unknownKeys(raw.rules, Object.keys(DEFAULT_RULES));
      if (bad) return `rules: ${bad}`;
      for (const [k, v] of Object.entries(raw.rules)) {
        const want = typeof (DEFAULT_RULES as unknown as Record<string, unknown>)[k];
        if (want === 'boolean' ? typeof v !== 'boolean' : !(integer(v) && v >= 0 && v <= (k === 'budget' ? 20_000_000 : 4096))) return `rules.${k} must be ${want === 'boolean' ? 'a boolean' : 'a non-negative integer'}`;
        (rules as unknown as Record<string, unknown>)[k] = v;
      }
    }
    if (raw.priced) {
      // the search weighs whole bridges and tunnels at their exact prices, in units of one rail tile
      const span = spanMoney(raw.priced as Priced);
      const rail = (raw.priced as Priced).build_rail;
      if (span.bridge) costs.bridgeSpan = (middle) => { const v = span.bridge!(middle); return v === null ? null : v / rail; };
      if (span.tunnel) costs.tunnelSpan = (middle) => span.tunnel!(middle) / rail;
    }
    const m: TileMap = { w, h, heights, types, roads, blocked };
    if (raw.terrain !== undefined) {
      const bad = applyTerrain(m, raw.terrain as Record<string, unknown>);
      if (bad) return bad;
    }
    const p = plan(m, from as { x: number; y: number; dir: Heading }, to, costs, rules);
    const out: Record<string, unknown> = {
      ...(raw.priced ? { priced: { ...(raw.priced as Priced), prices: undefined, exact: { bridge: Boolean(costs.bridgeSpan), tunnel: Boolean(costs.tunnelSpan) } }, money: p.status === 'found' ? moneyOf(p.pieces, raw.priced as Priced) : null } : {}),
      status: p.status, cost: Number.isFinite(p.cost) ? p.cost : null, counts: p.counts, expanded: p.expanded, pieces: p.pieces, runs: p.runs, costs, rules,
    };
    if (raw.meta === true) {
      // the planner's reading of each tile, as rows: OpenTTD Slope (2 hex digits) and the
      // largest difference of its corners (the gradient across it, 0..2)
      const slopes: string[] = []; const gradients: string[] = [];
      for (let y = 0; y + 1 < h; y++) {
        let s = ''; let g = '';
        for (let x = 0; x + 1 < w; x++) { const t = tileMeta(m, x, y); s += t.slope.toString(16).padStart(2, '0'); g += String(t.max - t.min); }
        slopes.push(s); gradients.push(g);
      }
      out.meta = { tiles: [w - 1, h - 1], slopes, gradients };
    }
    return out;
  },
};
