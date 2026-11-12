// The array engine's lab traces its kernels one per frame and shows them together once all are
// ready, so a lab of many kernels never traces them all inside one frame; a thumbnail is one
// picture and traces them at once.
import { describe, expect, it } from 'vitest';
import { CATALOGUE } from '../src/core/catalogue';
import { palette as lookupPalette, GROUNDS } from '../src/core/palette';
import type { Params, Plate, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { labRunnable, loadLab } from '../src/registry';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

function mount(plate: Plate, thumbnail: boolean) {
  const params: Params = {};
  for (const d of plate.params) params[d.key] = d.value;
  params.group = 'all';
  let stats: Stat[] = [];
  const ctx: PlateContext = {
    width: 640, height: 480, params, seed: 7, rnd: mulberry32(7), theme: 'dark',
    bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail,
    palette: () => lookupPalette('ember'), stats(rows) { stats = rows; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  return { sim, stats: () => stats };
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
    it(`${l.id}: a thumbnail traces every kernel at once`, async () => {
      const plate = (await loadLab(l.id))!;
      const { sim, stats } = mount(plate, true);
      sim.draw();
      expect(stats().length).toBeGreaterThan(1);
    });
  }
});
