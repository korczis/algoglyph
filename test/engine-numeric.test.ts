// The numeric engine's plate loop: a finished run holds, then the next input is built in
// slices across frames while the held run stays on screen, so a rebuild never freezes a frame
// for a whole kernel run (rule project.viz-component-layer: heavy work is spread over frames).
import { describe, expect, it } from 'vitest';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import type { Params, Plate, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { loadPlate } from '../src/registry';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

/** The kernels reviewers measured rebuilding for tens of milliseconds in one frame. */
const HEAVY = [
  'hurst-dfa', 'poincare-section', 'recurrence-plot', 'pca-svd',
  'linear-congruential', 'takens-embedding', 'lyapunov-exponent',
];

function heaviest(plate: Plate): Params {
  const out: Params = {};
  for (const d of plate.params) out[d.key] = d.kind === 'range' ? d.max : d.value;
  return { ...out, loop: true };
}

describe('numeric engine rebuilds', () => {
  for (const id of HEAVY) {
    it(`${id} keeps the finished run on screen while the next one is built`, async () => {
      const plate = (await loadPlate(id))!;
      const params = heaviest(plate);
      let step = '';
      const ground = GROUNDS.dark;
      const ctx: PlateContext = {
        width: 400, height: Math.round(400 / plate.aspect), params, seed: 4242, rnd: mulberry32(4242),
        theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
        palette: () => lookupPalette(String(params.palette ?? 'ember')),
        stats(rows: Stat[]) { step = rows.find((r) => r.label === 'Step')?.value ?? ''; },
        chart() {},
      };
      const sim = plate.create(p5Stub(), ctx);
      sim.setup();
      // replay to the end of the first run, then count the frames that still show its last step
      let frames = 0;
      do { sim.draw(); frames++; } while (!/^(\d+) of \1$/.test(step) && frames < 20000);
      const last = step;
      let held = 0;
      while (step === last && held < 20000) { sim.draw(); held++; }
      expect(step, `${id}: a new run started`).toMatch(/^1 of \d+$/);
      // the hold is 150 frames once the run is done; a rebuild done in one frame adds none
      expect(held, `${id}: frames the finished run stayed`).toBeGreaterThan(151);
    }, 120000);
  }
});
