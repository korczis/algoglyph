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
import { fmtInt, Meter, MUL, type Panel, type SignalKernel, type View } from './trace';

const HOLD_FRAMES = 120;
const LAB_N = [256, 512, 1024, 2048, 4096, 8192];
const LAB_FS = 8000;

function signature(params: Params, keys: string[]): string {
  return keys.map((k) => String(params[k])).join('|');
}

function countRows(v: View): Stat[] {
  return Object.entries(v.counts).map(([label, value]) => ({ label, value: fmtInt(value) }));
}

function plate(info: KernelInfo, kernel: SignalKernel): PlateCode {
  const own = kernel.params ?? [];
  const keys = own.map((d) => d.key);
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
    thumbnailFrames: 2,
    params,
    create(p, ctx) {
      let generation = 0;
      let sig = signature(ctx.params, keys);
      const record = () => kernel.run(ctx.params, ctx.seed + generation * 7919, new Meter());
      let views = record();
      let at = 0;
      let hold = 0;
      const painter = new Painter(p, ctx);
      return {
        setup() {
          if (ctx.thumbnail) at = views.length - 1;
        },
        draw() {
          p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
          if (!ctx.thumbnail) {
            const now = signature(ctx.params, keys);
            if (now !== sig) {
              sig = now;
              const keep = at >= views.length - 1;
              views = record();
              at = keep ? views.length - 1 : Math.min(at, views.length - 1);
            }
            if (at < views.length - 1) at = Math.min(views.length - 1, at + num(ctx.params, 'speed') / 60);
            else if (bool(ctx.params, 'loop') && views.length > 1 && ++hold > HOLD_FRAMES) {
              hold = 0;
              generation++;
              views = record();
              at = 0;
            }
          }
          const v = views[Math.floor(at)];
          const boxes = layout(v.panels.length, ctx.width, ctx.height, v.layout);
          v.panels.forEach((panel, i) => painter.draw(panel, boxes[i]));
          ctx.stats([...v.stats, ...countRows(v),
            { label: 'Recorded view', value: `${Math.floor(at) + 1} of ${views.length}` }]);
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
