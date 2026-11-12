// The transitive-support plate counts independent lines of support once, in its report row.
// A readout or chart series labelled as lines must read that same count: an engine count of
// edges (three per line on the defaults) published under a lines label contradicted it.
import type p5 from 'p5';
import { expect, it } from 'vitest';
import { GROUNDS, palette } from '../src/core/palette';
import type { Params, PlateContext } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { engine } from '../src/engines/graph';
import { kernel } from '../src/kernels/graph/transitive-support';

type Row = { label: string; value: string };
type Series = { name: string; points: [number, number][] };

function fakeP5(): p5 {
  return new Proxy({}, {
    get: (_, key) => (typeof key === 'string' && /^[A-Z_]+$/.test(key) ? 0 : () => undefined),
  }) as p5;
}

/** A label whose head noun is lines: it claims to count lines of support. */
const countsLines = (label: string) => /\blines( of support)?$/i.test(label.trim());

it('every readout and series labelled as lines reads the lines count at the defaults', () => {
  const code = engine.plate(
    { id: 'transitive-support', title: 'Transitive support of a conclusion', group: 'inference/belief' },
    kernel,
  );
  const params: Params = {};
  for (const d of code.params) params[d.key] = d.value;
  params.loop = false;
  const ground = GROUNDS.dark;
  let finalRows: Row[] | null = null;
  let series: Series[] = [];
  const ctx: PlateContext = {
    width: 640, height: 360, params, seed: 4242, rnd: mulberry32(4242), theme: 'dark',
    bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => palette(String(params.palette)),
    stats(rows: Row[]) {
      if (!finalRows && rows.some((r) => r.label === 'Independent lines of support')) finalRows = rows;
    },
    chart(c: { series: Series[] }) { series = c.series; },
  } as unknown as PlateContext;
  const sim = code.create(fakeP5(), ctx);
  sim.setup();
  for (let f = 0; f < 20_000 && !finalRows; f++) sim.draw();
  // one more chart rebuild after the run has finished
  for (let f = 0; f < 40; f++) sim.draw();
  expect(finalRows, 'the run finished and published its report').not.toBeNull();
  const rows = finalRows as unknown as Row[];
  const lines = Number(rows.find((r) => r.label === 'Independent lines of support')?.value);
  expect(lines).toBeGreaterThan(0);
  for (const r of rows.filter((x) => countsLines(x.label))) {
    expect(Number(r.value.replace(/,/g, '')), `readout "${r.label}"`).toBe(lines);
  }
  expect(series.length).toBeGreaterThan(0);
  for (const s of series.filter((x) => countsLines(x.name))) {
    const last = s.points[s.points.length - 1]?.[1];
    expect(last, `chart series "${s.name}"`).toBe(lines);
  }
});
