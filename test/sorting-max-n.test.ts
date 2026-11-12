// Measures, for every wasm sorting kernel the array engine may play, what one rebuild costs at
// each n (one full trace on the main thread, the worst input shape, best of three) and derives
// the largest n whose rebuild stays within a budget: the `max_n` the sidecar will carry once the
// array engine accepts ArrayKernel.maxN. A measurement, not a gate: it runs only when asked,
//
//   ALGOGLYPH_MAX_N=<out.json> [ALGOGLYPH_MAX_N_MS=17] npx vitest run test/sorting-max-n.test.ts
//
// and writes { kernel: { max_n, ms_at_512 } } for the kernels that need a bound. Times are CPU
// time scaled to the reference machine of config/budgets.yaml, the way test/budget.test.ts
// scales its budgets, so the derived bounds do not depend on the machine that measured them.
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ENTRIES } from '../src/core/catalogue';
import { input, SHAPES, trace } from '../src/engines/array/trace';
import { sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';

const OUT = process.env.ALGOGLYPH_MAX_N;
const BUDGET_MS = Number(process.env.ALGOGLYPH_MAX_N_MS ?? 17);
const GRID = [64, 128, 192, 256, 320, 384, 448, 512];
const STEP = 8;

const cpuMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };

/** The fixed workload of test/budget.test.ts (referenceCpuMs), best of five: the machine's speed. */
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

/** The largest n (a multiple of STEP) whose cost stays within the budget, by power-law interpolation. */
export function derivedMaxN(points: [number, number][], budget: number): number | undefined {
  if (points.every(([, ms]) => ms <= budget)) return undefined;
  const k = points.findIndex(([, ms]) => ms > budget);
  if (k === 0) return Math.max(STEP, Math.floor((points[0][0] * budget) / points[0][1] / STEP) * STEP);
  const [[n0, c0], [n1, c1]] = [points[k - 1], points[k]];
  const slope = Math.log(c1 / c0) / Math.log(n1 / n0);
  const n = slope > 0 ? n0 * (budget / c0) ** (1 / slope) : n0;
  return Math.max(STEP, Math.floor(Math.min(n, n1) / STEP) * STEP);
}

describe.runIf(Boolean(OUT))('sorting rebuild cost per n', () => {
  it('measures every wasm-played sorting kernel and writes the derived max_n', async () => {
    const budgets = parse(readFileSync('config/budgets.yaml', 'utf8')) as { reference_cpu_ms: number };
    const factor = Math.max(1, referenceCpuMs() / budgets.reference_cpu_ms);
    const records = (parse(readFileSync('catalogue/sorting-sidecar.yaml', 'utf8')) as {
      entries: { id: string; kernel: string; existing?: boolean }[];
    }).entries.filter((r) => !r.existing && ENTRIES.find((e) => e.id === r.id)?.engine === 'array');
    const out: Record<string, { max_n: number; ms_at_512: number }> = {};
    for (const r of records) {
      const kernel = await sidecarKernel(r.id);
      const points: [number, number][] = GRID.map((n) => {
        let worst = 0;
        for (const shape of SHAPES) {
          const data = input(shape, n, 4242 + n);
          let best = Infinity;
          for (let rep = 0; rep < 3; rep++) {
            const t = cpuMs();
            trace(kernel, data);
            best = Math.min(best, cpuMs() - t);
          }
          worst = Math.max(worst, best);
        }
        return [n, worst / factor];
      });
      const max = derivedMaxN(points, BUDGET_MS);
      if (max !== undefined) out[r.kernel] = { max_n: max, ms_at_512: Number(points.at(-1)![1].toFixed(1)) };
    }
    writeFileSync(OUT!, `${JSON.stringify({ budget_ms: BUDGET_MS, factor, kernels: out }, null, 2)}\n`);
    expect(Object.keys(out).every((k) => out[k].max_n >= STEP)).toBe(true);
  }, 3_600_000);
});

describe('derived max_n', () => {
  it('is the largest step of n within the budget, interpolated on a power law', () => {
    expect(derivedMaxN([[64, 1], [512, 10]], 17)).toBeUndefined();
    // quadratic: 4 ms at 256, 16 at 512, budget 8 -> n = 256 * sqrt(2) = 362 -> 360
    expect(derivedMaxN([[256, 4], [512, 16]], 8)).toBe(360);
    expect(derivedMaxN([[64, 40], [128, 160]], 17)).toBe(24);
  });
});
