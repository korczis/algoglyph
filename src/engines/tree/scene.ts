// What the tree engine draws: a replayed store laid out as a tidy forest, eased from one layout
// to the next, with the current operation's path highlighted. Positions are in slot units: each
// key of a search-tree node takes the slot between its subtrees (in-order), a node without that
// shape sits centred over its children. Nothing here measures; it only shows the store.
import type p5 from 'p5';
import { mix, ramp, type RGB } from '../../core/palette';
import type { PlateContext } from '../../core/plate';
import { EV, NIL, OP_KINDS, Store, WORD_LETTERS, type Counts, type Key, type Trace,
  type TreeKernel } from './trace';

export interface SceneNode {
  id: number;
  x: number;
  d: number;
  labels: string[];
  /** Colour position in [0, 1]. */
  value: number;
  tag: number;
  info?: number;
}

export interface SceneEdge {
  from: number;
  to: number;
  /** Which child slot of `from` (to anchor edges of multi-key nodes between their keys). */
  slot: number;
  /** A link back up the tree (Patricia) rather than down to a child. */
  thread: boolean;
}

export interface Scene {
  nodes: SceneNode[];
  edges: SceneEdge[];
  slots: number;
  depth: number;
}

const valueOf = (k: Key, maxKey: number): number => {
  if (typeof k === 'number') return maxKey > 0 ? k / maxKey : 0;
  const i = WORD_LETTERS.indexOf(k[0]);
  if (i >= 0) return i / Math.max(1, WORD_LETTERS.length - 1);
  return (k.charCodeAt(0) % 26) / 25;
};

function nodesScene(s: Store, kernel: TreeKernel, maxKey: number): Scene {
  const nodes: SceneNode[] = [];
  const edges: SceneEdge[] = [];
  const seen = new Set<number>();
  let slot = 0;
  let depth = 0;
  const tidy = kernel.layout === 'tidy';
  const place = (x: number, d: number): number => {
    seen.add(x);
    depth = Math.max(depth, d);
    const ks = s.keys[x];
    const cs = s.kids[x];
    const node: SceneNode = { id: x, x: 0, d, labels: ks.map(String), value: ks.length ? valueOf(ks[0], maxKey) : 0.5, tag: s.tag[x] };
    if (kernel.infoLabel) node.info = s.info[x];
    nodes.push(node);
    const down = (i: number): number | undefined => {
      const c = cs[i];
      if (c === NIL || c === undefined || !s.alive[c]) return undefined;
      if (seen.has(c)) { edges.push({ from: x, to: c, slot: i, thread: true }); return undefined; }
      edges.push({ from: x, to: c, slot: i, thread: false });
      return place(c, d + 1);
    };
    if (!tidy && (cs.length === 0 || cs.length === ks.length + 1)) {
      const keySlots: number[] = [];
      const childXs: number[] = [];
      for (let i = 0; i <= ks.length; i++) {
        if (i < cs.length) { const cx = down(i); if (cx !== undefined) childXs.push(cx); }
        if (i < ks.length) keySlots.push(slot++);
      }
      if (keySlots.length) node.x = keySlots.reduce((a, b) => a + b, 0) / keySlots.length;
      else if (childXs.length) node.x = (childXs[0] + childXs[childXs.length - 1]) / 2;
      else node.x = slot++;
      return node.x;
    }
    const childXs: number[] = [];
    for (let i = 0; i < cs.length; i++) { const cx = down(i); if (cx !== undefined) childXs.push(cx); }
    if (childXs.length) node.x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    else { node.x = slot + (Math.max(1, ks.length) - 1) / 2; slot += Math.max(1, ks.length); }
    return node.x;
  };
  for (const r of s.roots) {
    if (r === NIL || seen.has(r) || !s.alive[r]) continue;
    if (slot > 0) slot += 0.6;
    place(r, 0);
  }
  return { nodes, edges, slots: Math.max(1, slot), depth };
}

