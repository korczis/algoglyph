// Measures, for every wasm sorting kernel the array engine may play, what one rebuild costs at
// each n (the array plate built at that n, as a loop rebuilds it inside one frame: the whole
// trace, the replay and the frame's own work; the worst input shape, best of three) and derives
// the largest n whose rebuild stays within a budget: the `max_n` the sidecar will carry once the
// array engine accepts ArrayKernel.maxN. A measurement, not a gate: it runs only when asked,
//
//   ALGOGLYPH_MAX_N=<out.json> [ALGOGLYPH_MAX_N_MS=<ms, overrides max_n_budget_ms>] [ALGOGLYPH_MAX_N_WRITE=1] \
//     npx vitest run test/sorting-max-n.test.ts
//
// and writes { kernel: { max_n, ms_at_512, ms } } for the kernels that need a bound (ms: every
// cost measured, by n). The bound keeps a margin (max_n_margin of config/budgets.yaml): the
// largest n whose rebuild costs at most budget × margin, settled on costs measured at max_n and
// max_n + 8 after the power-law estimate, and then checked again on the sidecar's recorded
// bounds by a second measurement. A kernel with options (the sidecar's `options`) is measured at
// each of its option corners, the ones the budget gate measures (every option at its maximum,
// then each in turn at its minimum) and its defaults, and its bound is the worst: max_n holds at
// the option's costliest setting.
// ALGOGLYPH_MAX_N_ONLY=<kernel,...> measures and rewrites only those records. Times are CPU
// time scaled to the reference machine of config/budgets.yaml, the way test/budget/
// scales its budgets, so the derived bounds do not depend on the machine that measured them.
// With ALGOGLYPH_MAX_N_WRITE=1 it also writes them into catalogue/sorting-sidecar.yaml: each
// record's max_n, with max_n_of, the kernel's source hash from its manifest, which the catalogue
// gate compares, so a kernel changed after its measurement is refused until it is re-measured.
// A kernel that needs no bound loses both keys.
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PACING } from '../src/core/pace';
import { parse } from 'yaml';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, Plate } from '../src/core/plate';
import { loadPlate } from '../src/registry';
import { engine, MAX_N } from '../src/engines/array';
import { SHAPES } from '../src/engines/array/trace';
import type { ArrayKernel } from '../src/engines/array/trace';
import { sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';
import { rebuild as gateRebuild, widest } from './support/budget';
import { installBrowserStubs } from './support/p5-stub';

const OUT = process.env.ALGOGLYPH_MAX_N;
const WRITE = process.env.ALGOGLYPH_MAX_N_WRITE === '1';
const ONLY = process.env.ALGOGLYPH_MAX_N_ONLY ? new Set(process.env.ALGOGLYPH_MAX_N_ONLY.split(',')) : undefined;

/**
 * The option settings a kernel is measured at: its defaults, every option at its maximum, then
 * each option in turn at its minimum (the corners test/support/budget.ts derives from controls).
 * One empty setting for a kernel without options.
 */
export function optionCorners(kernel: Pick<ArrayKernel, 'options'>): Record<string, number>[] {
  const o = kernel.options ?? [];
  if (!o.length) return [{}];
  const top = Object.fromEntries(o.map((x) => [x.name, x.max]));
  return [Object.fromEntries(o.map((x) => [x.name, x.default])), top, ...o.map((x) => ({ ...top, [x.name]: x.min }))];
}
const SIDECAR = 'catalogue/sorting-sidecar.yaml';
const MANIFEST = 'crates/algoglyph-kernels/src/sorting/kernels.json';

/**
 * The sidecar text with each listed record's max_n and max_n_of set from `bounds` (keyed by
 * kernel), and removed from every other record of `kernels`: a line edit after the record's
 * `kernel:` line, so the authored file keeps its comments and order.
 */
export function withMaxN(text: string, kernels: Set<string>, bounds: Record<string, { max_n: number; source: string }>): string {
  const lines = text.split('\n');
  const out: string[] = [];
  // the kernel of the record being read: a record of a kernel not measured keeps its bound
  let current: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^ {2}- /.test(line)) current = undefined;
    if (/^ {4}max_n(_of)?: /.test(line) && current !== undefined && kernels.has(current)) continue;
    out.push(line);
    const m = /^ {4}kernel: "?([a-z0-9-]+)"?\s*$/.exec(line);
    if (m) current = m[1];
    if (m && kernels.has(m[1]) && bounds[m[1]]) {
      out.push(`    max_n: ${bounds[m[1]].max_n}`, `    max_n_of: "${bounds[m[1]].source}"`);
    }
  }
  return out.join('\n');
}
// the measurement's budget has one source, config/budgets.yaml; the environment overrides it for
// one run only
const BUDGET_MS = Number(process.env.ALGOGLYPH_MAX_N_MS
  ?? (parse(readFileSync('config/budgets.yaml', 'utf8')) as { max_n_budget_ms: number }).max_n_budget_ms);
