// Next fit, first fit and first fit decreasing pack the same seeded items side by side; the
// plate replays each one's placements and counts bins, fill and fit tests from them.
import type p5 from 'p5';
import { paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type Chart, type PlateCode, type PlateContext, type Stat } from '../../core/plate';
import { ALGORITHM_LABELS, ALGORITHMS, CAPACITY, EXACT_MAX, items, lowerBound, optimum, pack,
  SHAPE_LABELS, SHAPES, type Algorithm, type Packing, type Shape } from './packing';

const HOLD_FRAMES = 90;
const fmt = (x: number) => x.toLocaleString('en-US');

interface Lane {
  algorithm: Algorithm;
  packing: Packing;
  /** Placements replayed so far. */
  at: number;
  loads: number[];
  /** Per bin, the sizes stacked in it so far. */
  stacks: number[][];
  tests: number;
  /** [placements replayed, bins open] after every placement. */
  curve: [number, number][];
}

interface Run {
  sizes: number[];
  lanes: Lane[];
  lower: number;
  exact: number | null;
  /** The most bins any lane ends with: the grid every lane is drawn on. */
  binsMax: number;
}

export function build(shape: Shape, n: number, seed: number): Run {
  const sizes = items(shape, n, seed);
  const lanes = ALGORITHMS.map((algorithm): Lane => ({
    algorithm, packing: pack(algorithm, sizes), at: 0, loads: [], stacks: [], tests: 0, curve: [[0, 0]],
  }));
  return {
    sizes, lanes, lower: lowerBound(sizes),
    exact: n <= EXACT_MAX ? optimum(sizes) : null,
    binsMax: Math.max(1, ...lanes.map((l) => l.packing.loads.length)),
  };
}

/** Replay up to k placements of a lane, adding the fit tests each one recorded. */
export function advance(lane: Lane, k: number): void {
  const pl = lane.packing.placements;
  const end = Math.min(pl.length, lane.at + k);
  for (; lane.at < end; lane.at++) {
    const q = pl[lane.at];
    lane.tests += q.tests;
    if (q.opened) { lane.loads.push(0); lane.stacks.push([]); }
    lane.loads[q.bin] += q.size;
    lane.stacks[q.bin].push(q.size);
    lane.curve.push([lane.at + 1, lane.loads.length]);
  }
}

const done = (lane: Lane) => lane.at >= lane.packing.placements.length;

/** Columns for b bins of aspect 1:2 in a w x h box, largest bins first. */
function grid(b: number, w: number, h: number): { cols: number; bw: number; bh: number } {
  let best = { cols: 1, bw: 0, bh: 0 };
  for (let cols = 1; cols <= b; cols++) {
    const rows = Math.ceil(b / cols);
    const bh = Math.min(h / rows, (2 * w) / cols);
    const bw = bh / 2;
    if (bh > best.bh) best = { cols, bw, bh };
  }
  return best;
}

function drawLane(p: p5, ctx: PlateContext, run: Run, lane: Lane, x: number, y: number, w: number, h: number) {
  const pal = ctx.palette();
  const [fr, fg, fb] = ctx.fg;
  const fs = Math.max(9, Math.min(13, Math.round(Math.min(w, h) * 0.06)));
  p.noStroke();
  p.fill(fr, fg, fb);
  p.textSize(fs);
  p.textAlign(p.LEFT, p.TOP);
  p.text(`${ALGORITHM_LABELS[lane.algorithm]}: ${lane.loads.length} bins`, x, y);
  const top = y + fs + 6;
  const { cols, bw, bh } = grid(run.binsMax, w, h - fs - 6);
  const last = lane.at > 0 ? lane.packing.placements[lane.at - 1] : null;
  for (let b = 0; b < lane.loads.length; b++) {
    const bx = x + (b % cols) * bw;
    const by = top + Math.floor(b / cols) * bh;
    const iw = bw * 0.84;
    const ih = bh * 0.92;
    p.fill(fr, fg, fb, 22);
    p.rect(bx, by, iw, ih);
    let filled = 0;
    const stack = lane.stacks[b];
    stack.forEach((s, i) => {
      const c = ramp(pal, s / CAPACITY);
      const sh = (s / CAPACITY) * ih;
      p.fill(c[0], c[1], c[2]);
      p.rect(bx, by + ih - filled - sh, iw, Math.max(0.5, sh - (sh > 3 ? 0.75 : 0)));
      if (!done(lane) && last && last.bin === b && i === stack.length - 1) {
        p.noFill();
        p.stroke(fr, fg, fb);
        p.strokeWeight(1.5);
        p.rect(bx, by + ih - filled - sh, iw, sh);
        p.noStroke();
      }
      filled += sh;
    });
  }
}

