// Rail route planning on a tile map, as OpenTTD builds track: a best-first search whose state is
// a tile entered with a heading, the train's motion (one of eight directions) and the height of
// the edge it crossed. A move lays one track piece (straight, or one of the four corner pieces
// that make diagonal track), a bridge (straight, level, over anything low enough) or a tunnel
// (straight, level, through a hill between two inclined portals). Slopes decide what fits: a
// straight piece runs up an inclined tile as it is, anything else on a slope needs a foundation
// that levels it to its highest corner, and the heights at every edge crossed must agree.
//
// Conventions are OpenTTD's, so the fork's export maps on without translation:
// - x grows towards the south-west, y towards the south-east; a heading is the side a train
//   leaves by: NE (x - 1), SE (y + 1), SW (x + 1), NW (y - 1).
// - heights are vertex heights, TileHeight(x, y) being the tile's north corner; its corners are
//   N = H(x, y), W = H(x + 1, y), E = H(x, y + 1), S = H(x + 1, y + 1), so the last row and
//   column of the export are the map's edge and are never built on.
// - the slope is the Slope bitmask (W 1, S 2, E 4, N 8, steep 16); a piece is a TrackBits value
//   (X 1, Y 2, upper 4, lower 8, left 16, right 32); road bits are RoadBits (NW 1, SW 2, SE 4, NE 8).
// - tile types are the export's letters: C clear, T trees, r road, R rail, H house, S station,
//   W water, V void, I industry, B bridge or tunnel, O object.
// Nothing here draws; the plate and the flow's command line (data.ts) read it.
import { Heap } from '../../kernels/geometry/_heap';

export const HEADINGS = ['NE', 'SE', 'SW', 'NW'] as const;
export type Heading = (typeof HEADINGS)[number];
const DX = [-1, 0, 1, 0];
const DY = [0, 1, 0, -1];
/** Corner indices clockwise: N 0, E 1, S 2, W 3; side s has corners s and s + 1. */
const SLOPE_BIT = [8, 4, 2, 1];
/** The TrackBits of the corner piece at corner c (the piece joining sides c - 1 and c, which share it). */
const CORNER_TRACK = [4, 32, 8, 16];
const CORNER_NAME = ['upper', 'right', 'lower', 'left'] as const;
/** RoadBits of a straight road along the x axis (NE-SW) and along y (NW-SE). */
const ROAD_X = 8 | 2;
const ROAD_Y = 1 | 4;
const HALF_DIAGONAL = Math.SQRT1_2;

export interface Costs {
  /** A corner (diagonal) piece costs its length, half a tile's diagonal; a straight piece 1. */
  curve: number;
  incline: number;
  foundation: number;
  clear: number;
  crossing: number;
  /** Per tile under a bridge, and per tile inside a tunnel (each head or portal is a piece). */
  bridge: number;
  tunnel: number;
  /**
   * Exact prices, in units of one tile of rail, when the game's prices are known: the whole
   * bridge with `middle` tiles under it (heads included, the cheapest type that spans it; null
   * when none does), and the whole tunnel with `middle` tiles inside. They replace the per-tile
   * `bridge` and `tunnel` costs; head foundations and clearing are still added.
   */
  bridgeSpan?: (middle: number) => number | null;
  tunnelSpan?: (middle: number) => number;
}

export interface Rules {
  maxBridge: number;
  maxTunnel: number;
  /** OpenTTD's forbid_90_deg: a train may not turn 90 degrees in one step. */
  forbid90: boolean;
  /** build_on_slopes: track on a slope other than an incline stands on a levelling foundation. */
  foundations: boolean;
  /** Track on a steep slope (two corners differ by 2), on a foundation. */
  steep: boolean;
  /** Most states expanded before the search gives up. */
  budget: number;
}

export const DEFAULT_COSTS: Costs = { curve: 0.5, incline: 1, foundation: 0.5, clear: 0.25, crossing: 1, bridge: 3, tunnel: 3 };
export const DEFAULT_RULES: Rules = { maxBridge: 16, maxTunnel: 32, forbid90: true, foundations: true, steep: false, budget: 2_000_000 };

