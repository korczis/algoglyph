import { mix, paletteParam, ramp, type RGB } from '../../core/palette';
import { bool, num, str, type PlateCode, type Stat } from '../../core/plate';
import { gaussian } from '../../core/random';
import {
  circumcentre, Delaunay, LATTICE, minAngle, type Insertion,
} from '../_shared/delaunay/delaunay';
import { Pacer, paceParam } from '../../core/pace';

type Pt = [number, number];

const BUCKETS = 40;
export const FADE = 45;

function rgba(c: RGB, a: number): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

/**
 * Opacity of the latest cavity, `age` frames after its insertion: a linear ramp that reaches
 * exactly 0 at FADE, never an exponential decay that would creep through subnormal floats.
 */
export function highlight(age: number): number {
  return age >= FADE ? 0 : 1 - age / FADE;
}

function degrees(rad: number): string {
  const d = (rad * 180) / Math.PI;
  return `${d < 1 ? d.toPrecision(2) : d.toFixed(2)}°`;
}

/** Seeded points in canvas pixels, inside a margin. */
export function scatter(kind: string, n: number, w: number, h: number, rnd: () => number): Pt[] {
  const m = Math.min(w, h) * 0.04;
  const clampPt = (x: number, y: number): Pt =>
    [Math.min(w - m, Math.max(m, x)), Math.min(h - m, Math.max(m, y))];
  const out: Pt[] = [];
  if (kind === 'clustered') {
    const k = 4 + Math.floor(rnd() * 5);
    const centres = Array.from({ length: k }, () => ({
      x: m + rnd() * (w - 2 * m),
      y: m + rnd() * (h - 2 * m),
      s: Math.min(w, h) * (0.04 + 0.12 * rnd()),
    }));
    for (let i = 0; i < n; i++) {
      if (rnd() < 0.12) {
        out.push(clampPt(m + rnd() * (w - 2 * m), m + rnd() * (h - 2 * m)));
        continue;
      }
      const c = centres[Math.floor(rnd() * k)];
      // resample rather than clamp: clamped points would line the margin with slivers
      let x = c.x;
      let y = c.y;
      for (let tries = 0; tries < 20; tries++) {
        const gx = c.x + gaussian(rnd) * c.s;
        const gy = c.y + gaussian(rnd) * c.s;
        if (gx < m || gx > w - m || gy < m || gy > h - m) continue;
        x = gx;
        y = gy;
        break;
      }
      out.push([x, y]);
    }
  } else if (kind === 'poisson') {
    // dart throwing with a background grid; the radius shrinks if the darts stop landing
    let r = 0.72 * Math.sqrt(((w - 2 * m) * (h - 2 * m)) / n);
    while (out.length < n && r > 0.5) {
      const cell = r / Math.SQRT2;
      const gw = Math.ceil(w / cell);
      const gh = Math.ceil(h / cell);
      const grid = new Int32Array(gw * gh).fill(-1);
      for (let i = 0; i < out.length; i++) {
        grid[Math.floor(out[i][1] / cell) * gw + Math.floor(out[i][0] / cell)] = i;
      }
      let misses = 0;
      while (out.length < n && misses < 30 * n) {
        const x = m + rnd() * (w - 2 * m);
        const y = m + rnd() * (h - 2 * m);
        const gx = Math.floor(x / cell);
        const gy = Math.floor(y / cell);
        let ok = true;
        for (let yy = Math.max(0, gy - 2); ok && yy <= Math.min(gh - 1, gy + 2); yy++) {
          for (let xx = Math.max(0, gx - 2); xx <= Math.min(gw - 1, gx + 2); xx++) {
            const j = grid[yy * gw + xx];
            if (j >= 0 && (out[j][0] - x) ** 2 + (out[j][1] - y) ** 2 < r * r) {
              ok = false;
              break;
            }
          }
        }
        if (!ok) {
          misses++;
          continue;
        }
        grid[gy * gw + gx] = out.length;
        out.push([x, y]);
      }
      r *= 0.9;
    }
  } else if (kind === 'circle') {
    const R = Math.min(w, h) * 0.4;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = R * (1 + 0.035 * gaussian(rnd));
      out.push(clampPt(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr));
    }
  } else {
    for (let i = 0; i < n; i++) out.push([m + rnd() * (w - 2 * m), m + rnd() * (h - 2 * m)]);
  }
  return out;
}