function heapScene(s: Store, kernel: TreeKernel, maxKey: number): Scene {
  const nodes: SceneNode[] = [];
  const edges: SceneEdge[] = [];
  let slot = 0;
  let depth = 0;
  const place = (i: number, d: number) => {
    if (i > s.size) return;
    depth = Math.max(depth, d);
    if (2 * i <= s.size) edges.push({ from: i, to: 2 * i, slot: 0, thread: false });
    if (2 * i + 1 <= s.size) edges.push({ from: i, to: 2 * i + 1, slot: 0, thread: false });
    place(2 * i, d + 1);
    const v = s.arr[i];
    const dec = kernel.decode ? kernel.decode(v) : { key: v, group: 0 };
    nodes.push({
      id: i, x: slot++, d, labels: [String(dec.key)], tag: dec.group,
      value: kernel.decode ? ((dec.group * 0.381966) % 1) : valueOf(dec.key, maxKey),
    });
    place(2 * i + 1, d + 1);
  };
  place(1, 0);
  return { nodes, edges, slots: Math.max(1, slot), depth };
}

function parentScene(s: Store): Scene {
  const n = s.size;
  const kids: number[][] = Array.from({ length: n }, () => []);
  const roots: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = s.arr[i];
    if (p === i || p < 0 || p >= n) roots.push(i); else kids[p].push(i);
  }
  const nodes: SceneNode[] = [];
  const edges: SceneEdge[] = [];
  const seen = new Set<number>();
  let slot = 0;
  let depth = 0;
  const place = (x: number, d: number, root: number): number => {
    seen.add(x);
    depth = Math.max(depth, d);
    const node: SceneNode = { id: x, x: 0, d, labels: [String(x)], value: n > 1 ? root / (n - 1) : 0.5, tag: 0 };
    nodes.push(node);
    const xs: number[] = [];
    for (const c of kids[x]) {
      if (seen.has(c)) continue;
      edges.push({ from: x, to: c, slot: 0, thread: false });
      xs.push(place(c, d + 1, root));
    }
    node.x = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : slot++;
    return node.x;
  };
  for (const r of roots) { if (slot > 0) slot += 0.4; place(r, 0, r); }
  return { nodes, edges, slots: Math.max(1, slot), depth };
}

export function scene(s: Store, kernel: TreeKernel, maxKey: number): Scene {
  if (kernel.view === 'heap') return heapScene(s, kernel, maxKey);
  if (kernel.view === 'parent') return parentScene(s);
  return nodesScene(s, kernel, maxKey);
}

/** The shape of the replayed structure: keys held, levels, and mean depth (root = 1) of a key. */
export function shape(s: Store, kernel: TreeKernel): { size: number; nodes: number; height: number; mean: number } {
  if (kernel.view === 'heap') {
    let sum = 0;
    for (let i = 1; i <= s.size; i++) sum += Math.floor(Math.log2(i)) + 1;
    return { size: s.size, nodes: s.size, height: s.size ? Math.floor(Math.log2(s.size)) + 1 : 0, mean: s.size ? sum / s.size : 0 };
  }
  if (kernel.view === 'parent') {
    let sum = 0; let h = 0;
    for (let i = 0; i < s.size; i++) {
      let d = 1;
      for (let x = i; s.arr[x] !== x && d <= s.size; x = s.arr[x]) d++;
      sum += d; h = Math.max(h, d);
    }
    return { size: s.size, nodes: s.size, height: h, mean: s.size ? sum / s.size : 0 };
  }
  const nodes = s.walk();
  let size = 0; let sum = 0; let h = 0;
  for (const { id, depth } of nodes) {
    h = Math.max(h, depth + 1);
    const k = kernel.colour === 'terminal' ? (s.tag[id] === 1 ? 1 : 0) : s.keys[id].length;
    size += k;
    sum += k * (depth + 1);
  }
  return { size, nodes: nodes.length, height: h, mean: size ? sum / size : 0 };
}

