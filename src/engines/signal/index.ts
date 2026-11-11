// The signal engine: a kernel records a run on a seeded synthetic signal as a trace of views,
// and the plate replays it, drawing each view's panels and publishing its measured readouts and
// chart. A lab applies several kernels to one shared input and measures how each one's work
// grows with the signal's length (ADR 0004 §4-5).
import { paletteParam } from '../../core/palette';
import { bool, num, type ParamDef, type Params, type PlateCode, type Stat } from '../../core/plate';
import { exponentOf } from './fit';
import type { Engine, KernelInfo } from '../types';
import { layout, Painter } from './draw';
import { labSignal } from './input';
import { fmtInt, Meter, MUL, Recording, type Panel, type SignalKernel, type View } from './trace';

const HOLD_FRAMES = 120;
/** Milliseconds of recording resumed per live frame, and per thumbnail frame (run 15 at a time). */
export const SLICE_MS = 6;
export const THUMB_SLICE_MS = 1.5;
/** Frames the parameters must stay unchanged before a re-record starts (a slider being dragged). */
export const SETTLE_FRAMES = 8;
const THUMB_FRAMES = 90;
const LAB_N = [256, 512, 1024, 2048, 4096, 8192];
const LAB_FS = 8000;

function signature(params: Params, keys: string[]): string {
  return keys.map((k) => String(params[k])).join('|');
}

function countRows(v: View): Stat[] {
  return Object.entries(v.counts).map(([label, value]) => ({ label, value: fmtInt(value) }));
}

/**
 * A kernel as a plate. Recording never runs on the frame path in one piece: the run is resumed
 * for SLICE_MS per frame. The first run and each new signal are replayed as they are recorded; a
 * change of parameters waits until the controls settle, records in the background, and the last
 * finished run stays on screen until the new one is complete. Structural parameters
 * (`rebuild: true`) remount the plate instead.
 */
function plate(info: KernelInfo, kernel: SignalKernel): PlateCode {
  const own = kernel.params ?? [];
  const keys = own.filter((d) => !d.rebuild).map((d) => d.key);
  const rate = kernel.rate ?? 8;
  const params: ParamDef[] = [
    ...own,
    { kind: 'range', key: 'speed', label: 'Replay speed (views per second)', min: 1, max: 60, step: 1, value: rate },
    { kind: 'toggle', key: 'loop', label: 'New signal when done', value: true },
    paletteParam('spectral'),
  ];
  return {
    id: info.id,
    mode: '2d',
    aspect: kernel.aspect ?? 16 / 9,
    thumbnailFrames: THUMB_FRAMES,
    params,
    create(p, ctx) {
      let generation = 0;
      let sig = signature(ctx.params, keys);
      const record = () => new Recording(kernel.run({ ...ctx.params }, ctx.seed + generation * 7919, new Meter()));
      /** The run on screen, and a re-record for new parameters finishing in the background. */
      let live = record();
      let next: Recording | null = null;
      let settle = 0;
      let at = 0;
      let hold = 0;
      let shown: View | null = null;
      let painted: View | null = null;
      let draws = 0;
      const painter = new Painter(p, ctx);
      return {
        setup() {},
        draw() {
          const slice = ctx.thumbnail ? THUMB_SLICE_MS : SLICE_MS;
          if (!ctx.thumbnail) {
            const now = signature(ctx.params, keys);
            if (now !== sig) { sig = now; next = null; settle = SETTLE_FRAMES; }
            else if (settle > 0 && --settle === 0) next = record();
          }
          if (next) {
            if (next.pump(slice)) {
              const keep = at >= live.views.length - 1;
              live = next;
              next = null;
              at = keep ? live.views.length - 1 : Math.min(at, live.views.length - 1);
              hold = 0;
            }
          } else if (!live.done) live.pump(slice);
          const last = Math.max(0, live.views.length - 1);
          if (ctx.thumbnail) at = last;
          else if (at < last) at = Math.min(last, at + num(ctx.params, 'speed') / 60);
          else if (live.done && !next && settle === 0 && bool(ctx.params, 'loop') && live.views.length > 1
            && ++hold > HOLD_FRAMES) {
            hold = 0;
            generation++;
            live = record();
            at = 0;
          }
          shown = live.views[Math.floor(at)] ?? shown;
          // a thumbnail is drawn many times per frame: paint it once, when its run has finished
          // or on its last frame
          if (ctx.thumbnail) {
            draws++;
            if (shown === painted || (!live.done && draws < THUMB_FRAMES)) return;
          }
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          painted = shown;
          if (!shown) { ctx.stats([{ label: 'Recorded view', value: 'recording' }]); return; }
          const v = shown;
          const boxes = layout(v.panels.length, ctx.width, ctx.height, v.layout);
          v.panels.forEach((panel, i) => painter.draw(panel, boxes[i]));
          const total = live.done ? String(live.views.length) : `${live.views.length} recorded so far`;
          ctx.stats([...v.stats, ...countRows(v),
            { label: 'Recorded view', value: live.views.length ? `${Math.floor(at) + 1} of ${total}` : 'recording' },
            ...(next || settle ? [{ label: 'New settings', value: `recording, ${next?.views.length ?? 0} views so far` }] : [])]);
          if (v.chart) ctx.chart(v.chart);
        },
      };
    },
  };
}