const GRID = [64, 128, 192, 256, 320, 384, 448, 512];
const STEP = 8;

const cpuMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };

/** The fixed workload of test/budget/ (referenceCpuMs), best of five: the machine's speed. */
function referenceCpuMs(): number {
  const n = 192;
  const a = new Float64Array(n * n).map((_, i) => Math.sin(i));
  const b = new Float64Array(n * n);
  let best = Infinity;
  for (let r = 0; r < 5; r++) {
    const t = cpuMs();
    for (let it = 0; it < 12; it++) {
      for (let y = 1; y < n - 1; y++) {
        for (let x = 1; x < n - 1; x++) {
          const i = y * n + x;
          b[i] = 0.2 * (a[i - 1] + a[i + 1] + a[i - n] + a[i + n]) + 0.2 * Math.cos(a[i]);
        }
      }
      a.set(b);
    }
    best = Math.min(best, cpuMs() - t);
  }
  return best;
}

/**
 * The largest n (a multiple of STEP) whose cost stays within budget × margin, by power-law
 * interpolation; undefined when every point fits. The margin is load the gate's machine may add
 * on top of the measured cost (config/budgets.yaml, max_n_margin).
 */
export function derivedMaxN(points: [number, number][], budget: number, margin: number): number | undefined {
  const limit = budget * margin;
  if (points.every(([, ms]) => ms <= limit)) return undefined;
  const k = points.findIndex(([, ms]) => ms > limit);
  if (k === 0) return Math.max(STEP, Math.floor((points[0][0] * limit) / points[0][1] / STEP) * STEP);
  const [[n0, c0], [n1, c1]] = [points[k - 1], points[k]];
  const slope = Math.log(c1 / c0) / Math.log(n1 / n0);
  const n = slope > 0 ? n0 * (limit / c0) ** (1 / slope) : n0;
  return Math.max(STEP, Math.floor(Math.min(n, n1) / STEP) * STEP);
}

/**
 * The bound settled on measured costs from the estimate `start`: the largest n (a multiple of
 * STEP) whose cost is within `limit` while n + STEP's is not, walking down then up one step at a
 * time; undefined when the cost is within it up to `top`, the plate's largest n. Each n is
 * measured once.
 */
export function settledMaxN(start: number, cost: (n: number) => number, limit: number, top: number): number | undefined {
  const seen = new Map<number, number>();
  const at = (n: number) => {
    if (!seen.has(n)) seen.set(n, cost(n));
    return seen.get(n)!;
  };
  let n = Math.max(STEP, Math.min(top, Math.floor(start / STEP) * STEP));
  while (n > STEP && at(n) > limit) n -= STEP;
  while (n < top && at(n + STEP) <= limit) n += STEP;
  return n >= top && at(top) <= limit ? undefined : n;
}

installBrowserStubs();

type Budgets = { reference_cpu_ms: number; max_n_margin: number };
type SidecarRecord = { id: string; kernel: string; existing?: boolean; max_n?: number };

