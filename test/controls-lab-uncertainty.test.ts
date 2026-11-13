// The uncertainty lab carries the shared "Nominal level shown" control (S4 A3): both of its
// kernels declare it from one factory (src/kernels/stochastic/_coverage.ts), the lab offers the
// union of its kernels' controls, and each pane then shows the level chosen.
import { describe, expect, it } from 'vitest';
import { GROUNDS, palette } from '../src/core/palette';
import { defaults, type Params, type PlateContext, type Stat } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { mulberry32 } from '../src/core/random';
import { kernel as bootstrap } from '../src/kernels/stochastic/bootstrap-ci';
import { kernel as conformal } from '../src/kernels/stochastic/conformal-intervals';
import { loadLab } from '../src/registry';
import { p5Stub, installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

/** The lab's readouts once every pane has replayed its whole run. */
async function settled(over: Params): Promise<Stat[]> {
  const plate = (await loadLab('uncertainty'))!;
  const params: Params = { ...defaults(plate), loop: false, reps: 20, ...over };
  const pace = plate.params.find((d) => d.key === 'pace');
  if (pace?.kind === 'range') params.pace = pace.max;
  let rows: Stat[] = [];
  const ctx: PlateContext = {
    width: 800, height: 600, params, seed: 4242, rnd: mulberry32(4242), theme: 'dark',
    bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail: false, palette: () => palette('abyss'),
    stats(r) { rows = r; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  for (let i = 0; i < 20_000 && !(sim.pace?.() as { done?: boolean } | undefined)?.done; i++) sim.draw();
  sim.draw();
  return rows;
}

describe('lab uncertainty: nominal level shown', () => {
  it('offers the one control both kernels declare, with the old 90% as its default', async () => {
    const plate = (await loadLab('uncertainty'))!;
    const mine = plate.params.filter((d) => d.key === 'level');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toEqual(bootstrap.params!.find((d) => d.key === 'level'));
    expect(mine[0]).toEqual(conformal.params!.find((d) => d.key === 'level'));
    expect(mine[0]).toMatchObject({ kind: 'select', value: '0.9' });
    const d: Params = Object.fromEntries(plate.params.map((x) => [x.key, x.value]));
    expect(parse(plate.params, serialise(plate.params, { ...d, level: '0.8' }, 7))).toEqual({ seed: 7, params: { level: '0.8' } });
  });

  it('shows each pane at the level chosen, and at 90% by default', async () => {
    const at = await settled({ level: '0.8' });
    expect(at.slice(0, 2).map((r) => r.value).join(' | ')).toMatch(/80% intervals covering.*\|.*80% intervals covering/);
    const def = await settled({});
    expect(def.slice(0, 2).map((r) => r.value).join(' | ')).toMatch(/90% intervals covering.*\|.*90% intervals covering/);
  });
});
