import { paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { mulberry32, shuffle } from '../../core/random';
import { ALGORITHMS, isSorted, type Counter, type Touch } from './algorithms';
import { HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';

interface Row {
  a: number[];
  gen: Generator<Touch, void, unknown>;
  c: Counter;
  done: boolean;
  touch: Touch | null;
}

export const sortTapestry: PlateCode = {
  id: 'sort-tapestry',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 11,
  params: [
    {
      kind: 'select', key: 'algorithm', label: 'Algorithm', value: 'quick', rebuild: true,
      options: Object.entries(ALGORITHMS).map(([value, a]) => ({ value, label: a.label })),
    },
    { kind: 'range', key: 'rows', label: 'Rows', min: 4, max: 72, step: 1, value: 36, rebuild: true },
    { kind: 'range', key: 'n', label: 'Values per row', min: 16, max: 192, step: 8, value: 96,
      rebuild: true },
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'Reshuffle when sorted', value: true },
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'operations' },
  create(p, ctx) {
    const params = ctx.params;
    let rows: Row[] = [];
    let hold = 0;
    let generation = 0;
    const pacer = new Pacer('replay', 'operations', 400);

    const build = () => {
      const rnd = mulberry32(ctx.seed + generation * 7919);
      const algo = ALGORITHMS[str(params, 'algorithm')] ?? ALGORITHMS.quick;
      const n = num(params, 'n');
      rows = Array.from({ length: num(params, 'rows') }, () => {
        const a = shuffle(Array.from({ length: n }, (_, i) => i), rnd);
        const c: Counter = { cmp: 0, wr: 0 };
        return { a, c, gen: algo.run(a, c), done: false, touch: null };
      });
      hold = 0;
      // every row advances alike and sorts a shuffle of the same keys with the same algorithm:
      // the run's length is the first row's, counted on a copy (one sort, never one per row)
      if (rows.length) {
        const gen = algo.run(rows[0].a.slice(), { cmp: 0, wr: 0 });
        let k = 0;
        while (!gen.next().done) k++;
        pacer.start(k);
      } else pacer.start(0);
    };

    return {
      pace: () => pacer.report(rows.every((row) => row.done), params),
      setup() {
        p.noStroke();
        build();
      },
      draw() {
        // a thumbnail is drawn from a few frames: it advances as fast as the old default did
        const speed = ctx.thumbnail ? 24 : rows.some((row) => !row.done) ? pacer.take(params) : 0;
        let running = 0;
        for (const row of rows) {
          if (row.done) continue;
          for (let k = 0; k < speed; k++) {
            const r = row.gen.next();
            if (r.done) {
              row.done = true;
              row.touch = null;
              break;
            }
            row.touch = r.value;
          }
          if (!row.done) running++;
        }
        if (running === 0) {
          hold++;
          if (bool(params, 'loop') && hold > HOLD_FRAMES && !ctx.thumbnail) {
            generation++;
            build();
          }
        }

        const pal = ctx.palette();
        p.background(...ctx.bg);
        const n = rows[0]?.a.length ?? 1;
        const cw = p.width / n;
        const rh = p.height / rows.length;
        const gap = rh > 7 ? 1.5 : 0;
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          const y = r * rh;
          for (let k = 0; k < n; k++) {
            p.fill(...ramp(pal, row.a[k] / (n - 1)));
            p.rect(k * cw, y, cw + 0.6, rh - gap);
          }
          if (row.touch) {
            p.fill(...ctx.fg);
            for (const k of row.touch) p.rect(k * cw, y + rh - gap - 2, cw + 0.6, 2);
          }
        }

        const total = rows.reduce((s, row) => ({ cmp: s.cmp + row.c.cmp, wr: s.wr + row.c.wr }),
          { cmp: 0, wr: 0 });
        const sorted = rows.filter((row) => row.done && isSorted(row.a)).length;
        ctx.stats([
          { label: 'algorithm', value: ALGORITHMS[str(params, 'algorithm')]?.label ?? '?' },
          { label: 'comparisons / row', value: Math.round(total.cmp / rows.length).toLocaleString('en') },
          { label: 'writes / row', value: Math.round(total.wr / rows.length).toLocaleString('en') },
          { label: 'rows sorted', value: `${sorted} / ${rows.length}` },
          pacer.row(params),
        ]);
      },
    };
  },
};

export default sortTapestry;