/** A trace replayed event by event onto a store of its own. */
export class Replay {
  s: Store;
  at = 0;
  op = -1;
  caption = '';
  hot = new Set<number>();
  last = NIL;
  outputs: { v: Key; group: number }[] = [];
  hits = 0;
  misses = 0;
  c: Counts = { compares: 0, digits: 0, visits: 0, links: 0, rotations: 0, splits: 0, recolours: 0, nodes: 0, reads: 0, writes: 0 };
  /** Per operation: [operations done, height, mean depth, lg(size + 1)]. */
  history: [number, number, number, number][] = [];
  readonly maxKey: number;
  constructor(readonly t: Trace, readonly kernel: TreeKernel) {
    this.s = new Store(t.store.arr.length);
    const nums = t.workload.keys.filter((k): k is number => typeof k === 'number');
    this.maxKey = Math.max(1, ...nums, t.workload.sites - 1);
  }
  get done(): boolean { return this.at >= this.t.events.length; }
  private sample(): void {
    const sh = shape(this.s, this.kernel);
    this.history.push([this.op + 1, sh.height, Number(sh.mean.toFixed(3)), Number(Math.log2(sh.size + 1).toFixed(3))]);
    if (this.history.length > 600) this.history = this.history.filter((_, i) => i % 2 === 0);
  }
  advance(steps: number): void {
    const ev = this.t.events;
    const end = Math.min(ev.length, this.at + steps);
    for (; this.at < end; this.at++) {
      const e = ev[this.at];
      switch (e.o) {
        case EV.begin:
          if (this.op >= 0) this.sample();
          this.op++;
          this.caption = String(e.p ?? OP_KINDS[e.a]);
          this.hot.clear();
          this.last = NIL;
          break;
        case EV.visit: case EV.compare: case EV.digit: case EV.get: case EV.set:
          if (e.a >= 0) { this.hot.add(e.a); this.last = e.a; }
          if (e.o === EV.visit) this.c.visits++;
          else if (e.o === EV.compare) this.c.compares++;
          else if (e.o === EV.digit) this.c.digits++;
          else if (e.o === EV.get) this.c.reads++;
          else this.c.writes++;
          break;
        case EV.child: case EV.root: this.c.links++; break;
        case EV.children: {
          const old = this.s.kids[e.a]; const cs = e.p as number[];
          let ch = Math.abs(old.length - cs.length);
          for (let i = 0; i < Math.min(old.length, cs.length); i++) if (old[i] !== cs[i]) ch++;
          this.c.links += ch;
          break;
        }
        case EV.tag: this.c.recolours++; break;
        case EV.make: this.c.nodes++; this.hot.add(e.a); this.last = e.a; break;
        case EV.rotate: this.c.rotations++; break;
        case EV.split: this.c.splits++; break;
        case EV.emit: this.outputs.push({ v: e.p as Key, group: e.a }); break;
        case EV.found: if (e.a) this.hits++; else this.misses++; break;
        default: break;
      }
      this.s.apply(e);
    }
    if (this.done && this.op >= 0 && this.history[this.history.length - 1]?.[0] !== this.op + 1) this.sample();
  }
}

/** Eased screen positions per node id, so a rotation or split is seen moving. */
export class Motion {
  private pos = new Map<number, [number, number]>();
  place(id: number, x: number, y: number, from?: [number, number]): [number, number] {
    const cur = this.pos.get(id) ?? from ?? [x, y];
    const next: [number, number] = [cur[0] + (x - cur[0]) * 0.28, cur[1] + (y - cur[1]) * 0.28];
    this.pos.set(id, next);
    return next;
  }
  snap(): void { this.pos.clear(); }
  get(id: number): [number, number] | undefined { return this.pos.get(id); }
  keep(ids: Set<number>): void { for (const k of [...this.pos.keys()]) if (!ids.has(k)) this.pos.delete(k); }
}

export interface Box { x: number; y: number; w: number; h: number }

