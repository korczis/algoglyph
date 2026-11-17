// The guard against imported helpers in hot loops (scripts/check-hot-loops.mjs): it passes on the
// tree, it catches each pattern it claims to catch, and it leaves alone what it says it leaves.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { findings, scan } from '../../scripts/check-hot-loops.mjs';

const lines = (src: string) => (findings(src) as { helper: string }[]).map((x) => x.helper);

describe('check-hot-loops', () => {
  it('finds no call to fix in src/plates, src/engines or src/kernels', () => {
    const bad = (scan() as { file: string; line: number; helper: string; allow?: string }[]).filter((x) => !x.allow);
    expect(bad.map((x) => `${x.file}:${x.line} ${x.helper}()`)).toEqual([]);
  });

  it('catches an imported flush() in any loop, braced or not', () => {
    const imp = "import { flush } from '../../core/budget';\n";
    expect(lines(`${imp}for (let i = 0; i < n; i++) { u[i] = flush(u[i]); }`)).toEqual(['flush']);
    expect(lines(`${imp}for (let i = 0; i < n; i++) u[i] = flush(u[i]);`)).toEqual(['flush']);
    expect(lines(`${imp}while (k < n) {\n  v = flush(v);\n  k++;\n}`)).toEqual(['flush']);
  });

  it('catches ramp, mix and scale in a loop that writes pixels, through data[] or .set(', () => {
    const imp = "import { mix, ramp, scale } from '../../core/palette';\n";
    expect(lines(`${imp}for (let i = 0; i < n; i++) { const c = ramp(pal, t); data[i * 4] = c[0]; }`)).toEqual(['ramp']);
    expect(lines(`${imp}for (let i = 0; i < n; i++) { const c = scale(mix(a, b, t), 2); raster.set(x, y, c[0], c[1], c[2]); }`)).toEqual(['mix', 'scale']);
  });

  it('leaves alone what it says it misses: draws through p5, names not imported, comments', () => {
    const imp = "import { mix, ramp } from '../../core/palette';\n";
    expect(lines(`${imp}for (const n of nodes) { const c = ramp(pal, n.t); p.fill(c[0], c[1], c[2]); }`)).toEqual([]);
    expect(lines('for (let i = 0; i < n; i++) u[i] = flush(u[i]);')).toEqual([]);
    expect(lines(`${imp}for (let i = 0; i < n; i++) { // mix(a, b) is slow\n data[i] = 0; }`)).toEqual([]);
    expect(lines(`${imp}const into = ramp;\nfor (let i = 0; i < n; i++) { const c = into(pal, t); data[i] = c[0]; }`)).toEqual([]);
  });
});
