// Worstsort: every permutation of the input as one row, the rows bubble-sorted lexicographically
// (one level), or every permutation of that list of permutations as one row (two levels). The
// compared rows are marked, the settled tail is bracketed, and the chart counts the bubble sort's
// lexicographic comparisons and swaps against what the list itself says they must be.
import type p5 from 'p5';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type PlateContext } from '../../core/plate';
import { Raster } from '../../core/raster';
import { caption, drawBars, padding, type Box } from '../_shared/bars/bars';
import { speedOf, speedParam } from '../_shared/kernel-mirror/controls';
import { countOnly, sortingNow, type WasmRun } from '../_shared/kernel-mirror/wasm';
import { chartOf, fmt, Series } from '../_shared/live-chart/series';
import { DISTINCT, input, isSorted, runSeed, SHAPES, shapeOf, shapeParam } from '../_shared/sort-input/input';
import { factorial } from '../_shared/theory/combinatorics';
import {
  bubbleCost, bubbleItems, kernelLevels, KERNEL_MAX_N, leaves, MAX_ITEMS, worstRun, type Val, type WorstRun,
} from './worstsort';

const HOLD = 90;

const worstsortPlate: PlateCode = {
  id: 'worstsort',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 40,
  params: [
    { kind: 'range', key: 'n', label: 'Keys n', min: 2, max: KERNEL_MAX_N, step: 1, value: 4, rebuild: true },
    shapeParam(SHAPES.filter((s) => DISTINCT.includes(s) || s === 'few-unique'), 'random'),
    {
      kind: 'select', key: 'levels', label: 'Levels', value: 'f', rebuild: true,
      options: [
        { value: 'f', label: 'f(n), the kernel\'s choice' },
        { value: '0', label: '0: bubble sort' },
        { value: '1', label: '1: sort the n! permutations' },
        { value: '2', label: '2: sort the (n!)! lists (n ≤ 3)' },
      ],
    },
    speedParam(64),
    paletteParam('spectral'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    const n = num(params, 'n');
    const shape = shapeOf(params.shape);
    const asked = str(params, 'levels');
    const askedK = asked === 'f' ? kernelLevels(n) : Number(asked);
    const feasible = bubbleItems(n, askedK) <= MAX_ITEMS;
    const k = feasible ? askedK : kernelLevels(n);
    // the kernel's own path when the levels are its f(n): then its counts are comparable
    const kernelMode = k === kernelLevels(n);
    let r = 0;
    let run: WorstRun;
    let hold = 0;
    let cost: ReturnType<typeof bubbleCost> | null = null;
    let costOf: Val[] | null = null;
    let flat = new Map<Val, number[]>();
    let raster: Raster | null = null;
    let wasm: WasmRun | undefined;
    let finished = 0;
    let lastOk = true;

    const inputOf = (i: number) => input(shape, n, runSeed(ctx.seed, i));
    const next = () => {
      run = worstRun(inputOf(r), kernelMode ? undefined : k);
      cost = null;
      costOf = null;
      flat = new Map();
      raster = null;
      wasm = undefined;
    };

    return {
      setup() {
        p.textFont('monospace');
        next();
      },
      draw() {
        if (hold > 0) {
          hold--;
          if (hold === 0) {
            r++;
            next();
          }
        } else {
          run.stepper.advance(speedOf(params));
          const st = run.state;
          if (st.initial && st.initial !== costOf) {
            costOf = st.initial;
            cost = bubbleCost(st.initial);
            for (const v of st.initial) flat.set(v, leaves(v));
          }
          if (run.stepper.done) {
            finished++;
            lastOk = run.stepper.outcome === 'sorted' && isSorted(run.keys);
            hold = ctx.thumbnail ? 1 : HOLD;
          }
        }
        const s = sortingNow();
        if (s && !wasm && kernelMode && !ctx.thumbnail) wasm = countOnly(s, 'worstsort', inputOf(r));
        render();
        publish();
      },
    };

    function render() {
      const pad = padding(ctx.width);
      const pal = ctx.palette();
      p.background(...ctx.bg);
      const top = pad + 22;
      const side = Math.round(Math.min(ctx.width * 0.26, 220));
      const keysBox: Box = { x: pad, y: top, w: side - pad, h: (ctx.height - top - pad) * 0.5 };
      drawBars(p, keysBox, {
        keys: run.keys, max: Math.max(...run.keys), fg: ctx.fg,
        color: (i) => ramp(pal, (run.keys[i] - 1) / Math.max(1, n - 1)),
      });
      const size = Math.max(10, Math.min(13, ctx.width / 52));
      caption(p, ctx.fg, run.stepper.done ? 'output' : 'input', pad, keysBox.y + keysBox.h + 8, size);
      const mat: Box = { x: side + pad, y: top, w: ctx.width - side - 2 * pad, h: ctx.height - top - pad };
      drawList(p, ctx, mat);
      const st = run.state;
      const N = st.list?.length ?? 0;
      caption(p, ctx.fg, `levels ${k} · ${N ? `${fmt(N)} items, pass ${fmt(st.pass + 1)}` : 'listing permutations'}`
        + ` · ${fmt(run.stepper.t.counts.cmp)} key comparisons`, pad, pad, size);
    }

    function drawList(p5i: p5, c: PlateContext, box: Box) {
      const list = run.state.list;
      if (!list || !list.length) return;
      const width = flat.get(list[0])?.length ?? 1;
      if (!raster || raster.w !== width || raster.h !== list.length) raster = new Raster(width, list.length);
      const pal = c.palette();
      const settled = list.length - run.state.pass;
      for (let y = 0; y < list.length; y++) {
        const keys = flat.get(list[y]) ?? leaves(list[y]);
        for (let x = 0; x < width; x++) {
          const col = ramp(pal, (keys[x] - 1) / Math.max(1, n - 1));
          const q = !run.stepper.done && y >= settled ? mix(col, c.bg, 0.35) : col;
          raster.set(x, y, q[0], q[1], q[2]);
        }
      }
      const rh = box.h / list.length;
      raster.blit(p5i, false, box.x, box.y, box.w, box.h);
      const at = run.state.at;
      if (at >= 0 && !run.stepper.done) {
        p5i.noStroke();
        p5i.fill(...c.fg);
        p5i.rect(box.x - 7, box.y + at * rh, 4, Math.max(2, 2 * rh));
      }
      if (!run.stepper.done && settled < list.length) {
        p5i.fill(c.fg[0], c.fg[1], c.fg[2], 140);
        p5i.rect(box.x + box.w + 3, box.y + settled * rh, 3, box.h - settled * rh);
      }
    }

    function publish() {
      const t = run.stepper.t;
      const st = run.state;
      const N = st.list?.length ?? 0;
      const levelsValue = feasible ? `${k}${asked === 'f' ? ' = f(n)' : ''}`
        : `${k} = f(n) (asked ${askedK}: a list of ${bubbleItems(n, askedK) === Infinity ? 'astronomically many' : fmt(bubbleItems(n, askedK))} items is beyond reach)`;
      ctx.stats([
        { label: 'levels', value: levelsValue },
        { label: 'items bubble-sorted', value: N ? `${fmt(N)} (${n}! = ${fmt(factorial(n))})` : '–' },
        { label: 'key comparisons, counted live', value: fmt(t.counts.cmp) },
        { label: 'lexicographic comparisons / exact for this list', value: `${fmt(st.lex)} / ${cost ? fmt(cost.lex[cost.lex.length - 1]) : '–'}` },
        { label: 'bubble swaps / inversions of the list', value: `${fmt(st.swaps)} / ${cost ? fmt(cost.inversions) : '–'}` },
        { label: 'kernel (wasm) on this input', value: !kernelMode ? 'other levels than the kernel\'s f(n)'
          : wasm ? `${fmt(wasm.counts.cmp)} key comparisons, ${wasm.outcome}` : 'loading' },
        { label: 'runs finished', value: `${fmt(finished)}${finished ? (lastOk ? ', last output sorted (checked)' : ', last output NOT sorted') : ''}` },
      ]);
      // counted at every pass boundary, plus where the pass in progress stands
      const lexSeries = new Series('lexicographic comparisons (counted)', 1024);
      const swapSeries = new Series('swaps (counted)', 1024);
      st.passLex.forEach((v, i) => lexSeries.push(i, v));
      st.passSwaps.forEach((v, i) => swapSeries.push(i, v));
      if (st.list && st.at >= 0) {
        const x = st.pass + (st.at + 1) / Math.max(1, st.list.length - 1 - st.pass);
        lexSeries.push(x, st.lex);
        swapSeries.push(x, st.swaps);
      }
      const exact = new Series('lexicographic comparisons, exact from the list', 1024);
      const inv = new Series('inversions of the list (the swaps it needs)', 1024);
      if (cost) {
        cost.lex.forEach((v, i) => exact.push(i, v));
        inv.push(0, cost.inversions);
        inv.push(Math.max(1, cost.passes), cost.inversions);
      }
      ctx.chart(chartOf('Bubble sort of the permutation list', { label: 'passes' }, { label: 'count' },
        [lexSeries, exact, swapSeries, inv]));
    }
  },
};

export default worstsortPlate;