function chart(run: Run): Chart {
  let sum = 0;
  const lower: [number, number][] = [[0, 0], ...run.sizes.map((s, i) => {
    sum += s;
    return [i + 1, Math.ceil(sum / CAPACITY)] as [number, number];
  })];
  const upTo = Math.max(...run.lanes.map((l) => l.at));
  return {
    title: 'Bins open as the items are placed',
    x: { label: 'items placed' },
    y: { label: 'bins' },
    series: [
      ...run.lanes.map((l) => ({ name: ALGORITHM_LABELS[l.algorithm], points: l.curve.slice() })),
      { name: 'Lower bound ⌈Σ size / capacity⌉, items in arrival order', points: lower.slice(0, upTo + 1) },
    ],
  };
}

function stats(run: Run): Stat[] {
  const rows: Stat[] = run.lanes.map((l) => {
    const used = l.loads.reduce((a, b) => a + b, 0);
    const fill = l.loads.length ? (100 * used) / (l.loads.length * CAPACITY) : 0;
    const sort = l.packing.compares && done(l) ? ` · ${fmt(l.packing.compares)} sort comparisons` : '';
    return {
      label: ALGORITHM_LABELS[l.algorithm],
      value: `${fmt(l.loads.length)} bins · ${fill.toFixed(1)}% full · ${fmt(l.tests)} fit tests${sort}`,
    };
  });
  rows.push(
    { label: 'Items', value: `${fmt(run.sizes.length)}, total size ${fmt(run.sizes.reduce((a, b) => a + b, 0))}, bins of ${CAPACITY}` },
    { label: 'Lower bound ⌈Σ size / capacity⌉', value: fmt(run.lower) },
    { label: 'Optimum (exact search)', value: run.exact === null ? 'not searched: too many items for the exact search' : fmt(run.exact) },
  );
  return rows;
}

export const binPacking: PlateCode = {
  id: 'bin-packing',
  mode: '2d',
  aspect: 16 / 9,
  thumbnailFrames: 2,
  params: [
    {
      kind: 'select', key: 'shape', label: 'Items', value: 'uniform', rebuild: true,
      options: SHAPES.map((s) => ({ value: s, label: SHAPE_LABELS[s] })),
    },
    { kind: 'range', key: 'n', label: 'Items to pack', min: 8, max: 256, step: 4, value: 48, rebuild: true },
    { kind: 'range', key: 'speed', label: 'Placements per frame', min: 1, max: 32, step: 1, value: 1 },
    { kind: 'toggle', key: 'loop', label: 'New items when done', value: true },
    paletteParam('ember'),
  ],
  create(p, ctx) {
    let generation = 0;
    let hold = 0;
    const make = () => build(str(ctx.params, 'shape') as Shape, num(ctx.params, 'n'), ctx.seed + generation * 7919);
    let run = make();
    return {
      setup() {
        if (ctx.thumbnail) for (const l of run.lanes) advance(l, Math.ceil(l.packing.placements.length * 0.6));
      },
      draw() {
        p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
        if (!ctx.thumbnail) {
          if (!run.lanes.every(done)) for (const l of run.lanes) advance(l, num(ctx.params, 'speed'));
          else if (bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
            // a new run costs O(n · bins) fit tests at most, well inside one frame
            generation++;
            hold = 0;
            run = make();
          }
        }
        const W = ctx.width; const H = ctx.height;
        const pad = Math.max(6, Math.round(Math.min(W, H) * 0.03));
        const m = run.lanes.length;
        const lw = (W - pad * (m + 1)) / m;
        run.lanes.forEach((l, i) => drawLane(p, ctx, run, l, pad + i * (lw + pad), pad, lw, H - 2 * pad));
        ctx.chart(chart(run));
        ctx.stats(stats(run));
      },
    };
  },
};

export default binPacking;