export interface TileMap {
  /** Tiles across and down (the export's columns and rows, the last of each the map edge). */
  w: number;
  h: number;
  /** Vertex heights, row-major, w × h. */
  heights: Uint8Array;
  /** Type letters, row-major. */
  types: Uint8Array;
  /** RoadBits per tile, or none: then a road is an obstacle. */
  roads?: Uint8Array;
  /** Tiles taken since the export: planned track, reservations, works. */
  blocked?: Uint8Array;
}

export interface End { x: number; y: number; dir?: Heading }

export interface TrackPiece {
  kind: 'track';
  x: number; y: number;
  track: number;
  piece: 'x' | 'y' | (typeof CORNER_NAME)[number];
  heading: Heading;
  z: [number, number];
  foundation: boolean;
  incline: boolean;
  crossing: boolean;
  cleared: boolean;
}
export interface Span {
  kind: 'bridge' | 'tunnel';
  from: [number, number];
  to: [number, number];
  heading: Heading;
  axis: 'x' | 'y';
  /** Tiles under the bridge or inside the tunnel, the heads not counted. */
  length: number;
  /** The track's height at both heads (a bridge's deck is one above). */
  z: number;
  foundations: number;
}
export type Piece = TrackPiece | Span;

/** The eight directions a train moves in, clockwise from NE: a corner piece moves it E, S, W or N. */
export const MOTIONS = ['NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'] as const;

/**
 * A plan said compactly: consecutive track pieces of one motion are one run (a straight line, or
 * a diagonal of alternating corner pieces), rebuilt from its first tile, the heading it enters
 * that tile by, its motion and its count; a bridge or tunnel is one span between its two heads.
 */
export type Run =
  | { kind: 'track'; x: number; y: number; heading: Heading; motion: (typeof MOTIONS)[number]; count: number }
  | { kind: 'bridge' | 'tunnel'; from: [number, number]; to: [number, number]; heading: Heading };

export interface Plan {
  status: 'found' | 'unreachable' | 'budget';
  cost: number;
  pieces: Piece[];
  runs: Run[];
  expanded: number;
  counts: { tiles: number; length: number; curves: number; sharp: number; foundations: number; inclines: number; crossings: number; cleared: number; bridges: number; tunnels: number };
}

const at = (m: TileMap, x: number, y: number) => m.heights[y * m.w + x];
const inside = (m: TileMap, x: number, y: number) => x >= 0 && y >= 0 && x < m.w - 1 && y < m.h - 1;

/** The four corner heights N, E, S, W of tile (x, y). */
export function corners(m: TileMap, x: number, y: number): [number, number, number, number] {
  return [at(m, x, y), at(m, x, y + 1), at(m, x + 1, y + 1), at(m, x + 1, y)];
}

/** What the planner reads of one tile: its corners, OpenTTD slope, steepness and lowest/highest corner. */
export interface TileMeta {
  corners: [number, number, number, number];
  min: number;
  max: number;
  slope: number;
  steep: boolean;
  type: string;
}

export function meta(m: TileMap, x: number, y: number): TileMeta {
  const c = corners(m, x, y);
  const min = Math.min(...c);
  const max = Math.max(...c);
  let slope = 0;
  for (let k = 0; k < 4; k++) if (c[k] > min) slope |= SLOPE_BIT[k];
  const steep = max - min >= 2;
  // a steep slope is named by its top corner: every corner raised but the one opposite it
  if (steep) slope = 16 | (15 ^ SLOPE_BIT[c.indexOf(min)]);
  return { corners: c, min, max, slope, steep, type: String.fromCharCode(m.types[y * m.w + x]) };
}

interface Shape { zin: number; zout: number; foundation: boolean; incline: boolean }

