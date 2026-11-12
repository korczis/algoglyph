// The pacing contract (config/pacing.yaml, ADR 0008), judged on a plate headless at its
// defaults, seed 4242, loop off, counted in frames at the file's fps and never timed:
//   declared   every plate says how it is paced (PlateCode.pace); an emergent stream and a still
//              plate say why, and only they may keep a control of their own that sets a rate
//   arithmetic once a run's length is known, its calm run lasts within run_s (unless the whole
//              run is shorter than run_s[0] × min_per_s changes) and shows at most max_per_s
//   driven     the run, driven frame by frame to its end, ends within run_s as counted
// test/pacing.test.ts judges the first two for every subject; `npm run test:pacing` (one file
// per wing under test/pacing/, each in a process of its own) drives every run to its end.
import { describe, expect, it } from 'vitest';
import { CATALOGUE, ENTRIES } from '../../src/core/catalogue';
import { FPS, PACING, type PaceDecl, type PaceReport } from '../../src/core/pace';
import { palette as lookupPalette, GROUNDS } from '../../src/core/palette';
import { defaults, type Params, type Plate, type PlateCode, type PlateContext, type Sim, type Stat } from '../../src/core/plate';
import { mulberry32 } from '../../src/core/random';
import { labRunnable, loadLab, loadPlate } from '../../src/registry';
import { installBrowserStubs, p5Stub } from './p5-stub';

installBrowserStubs();

export const SEED = 4242;
/** Frames a run may take to report its length (a build or a recording sliced over frames). */
export const KNOWN_WITHIN = 3000;

export interface Subject { label: string; load: () => Promise<Plate | undefined> | undefined }

export function subjectsOf(pick: { wing: string } | { labs: true } | { all: true }): Subject[] {
  const labs = CATALOGUE.labs.filter((x) => labRunnable(x.id)).map((l) => ({ label: `lab ${l.id}`, load: () => loadLab(l.id) }));
  if ('labs' in pick) return labs;
  const plates = ENTRIES.filter((x) => x.status === 'live' && ('all' in pick || x.path[0] === pick.wing))
    .map((e) => ({ label: e.id, load: () => loadPlate(e.id) }));
  return 'all' in pick ? [...plates, ...labs] : plates;
}

