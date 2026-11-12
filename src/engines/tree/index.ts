// The tree engine: search trees, heaps, tries, forests and codes, built by a kernel through
// instrumented node operations and replayed from the recorded trace. A plate runs one kernel;
// a lab runs several on the same seeded input with one event budget per frame, and measures
// how each one's search cost grows with n (ADR 0004 §4-5).
import type p5 from 'p5';
import { paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type ParamDef, type PlateCode, type PlateContext, type Stat } from '../../core/plate';
import type { Engine, KernelInfo } from '../types';
import { drawArray, drawOutputs, drawScene, Motion, Replay, shape, type Box } from './scene';
import { costOf, MAX_SYMBOLS, NIL, opGroups, SHAPES, trace, workload, type InputKind, type OpKind, type Trace,
  type TreeKernel } from './trace';
import { count } from '../../core/format';
import { downFrom, fitSize, HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';

/** The per-frame maximum the old steps slider allowed: the pace never asks more. */
const MAX_STEPS_PER_FRAME = 2000;
const SCALING_N = [16, 32, 64, 128, 256, 512, 1024];
const LAB_MAX_N = 128;
const fmt = count;
const fix2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '?');

const SIZE: Record<InputKind, { min: number; max: number; value: number; label: string }> = {
  keys: { min: 2, max: 255, value: 31, label: 'Keys' },
  bits: { min: 2, max: 255, value: 24, label: 'Keys' },
  words: { min: 2, max: 120, value: 20, label: 'Words' },
  pairs: { min: 2, max: 200, value: 24, label: 'Sites' },
  weights: { min: 2, max: MAX_SYMBOLS, value: 14, label: 'Symbols' },
};

function baseParams(kind: InputKind, extra: ParamDef[] = [], n?: number): ParamDef[] {
  const sz = SIZE[kind];
  return [
    { kind: 'select', key: 'shape', label: 'Input', value: SHAPES[kind][0].value, rebuild: true, options: SHAPES[kind] },
    { kind: 'range', key: 'n', label: sz.label, min: sz.min, max: sz.max, step: 1, value: n ?? sz.value, rebuild: true },
    ...extra,
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'New input when done', value: true },
    paletteParam('spectral'),
  ];
}

const optsOf = (k: TreeKernel, params: PlateContext['params']) =>
  Object.fromEntries((k.params ?? []).map((d) => [d.key, d.key in params ? num(params, d.key) : Number(d.value)]));

function run(kernel: TreeKernel, ctx: PlateContext, generation: number): Trace {
  return trace(kernel, workload(kernel.input, str(ctx.params, 'shape'), num(ctx.params, 'n'),
    ctx.seed + generation * 7919, optsOf(kernel, ctx.params)));
}

type Cost = { total: number; ops: number; max: number };

/** The cost an operation is measured in: key and digit tests, or array accesses, summed per
 * operation (so the maximum is the costliest operation's total). */
export function unitOf(k: TreeKernel): { name: string; of: (t: Trace, kind: OpKind, phase?: string) => Cost } {
  if (k.view === 'parent' || k.view === 'heap') {
    return { name: 'array accesses', of: (t, kind, phase) => costOf(t, kind, ['reads', 'writes'], phase) };
  }
  return { name: 'key and digit tests', of: (t, kind, phase) => costOf(t, kind, ['compares', 'digits'], phase) };
}

/** The operation kind a lab measures cost on. */
const probeOf = (k: TreeKernel): OpKind => (k.input === 'pairs' ? 'union' : 'search');

/** Events one scaling run may take in one frame (about 40k events measured at 7 ms or less on a
 * desktop). A curve whose next size is predicted to exceed it is not run, and a run that reaches
 * it is stopped; either way the lab says which. */
export const PROBE_BUDGET = 150_000;

/** Mean cost of one probe operation in a fresh, unrecorded trace of n items. */
export function probeCost(k: TreeKernel, shapeName: string, n: number, seed: number, cap = PROBE_BUDGET):
  { cost: number; height: number; steps: number; truncated: boolean } {
  const t = trace(k, workload(k.input, shapeName, n, seed, optsOf(k, {})), false, cap);
  if (t.truncated) return { cost: NaN, height: NaN, steps: t.steps, truncated: true };
  const c = unitOf(k).of(t, probeOf(k));
  return { cost: c.ops ? c.total / c.ops : NaN, height: shape(t.store, k).height, steps: t.steps, truncated: false };
}