/** The heights a piece from entry side `a` to exit side `b` takes on a tile, or null if it cannot stand there. */
function shape(c: TileMeta['corners'], a: number, b: number, rules: Rules): Shape | null {
  const min = Math.min(...c);
  const max = Math.max(...c);
  if (max === min) return { zin: min, zout: min, foundation: false, incline: false };
  if (max - min > 2) return null;
  const ea = [c[a], c[(a + 1) % 4]];
  const eb = [c[b], c[(b + 1) % 4]];
  // an incline: the piece is straight and the tile rises evenly from one edge to the other
  if ((a + 2) % 4 === b && max - min === 1 && ea[0] === ea[1] && eb[0] === eb[1]) {
    return { zin: ea[0], zout: eb[0], foundation: false, incline: true };
  }
  if (!rules.foundations || (max - min === 2 && !rules.steep)) return null;
  return { zin: max, zout: max, foundation: true, incline: false };
}

/** The height of a station or goal tile's track: flat, else on a foundation at its highest corner. */
const level = (t: TileMeta) => t.max;

type Class = 'build' | 'trees' | 'road' | 'span' | 'none';
function classOf(m: TileMap, x: number, y: number): Class {
  const i = y * m.w + x;
  if (m.blocked?.[i]) return 'none';
  switch (String.fromCharCode(m.types[i])) {
    case 'C': return 'build';
    case 'T': return 'trees';
    case 'r': return m.roads ? 'road' : 'span';
    case 'W': case 'R': return 'span';
    default: return 'none';
  }
}
/** What a bridge may pass over: low ground, water, road, rail; never buildings or other bridges. */
const passableUnder = (m: TileMap, x: number, y: number) => {
  const t = String.fromCharCode(m.types[y * m.w + x]);
  return t === 'C' || t === 'T' || t === 'W' || t === 'r' || t === 'R';
};

/** The angle between two of the eight motions, in steps of 45 degrees. */
const turn = (p: number, q: number) => { const d = Math.abs(p - q) % 8; return Math.min(d, 8 - d); };

interface Move { prev: number; piece: Piece }

/**
 * The cheapest route from the edge of `from` (a station tile; the line leaves it heading
 * from.dir) into `to` (entered from any side, or heading to.dir), by A* with the heuristic
 * Manhattan distance times the cheapest cost of advancing one tile, which never overestimates.
 * With `heuristic` false it is Dijkstra, the reference the tests hold A* to.
 */
