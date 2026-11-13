// min-cost-flow's readouts (wave 7a, D2). The engine's flow readout is labelled "Flow value", and
// the kernel's own report added a second row with the same label: a claim reads only the first
// row with its label, so a settled plate's labels must be unique. The engine's row stays (it is
// the flow the replay has drawn, the chart's series); the report keeps the minimum cost.
import { describe, expect, it } from 'vitest';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import { defaults, type Params, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { loadPlate } from '../src/registry';
import { SETTLE_FRAMES, MAX_FRAMES } from './support/claims';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

/** Every readout row of `id`'s plate once its readouts have settled, as test/support/claims.ts
 * runs it: loop off, the pace control at its top, the given parameters and seed. */
async function settledRows(id: string, set: Params, seed: number): Promise<Stat[]> {
  const plate = await loadPlate(id);
  if (!plate) throw new Error(`${id} has no plate`);
  const params: Params = { ...defaults(plate), loop: false, ...set };
  const pace = plate.params.find((d) => d.key === 'pace');
  if (pace?.kind === 'range') params.pace = pace.max;
  let rows: Stat[] = [];
  const ground = GROUNDS.dark;
  const ctx: PlateContext = {
    width: 800, height: Math.round(800 / plate.aspect), params, seed, rnd: mulberry32(seed),
    theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => lookupPalette('spectral'), stats(r) { rows = r; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  let last = '';
  let still = 0;
  for (let f = 0; f < MAX_FRAMES && (still < SETTLE_FRAMES || !sim.pace?.().done); f++) {
    sim.draw();
    const now = JSON.stringify(rows);
    still = now === last ? still + 1 : 0;
    last = now;
  }
  expect(still, `${id} settles`).toBeGreaterThanOrEqual(SETTLE_FRAMES);
  return rows;
}

describe('min-cost-flow: a settled plate publishes each readout label once (D2)', () => {
  for (const [n, seed] of [[30, 4242], [30, 7], [80, 4242], [4, 7]] as const) {
    it(`n ${n}, seed ${seed}`, async () => {
      const rows = await settledRows('min-cost-flow', { n }, seed);
      const labels = rows.map((r) => r.label);
      const twice = labels.filter((l, i) => labels.indexOf(l) !== i);
      expect(twice, `labels: ${labels.join(' | ')}`).toEqual([]);
      expect(labels).toContain('Flow value');
      expect(labels).toContain('Minimum cost');
    });
  }
});