/** One kernel's work on the lab input of length n, counted in real multiplies. */
export function labWork(kernel: SignalKernel, n: number, seed: number): number {
  const m = new Meter();
  kernel.lab?.(labSignal(n, LAB_FS, seed), LAB_FS, m);
  return m.get(MUL);
}

function lab(id: string, kernels: { info: KernelInfo; kernel: SignalKernel }[]): PlateCode {
  const usable = kernels.filter((k) => k.kernel.lab);
  return {
    id: `lab-${id}`,
    mode: '2d',
    aspect: 4 / 3,
    thumbnailFrames: 2,
    params: [
      { kind: 'select', key: 'n', label: 'Signal length', value: '1024', rebuild: true,
        options: LAB_N.map((n) => ({ value: String(n), label: `${n} samples` })) },
      paletteParam('spectral'),
    ],
    create(p, ctx) {
      const n = num(ctx.params, 'n');
      const x = labSignal(n, LAB_FS, ctx.seed);
      const panes: { info: KernelInfo; panel: Panel; work: number }[] = usable.map((k) => {
        const m = new Meter();
        const panel = k.kernel.lab!(x, LAB_FS, m);
        return { info: k.info, panel: { ...panel, title: k.info.title }, work: m.get(MUL) };
      });
      const input: Panel = { kind: 'wave', title: `Shared input, ${n} samples at ${LAB_FS} Hz`, series: [{ name: 'x', y: x, tone: -1, alpha: 200 }] };
      // the scaling curves are measured one size per frame, so the lab never blocks a phone
      const curves = usable.map((k) => ({ info: k.info, pts: [] as [number, number][] }));
      const pending = usable.flatMap((_, ci) => LAB_N.map((len) => [ci, len] as [number, number]));
      const painter = new Painter(p, ctx);
      return {
        setup() {},
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            const next = pending.shift();
            if (next) {
              const [ci, len] = next;
              curves[ci].pts.push([len, labWork(usable[ci].kernel, len, ctx.seed)]);
            }
          }
          const all = [input, ...panes.map((q) => q.panel)];
          const rows: number[][] = [[0]];
          for (let i = 1; i < all.length; i += 2) rows.push(i + 1 < all.length ? [i, i + 1] : [i]);
          const boxes = layout(all.length, ctx.width, ctx.height, rows);
          all.forEach((panel, i) => painter.draw(panel, boxes[i]));
          ctx.chart({
            title: 'Measured work as the signal grows',
            x: { label: 'samples n', log: true },
            y: { label: 'real multiplies', log: true },
            series: curves.map((c) => ({ name: c.info.title, points: c.pts.slice() })),
          });
          ctx.stats(panes.map((q, i) => {
            const slope = exponentOf(curves[i].pts);
            return {
              label: q.info.title,
              value: `${fmtInt(q.work)} multiplies at n = ${n} · growth n^${Number.isFinite(slope) ? slope.toFixed(2) : '?'}`,
            };
          }));
        },
      };
    },
  };
}

export const engine: Engine<SignalKernel> = { id: 'signal', plate, lab };