const lum = (c: RGB) => (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000;
/** Of the two grounds, the one that reads on `fill`. */
export function ink(ctx: PlateContext, fill: RGB): RGB {
  return Math.abs(lum(ctx.fg) - lum(fill)) > Math.abs(lum(ctx.bg) - lum(fill)) ? ctx.fg : ctx.bg;
}

/** Draw a replay's structure into box b; returns nothing, draws only through p and ctx colours. */
export function drawScene(p: p5, ctx: PlateContext, r: Replay, m: Motion, b: Box, opts: { labels: boolean; snap?: boolean }): void {
  const sc = scene(r.s, r.kernel, r.maxKey);
  const pal = ctx.palette();
  const fg = ctx.fg; const bg = ctx.bg;
  const levels = sc.depth + 1;
  const cw = b.w / sc.slots;
  const rh = b.h / Math.max(1, levels);
  const rad = Math.max(1.6, Math.min(cw * 0.42, rh * 0.3, 17));
  const X = (x: number) => b.x + (x + 0.5) * cw;
  const Y = (d: number) => b.y + (d + 0.5) * rh;
  const ids = new Set(sc.nodes.map((n) => n.id));
  if (opts.snap) m.snap();
  const parentOf = new Map<number, number>();
  for (const e of sc.edges) if (!e.thread) parentOf.set(e.to, e.from);
  const at = new Map<number, [number, number]>();
  const order = sc.nodes.slice().sort((a, c) => a.d - c.d);
  for (const n of order) {
    const par = parentOf.get(n.id);
    at.set(n.id, m.place(n.id, X(n.x), Y(n.d), par !== undefined ? at.get(par) : undefined));
  }
  m.keep(ids);
  const byId = new Map(sc.nodes.map((n) => [n.id, n]));
  const halfW = (n: SceneNode) => (n.labels.length > 1 ? (n.labels.length * rad * 1.7) / 2 : rad);
  const multi = sc.nodes.some((n) => n.labels.length > 1);
  // edges
  for (const e of sc.edges) {
    const a = at.get(e.from); const c = at.get(e.to);
    const na = byId.get(e.from);
    if (!a || !c || !na) continue;
    const k = na.labels.length;
    const ax = multi && k > 1 ? a[0] - halfW(na) + (e.slot * 2 * halfW(na)) / k : a[0];
    const hot = r.hot.has(e.from) && r.hot.has(e.to) && !r.done;
    const redLink = r.kernel.colour === 'red-black' && byId.get(e.to)?.tag === 1;
    if (e.thread) {
      p.noFill();
      p.stroke(fg[0], fg[1], fg[2], hot ? 150 : 45);
      p.strokeWeight(1);
      if (e.from === e.to) {
        const lr = Math.min(rad * 0.7, 6);
        p.circle(a[0] + (e.slot ? 1 : -1) * (rad + lr * 0.6), a[1] + rad * 0.6, 2 * lr);
      } else {
        const dx = (e.slot ? 1 : -1) * Math.max(cw, rad * 3);
        p.bezier(ax, a[1] + rad * 0.6, ax + dx, a[1] + rh * 0.7, c[0] + dx, c[1] + rh * 0.4, c[0], c[1] + rad);
      }
      continue;
    }
    if (redLink) {
      const rc = ramp(pal, 0);
      p.stroke(rc[0], rc[1], rc[2]);
      p.strokeWeight(Math.max(1.5, rad * 0.35));
    } else {
      p.stroke(fg[0], fg[1], fg[2], hot ? 230 : 90);
      p.strokeWeight(hot ? Math.max(1.5, rad * 0.25) : 1);
    }
    p.line(ax, a[1] + (multi ? rad * 0.8 : 0), c[0], c[1] - (multi ? rad * 0.8 : 0));
  }
  // nodes
  p.textAlign(p.CENTER, p.CENTER);
  const fs = Math.max(7, Math.min(13, rad * 0.95));
  p.textSize(fs);
  for (const n of sc.nodes) {
    const q = at.get(n.id);
    if (!q) continue;
    let fill: RGB = ramp(pal, n.value);
    let hollow = false;
    if (r.kernel.colour === 'red-black') fill = n.tag === 1 ? ramp(pal, 0) : mix(fg, bg, 0.15);
    if (r.kernel.colour === 'terminal' && n.tag !== 1) hollow = true;
    const keyless = n.labels.length === 0;
    const hot = r.hot.has(n.id) && !r.done;
    p.strokeWeight(hot ? 2.5 : 1);
    p.stroke(fg[0], fg[1], fg[2], hot ? 255 : 110);
    if (keyless || hollow) p.fill(bg[0], bg[1], bg[2]); else p.fill(fill[0], fill[1], fill[2]);
    const hw = halfW(n);
    if (n.labels.length > 1) p.rect(q[0] - hw, q[1] - rad * 0.8, 2 * hw, rad * 1.6, rad * 0.3);
    else p.circle(q[0], q[1], (keyless ? 1.1 : 2) * rad);
    if (n.id === r.last && !r.done) {
      p.noFill();
      p.stroke(fg[0], fg[1], fg[2]);
      p.strokeWeight(1.5);
      if (n.labels.length > 1) p.rect(q[0] - hw - 3.5, q[1] - rad * 0.8 - 3.5, 2 * hw + 7, rad * 1.6 + 7, rad * 0.4);
      else p.circle(q[0], q[1], 2 * rad + 7);
    }
    if (opts.labels && rad >= 7 && !keyless) {
      p.noStroke();
      const c = hollow || keyless ? fg : ink(ctx, fill);
      p.fill(c[0], c[1], c[2]);
      n.labels.forEach((lab, i) => {
        const cx = n.labels.length > 1 ? q[0] - hw + ((i + 0.5) * 2 * hw) / n.labels.length : q[0];
        p.text(lab, cx, q[1] + 0.5);
      });
    }
    if (opts.labels && rad >= 9 && n.info !== undefined) {
      p.noStroke();
      p.fill(fg[0], fg[1], fg[2], 170);
      p.textSize(Math.max(7, fs * 0.7));
      p.text(String(n.info), q[0] + Math.max(hw, rad) + 2 + fs * 0.4, q[1] - rad * 0.9);
      p.textSize(fs);
    }
  }
}

/** The array behind a heap or union-find view, one cell per position, in box b. */
export function drawArray(p: p5, ctx: PlateContext, r: Replay, b: Box): void {
  const s = r.s;
  const heap = r.kernel.view === 'heap';
  const from = heap ? 1 : 0;
  const to = heap ? s.size : s.size - 1;
  const cells = Math.max(1, heap ? Math.max(s.size, 1) : s.size);
  const w = b.w / cells;
  const pal = ctx.palette();
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(Math.max(7, Math.min(11, w * 0.45)));
  for (let i = from; i <= to; i++) {
    const v = s.arr[i];
    const dec = r.kernel.decode ? r.kernel.decode(v) : { key: v, group: 0 };
    const t = r.kernel.decode ? (dec.group * 0.381966) % 1 : heap ? dec.key / r.maxKey : (s.size > 1 ? v / (s.size - 1) : 0.5);
    const c = ramp(pal, t);
    const x = b.x + (i - from) * w;
    p.stroke(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
    p.strokeWeight(1);
    p.fill(c[0], c[1], c[2]);
    p.rect(x, b.y, w, b.h);
    if (r.hot.has(i) && !r.done) {
      p.noFill();
      p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
      p.strokeWeight(2);
      p.rect(x + 1, b.y + 1, w - 2, b.h - 2);
    }
    if (w >= 16) {
      p.noStroke();
      const k = ink(ctx, c);
      p.fill(k[0], k[1], k[2]);
      p.text(String(dec.key), x + w / 2, b.y + b.h / 2);
    }
  }
}

/** Everything emitted so far, as a strip of bars coloured by value, gaps between groups. */
export function drawOutputs(p: p5, ctx: PlateContext, r: Replay, b: Box): void {
  const out = r.outputs;
  if (!out.length) return;
  const total = r.t.outputs.length + Math.max(0, new Set(r.t.outputs.map((o) => o.group)).size - 1);
  const w = b.w / Math.max(1, total);
  const pal = ctx.palette();
  let x = b.x;
  let prev = out[0].group;
  p.noStroke();
  p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 16);
  p.rect(b.x, b.y, b.w, b.h);
  for (const o of out) {
    if (o.group !== prev) { x += w; prev = o.group; }
    const v = typeof o.v === 'number' ? o.v / r.maxKey : 0.5;
    const c = ramp(pal, v);
    p.fill(c[0], c[1], c[2]);
    const h = Math.max(2, v * b.h);
    p.rect(x, b.y + b.h - h, Math.max(1, w - (w > 3 ? 1 : 0)), h);
    x += w;
  }
}