export function plan(m: TileMap, from: End & { dir: Heading }, to: End, costs: Costs = DEFAULT_COSTS,
  rules: Rules = DEFAULT_RULES, heuristic = true): Plan {
  const W = m.w;
  const hf = heuristic ? Math.min(HALF_DIAGONAL, costs.bridge, costs.tunnel, 1) : 0;
  const goalZ = level(meta(m, to.x, to.y));
  const goalDir = to.dir ? HEADINGS.indexOf(to.dir) : -1;
  const key = (x: number, y: number, d: number, mo: number, z: number) => (((y * W + x) * 4 + d) * 8 + mo) * 256 + z;
  const g = new Map<number, number>();
  const via = new Map<number, Move>();
  const closed = new Set<number>();
  const heap = new Heap<{ f: number; k: number }>((p, q) => p.f < q.f);
  const h = (x: number, y: number) => hf * (Math.abs(x - to.x) + Math.abs(y - to.y));
  const d0 = HEADINGS.indexOf(from.dir);
  const sx = from.x + DX[d0]; const sy = from.y + DY[d0];
  const z0 = level(meta(m, from.x, from.y));
  const k0 = key(sx, sy, d0, 2 * d0, z0);
  g.set(k0, 0);
  heap.push({ f: h(sx, sy), k: k0 });
  const decode = (k: number) => {
    const z = k % 256; let r = (k - z) / 256;
    const mo = r % 8; r = (r - mo) / 8;
    const d = r % 4; const t = (r - d) / 4;
    return { x: t % W, y: Math.floor(t / W), d, mo, z };
  };
  const relax = (k: number, cost: number, nx: number, ny: number, nd: number, nm: number, nz: number, piece: Piece) => {
    if (nx < 0 || ny < 0 || nx >= m.w - 1 || ny >= m.h - 1 || nz > 255) return;
    const nk = key(nx, ny, nd, nm, nz);
    const ng = g.get(k)! + cost;
    if (closed.has(nk) || ng >= (g.get(nk) ?? Infinity)) return;
    g.set(nk, ng);
    via.set(nk, { prev: k, piece });
    heap.push({ f: ng + h(nx, ny), k: nk });
  };
  const curveCost = (pm: number, nm: number) => {
    const a = turn(pm, nm);
    if (a >= 3 || (a === 2 && rules.forbid90)) return Infinity;
    return a * costs.curve;
  };
  let expanded = 0;
  let found = -1;
  while (heap.size) {
    const { k } = heap.pop()!;
    if (closed.has(k)) continue;
    closed.add(k);
    const { x, y, d, mo, z } = decode(k);
    if (x === to.x && y === to.y) {
      if (z === goalZ && (goalDir < 0 || d === goalDir)) { found = k; break; }
      continue;
    }
    if (++expanded > rules.budget) return empty('budget', expanded);
    const cls = classOf(m, x, y);
    if (cls === 'none' || cls === 'span') continue;
    const t = meta(m, x, y);
    const a = (d + 2) % 4;
    // one track piece: straight on, or a corner piece turning 45 degrees either way
    for (const e of [d, (d + 1) % 4, (d + 3) % 4]) {
      const s = shape(t.corners, a, e, rules);
      if (!s || s.zin !== z) continue;
      const straight = e === d;
      const nm = straight ? 2 * d : e === (d + 1) % 4 ? 2 * d + 1 : (2 * d + 7) % 8;
      const cc = curveCost(mo, nm);
      if (!Number.isFinite(cc)) continue;
      let crossing = false;
      if (cls === 'road') {
        const bits = m.roads![y * W + x];
        if (!straight || s.foundation || s.incline || bits !== (d % 2 === 0 ? ROAD_Y : ROAD_X)) continue;
        crossing = true;
      }
      // entry side d + 2 and exit side d + 1 share corner d + 2; with exit side d - 1, corner d + 3
      const corner = e === (d + 1) % 4 ? (d + 2) % 4 : (d + 3) % 4;
      const piece: TrackPiece = {
        kind: 'track', x, y, heading: HEADINGS[d],
        track: straight ? (d % 2 === 0 ? 1 : 2) : CORNER_TRACK[corner],
        piece: straight ? (d % 2 === 0 ? 'x' : 'y') : CORNER_NAME[corner],
        z: [s.zin, s.zout], foundation: s.foundation, incline: s.incline, crossing, cleared: cls === 'trees',
      };
      const cost = (straight ? 1 : HALF_DIAGONAL) + cc + (s.incline ? costs.incline : 0) + (s.foundation ? costs.foundation : 0)
        + (crossing ? costs.crossing : 0) + (cls === 'trees' ? costs.clear : 0);
      relax(k, cost, x + DX[e], y + DY[e], e, nm, s.zout, piece);
    }
    if (cls === 'road') continue;
    const cc = curveCost(mo, 2 * d);
    if (!Number.isFinite(cc)) continue;
    const headCost = (tt: TileMeta, c: Class) => 1 + (tt.max !== tt.min ? costs.foundation : 0) + (c === 'trees' ? costs.clear : 0);
    // a bridge: level heads at the arrival height, the deck one above, ground below at most the heads
    const hz = t.max;
    const headOk = (tt: TileMeta) => tt.max === tt.min || (rules.foundations && (tt.max - tt.min < 2 || rules.steep));
    if (hz === z && headOk(t)) {
      for (let L = 1; L <= rules.maxBridge; L++) {
        const mx = x + DX[d] * L; const my = y + DY[d] * L;
        if (!inside(m, mx, my) || !passableUnder(m, mx, my) || meta(m, mx, my).max > hz) break;
        const bx = mx + DX[d]; const by = my + DY[d];
        if (!inside(m, bx, by)) break;
        const bc = classOf(m, bx, by);
        const bt = meta(m, bx, by);
        if ((bc === 'build' || bc === 'trees') && bt.max === hz && headOk(bt)) {
          const span: Span = { kind: 'bridge', from: [x, y], to: [bx, by], heading: HEADINGS[d], axis: d % 2 === 0 ? 'x' : 'y', length: L, z: hz,
            foundations: (t.max !== t.min ? 1 : 0) + (bt.max !== bt.min ? 1 : 0) };
          const exact = costs.bridgeSpan?.(L);
          if (exact === null) continue;
          const spanCost = exact === undefined ? headCost(t, cls) + headCost(bt, bc) + L * costs.bridge
            : exact + headCost(t, cls) + headCost(bt, bc) - 2;
          relax(k, cc + spanCost, bx + DX[d], by + DY[d], d, 2 * d, hz, span);
        }
      }
    }
    // a tunnel: an incline rising ahead at the arrival height, ground above it, and the first
    // incline falling ahead at the same height its far portal
    const rising = (c: TileMeta['corners'], zz: number) => !(Math.max(...c) - Math.min(...c) > 1)
      && c[a] === zz && c[(a + 1) % 4] === zz && c[d] === zz + 1 && c[(d + 1) % 4] === zz + 1;
    if (rising(t.corners, z)) {
      for (let L = 1; L <= rules.maxTunnel + 1; L++) {
        const tx = x + DX[d] * L; const ty = y + DY[d] * L;
        if (!inside(m, tx, ty)) break;
        const tt = meta(m, tx, ty);
        const c = tt.corners;
        const falling = tt.max - tt.min === 1 && c[a] === z + 1 && c[(a + 1) % 4] === z + 1 && c[d] === z && c[(d + 1) % 4] === z;
        if (falling) {
          const tc = classOf(m, tx, ty);
          if (L >= 2 && (tc === 'build' || tc === 'trees')) {
            const span: Span = { kind: 'tunnel', from: [x, y], to: [tx, ty], heading: HEADINGS[d], axis: d % 2 === 0 ? 'x' : 'y', length: L - 1, z, foundations: 0 };
            const body = costs.tunnelSpan ? costs.tunnelSpan(L - 1) : 2 + (L - 1) * costs.tunnel;
            relax(k, cc + body + (cls === 'trees' ? costs.clear : 0) + (tc === 'trees' ? costs.clear : 0), tx + DX[d], ty + DY[d], d, 2 * d, z, span);
          }
          break;
        }
        if (tt.min < z + 1 || L > rules.maxTunnel) break;
      }
    }
  }
  if (found < 0) return empty('unreachable', expanded);
  const pieces: Piece[] = [];
  for (let k = found; via.has(k); k = via.get(k)!.prev) pieces.push(via.get(k)!.piece);
  pieces.reverse();
  return { status: 'found', cost: g.get(found)!, pieces, runs: runs(pieces), expanded, counts: count(pieces) };
}

