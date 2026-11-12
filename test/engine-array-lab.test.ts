// The array engine's lab traces its kernels one per frame and shows them together once all are
// ready, so a lab of many kernels never traces them all inside one frame; a thumbnail is one
// picture and traces them at once.
import { describe, expect, it, vi } from 'vitest';

// every trace the engine takes, counted: a frame's heavy work is its traces
const counter = vi.hoisted(() => ({ traces: 0 }));
vi.mock('../src/engines/array/trace', async (load) => {
  const real = await load<typeof import('../src/engines/array/trace')>();
  return { ...real, trace: (...a: Parameters<typeof real.trace>) => { counter.traces++; return real.trace(...a); } };
});
import { CATALOGUE } from '../src/core/catalogue';
import { palette as lookupPalette, GROUNDS } from '../src/core/palette';
import type { Chart, Params, Plate, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { labRunnable, loadLab } from '../src/registry';
import { installBrowserStubs, p5Stub } from './support/p5-stub';
import { drawRecorder } from './support/draw-recorder';

installBrowserStubs();

function mount(plate: Plate, thumbnail: boolean) {
  const params: Params = {};
  for (const d of plate.params) params[d.key] = d.value;
  params.group = 'all';
  let stats: Stat[] = [];
  const charts: Chart[] = [];
  const ctx: PlateContext = {
    width: 640, height: 480, params, seed: 7, rnd: mulberry32(7), theme: 'dark',
    bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail,
    palette: () => lookupPalette('ember'), stats(rows) { stats = rows; }, chart(c) { charts.push(c); },
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  return { sim, stats: () => stats, charts };
}

/** Per frame: how many kernels the lab traced, and how many panes it reported. */
function tracesPerFrame(sim: { draw(): void }, frames: number, stats: () => Stat[]) {
  const out: { traces: number; shown: number }[] = [];
  for (let f = 0; f < frames; f++) {
    const before = counter.traces;
    sim.draw();
    out.push({ traces: counter.traces - before, shown: stats().length });
  }
  return out;
}

const labs = CATALOGUE.labs.filter((l) => l.engine === 'array' && labRunnable(l.id));

describe('array lab: one kernel traced per frame', () => {
  it('there is an array lab to check', () => { expect(labs.length).toBeGreaterThan(0); });
  for (const l of labs) {
    it(`${l.id}: panes appear together after one frame per kernel, not at creation`, async () => {
      const plate = (await loadLab(l.id))!;
      const group = plate.params.find((d) => d.key === 'group');
      expect(group?.kind).toBe('select');
      const kernels = l.entries.length;
      const { sim, stats } = mount(plate, false);
      const seen: number[] = [];
      for (let f = 0; f < kernels + 2; f++) { sim.draw(); seen.push(stats().length); }
      // nothing is shown until every kernel is traced, then all of them at once
      const first = seen.findIndex((x) => x > 0);
      expect(first).toBeGreaterThanOrEqual(1);
      expect(seen.slice(0, first).every((x) => x === 0)).toBe(true);
      expect(new Set(seen.slice(first))).toEqual(new Set([seen[first]]));
      expect(seen[first]).toBeGreaterThan(1);
    });
    it(`${l.id}: measures no size larger than the input its slider allows`, async () => {
      // a lab frame traces one kernel beside drawing every pane: a scaling point past the lab's
      // own n bound would be the heaviest trace of the run (an uncapped kernel at 512)
      const plate = (await loadLab(l.id))!;
      const n = plate.params.find((d) => d.key === 'n');
      if (n?.kind !== 'range') throw new Error('the lab has an n range');
      const { sim, charts } = mount(plate, false);
      for (let f = 0; f < 600; f++) sim.draw();
      const scaling = charts.filter((c) => c.x.label === 'keys n');
      let points = 0; let largest = 0;
      for (const c of scaling) for (const s of c.series) for (const [x] of s.points) { points++; largest = Math.max(largest, x); }
      expect(points).toBeGreaterThan(0);
      expect(largest).toBeLessThanOrEqual(n.max);
    });
    it(`${l.id}: the frame that shows the new panes traces no kernel`, async () => {
      // the first draw of every pane is as heavy as a trace: the two never share a frame
      const plate = (await loadLab(l.id))!;
      const { sim, stats } = mount(plate, false);
      const calls = tracesPerFrame(sim, l.entries.length + 2, stats);
      const shown = calls.findIndex((x) => x.shown > 0);
      expect(shown).toBeGreaterThan(0);
      expect(calls[shown].traces).toBe(0);
      expect(calls[shown - 1].traces).toBe(1);
    });
    it(`${l.id}: a frame that traces leaves the picture as it was`, async () => {
      // the canvas keeps the last frame; redrawing every finished pane beside the trace was the
      // second heavy piece of a rebuild frame. The readouts are still published on such a frame.
      const plate = (await loadLab(l.id))!;
      const params: Params = {};
      for (const d of plate.params) params[d.key] = d.value;
      params.group = 'all';
      const { p, calls } = drawRecorder();
      let shown = 0;
      const ctx: PlateContext = {
        width: 640, height: 480, params, seed: 7, rnd: mulberry32(7), theme: 'dark',
        bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail: false,
        palette: () => lookupPalette('ember'), stats(rows) { shown = rows.length; }, chart() {},
      };
      const sim = plate.create(p, ctx);
      sim.setup();
      const kernels = l.entries.length;
      let checked = 0;
      for (let f = 0; f < kernels + 40; f++) {
        const before = counter.traces;
        calls.length = 0;
        sim.draw();
        // once panes are on screen, a frame that traced a kernel draws nothing at all
        if (counter.traces > before && shown > 0) {
          expect(calls, `frame ${f}: draw calls on a tracing frame`).toEqual([]);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(0);
    });
    it(`${l.id}: a thumbnail traces every kernel at once`, async () => {
      const plate = (await loadLab(l.id))!;
      const { sim, stats } = mount(plate, true);
      sim.draw();
      expect(stats().length).toBeGreaterThan(1);
    });
  }
});

describe('array engine: a kernel may bound its own n (ArrayKernel.maxN)', () => {
  it('the plate slider stops at the kernel bound and labs at the smallest bound of their kernels', async () => {
    const { loadPlate } = await import('../src/registry');
    const { kernel } = await import('../src/kernels/array/perfect-shuffle-merge');
    expect(kernel.maxN).toBeGreaterThan(0);
    const plate = (await loadPlate('perfect-shuffle-merge'))!;
    const n = plate.params.find((d) => d.key === 'n');
    expect(n?.kind === 'range' && n.max).toBe(kernel.maxN);
    for (const l of labs) {
      const lab = (await loadLab(l.id))!;
      const ln = lab.params.find((d) => d.key === 'n');
      expect(ln?.kind === 'range' && ln.max <= 256).toBe(true);
    }
  });
});