/** The sidecar's records the array engine plays (those of ALGOGLYPH_MAX_N_ONLY, when given). */
function playedRecords(): SidecarRecord[] {
  return (parse(readFileSync(SIDECAR, 'utf8')) as { entries: SidecarRecord[] }).entries
    .filter((r) => !r.existing && ENTRIES.find((e) => e.id === r.id)?.engine === 'array'
      && (!ONLY || ONLY.has(r.kernel)));
}

/**
 * One rebuild's cost at n in reference milliseconds: the plate built at n, set up and drawn once
 * at 1440 px, the worst over input shapes and option corners of the best of three runs.
 */
async function rebuildCost(id: string, factor: number): Promise<(n: number) => number> {
  // measured unbounded: the bound is what is being derived or checked
  const { maxN: _bound, ...kernel } = await sidecarKernel(id);
  // the registered plate's info with the engine's code built on the uncapped kernel
  const code = engine.plate({ id, title: id, group: 'sorting' }, kernel);
  const registered = await loadPlate(id);
  if (!registered) throw new Error(`${id} is not a live plate`);
  const plate: Plate = { ...registered, params: code.params, create: code.create.bind(code) };
  const { repeats } = parse(readFileSync('config/budgets.yaml', 'utf8')) as { repeats: number };
  return (n) => {
    let worst = 0;
    for (const [shape, corner] of SHAPES.flatMap((sh) => optionCorners(kernel).map((c) => [sh, c] as const))) {
      const params: Params = { shape, n, pace: PACING.pace.max, loop: true, palette: 'spectral', ...corner };
      // the budget gate's own reading (test/support/budget.ts), imported so the two cannot drift:
      // the worst frame past the end of a run, where the loop rebuilds inside draw(), at the
      // gate's widest width, the best of the gate's repeats
      let best = Infinity;
      for (let rep = 0; rep < repeats; rep++) best = Math.min(best, gateRebuild(plate, params, widest).frame);
      worst = Math.max(worst, best);
    }
    return worst / factor;
  };
}

const round = (ms: number) => Number(ms.toFixed(1));

