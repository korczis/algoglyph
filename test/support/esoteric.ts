// Helpers of the bespoke sorting plates' tests: run a plate headless (drawing stubbed, as the
// budget gate does) and capture what it publishes, and run a kernel of the wasm module
// count-only for the comparison with a plate's step-wise mirror.
import { GROUNDS, palette as lookupPalette } from '../../src/core/palette';
import type { Chart, Params, PlateCode, PlateContext, Sim, Stat } from '../../src/core/plate';
import { defaults } from '../../src/core/plate';
import { mulberry32 } from '../../src/core/random';
import { loadSorting, type WasmRun } from '../../src/kernels/sorting-wasm/_abi';
import { installBrowserStubs, p5Stub } from './p5-stub';

installBrowserStubs();

export const S = await loadSorting();

/** Kernel `id` on `keys`, count-only, with the step limit `maxSteps` (0: the kernel default). */
export function kernelRun(id: string, keys: readonly number[], seed: number, maxSteps = 0): WasmRun {
  return S.run(id, keys, { seed, trace: false, maxSteps });
}

export interface Headless {
  sim: Sim;
  stats: () => Record<string, string>;
  chart: () => Chart | undefined;
  frames(n: number): void;
}

/** Mounts a plate on a stubbed p5 at `width` with its defaults overridden by `params`. */
export function headless(code: PlateCode, params: Params = {}, seed = 4242, width = 390): Headless {
  let rows: Stat[] = [];
  let chart: Chart | undefined;
  const all = { ...defaults({ ...code, title: '', summary: '', no: '' }), ...params };
  const ground = GROUNDS.dark;
  const ctx: PlateContext = {
    width, height: Math.round(width / code.aspect), params: all, seed, rnd: mulberry32(seed),
    theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => lookupPalette(String(all.palette ?? 'ember')),
    stats(r) { rows = r; },
    chart(c) { chart = c; },
  };
  const sim = code.create(p5Stub(), ctx);
  sim.setup();
  return {
    sim,
    stats: () => Object.fromEntries(rows.map((r) => [r.label, r.value])),
    chart: () => chart,
    frames(n: number) { for (let i = 0; i < n; i++) sim.draw(); },
  };
}

/** Every parameter setting a budget corner would try: each range at both ends, each option. */
export function extremes(code: PlateCode): Params[] {
  const out: Params[] = [{}];
  for (const d of code.params) {
    if (d.kind === 'range') out.push({ [d.key]: d.min }, { [d.key]: d.max });
    else if (d.kind === 'select' && d.key !== 'palette') for (const o of d.options) out.push({ [d.key]: o.value });
    else if (d.kind === 'toggle') out.push({ [d.key]: !d.value });
  }
  return out;
}

/** A readout's leading number ("1,234 shuffles" -> 1234). */
export function lead(s: string | undefined): number {
  return Number((s ?? '').replace(/,/g, '').match(/-?[\d.]+(e[+-]?\d+)?/i)?.[0] ?? NaN);
}
