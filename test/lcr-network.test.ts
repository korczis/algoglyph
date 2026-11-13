// The lcr-network plate beyond its claims (catalogue/entries/lcr-network.md): a reader's netlist,
// checked against a closed form the plate does not use (the capacitor voltage of a series circuit
// peaks at ω₀√(1 − 1/2Q²) with height Q/√(1 − 1/4Q²)), rows it must refuse, a floating node, and a
// drive set by a press on the response curve.
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
  const plate = (await loadPlate('lcr-network'))!;
  let rows: Stat[] = [];
  const params: Params = { ...defaults(plate), pace: 4096, ...over };
  const ground = GROUNDS.dark;
  const ctx: PlateContext = {
    width: 800, height: 500, params, seed: 3, rnd: mulberry32(3), theme: 'dark', bg: ground.bg, fg: ground.fg,
    thumbnail: false, palette: () => lookupPalette('ember'), stats(r) { rows = r; }, chart() {},
    data: (id) => (id === 'netlist' ? table ?? null : null),
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  for (let i = 0; i < 4000 && !sim.pace?.().done; i++) sim.draw();
  sim.draw();
  return { sim, rows: () => rows };
}

const value = (rows: Stat[], label: string) => rows.find((r) => r.label === label)?.value ?? '';
const decl = ENTRIES.find((e) => e.id === 'lcr-network')!.data[0];
const table = (lines: string[]) => {
  const r = parseData(decl, ['kind,a,b,value', ...lines].join('\n'));
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.table;
};

describe('lcr-network on your netlist', () => {
  it('drives a series circuit at the capacitor voltage’s peak, ω₀√(1 − 1/2Q²)', async () => {
    // R = 0.2, L = 1, C = 1: Q = 5, and the output node 3 is the capacitor's voltage
    const { rows } = await mount({ mode: optionValue('netlist') }, table(['1,1,2,0.2', '2,2,3,1', '3,3,0,1']));
    const r = rows();
    expect(value(r, 'Input')).toMatch(/^your data, 3 elements, nodes 0 to 3/);
    expect(value(r, 'solvable')).toBe('yes');
    const Q = 5;
    const peak = Math.sqrt(1 - 1 / (2 * Q * Q));
    // the drive is the best of 121 log-spaced frequencies, so within one grid step of the peak
    const w = Number(value(r, 'drive ω').split(' ')[0]);
    const lo = 1 / (5 * 20);
    const hi = 1 * 20 * 5;
    const grid = Math.log(hi / lo) / 120;
    expect(Math.abs(Math.log(w / peak))).toBeLessThan(grid);
    // the transient agrees with the phasor at the warped frequency: the bilinear transform
    expect(Number(value(r, 'transient against the phasor at the warped frequency, relative gap'))).toBeLessThan(1e-8);
    expect(Number(value(r, 'Kirchhoff current-law residual, largest relative'))).toBeLessThan(1e-9);
  });

  it('refuses rows it cannot read and says which', async () => {
    const { rows } = await mount({ mode: optionValue('netlist') }, table(['1.5,1,2,1', '1,2,2,1', '1,1,0,1']));
    expect(value(rows(), 'refused rows')).toBe('row 1: kind 1.5 is not 1, 2 or 3; row 2: nodes must be two different whole numbers');
  });

  it('a node that floats is not solved', async () => {
    const { rows } = await mount({ mode: optionValue('netlist') }, table(['1,1,0,1', '3,2,3,1']));
    expect(value(rows(), 'solvable')).toMatch(/^no/);
  });
});

describe('lcr-network driven by hand', () => {
  it('a press on the response curve drives the circuit there, and the transient follows', async () => {
    const { sim, rows } = await mount({});
    // the response panel spans 56 %–96 % of the width over ω from 0.2 to 3 (log): its middle is √0.6
    sim.pressed?.(800 * 0.76, 500 * 0.4);
    for (let i = 0; i < 4000 && !sim.pace?.().done; i++) sim.draw();
    sim.draw();
    const r = rows();
    expect(value(r, 'drive ω over ω₀')).toMatch(/set on the response curve/);
    const w = Number(value(r, 'drive ω over ω₀').split(' ')[0]);
    expect(Math.abs(w - Math.sqrt(0.6))).toBeLessThan(1e-3);
    const closed = Number(value(r, 'current amplitude, closed form V/|R + j(ωL − 1/ωC)|'));
    expect(Math.abs(closed - Number(value(r, 'current amplitude, phasor solve at ω')))).toBeLessThan(1e-9);
    // the drive is shown to four decimals: the closed form at the shown ω is that close
    expect(Math.abs(closed / (1 / Math.hypot(0.1, w - 1 / w)) - 1)).toBeLessThan(1e-3);
    expect(value(r, 'current amplitude, trapezoidal transient (lock-in)')).not.toBe('settling');
  });
});