export const bowyerWatsonDelaunay: PlateCode = {
  id: 'bowyer-watson-delaunay',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 50,
  params: [
    { kind: 'range', key: 'points', label: 'Points', min: 20, max: 3000, step: 10, value: 700,
      rebuild: true },
    paceParam(),
    {
      kind: 'select', key: 'distribution', label: 'Distribution', value: 'clustered',
      rebuild: true,
      options: [
        { value: 'uniform', label: 'Uniform' },
        { value: 'clustered', label: 'Clustered' },
        { value: 'poisson', label: 'Poisson-disc-like' },
        { value: 'circle', label: 'Circle + noise' },
      ],
    },
    {
      // the side of the integer lattice the points snap to (delaunay.ts): 4096 is the largest on
      // which the predicates stay exact; a coarse one merges points and lines them up
      kind: 'select', key: 'lattice', label: 'Lattice side', value: String(LATTICE),
      rebuild: true,
      options: [64, 256, 1024, LATTICE].map((v) => ({ value: String(v), label: `${v} × ${v}` })),
    },
    { kind: 'toggle', key: 'circles', label: 'Show circumcircles', value: true },
    { kind: 'toggle', key: 'voronoi', label: 'Show Voronoi dual', value: false },
    {
      kind: 'select', key: 'colour', label: 'Colour by', value: 'area',
      options: [
        { value: 'area', label: 'Area' },
        { value: 'angle', label: 'Minimum angle' },
      ],
    },
    paletteParam('ember'),
  ],
  pace: { kind: 'replay', unit: 'points' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'points', 60);
    const W = ctx.width;
    const H = ctx.height;
    // lattice units per canvas pixel
    // a caller that names no lattice gets the default, 4096
    const side = params.lattice === undefined ? LATTICE : num(params, 'lattice');
    const s = (side - 1) / Math.max(W, H);
    const snap = (v: number) => Math.min(side - 1, Math.max(0, Math.round(v * s)));
    let mesh = new Delaunay(side);
    let queue: Pt[] = [];
    let next = 0;
    let recent: Insertion[] = [];
    let age = FADE;
    let fresh = true;
    let clicks = 0;
    let shown = '';
    let rows: Stat[] = [];
    // per-triangle buffers reused across frames, so a frame allocates next to nothing
    let area = new Float64Array(0);
    let angle = new Float64Array(0);
    let cc = new Float64Array(0);
    const edges: number[] = [];

    // the highlight shows the insertions of the latest frame (or click) that inserted any
    const insert = (x: number, y: number): boolean => {
      const ins = mesh.insert(snap(x), snap(y));
      if (!ins) return false;
      if (fresh) recent = [];
      fresh = false;
      recent.push(ins);
      age = 0;
      return true;
    };

    return {
      pace: () => pacer.report(next >= queue.length, params),
      setup() {
        mesh = new Delaunay(side);
        queue = scatter(str(params, 'distribution'), num(params, 'points'), W, H, ctx.rnd);
        next = 0;
        pacer.start(queue.length);
        recent = [];
        age = FADE;
        clicks = 0;
        shown = '';
      },
      pressed(x, y) {
        fresh = true;
        clicks++;
        insert(x, y);
      },
      draw() {
        const rate = ctx.thumbnail ? Math.ceil(queue.length / 40) : next < queue.length ? pacer.take(params) : 0;
        fresh = true;
        let inserted = false;
        for (let k = 0; k < rate && next < queue.length; k++, next++) {
          if (insert(queue[next][0], queue[next][1])) inserted = true;
        }
        if (!inserted) age = Math.min(FADE, age + 1);

        // the canvas keeps its last frame: redraw only when something it or the readouts show
        // has changed. Every other readout is a function of the mesh, so of its vertex count.
        const key = [mesh.vertices, mesh.duplicates, clicks, next, age, ctx.theme,
          str(params, 'palette'), str(params, 'colour'), bool(params, 'voronoi'),
          bool(params, 'circles')].join('|');
        if (key === shown) {
          ctx.stats(rows);
          return;
        }
        shown = key;

        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const X = mesh.xs;
        const Y = mesh.ys;
        const px = (i: number) => X[i] / s;
        const py = (i: number) => Y[i] / s;
        p.background(...ctx.bg);

        // per-triangle measures; area is colour-normalised by the geometric mean
        const tv = mesh.tv;
        const alive = mesh.alive;
        if (area.length < alive.length) {
          const size = 2 * alive.length;
          area = new Float64Array(size);
          angle = new Float64Array(size);
          cc = new Float64Array(2 * size);
        }
        let logSum = 0;
        let count = 0;
        let smallest = Infinity;
        let angleSum = 0;
        for (let t = 0; t < alive.length; t++) {
          if (!alive[t] || mesh.ghost(t)) continue;
          const a = tv[3 * t];
          const b = tv[3 * t + 1];
          const c = tv[3 * t + 2];
          area[t] = Math.abs((X[b] - X[a]) * (Y[c] - Y[a]) - (Y[b] - Y[a]) * (X[c] - X[a])) / 2;
          angle[t] = minAngle(X[a], Y[a], X[b], Y[b], X[c], Y[c]);
          if (angle[t] < smallest) smallest = angle[t];
          angleSum += angle[t];
          logSum += Math.log(area[t]);
          count++;
        }
        const logMean = count ? logSum / count : 0;
        const byAngle = str(params, 'colour') === 'angle';
        const fills: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
        for (let t = 0; t < alive.length; t++) {
          if (!alive[t] || mesh.ghost(t)) continue;
          const u = byAngle ? angle[t] / (Math.PI / 3)
            : 0.5 + 0.2 * (Math.log(area[t]) - logMean) / Math.LN2;
          const bucket = Math.min(BUCKETS - 1, Math.max(0, Math.floor(u * BUCKETS)));
          const path = fills[bucket];
          path.moveTo(px(tv[3 * t]), py(tv[3 * t]));
          path.lineTo(px(tv[3 * t + 1]), py(tv[3 * t + 1]));
          path.lineTo(px(tv[3 * t + 2]), py(tv[3 * t + 2]));
          path.closePath();
        }
        g.save();
        for (let b = 0; b < BUCKETS; b++) {
          g.fillStyle = rgba(mix(ctx.bg, ramp(pal, (b + 0.5) / BUCKETS), 0.88), 1);
          g.fill(fills[b]);
        }

        mesh.edges(edges);
        const lead = new Path2D();
        for (let i = 0; i < edges.length; i += 4) {
          lead.moveTo(px(edges[i]), py(edges[i]));
          lead.lineTo(px(edges[i + 1]), py(edges[i + 1]));
        }
        g.lineJoin = 'round';
        g.lineWidth = ctx.thumbnail ? 0.5 : 0.7;
        g.strokeStyle = rgba(ctx.bg, 0.8);
        g.stroke(lead);

        if (bool(params, 'voronoi') && count > 0) {
          for (let t = 0; t < alive.length; t++) {
            if (!alive[t] || mesh.ghost(t)) continue;
            const [x, y] = circumcentre(px(tv[3 * t]), py(tv[3 * t]), px(tv[3 * t + 1]),
              py(tv[3 * t + 1]), px(tv[3 * t + 2]), py(tv[3 * t + 2]));
            cc[2 * t] = x;
            cc[2 * t + 1] = y;
          }
          const dual = new Path2D();
          const far = 2 * Math.max(W, H);
          for (let i = 0; i < edges.length; i += 4) {
            const t = edges[i + 2];
            const u = edges[i + 3];
            dual.moveTo(cc[2 * t], cc[2 * t + 1]);
            if (u >= 0) dual.lineTo(cc[2 * u], cc[2 * u + 1]);
            else {
              // a hull edge: its Voronoi edge is a ray leaving the hull, perpendicular to it
              const dx = px(edges[i + 1]) - px(edges[i]);
              const dy = py(edges[i + 1]) - py(edges[i]);
              const len = Math.hypot(dx, dy) || 1;
              dual.lineTo(cc[2 * t] + (dy / len) * far, cc[2 * t + 1] - (dx / len) * far);
            }
          }
          g.lineWidth = 0.9;
          g.strokeStyle = rgba(ctx.fg, 0.6);
          g.stroke(dual);
        }

        // the cavity of the latest insertions, its circumcircles and the new fan
        const fade = highlight(age);
        if (fade > 0 && recent.length) {
          const hole = new Path2D();
          const rings = new Path2D();
          const fan = new Path2D();
          for (const ins of recent) {
            const r = ins.removed;
            for (let i = 0; i < r.length; i += 3) {
              const [ax, ay, bx, by, cx, cy] = [px(r[i]), py(r[i]), px(r[i + 1]), py(r[i + 1]),
                px(r[i + 2]), py(r[i + 2])];
              hole.moveTo(ax, ay);
              hole.lineTo(bx, by);
              hole.lineTo(cx, cy);
              hole.closePath();
              const [ox, oy] = circumcentre(ax, ay, bx, by, cx, cy);
              const rad = Math.hypot(ax - ox, ay - oy);
              rings.moveTo(ox + rad, oy);
              rings.arc(ox, oy, rad, 0, Math.PI * 2);
            }
            const c = ins.created;
            for (let i = 0; i < c.length; i += 3) {
              fan.moveTo(px(c[i + 2]), py(c[i + 2]));
              fan.lineTo(px(c[i]), py(c[i]));
            }
          }
          g.fillStyle = rgba(ctx.fg, 0.16 * fade);
          g.fill(hole);
          g.lineWidth = 1.2;
          g.strokeStyle = rgba(ctx.fg, 0.75 * fade);
          g.stroke(hole);
          if (bool(params, 'circles')) {
            g.lineWidth = 0.8;
            g.strokeStyle = rgba(mix(ctx.fg, ramp(pal, 0.85), 0.5), 0.55 * fade);
            g.stroke(rings);
          }
          g.lineWidth = 1;
          g.strokeStyle = rgba(ramp(pal, 1), 0.9 * fade);
          g.stroke(fan);
          g.fillStyle = rgba(ctx.fg, fade);
          for (const ins of recent) {
            g.beginPath();
            g.arc(px(ins.vertex), py(ins.vertex), 2.6, 0, Math.PI * 2);
            g.fill();
          }
        }

        // points still waiting, as dust
        if (next < queue.length) {
          const dust = new Path2D();
          for (let i = next; i < queue.length; i++) {
            dust.moveTo(queue[i][0] + 0.9, queue[i][1]);
            dust.arc(queue[i][0], queue[i][1], 0.9, 0, Math.PI * 2);
          }
          g.fillStyle = rgba(ctx.fg, 0.3);
          g.fill(dust);
        }
        g.restore();

        const n = mesh.vertices;
        const { triangles, edges: e, hull } = mesh.counts();
        rows = [
          pacer.row(params),
          { label: 'points inserted', value: `${n} / ${queue.length + clicks}` },
          { label: 'duplicates skipped', value: String(mesh.duplicates) },
          { label: 'triangles', value: `${triangles} (2n − 2 − h = ${2 * n - 2 - hull})` },
          { label: 'edges', value: String(e) },
          { label: 'V − E + F', value: String(n - e + triangles + 1) },
          { label: 'hull vertices h', value: String(hull) },
          {
            label: 'visited / insertion',
            value: mesh.insertions ? (mesh.visited / mesh.insertions).toFixed(1) : '–',
          },
          { label: 'minimum angle', value: count ? degrees(smallest) : '–' },
          {
            label: 'mean of triangle minimum angles',
            value: count ? degrees(angleSum / count) : '–',
          },
        ];
        ctx.stats(rows);
      },
    };
  },
};

export default bowyerWatsonDelaunay;