/** The events the next size will take, extrapolated from the growth between the last two. */
export function predictSteps(steps: number[]): number {
  const last = steps[steps.length - 1] ?? 0;
  const prev = steps[steps.length - 2];
  return prev ? last * Math.max(2, last / Math.max(1, prev)) : last * 4;
}

/** What the structure holds now, measured from the replayed store (kernel specific readouts). */
function extraStats(r: Replay): Stat[] {
  const k = r.kernel;
  const s = r.s;
  const w = r.t.workload;
  if (k.structure === 'union-find') {
    let roots = 0;
    for (let i = 0; i < s.size; i++) if (s.arr[i] === i) roots++;
    return [{ label: 'Components', value: fmt(roots) }];
  }
  if (k.structure === 'runs') {
    const runs = new Set(r.outputs.map((o) => o.group)).size;
    return [
      { label: 'Runs written', value: fmt(runs) },
      { label: 'Average run length', value: runs ? `${fix2(r.outputs.length / runs)} keys (memory M = ${w.opts.memory})` : 'none yet' },
    ];
  }
  if (k.structure === 'huffman') {
    let bits = 0;
    const walk = (x: number, d: number) => {
      if (s.kids[x].length === 0) { bits += s.info[x] * d; return; }
      for (const c of s.kids[x]) if (c !== NIL) walk(c, d + 1);
    };
    const trees = s.roots.filter((x) => x !== NIL && s.alive[x]);
    for (const x of trees) walk(x, 0);
    const total = w.weights.reduce((a, b) => a + b, 0);
    const entropy = w.weights.reduce((a, f) => a - (f ? f * Math.log2(f / total) : 0), 0);
    return [
      { label: 'Trees in the queue', value: fmt(trees.length) },
      ...(trees.length === 1 ? [{ label: 'Encoded length', value: `${fmt(bits)} bits (${fix2(bits / total)} per symbol)` }] : []),
      { label: 'Entropy bound', value: `${fmt(Math.ceil(entropy))} bits (${fix2(entropy / total)} per symbol)` },
    ];
  }
  return [];
}

/** In-order keys of the replayed binary search tree are ascending. */
function inorderOK(r: Replay): boolean {
  const s = r.s;
  const out: (number | string)[] = [];
  const rec = (h: number, d: number): boolean => {
    if (h === NIL) return true;
    if (d > s.kids.length) return false;
    if (!rec(s.kids[h][0], d + 1)) return false;
    out.push(s.keys[h][0]);
    return rec(s.kids[h][1], d + 1);
  };
  if (!rec(s.roots[0] ?? NIL, 0)) return false;
  for (let i = 1; i < out.length; i++) if (!(out[i - 1] < out[i])) return false;
  return true;
}

/** Split a box into the tree, and bands for the array and the output beneath it. */
function bands(r: Replay, b: Box): { tree: Box; array?: Box; out?: Box } {
  const hasArray = r.kernel.view === 'heap' || r.kernel.view === 'parent';
  const band = Math.max(10, Math.round(b.h * 0.09));
  let used = 0;
  const array = hasArray ? { x: b.x, y: b.y + b.h - band, w: b.w, h: band } : undefined;
  if (array) used += band + 6;
  const out = r.t.outputs.length ? { x: b.x, y: b.y + b.h - used - band, w: b.w, h: band } : undefined;
  if (out) used += band + 6;
  return { tree: { x: b.x, y: b.y, w: b.w, h: b.h - used }, array, out };
}

function draw(p: p5, ctx: PlateContext, r: Replay, m: Motion, b: Box, labels: boolean, snap = false) {
  const l = bands(r, b);
  drawScene(p, ctx, r, m, l.tree, { labels, snap });
  if (l.array) drawArray(p, ctx, r, l.array);
  if (l.out) drawOutputs(p, ctx, r, l.out);
}