describe.runIf(Boolean(OUT))('sorting rebuild cost per n', () => {
  const budgets = parse(readFileSync('config/budgets.yaml', 'utf8')) as Budgets;
  const limit = BUDGET_MS * budgets.max_n_margin;
  const factorNow = () => Math.max(1, referenceCpuMs() / budgets.reference_cpu_ms);

  it('measures every wasm-played sorting kernel and writes the derived max_n', async () => {
    const records = playedRecords();
    const out: Record<string, { max_n: number; ms_at_512: number; factor: number; ms: Record<number, number> }> = {};
    for (const r of records) {
      // calibrated before each kernel, as the budget gate does before each check: load that comes
      // and goes during the run is followed, not frozen at its start
      const factor = factorNow();
      const measure = await rebuildCost(r.id, factor);
      const ms: Record<number, number> = {};
      const cost = (n: number) => (ms[n] ??= measure(n));
      const points: [number, number][] = GRID.map((n) => [n, cost(n)]);
      const estimate = derivedMaxN(points, BUDGET_MS, budgets.max_n_margin);
      const max = estimate === undefined ? undefined : settledMaxN(estimate, cost, limit, MAX_N);
      if (max !== undefined) {
        out[r.kernel] = {
          max_n: max, ms_at_512: round(points.at(-1)![1]), factor: Number(factor.toFixed(2)),
          ms: Object.fromEntries(Object.entries(ms).map(([n, v]) => [n, round(v)])),
        };
      }
    }
    writeFileSync(OUT!, `${JSON.stringify({ budget_ms: BUDGET_MS, margin: budgets.max_n_margin, kernels: out }, null, 2)}\n`);
    if (WRITE) {
      const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { kernels: { id: string; source: string }[] };
      const source = new Map(manifest.kernels.map((k) => [k.id, k.source]));
      const bounds = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { max_n: v.max_n, source: source.get(k)! }]));
      writeFileSync(SIDECAR, withMaxN(readFileSync(SIDECAR, 'utf8'), new Set(records.map((r) => r.kernel)), bounds));
    }
    expect(Object.keys(out).every((k) => out[k].max_n >= STEP)).toBe(true);
  }, 3_600_000);

  it('reports every recorded max_n against budget × margin, and n + 8 beside it', async () => {
    // A second measurement of the sidecar as it now stands, reported and never asserted: one n
    // measured twice minutes apart differs by ±10–15 % on a loaded machine while a step of 8 moves
    // the cost by about 4 %, so neither half can be held honestly here. What gates a bound is the
    // deterministic decision test below ('max n margin'); this is the reading beside it.
    const checked: Record<string, { max_n: number; factor: number; ms: number; ms_next?: number; note: string }> = {};
    for (const r of playedRecords().filter((x) => x.max_n !== undefined)) {
      const factor = factorNow();
      const cost = await rebuildCost(r.id, factor);
      const n = r.max_n!;
      const ms = round(cost(n));
      const msNext = n + STEP <= MAX_N ? round(cost(n + STEP)) : undefined;
      const notes = [
        ms > limit ? `${ms} ms at max_n is over ${round(limit)}` : '',
        msNext !== undefined && msNext <= limit ? `${msNext} ms at ${n + STEP} is still within ${round(limit)}` : '',
      ].filter(Boolean);
      checked[r.kernel] = {
        max_n: n, factor: Number(factor.toFixed(2)), ms, ms_next: msNext,
        note: notes.length ? `${notes.join('; ')} (within the ±10–15 % repeat noise of a loaded machine)` : 'as derived',
      };
    }
    const report = JSON.parse(readFileSync(OUT!, 'utf8')) as Record<string, unknown>;
    writeFileSync(OUT!, `${JSON.stringify({ ...report, checked }, null, 2)}\n`);
    console.log(Object.entries(checked).map(([k, c]) => `${k}: max_n ${c.max_n} ${c.ms} ms, n+8 ${c.ms_next ?? '-'} ms — ${c.note}`).join('\n'));
    expect(Object.keys(checked).length).toBeGreaterThan(0);
  }, 3_600_000);
});

describe('derived max_n', () => {
  it('is written after the record\'s kernel line, and removed where no bound is needed', () => {
    const text = '  - id: "a"\n    kernel: "ka"\n    max_n: 64\n    max_n_of: "x"\n    year: 1\n  - id: "b"\n    kernel: "kb"\n';
    expect(withMaxN(text, new Set(['ka', 'kb']), { kb: { max_n: 312, source: 'f00' } }))
      .toBe('  - id: "a"\n    kernel: "ka"\n    year: 1\n  - id: "b"\n    kernel: "kb"\n    max_n: 312\n    max_n_of: "f00"\n');
    // a record whose kernel was not measured (ALGOGLYPH_MAX_N_ONLY) keeps its bound
    expect(withMaxN(text, new Set(['kb']), { kb: { max_n: 312, source: 'f00' } }))
      .toBe('  - id: "a"\n    kernel: "ka"\n    max_n: 64\n    max_n_of: "x"\n    year: 1\n  - id: "b"\n    kernel: "kb"\n    max_n: 312\n    max_n_of: "f00"\n');
  });

  it("is measured at a kernel's defaults and at every corner of its options", () => {
    expect(optionCorners({})).toEqual([{}]);
    const o = (name: string, min: number, max: number, d: number) => ({ name, label: name, min, max, step: 1, default: d });
    expect(optionCorners({ options: [o('k', 2, 16, 4), o('memory', 0, 64, 0)] })).toEqual([
      { k: 4, memory: 0 }, { k: 16, memory: 64 }, { k: 2, memory: 64 }, { k: 16, memory: 0 },
    ]);
  });

  it('is the largest step of n within the budget, interpolated on a power law', () => {
    expect(derivedMaxN([[64, 1], [512, 10]], 17, 1)).toBeUndefined();
    // quadratic: 4 ms at 256, 16 at 512, budget 8 -> n = 256 * sqrt(2) = 362 -> 360
    expect(derivedMaxN([[256, 4], [512, 16]], 8, 1)).toBe(360);
    expect(derivedMaxN([[64, 40], [128, 160]], 17, 1)).toBe(24);
  });
});