function empty(status: Plan['status'], expanded: number): Plan {
  return { status, cost: Infinity, pieces: [], runs: [], expanded, counts: count([]) };
}

/** The motion a track piece moves a train in (0..7, clockwise from NE). */
function motionOf(p: TrackPiece): number {
  const d = HEADINGS.indexOf(p.heading);
  if (p.piece === 'x' || p.piece === 'y') return 2 * d;
  return CORNER_NAME.indexOf(p.piece as (typeof CORNER_NAME)[number]) === (d + 2) % 4 ? 2 * d + 1 : (2 * d + 7) % 8;
}

/** The plan's pieces merged into runs of one motion, and its spans. */
export function runs(pieces: Piece[]): Run[] {
  const out: Run[] = [];
  for (const p of pieces) {
    if (p.kind !== 'track') { out.push({ kind: p.kind, from: p.from, to: p.to, heading: p.heading }); continue; }
    const mo = MOTIONS[motionOf(p)];
    const last = out[out.length - 1];
    if (last?.kind === 'track' && last.motion === mo) last.count++;
    else out.push({ kind: 'track', x: p.x, y: p.y, heading: p.heading, motion: mo, count: 1 });
  }
  return out;
}

/**
 * Lay a plan's runs back out as pieces' tiles and TrackBits, the way a builder that holds only the
 * runs would: a straight run continues its heading, a diagonal run alternates its two corner pieces.
 */
