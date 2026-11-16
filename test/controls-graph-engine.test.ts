// The graph engine's input controls of wave 7a phase 2 (maxCapacity, reciprocity, maxWeight,
// cycleWeight, minConfidence) and wave 7b (crossHoldings, edgesPerVertex) leave every graph
// plate and lab IDENTICAL at its defaults: each default is the old constant and every draw
// consumes the same random number in the same place (a count such as crossHoldings or
// edgesPerVertex shifts the later draws only off its default).
// Proved against the old engine itself, in the same run (rules 9 and 10, never a recorded hash):
// test/fixtures/graph-engine-before/graph.ts is src/engines/graph/graph.ts as it was before the
// controls, and vi.doMock puts it under a fresh copy of the registry, so each plate is drawn
// twice, once on the old generator and once on the new, and the two are compared call by call.
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { CATALOGUE, ENTRIES } from '../src/core/catalogue';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import type { Params, Plate, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import * as NEW from '../src/engines/graph/graph';
import * as OLD from './fixtures/graph-engine-before/graph';
import { defaultParams, type GraphKernel } from '../src/engines/graph/trace';
import { drawRecorder } from './support/draw-recorder';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const GRAPH = '../src/engines/graph/graph';
const kernels = import.meta.glob<GraphKernel>('../src/kernels/graph/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => kernels[`../src/kernels/graph/${id}.ts`];
const live = ENTRIES.filter((e) => e.engine === 'graph' && e.status === 'live');
const labs = CATALOGUE.labs.filter((l) => (l as { engine?: string }).engine === 'graph');
const SEEDS = [1, 7, 4242];
/** The ids the per-plate and per-lab tests are generated from (proved complete below). */
const PLATE_IDS = live.map((e) => e.id);
const LAB_IDS = labs.map((l) => l.id);

/** The new input keys with their defaults: the old constants of graph.ts. */
const DEFAULTS = { maxCapacity: 12, reciprocity: 0.35, maxWeight: 9, cycleWeight: -40, minConfidence: 0.3,
  crossHoldings: 1, edgesPerVertex: 1.2 };

/** The generator a registry draws on: the new one, the old one, or the new one with a planted
 * change (one vertex more on every graph) that the comparison must be able to see. */
type Generator = 'new' | 'old' | 'planted';

/** A fresh registry on the given generator: the plate code is the same. */
async function registry(gen: Generator) {
  vi.resetModules();
  // the old generator over the new module: the kernels still find the new defaults' constants
  // (MAX_CAPACITY, ...) for their controls, while every graph is drawn by the old makeGraph
  if (gen === 'old') {
    vi.doMock(GRAPH, async () => ({
      ...(await vi.importActual<object>(GRAPH)), ...(await import('./fixtures/graph-engine-before/graph')),
    }));
  }
  else if (gen === 'planted') {
    vi.doMock(GRAPH, async () => {
      const real = await vi.importActual<typeof NEW>(GRAPH);
      const makeGraph: typeof NEW.makeGraph = (shape, n, ...rest) => real.makeGraph(shape, n + 1, ...rest);
      return { ...real, makeGraph };
    });
  }
  else vi.doUnmock(GRAPH);
  const R = await import('../src/registry');
  const G = await import('../src/engines/graph/graph');
  return { R, makeGraph: G.makeGraph };
}

type Side = {
  makeGraph: typeof NEW.makeGraph; plates: Map<string, Plate>; labs: Map<string, Plate | undefined>;
};

/**
 * Both sides, built once for the whole file: the new registry with every graph plate and lab
 * loaded on it, then the old registry with every one loaded on it. Each side is loaded in full
 * before the next registry resets the modules, because a lazy plate import resolves through the
 * module cache current at the time of the import: a plate the new registry loaded after the old
 * one was built would be drawn by the old generator, and the comparison would prove nothing.
 */
async function compared(gen: Generator, plateIds: string[], labIds: string[]) {
  const load = async (g: Generator): Promise<Side> => {
    const { R, makeGraph } = await registry(g);
    const plates = new Map<string, Plate>();
    for (const id of plateIds) plates.set(id, (await R.loadPlate(id))!);
    const labs = new Map<string, Plate | undefined>();
    for (const id of labIds) labs.set(id, await R.loadLab(id));
    return { makeGraph, plates, labs };
  };
  const after = await load(gen);
  const before = await load('old');
  vi.doUnmock(GRAPH);
  return { after, before };
}

let both: Promise<{ after: Side; before: Side }> | undefined;
function sides() {
  both ??= compared('new', PLATE_IDS, LAB_IDS);
  return both;
}

/** Plates whose default input is not the grid (one vertex more changes the graph), and fast. */
const PLANTED = ['yen-k-shortest', 'bipartite-matching'];

const digest = (x: string) => createHash('sha256').update(x).digest('hex');

function context(plate: Plate, params: Params, thumbnail: boolean, rows: Stat[][]): PlateContext {
  return {
    width: 1440, height: Math.round(1440 / plate.aspect), params, seed: 4242, rnd: mulberry32(4242),
    theme: 'dark', bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail,
    palette: () => lookupPalette(String(params.palette ?? 'spectral')),
    stats(r) { rows.push(r); }, chart(c) { rows.push([{ label: 'chart', value: JSON.stringify(c) }]); },
  };
}

/** Every draw call, readout and chart of `frames` live frames and two thumbnail frames, one
 * digest per frame (computed in this run), then the readouts once the run has settled. */
function picture(plate: Plate, frames: number, settle = true): { frames: string[]; settled: string } {
  const out: string[] = [];
  for (const thumbnail of [false, true]) {
    const params: Params = {};
    for (const d of plate.params) params[d.key] = d.value;
    const { p, calls } = drawRecorder();
    const rows: Stat[][] = [];
    const sim = plate.create(p, context(plate, params, thumbnail, rows));
    sim.setup();
    for (let f = 0; f < (thumbnail ? 2 : frames); f++) {
      sim.draw();
      out.push(digest(calls.join('\n') + JSON.stringify(rows)));
      calls.length = 0; rows.length = 0;
    }
  }
  if (!settle) return { frames: out, settled: '' };
  // settled: loop off, the pace at its top, until the run reports its end and the rows stand still
  const params: Params = {};
  for (const d of plate.params) params[d.key] = d.value;
  if ('loop' in params) params.loop = false;
  const pace = plate.params.find((d) => d.key === 'pace');
  if (pace?.kind === 'range') params.pace = pace.max;
  const rows: Stat[][] = [];
  const { p } = drawRecorder();
  const sim = plate.create(p, context(plate, params, false, rows));
  sim.setup();
  let last = ''; let still = 0;
  const ended = () => { const r = sim.pace?.(); return !r || r.kind === 'stream' || r.done; };
  for (let f = 0; f < 20_000 && (still < 120 || !ended()); f++) {
    rows.length = 0;
    sim.draw();
    const now = JSON.stringify(rows.filter((r) => r[0]?.label !== 'chart'));
    if (now === '[]') continue;
    still = now === last ? still + 1 : 0;
    last = now;
  }
  return { frames: out, settled: last };
}

describe('the graph engine at its defaults is the engine before the controls', () => {
  it('the new keys are input keys, and their defaults are the old constants', () => {
    for (const key of Object.keys(DEFAULTS)) expect(NEW.INPUT_KEYS, key).toContain(key);
    for (const key of OLD.INPUT_KEYS) expect(NEW.INPUT_KEYS, key).toContain(key);
  });

  it('every shape, size and seed draws the same graph with the defaults passed explicitly', () => {
    const make = NEW.makeGraph as (s: NEW.Shape, n: number, seed: number, a?: number, i?: object) => NEW.Graph;
    for (const shape of NEW.SHAPES) {
      for (const n of [3, 17, 60, 150]) {
        for (const seed of SEEDS) {
          for (const aspect of [16 / 9, 1]) {
            const before = OLD.makeGraph(shape, n, seed, aspect);
            expect(make(shape, n, seed, aspect, DEFAULTS), `${shape} n=${n} seed=${seed}`).toEqual(before);
            expect(make(shape, n, seed, aspect), `${shape} n=${n} seed=${seed}`).toEqual(before);
          }
        }
      }
    }
  });

  it('every graph kernel\'s own input at its defaults draws the old graph, on every input it takes', async () => {
    const { graphInput } = await import('../src/engines/graph/index');
    for (const e of live) {
      const k = kernelOf(e.id);
      const input = graphInput(k, defaultParams(k));
      for (const shape of k.inputs) {
        for (const n of [...new Set([k.n?.min ?? 8, k.n?.value ?? 60, Math.min(k.n?.max ?? 240, 160)])]) {
          for (const seed of SEEDS) {
            const aspect = k.view?.matrix ? 1 : 16 / 9;
            expect(NEW.makeGraph(shape, n, seed, aspect, input), `${e.id} ${shape} n=${n} seed=${seed}`)
              .toEqual(OLD.makeGraph(shape, n, seed, aspect, input as OLD.GraphInput));
          }
        }
      }
    }
  });

  it('the old registry draws on the fixture\'s generator and the new one does not', async () => {
    const { after, before } = await sides();
    // the mock took: the old registry's generator is the fixture's, not the new one
    expect(before.makeGraph).not.toBe(after.makeGraph);
    expect(before.makeGraph('flow', 40, 1, 16 / 9, { maxCapacity: 1 } as object))
      .toEqual(OLD.makeGraph('flow', 40, 1, 16 / 9));
    expect(after.makeGraph('flow', 40, 1, 16 / 9, { maxCapacity: 1 } as object))
      .not.toEqual(OLD.makeGraph('flow', 40, 1, 16 / 9));
  });

  it('the comparison sees a planted change: one vertex more on the new side changes a drawing', async () => {
    // the same loading path as every plate test below, with the new side's makeGraph wrapped
    const { after, before } = await compared('planted', PLANTED, []);
    for (const id of PLANTED) expect(PLATE_IDS, id).toContain(id);
    const differs = PLANTED.filter((id) => {
      const a = picture(after.plates.get(id)!, 90);
      const b = picture(before.plates.get(id)!, 90);
      return JSON.stringify(a) !== JSON.stringify(b);
    });
    expect(differs, 'plates whose drawing the planted change altered').not.toEqual([]);
  });

  // One test per plate and per lab, so that no single test carries the whole catalogue; each
  // draws its plate on both sides in this run.
  it.each(PLATE_IDS)('plate %s draws the same calls and settles on the same readouts', async (id) => {
    const { after, before } = await sides();
    const a = picture(after.plates.get(id)!, 90);
    const b = picture(before.plates.get(id)!, 90);
    expect(a.settled, `${id} settles`).not.toBe('');
    expect(a.frames, `${id}: the draw calls and readouts of each frame`).toEqual(b.frames);
    expect(a.settled, `${id}: the settled readouts`).toBe(b.settled);
  });

  it.each(LAB_IDS)('lab %s draws the same calls', async (id) => {
    const { after, before } = await sides();
    const lab = after.labs.get(id);
    const old = before.labs.get(id);
    // a lab with fewer live kernels than the catalogue's minimum is not runnable, on either side
    if (!lab) return void expect(old).toBeUndefined();
    expect(picture(lab, 90, false).frames, `lab ${id}`).toEqual(picture(old!, 90, false).frames);
  });

  it('the generated tests are one per live graph plate and one per graph lab, none dropped', ({ task }) => {
    // read back the tests this suite actually registered, not the list they were generated from
    const names = task.suite!.tasks.map((t) => t.name);
    const ran = (re: RegExp) => names.flatMap((n) => re.exec(n)?.[1] ?? []).sort();
    const plates = ran(/^plate (\S+) draws the same calls/);
    const labIds = ran(/^lab (\S+) draws the same calls/);
    // the catalogue, read again here: every live entry of the graph engine, every graph lab
    const wantPlates = CATALOGUE.entries
      .filter((e) => e.engine === 'graph' && e.status === 'live').map((e) => e.id).sort();
    const wantLabs = CATALOGUE.labs
      .filter((l) => (l as { engine?: string }).engine === 'graph').map((l) => l.id).sort();
    expect(wantPlates.length).toBeGreaterThan(0);
    expect(wantLabs.length).toBeGreaterThan(0);
    expect(plates).toEqual(wantPlates);
    expect(labIds).toEqual(wantLabs);
  });
});