describe('max_n margin', () => {
  const { max_n_margin: margin } = parse(readFileSync('config/budgets.yaml', 'utf8')) as { max_n_margin?: number };
  // spaghetti-sort's rebuild per n, shaped on the gate's failure at its zero-margin bound: 26.2 ms
  // at n 448 against a budget of 26.0
  const spaghetti: [number, number][] = [
    [64, 0.6], [128, 2.2], [192, 4.9], [256, 8.6], [320, 13.4], [384, 19.3], [448, 26.2], [512, 34.2],
  ];
  const powerLaw = (points: [number, number][], n: number) => {
    const k = points.findIndex(([m]) => m >= n);
    const [[n0, c0], [n1, c1]] = [points[k - 1], points[k]];
    return c0 * (n / n0) ** (Math.log(c1 / c0) / Math.log(n1 / n0));
  };

  it('measures against max_n_budget_ms of config/budgets.yaml, the one source of that number', () => {
    const { max_n_budget_ms: budget } = parse(readFileSync('config/budgets.yaml', 'utf8')) as { max_n_budget_ms?: number };
    expect(typeof budget).toBe('number');
    expect(budget).toBeGreaterThan(0);
    if (process.env.ALGOGLYPH_MAX_N_MS === undefined) expect(BUDGET_MS).toBe(budget);
  });

  it('is declared in config/budgets.yaml, a fraction of the budget below 1', () => {
    expect(typeof margin).toBe('number');
    expect(margin).toBeGreaterThan(0);
    expect(margin).toBeLessThan(1);
  });

  it('keeps the derived n within budget × margin, never at the budget itself', () => {
    const n = derivedMaxN(spaghetti, 26.0, margin!)!;
    expect(n).toBeLessThan(448);
    expect(powerLaw(spaghetti, n)).toBeLessThanOrEqual(26.0 * margin!);
    // the largest such step: the next one is over budget × margin
    expect(powerLaw(spaghetti, n + STEP)).toBeGreaterThan(26.0 * margin!);
    // at margin 1 the bound is where the gate failed: within 26.0 by the curve, not by the machine
    expect(derivedMaxN(spaghetti, 26.0, 1)).toBe(440);
    // a cost that fits the budget but not its margin is a bound, not a pass
    expect(derivedMaxN([[256, 8], [512, 25]], 26.0, 1)).toBeUndefined();
    expect(derivedMaxN([[256, 8], [512, 25]], 26.0, margin!)).toBeLessThan(512);
  });

  it('settles on measured costs: within budget × margin at max_n, over it at max_n + 8', () => {
    // a measured cost per n where the interpolated start is off by a step either way
    const table = new Map([[400, 20.1], [408, 20.8], [416, 21.5], [424, 22.4], [432, 23.6], [440, 24.3], [448, 26.2]]);
    const cost = (n: number) => table.get(n)!;
    const limit = 26.0 * margin!;
    for (const start of [408, 416, 424, 432, 440, 448]) {
      const n = settledMaxN(start, cost, limit, 512)!;
      expect(cost(n)).toBeLessThanOrEqual(limit);
      expect(cost(n + STEP)).toBeGreaterThan(limit);
    }
    // 26.2 at 448 is never kept against 26.0, at any margin up to 1
    expect(settledMaxN(448, cost, 26.0, 512)).toBe(440);
    // within the limit up to the plate's top: no bound
    expect(settledMaxN(496, () => 1, limit, 512)).toBeUndefined();
    // over it already at the smallest step: the smallest step
    expect(settledMaxN(16, () => 99, limit, 512)).toBe(STEP);
  });
});
