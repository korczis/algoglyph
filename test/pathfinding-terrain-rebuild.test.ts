// pathfinding-terrain builds its next map past the end of a run. Built inside one frame, a map of
// 4 px cells at 1440 px (360 × 225 cells) took a 34.4 ms frame, over the main-thread budget, which
// the budget gate first read when its past-the-end check went to every range's minimum
// (test/support/budget.ts `pastTheEnd`). The build is now spread over the frames of the
// end-of-run hold, counted (BUILD_UNITS), while the finished map stays on screen.
//   1. No frame past the end of a run expands more than BUILD_UNITS cells for the next map, at the
//      budget gate's corner (every range at its maximum, cell at its minimum, 1440 px).
//   2. The default run is unchanged: its draw calls and readouts, frame by frame across two new
//      maps at 800 px and one at 1440 px, equal those of the plate as it was (test/support/pathfinding-terrain-before.ts), both
//      run here, in this run.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PACING } from '../src/core/pace';
import { Raster } from '../src/core/raster';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import type { Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import pathfinding, { BUILD_UNITS } from '../src/plates/pathfinding-terrain/plate';
import { Search } from '../src/plates/pathfinding-terrain/search';
import { drawRecorder } from './support/draw-recorder';
import pathfindingBefore from './support/pathfinding-terrain-before';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

function defaults(plate: PlateCode): Params {
  return Object.fromEntries(plate.params.map((d) => [d.key, d.value]));
}

function context(plate: PlateCode, params: Params, width: number, rows: (r: Stat[]) => void): PlateContext {
  const ground = GROUNDS.dark;
  return {
    width, height: Math.round(width / plate.aspect), params, seed: 4242, rnd: mulberry32(4242),
    theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => lookupPalette(String(params.palette)), stats: rows, chart() {},
  };
}

afterEach(() => vi.restoreAllMocks());

describe('pathfinding-terrain: the next map is built over frames', () => {
  it('expands at most BUILD_UNITS cells for the next map in any frame past the end of a run', () => {
    // the budget gate's past-the-end corner: every range at its maximum, cell at its minimum
    const params: Params = { ...defaults(pathfinding), weight: 5, rough: 3, cell: 4, pace: PACING.pace.max };
    const sim = pathfinding.create(p5Stub(), context(pathfinding, params, 1440, () => {}));
    sim.setup();
    const step = vi.spyOn(Search.prototype, 'step');
    let worst = 0;
    let builds = 0;
    let building = 0;
    for (let f = 0; f < 3000 && builds < 2; f++) {
      const ended = sim.pace!().done;
      step.mockClear();
      sim.draw();
      if (!ended) continue;
      worst = Math.max(worst, step.mock.calls.length);
      if (step.mock.calls.length > 0) building++;
      if (!sim.pace!().done) builds++;
    }
    expect(builds, 'new maps built past the end of a run').toBe(2);
    expect(worst, `the most cells one frame expanded for a new map`).toBeLessThanOrEqual(BUILD_UNITS);
    // a 360 × 225 map does not fit one frame's share: it is spread, not merely bounded
    expect(building).toBeGreaterThan(2);
  });

  // How many new maps each width runs through: at 1440 px the default run needs 27,078 frames for
  // two maps, about 3.4 ms of drawing a frame for each plate (180 s, over the 120 s test limit on
  // the self-hosted runner, Pages run 43748620021); one map there still crosses the over-frames
  // build, and 800 px keeps the full two.
  const MAPS: Record<number, number> = { 800: 2, 1440: 1 };
  for (const width of [800, 1440]) {
    it(`draws and reads out the default run at ${width} px exactly as the plate did before`, () => {
      // both plates step in lockstep and each frame is compared as it is drawn, so no frame is kept
      let sink: string[] = [];
      // the map's pixels, as each blit hands them over: an integer fold of the bytes, compared
      // with the other plate's in this run and never recorded
      vi.spyOn(Raster.prototype, 'blit').mockImplementation(function blit(this: Raster, _p, smooth, x, y, w, h) {
        let fold = 0;
        for (let i = 0; i < this.data.length; i++) fold = (Math.imul(fold, 31) + this.data[i]) | 0;
        sink.push(`blit(${this.w}x${this.h},${smooth},${x},${y},${w},${h},${fold})`);
      });
      const mount = (plate: PlateCode) => {
        const { p, calls } = drawRecorder();
        const run = { calls, rows: [] as Stat[], maps: 0, sim: undefined as unknown as ReturnType<PlateCode['create']> };
        run.sim = plate.create(p, context(plate, defaults(plate), width, (r) => { run.rows = r; }));
        run.sim.setup();
        return run;
      };
      const frame = (run: ReturnType<typeof mount>) => {
        sink = run.calls;
        const ended = run.sim.pace!().done;
        run.sim.draw();
        if (ended && !run.sim.pace!().done) run.maps++;
        const out = `${run.calls.join('\n')}\n${JSON.stringify(run.rows)}`;
        run.calls.length = 0;
        return out;
      };
      const before = mount(pathfindingBefore);
      const now = mount(pathfinding);
      let f = 0;
      for (; f < 40000 && before.maps < MAPS[width]; f++) {
        const a = frame(before);
        const b = frame(now);
        if (a !== b) expect(b, `frame ${f}`).toBe(a);
        if (now.maps !== before.maps) expect(now.maps, `new maps by frame ${f}`).toBe(before.maps);
      }
      expect(before.maps, 'new maps in the default run').toBe(MAPS[width]);
      // the old plate finished its last map on this frame; the new one must not need more
      expect(now.maps, `new maps after ${f} frames`).toBe(MAPS[width]);
    });
  }
});
