// The kepler-orbits plate beyond its claims (catalogue/entries/kepler-orbits.md): a reader's
// table of bodies, each measured against the conic its launch implies (vis-viva, computed here and
// not by the plate), and a launch dragged by hand, still held to Kepler's third law.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { optionValue, parseData, type DataTable } from '../src/core/data';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import { defaults, type Params, type PlateContext, type Sim, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { loadPlate } from '../src/registry';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

async function mount(over: Params, table?: DataTable): Promise<{ sim: Sim; rows: () => Stat[] }> {
  const plate = (await loadPlate('kepler-orbits'))!;
  let rows: Stat[] = [];
  const params: Params = { ...defaults(plate), pace: 4096, ...over };
  const ground = GROUNDS.dark;
  const ctx: PlateContext = {
    width: 800, height: 500, params, seed: 3, rnd: mulberry32(3), theme: 'dark', bg: ground.bg, fg: ground.fg,
    thumbnail: false, palette: () => lookupPalette('ember'), stats(r) { rows = r; }, chart() {},
    data: (id) => (id === 'bodies' ? table ?? null : null),
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  for (let i = 0; i < 50 && !sim.pace?.().done; i++) sim.draw();
  sim.draw();
  return { sim, rows: () => rows };
}

const value = (rows: Stat[], label: string) => rows.find((r) => r.label === label)?.value ?? '';

describe('kepler-orbits on your bodies', () => {
  const decl = ENTRIES.find((e) => e.id === 'kepler-orbits')!.data[0];
  // a circle, the vis-viva ellipse a = 1, e = 0.5 from perihelion, a body above escape speed, and one too close
  const text = ['x,y,vx,vy', '1,0,0,1', `0.5,0,0,${Math.sqrt(3)}`, '1,0,0,2', '0.01,0,0,1'].join('\n');
  const parsed = parseData(decl, text);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

  it('measures each body against the conic its launch implies', async () => {
    const { rows } = await mount({ mode: optionValue('bodies') }, parsed.table);
    const r = rows();
    expect(value(r, 'Input')).toBe('your data, 4 bodies around GM = 1');
    expect(value(r, 'orbits closed, two perihelia within 20π')).toBe('2');
    expect(value(r, 'escaped beyond r = 50')).toBe('1');
    expect(value(r, 'skipped, starting within r = 0.05')).toBe('1');
    // vis-viva: v² = GM(2/r − 1/a), so the second body has a = 1, e = 0.5 and T = 2π
    const m = /a ([\d.]+), e ([\d.]+), T ([\d.]+)/.exec(value(r, 'body 2'))!;
    expect(Math.abs(Number(m[1]) - 1)).toBeLessThan(1e-3);
    expect(Math.abs(Number(m[2]) - 0.5)).toBeLessThan(1e-3);
    expect(Math.abs(Number(m[3]) - 2 * Math.PI)).toBeLessThan(1e-3);
    expect(Number(value(r, 'largest Kepler III residual |T − 2π√(a³/GM)|/T, closed orbits'))).toBeLessThan(1e-4);
  });

  it('says so when no table is attached', async () => {
    const { rows } = await mount({ mode: optionValue('bodies') });
    expect(value(rows(), 'Input')).toMatch(/^your data: none attached/);
  });
});

describe('kepler-orbits launched by hand', () => {
  it('a dragged launch is integrated and still obeys the third law', async () => {
    const { sim, rows } = await mount({});
    // from the perihelion at (0.5, 0), a drag up and to the right: some other ellipse
    sim.pressed?.(400 + 0.5 * 120, 250 - 0.6 * 120);
    for (let i = 0; i < 5; i++) sim.draw();
    const r = rows();
    expect(value(r, 'launch')).toMatch(/^dragged: v = /);
    const T = Number(value(r, 'period T, measured between perihelia'));
    const K = Number(value(r, 'Kepler III: 2π√(a³/GM), a measured'));
    expect(Number.isFinite(T)).toBe(true);
    // a tighter orbit than the default, so fewer steps per perihelion passage: the leapfrog gap is larger
    expect(Math.abs(T - K) / T).toBeLessThan(1e-3);
    // vis-viva from the dragged velocity at r = 0.5: 1/a = 2/r − v²
    const [vx, vy] = /\(([-\d.]+), ([-\d.]+)\)/.exec(value(r, 'launch'))!.slice(1).map(Number);
    const a = 1 / (2 / 0.5 - (vx * vx + vy * vy));
    expect(Math.abs(Number(value(r, 'semimajor axis (r_peri + r_apo)/2, measured')) - a) / a).toBeLessThan(1e-3);
  });
});
