// The subjects scripts/budget-vs-bundle.mjs times: each plate driven headless at one corner, the
// same way test/support/budget.ts drives it (the p5 stub, the browser stubs, thread CPU time per
// frame). The script loads this one module twice, once through Vite's SSR module transform (the
// runtime vitest gives the budget gate) and once as a production bundle (how the site ships it),
// so the ratio of the two readings is what the gate adds to the plate's own cost.
import { GROUNDS, palette } from '../src/core/palette';
import type { Params, PlateCode, PlateContext } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import boids3d from '../src/plates/boids-3d/plate';
import grayScott from '../src/plates/gray-scott/plate';
import lorenzAttractor from '../src/plates/lorenz-attractor/plate';
import rippleTank from '../src/plates/ripple-tank/plate';
import { installBrowserStubs, p5Stub } from '../test/support/p5-stub';

export interface Corner { label: string; plate: PlateCode; params: Params }

const at = (plate: PlateCode, over: Params): Params => {
  const p: Params = {};
  for (const d of plate.params) p[d.key] = d.value;
  return { ...p, ...over };
};

/** The heaviest corners the budget gate reported for these plates (BUDGET_REPORT, 2026-11-17). */
export const CORNERS: Corner[] = [
  { label: 'ripple-tank double slit, finest cells', plate: rippleTank,
    params: at(rippleTank, { experiment: 'double', view: 'wave', lambda: 40, gap: 80, res: 2, speed: 8 }) },
  { label: 'boids-3d, 1500 boids at radius 0.3', plate: boids3d,
    params: at(boids3d, { n: 1500, separation: 3, alignment: 3, cohesion: 3, radius: 0.3, speed: 1.5, trail: 16 }) },
  { label: 'lorenz-attractor, 48 × 2400 at 12 steps', plate: lorenzAttractor,
    params: at(lorenzAttractor, { tracers: 48, trail: 2400, rho: 60, speed: 12 }) },
  { label: 'gray-scott, finest cells at 40 steps', plate: grayScott,
    params: at(grayScott, { res: 2, speed: 40 }) },
];

const threadCpu = (process as { threadCpuUsage?: () => NodeJS.CpuUsage }).threadCpuUsage;
const cpuMs = () => { const u = threadCpu ? threadCpu.call(process) : process.cpuUsage(); return (u.user + u.system) / 1000; };

/** Frame CPU times of one corner at 1440 × 900: `warm` frames unmeasured, then `frames` measured. */
export function frames(c: Corner, warm: number, n: number, seed = 4242): number[] {
  installBrowserStubs();
  const ground = GROUNDS.dark;
  const params = { ...c.params };
  const ctx: PlateContext = {
    width: 1440, height: 900, params, seed, rnd: mulberry32(seed), theme: 'dark',
    bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => palette(String(params.palette ?? 'ember')), stats() {}, chart() {},
  };
  const sim = c.plate.create(p5Stub(), ctx);
  sim.setup();
  for (let i = 0; i < warm; i++) sim.draw();
  const out: number[] = [];
  for (let i = 0; i < n; i++) { const t = cpuMs(); sim.draw(); out.push(cpuMs() - t); }
  return out;
}