function plate(info: KernelInfo, kernel: TreeKernel): PlateCode {
  const unit = unitOf(kernel);
  return {
    id: info.id,
    mode: '2d',
    aspect: 16 / 9,
    thumbnailFrames: 2,
    params: baseParams(kernel.input, kernel.params),
    pace: { kind: 'replay', unit: 'steps' },
    create(p, ctx) {
      let generation = 0;
      let r = new Replay(run(kernel, ctx, generation), kernel);
      const pacer = new Pacer('replay', 'steps', MAX_STEPS_PER_FRAME);
      pacer.start(r.t.events.length);
      let m = new Motion();
      let hold = 0;
      const digitsWord = kernel.input === 'words' ? 'character tests' : 'bit tests';
      const unitName = unit.name !== 'key and digit tests' ? unit.name
        : !r.t.counts.digits ? 'comparisons' : !r.t.counts.compares ? digitsWord : `comparisons and ${digitsWord}`;
      return {
        setup() {
          if (ctx.thumbnail) r.advance(Math.floor(r.t.events.length * 0.45));
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            if (!r.done) {
              const k = pacer.take(ctx.params);
              if (k) r.advance(k);
            } else if (bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              r = new Replay(run(kernel, ctx, generation), kernel);
              pacer.start(r.t.events.length);
              m = new Motion();
            }
          }
          const pad = Math.round(Math.min(ctx.width, ctx.height) * 0.04);
          draw(p, ctx, r, m, { x: pad, y: pad, w: ctx.width - 2 * pad, h: ctx.height - 2 * pad }, true, ctx.thumbnail);
          const sh = shape(r.s, kernel);
          const tc = r.t.counts;
          const c = r.c;
          const rows: Stat[] = [
            { label: 'Operation', value: r.op >= 0 ? `${fmt(r.op + 1)} of ${fmt(r.t.ops.length)}: ${r.caption}` : 'starting' },
            { label: kernel.view === 'parent' ? 'Sites' : 'Keys held', value: fmt(sh.size) },
            { label: 'Height', value: `${fmt(sh.height)} levels (lg(n+1) = ${fix2(Math.log2(sh.size + 1))})` },
            { label: 'Average depth of a key', value: `${fix2(sh.mean)} levels` },
          ];
          if (tc.compares) rows.push({ label: 'Key comparisons', value: fmt(c.compares) });
          if (tc.digits) rows.push({ label: kernel.input === 'words' ? 'Character tests' : 'Bit tests', value: fmt(c.digits) });
          if (tc.visits) rows.push({ label: 'Nodes touched', value: fmt(c.visits) });
          if (tc.links) rows.push({ label: 'Links written', value: fmt(c.links) });
          if (tc.rotations) rows.push({ label: 'Rotations', value: fmt(c.rotations) });
          if (tc.splits) rows.push({ label: 'Node splits', value: fmt(c.splits) });
          if (tc.recolours && kernel.colour === 'red-black') rows.push({ label: 'Recolourings', value: fmt(c.recolours) });
          if (tc.reads || tc.writes) rows.push({ label: 'Array reads / writes', value: `${fmt(c.reads)} / ${fmt(c.writes)}` });
          // cost per operation kind, over the operations completed so far
          const doneOps = Math.max(0, r.done ? r.t.ops.length : r.op);
          const partial: Trace = { ...r.t, ops: r.t.ops.slice(0, doneOps), counts: doneOps < r.t.ops.length ? r.t.ops[doneOps].c : r.t.counts };
          // an operation kind that costs nothing in this unit over the whole run gets no row
          for (const g of opGroups(r.t).filter((x) => unit.of(r.t, x.kind, x.phase).total > 0)) {
            const cost = unit.of(partial, g.kind, g.phase);
            const label = `Cost per ${g.kind}${g.phase ? ` (${g.phase})` : ''}`;
            if (cost.ops) rows.push({ label, value: `${fix2(cost.total / cost.ops)} ${unitName} (max ${fmt(cost.max)})` });
          }
          if (r.hits + r.misses) rows.push({ label: kernel.input === 'pairs' ? 'Already connected' : 'Lookups', value: `${fmt(r.hits)} yes, ${fmt(r.misses)} no` });
          rows.push(...extraStats(r));
          if (r.done && ['bst', 'avl', 'red-black', 'traversal'].includes(kernel.structure)) {
            rows.push({ label: 'Result', value: inorderOK(r) ? 'in-order ascending, verified' : 'NOT in order' });
          }
          rows.push(pacer.row(ctx.params));
          ctx.stats(rows);
          const h = r.history;
          ctx.chart({
            title: 'Shape as the operations run',
            x: { label: 'operations done' },
            y: { label: 'levels' },
            series: [
              { name: 'Height', points: h.map((q) => [q[0], q[1]]) },
              { name: 'Average depth', points: h.map((q) => [q[0], q[2]]) },
              { name: 'lg(n+1) (reference)', points: h.map((q) => [q[0], q[3]]) },
            ],
          });
        },
        pace: () => pacer.report(r.done, ctx.params),
      };
    },
  };
}

