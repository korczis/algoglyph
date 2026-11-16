// The track planner on a caller's map (src/core/solve.ts): the layers OpenTTD's research export
// gives, read as they come. `heights` are the rows of openttd://map's heights (two hex digits a
// tile, TileHeight, which is the tile's north corner) or rows of numbers; `types` its type letters;
// `roads` the rows of openttd://map/ways roads (one hex digit of RoadBits a tile), without which
// a road is an obstacle; `blocked` the tiles taken since the export. The answer is the plan as
// pieces a builder can lay as they are (TrackBits per tile, each bridge and tunnel with both
// ends), and on request the planner's reading of every tile (`meta`).
import { finite, integer, record, unknownKeys, type DataForm } from '../../core/solve';
import { DEFAULT_COSTS, DEFAULT_RULES, HEADINGS, meta as tileMeta, plan, type Costs, type Heading, type Rules, type TileMap } from './plan';

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

export const data: DataForm = {
  input: '{heights: string[] (2 hex digits a tile, openttd://map) | number[][], types?: string[], roads?: string[] (1 hex digit a tile), blocked?: [x, y][], from: {x, y, dir: NE|SE|SW|NW}, to: {x, y, dir?}, costs?, rules?, meta?: boolean}',
  solve(raw) {
    if (!record(raw)) return 'the input must be an object {heights, types?, roads?, blocked?, from, to, costs?, rules?, meta?}';
    const extra = unknownKeys(raw, ['heights', 'types', 'roads', 'blocked', 'from', 'to', 'costs', 'rules', 'meta']);
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
    const m: TileMap = { w, h, heights, types, roads, blocked };
    const p = plan(m, from as { x: number; y: number; dir: Heading }, to, costs, rules);
    const out: Record<string, unknown> = {
      status: p.status, cost: Number.isFinite(p.cost) ? p.cost : null, counts: p.counts, expanded: p.expanded, pieces: p.pieces, costs, rules,
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