export function unrun(rs: Run[]): { x: number; y: number; track: number }[] {
  const out: { x: number; y: number; track: number }[] = [];
  for (const r of rs) {
    if (r.kind !== 'track') continue;
    let x = r.x; let y = r.y; let d = HEADINGS.indexOf(r.heading);
    const mo = MOTIONS.indexOf(r.motion);
    for (let i = 0; i < r.count; i++) {
      let e: number;
      if (mo % 2 === 0) { e = d; out.push({ x, y, track: d % 2 === 0 ? 1 : 2 }); } else {
        // a diagonal motion between headings (mo - 1) / 2 and (mo + 1) / 2: enter by one, leave by the other
        const h1 = (mo - 1) / 2; const h2 = ((mo + 1) / 2) % 4;
        e = d === h1 ? h2 : h1;
        const corner = e === (d + 1) % 4 ? (d + 2) % 4 : (d + 3) % 4;
        out.push({ x, y, track: CORNER_TRACK[corner] });
      }
      d = e; x += DX[d]; y += DY[d];
    }
  }
  return out;
}

function count(pieces: Piece[]): Plan['counts'] {
  const c = { tiles: 0, length: 0, curves: 0, sharp: 0, foundations: 0, inclines: 0, crossings: 0, cleared: 0, bridges: 0, tunnels: 0 };
  let motion = -1;
  for (const p of pieces) {
    const d = HEADINGS.indexOf(p.heading);
    let mo = 2 * d;
    if (p.kind === 'track') {
      c.tiles++;
      const straight = p.piece === 'x' || p.piece === 'y';
      c.length += straight ? 1 : HALF_DIAGONAL;
      if (!straight) mo = CORNER_NAME.indexOf(p.piece as (typeof CORNER_NAME)[number]) === (d + 2) % 4 ? 2 * d + 1 : (2 * d + 7) % 8;
      if (p.foundation) c.foundations++;
      if (p.incline) c.inclines++;
      if (p.crossing) c.crossings++;
      if (p.cleared) c.cleared++;
    } else {
      c.tiles += 2;
      c.length += p.length + 2;
      c.foundations += p.foundations;
      if (p.kind === 'bridge') c.bridges++; else c.tunnels++;
    }
    if (motion >= 0) { const a = turn(motion, mo); if (a === 1) c.curves++; if (a === 2) c.sharp++; }
    motion = mo;
  }
  return c;
}

/** OpenTTD's CalcBridgeLenCostFactor: 2 for the first two tiles, then +1, +2 +2, +3 +3 +3, ... */
export function bridgeLenCostFactor(length: number): number {
  if (length < 2) return length;
  let left = length - 2;
  let sum = 2;
  for (let delta = 1; ; delta++) {
    for (let c = 0; c < delta; c++) {
      if (left === 0) return sum;
      sum += delta;
      left--;
    }
  }
}

/** A bridge's price as CmdBuildBridge charges it: L tiles of rail (heads included) and the type's share. */
export function bridgeMoney(middle: number, buildRail: number, buildBridge: number, typePrice: number): number {
  const L = middle + 2;
  return L * buildRail + Math.floor((bridgeLenCostFactor(L) * buildBridge * typePrice) / 256);
}

/** A tunnel's price as CmdBuildTunnel charges it: each tile inside, compounding, then the entrance. */
export function tunnelMoney(middle: number, buildTunnel: number): number {
  let total = 0;
  let coef = 3;
  let bump = 25;
  for (let tiles = 1; tiles <= middle; tiles++) {
    if (tiles === bump) { coef++; bump *= 2; }
    total += buildTunnel;
    total += Math.floor(total / 2 ** coef);
  }
  return total + buildTunnel;
}