/** The lab's default n: `want`, or the largest smaller one whose longest run fits the calm window. */
function labN(kernels: TreeKernel[], kind: InputKind, want: number): number {
  const length = (n: number) => Math.max(0, ...kernels.map((k) => {
    const opts = optsOf(k, Object.fromEntries((k.params ?? []).map((d) => [d.key, d.value])));
    return trace(k, workload(kind, SHAPES[kind][0].value, n, 4242, opts)).events.length;
  }));
  return fitSize('replay', downFrom(want, SIZE[kind].min, 4), length);
}

function lab(id: string, kernels: { info: KernelInfo; kernel: TreeKernel }[]): PlateCode {
  const kind = kernels[0]?.kernel.input ?? 'keys';
  const groups = [...new Set(kernels.map((k) => k.info.group))];
  const params: ParamDef[] = [
    {
      kind: 'select', key: 'group', label: 'Compare', value: 'all', rebuild: true,
      options: [{ value: 'all', label: 'All kernels' }, ...groups.map((g) => ({ value: g, label: g }))],
    },
    // every pane replays a recorded trace, so the lab keeps n where a quadratic case stays light,
    // and no larger than its longest run can be watched at the calm pace (config/pacing.yaml)
    ...baseParams(kind, [], labN(kernels.map((k) => k.kernel), kind, kind === 'pairs' ? 32 : 40))
      .map((d) => (d.key === 'n' && d.kind === 'range' ? { ...d, max: Math.min(d.max, LAB_MAX_N) } : d)),
  ];
  return {
    id: `lab-${id}`,
    mode: '2d',
    aspect: 4 / 3,
    thumbnailFrames: 2,
    params,
    pace: { kind: 'replay', unit: 'steps' },
    create(p, ctx) {
      let generation = 0;
      // one pace for every pane, from the longest run: the same steps per frame each
      const pacer = new Pacer('replay', 'steps', MAX_STEPS_PER_FRAME);
      let panes: { info: KernelInfo; kernel: TreeKernel; r: Replay; m: Motion; finished: number }[] = [];
      let curves: { info: KernelInfo; pts: [number, number][]; heights: [number, number][]; steps: number[];
        stopped: number; why: string }[] = [];
      let pending: [number, number][] = [];
      let finishedCount = 0;
      let hold = 0;
      const chosen = () => {
        const g = str(ctx.params, 'group');
        return kernels.filter((k) => g === 'all' || k.info.group === g);
      };
      const build = () => {
        finishedCount = 0;
        panes = chosen().map((k) => ({ ...k, r: new Replay(run(k.kernel, ctx, generation), k.kernel), m: new Motion(), finished: 0 }));
        pacer.start(Math.max(0, ...panes.map((x) => x.r.t.events.length)));
        if (generation === 0) {
          curves = chosen().map((k) => ({ info: k.info, pts: [], heights: [], steps: [], stopped: 0, why: '' }));
          pending = SCALING_N.flatMap((n) => curves.map((_, ci) => [ci, n] as [number, number]));
        }
      };
      // one (kernel, n) measurement per frame, so the lab never blocks a phone's main thread
      const measure = () => {
        const next = pending.shift();
        if (!next) return;
        const [ci, n] = next;
        const k = chosen()[ci];
        if (!k) return;
        const cv = curves[ci];
        if (cv.stopped) return;
        // a size whose run would outgrow one frame's budget is not measured, and the lab says so
        if (cv.steps.length && predictSteps(cv.steps) > PROBE_BUDGET) { cv.stopped = n; cv.why = 'predicted over'; return; }
        const res = probeCost(k.kernel, str(ctx.params, 'shape'), n, ctx.seed + n);
        if (res.truncated) { cv.stopped = n; cv.why = 'measured over'; return; }
        cv.pts.push([n, res.cost]);
        cv.heights.push([n, res.height]);
        cv.steps.push(res.steps);
      };
      build();
      const probe = kernels[0] ? probeOf(kernels[0].kernel) : 'search';
      const unit = kernels[0] ? unitOf(kernels[0].kernel).name : '';
      return {
        setup() {
          if (ctx.thumbnail) for (const pane of panes) pane.r.advance(Math.floor(pane.r.t.events.length * 0.4));
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            measure();
            const steps = panes.some((x) => !x.r.done) ? pacer.take(ctx.params) : 0;
            for (const pane of panes) {
              if (!pane.r.done && steps) {
                pane.r.advance(steps);
                if (pane.r.done) pane.finished = ++finishedCount;
              }
            }
            if (panes.every((x) => x.r.done) && bool(ctx.params, 'loop') && ++hold > HOLD_FRAMES) {
              generation++;
              hold = 0;
              build();
            }
          }
          const W = ctx.width; const H = ctx.height;
          const pad = Math.max(6, Math.round(Math.min(W, H) * 0.02));
          const m = panes.length;
          const cols = Math.max(1, Math.min(m, Math.round(Math.sqrt((m * W) / Math.max(1, H) / 1.2))));
          const rows = Math.ceil(m / cols);
          const cw = (W - pad * (cols + 1)) / cols;
          const ch = (H - pad * (rows + 1)) / Math.max(1, rows);
          const fs = Math.max(9, Math.min(13, Math.round(ch * 0.07)));
          panes.forEach((pane, i) => {
            const x = pad + (i % cols) * (cw + pad);
            const y = pad + Math.floor(i / cols) * (ch + pad);
            const c = ramp(ctx.palette(), m < 2 ? 0.5 : i / (m - 1));
            p.noStroke();
            p.fill(c[0], c[1], c[2]);
            p.rect(x, y, 4, fs + 2);
            p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2]);
            p.textAlign(p.LEFT, p.TOP);
            p.textSize(fs);
            const sh = shape(pane.r.s, pane.kernel);
            const tail = `${pane.finished ? `  #${pane.finished}` : ''}  ·  height ${sh.height}`;
            let title = pane.info.title;
            while (title.length > 4 && p.textWidth(`${title}${tail}`) > cw - 12) title = `${title.slice(0, -2)}…`;
            p.text(`${title}${tail}`, x + 8, y);
            draw(p, ctx, pane.r, pane.m, { x, y: y + fs + 6, w: cw, h: ch - fs - 6 }, cw > 260, ctx.thumbnail);
          });
          ctx.chart({
            title: `Measured cost per ${probe} as n grows`,
            x: { label: kind === 'pairs' ? 'sites n' : 'keys n', log: true },
            y: { label: `${unit} per ${probe}`, log: kind === 'pairs' },
            series: [
              ...curves.map((cv) => ({ name: cv.info.title, points: cv.pts.filter((q) => Number.isFinite(q[1])) })),
              ...(kind === 'pairs' ? [] : [{ name: 'lg n (reference)', points: SCALING_N.map((n) => [n, Math.log2(n)] as [number, number]) }]),
            ],
          });
          ctx.stats(panes.map((pane, i) => {
            const c = pane.r.c;
            const cv = curves[i];
            const last = cv?.pts[cv.pts.length - 1];
            const hl = cv?.heights[cv.heights.length - 1];
            const extras = [
              c.rotations ? `${fmt(c.rotations)} rotations` : '',
              c.splits ? `${fmt(c.splits)} splits` : '',
              c.reads + c.writes ? `${fmt(c.reads + c.writes)} array accesses` : '',
            ].filter(Boolean).join(' · ');
            return {
              label: pane.info.title,
              value: `${fmt(c.compares + c.digits)} tests${extras ? ` · ${extras}` : ''}`
                + (last ? ` · n=${last[0]}: ${fix2(last[1])} per ${probe}, height ${hl?.[1] ?? '?'}` : '')
                + (cv?.stopped ? ` · curve stops before n=${cv.stopped}: ${cv.why} the per-frame budget` : '')
                + (pane.finished ? ` · finished #${pane.finished}` : ''),
            };
          }).concat([pacer.row(ctx.params)]));
        },
        pace: () => pacer.report(panes.length > 0 && panes.every((x) => x.r.done), ctx.params),
      };
    },
  };
}

export const engine: Engine<TreeKernel> = { id: 'tree', plate, lab };
