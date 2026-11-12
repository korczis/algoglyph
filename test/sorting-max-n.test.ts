// Measures, for every wasm sorting kernel the array engine may play, what one rebuild costs at
// each n (one full trace on the main thread, the worst input shape, best of three) and derives
// the largest n whose rebuild stays within a budget: the `max_n` the sidecar will carry once the
// array engine accepts ArrayKernel.maxN. A measurement, not a gate: it runs only when asked,
//
//   ALGOGLYPH_MAX_N=<out.json> [ALGOGLYPH_MAX_N_MS=17] [ALGOGLYPH_MAX_N_WRITE=1] \
//     npx vitest run test/sorting-max-n.test.ts
//
// and writes { kernel: { max_n, ms_at_512 } } for the kernels that need a bound. Times are CPU
// time scaled to the reference machine of config/budgets.yaml, the way test/budget.test.ts
// scales its budgets, so the derived bounds do not depend on the machine that measured them.
// With ALGOGLYPH_MAX_N_WRITE=1 it also writes them into catalogue/sorting-sidecar.yaml: each
// record's max_n, with max_n_of, the kernel's source hash from its manifest, which the catalogue
// gate compares, so a kernel changed after its measurement is refused until it is re-measured.
// A kernel that needs no bound loses both keys.
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ENTRIES } from '../src/core/catalogue';
import { input, SHAPES, trace } from '../src/engines/array/trace';
import { sidecarKernel } from '../src/kernels/sorting-wasm/_adapter';

const OUT = process.env.ALGOGLYPH_MAX_N;
const WRITE = process.env.ALGOGLYPH_MAX_N_WRITE === '1';
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
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^ {4}max_n(_of)?: /.test(line)) continue;
    out.push(line);
    const m = /^ {4}kernel: "?([a-z0-9-]+)"?\s*$/.exec(line);
    if (m && kernels.has(m[1]) && bounds[m[1]]) {
      out.push(`    max_n: ${bounds[m[1]].max_n}`, `    max_n_of: "${bounds[m[1]].source}"`);
    }
  }
  return out.join('\n');
}
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
    if (WRITE) {
      const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { kernels: { id: string; source: string }[] };
      const source = new Map(manifest.kernels.map((k) => [k.id, k.source]));
      const bounds = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { max_n: v.max_n, source: source.get(k)! }]));
      writeFileSync(SIDECAR, withMaxN(readFileSync(SIDECAR, 'utf8'), new Set(records.map((r) => r.kernel)), bounds));
    }
    expect(Object.keys(out).every((k) => out[k].max_n >= STEP)).toBe(true);
  }, 3_600_000);
});

describe('derived max_n', () => {
  it('is written after the record\'s kernel line, and removed where no bound is needed', () => {
    const text = '  - id: "a"\n    kernel: "ka"\n    max_n: 64\n    max_n_of: "x"\n    year: 1\n  - id: "b"\n    kernel: "kb"\n';
    expect(withMaxN(text, new Set(['ka', 'kb']), { kb: { max_n: 312, source: 'f00' } }))
      .toBe('  - id: "a"\n    kernel: "ka"\n    year: 1\n  - id: "b"\n    kernel: "kb"\n    max_n: 312\n    max_n_of: "f00"\n');
  });

  it('is the largest step of n within the budget, interpolated on a power law', () => {
    expect(derivedMaxN([[64, 1], [512, 10]], 17)).toBeUndefined();
    // quadratic: 4 ms at 256, 16 at 512, budget 8 -> n = 256 * sqrt(2) = 362 -> 360
    expect(derivedMaxN([[256, 4], [512, 16]], 8)).toBe(360);
    expect(derivedMaxN([[64, 40], [128, 160]], 17)).toBe(24);
  });
});