/** A plate mounted headless at its defaults (loop off), with `over` applied. */
export function mount(plate: PlateCode, over: Params = {}, seed = SEED): { sim: Sim; params: Params; rows: () => Stat[] } {
  const params = defaults(plate as Plate);
  if (plate.params.some((d) => d.key === 'loop')) params.loop = false;
  Object.assign(params, over);
  let rows: Stat[] = [];
  const ground = GROUNDS.dark;
  const ctx: PlateContext = {
    width: 800, height: Math.round(800 / plate.aspect), params, seed, rnd: mulberry32(seed),
    theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => lookupPalette(String(params.palette ?? 'ember')),
    stats(r) { rows = r; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  return { sim, params, rows: () => rows };
}

/** A key or label that sets how fast a plate runs, in a unit of its own. */
export const RATE_CONTROL = { keys: ['speed', 'steps', 'substeps'], label: /\b\w+s( \w+)? per frame/i };

/** What is wrong with a plate's declaration; empty when it is sound. */
export function declarationErrors(plate: Pick<PlateCode, 'id' | 'params' | 'pace'>): string[] {
  const d: PaceDecl | undefined = plate.pace;
  if (!d) return [`${plate.id} declares no pace (PlateCode.pace, src/core/pace.ts)`];
  const out: string[] = [];
  const own = plate.params.filter((p) => p.kind !== 'toggle' && (RATE_CONTROL.keys.includes(p.key) || RATE_CONTROL.label.test(p.label)));
  const reason = 'emergent' in d ? d.emergent : 'why' in d ? d.why : undefined;
  if (reason !== undefined && !reason.trim()) out.push(`${plate.id}: a ${'emergent' in d ? 'emergent stream' : 'still plate'} says why, and its reason is empty`);
  if (reason === undefined && own.length) {
    out.push(`${plate.id}: ${own.map((p) => `"${p.label}"`).join(', ')} sets a rate of its own; a paced plate uses paceParam()`);
  }
  if (reason === undefined && !plate.params.some((p) => p.key === 'pace')) out.push(`${plate.id}: a paced plate carries the pace control (paceParam())`);
  return out;
}

/** The length the run reports, frames driven until it was known, and the report then. */
export function known(sim: Sim, frames = KNOWN_WITHIN): { report: PaceReport | undefined; frames: number } {
  let report = sim.pace?.();
  let f = 0;
  while (report && report.kind !== 'stream' && report.length === null && f < frames) {
    sim.draw();
    f++;
    report = sim.pace?.();
  }
  return { report, frames: f };
}

/** What is wrong with a reported pace at the defaults; empty when it keeps the contract. */
export function arithmeticErrors(label: string, report: PaceReport | undefined, decl: PaceDecl | undefined): string[] {
  if (!decl || 'emergent' in decl || 'why' in decl) return [];
  if (!report) return [`${label}: declares a ${decl.kind} pace and its run reports none (Sim.pace)`];
  if (report.kind !== decl.kind) return [`${label}: declares ${decl.kind} and reports ${report.kind}`];
  const out: string[] = [];
  const perSec = report.perFrame * FPS;
  const cap = PACING.kinds[report.kind].max_per_s;
  if (perSec > cap + 1e-9) out.push(`${label}: ${perSec.toFixed(1)} ${report.unit}/s at its defaults, above the ${cap}/s of a ${report.kind}`);
  if (report.kind === 'stream') return out;
  if (report.length === null) return [...out, `${label}: its run's length was still unknown after ${KNOWN_WITHIN} frames`];
  const k = PACING.kinds[report.kind];
  const s = report.seconds ?? report.length / report.perFrame / FPS;
  const short = report.length <= k.run_s[0] * k.min_per_s;
  if (s > k.run_s[1] + 1e-9) out.push(`${label}: a default run of ${report.length} ${report.unit} lasts ${s.toFixed(1)} s at ${perSec.toFixed(1)}/s, longer than ${k.run_s[1]} s`);
  if (s < k.run_s[0] - 1e-9 && !short) out.push(`${label}: a default run of ${report.length} ${report.unit} lasts ${s.toFixed(1)} s, shorter than ${k.run_s[0]} s`);
  return out;
}

/** Frames a run takes from mounting to its end, driven and counted; Infinity past `limit`. */
export function drive(sim: Sim, limit: number): number {
  for (let f = 1; f <= limit; f++) {
    sim.draw();
    if (sim.pace?.()?.done) return f;
  }
  return Infinity;
}

/** What is wrong with a driven run's length; empty when it ends within the window. */
export function drivenErrors(label: string, frames: number, report: PaceReport): string[] {
  if (report.kind === 'stream') return [];
  const k = PACING.kinds[report.kind];
  const s = frames / FPS;
  const short = report.length !== null && report.length <= k.run_s[0] * k.min_per_s;
  if (!Number.isFinite(frames)) return [`${label}: did not end within ${(k.run_s[1] * 1.5).toFixed(0)} s of frames`];
  if (s > k.run_s[1] + 1e-9) return [`${label}: its default run ended after ${frames} frames (${s.toFixed(1)} s at ${FPS} fps), longer than ${k.run_s[1]} s`];
  if (s < k.run_s[0] - 1e-9 && !short) return [`${label}: its default run ended after ${frames} frames (${s.toFixed(1)} s), shorter than ${k.run_s[0]} s`];
  return [];
}

/** The driven lane for one wing (or the labs): every paced run driven to its end. */
export function pacingSuite(pick: { wing: string } | { labs: true }): void {
  const subjects = subjectsOf(pick);
  describe(`pacing, driven: ${'labs' in pick ? 'labs' : pick.wing}`, () => {
    it('has subjects', () => expect(subjects.length).toBeGreaterThan(0));
    for (const s of subjects) {
      it(s.label, async () => {
        const plate = (await s.load())!;
        const d = plate.pace;
        if (!d || 'emergent' in d || 'why' in d || d.kind === 'stream') return;
        const { sim } = mount(plate);
        const k = PACING.kinds[d.kind];
        const frames = drive(sim, Math.ceil(k.run_s[1] * 1.5 * FPS));
        const report = sim.pace?.();
        expect(report, `${s.label}: reports no pace`).toBeDefined();
        expect(drivenErrors(s.label, frames, report!)).toEqual([]);
      }, 300000);
    }
  });
}
