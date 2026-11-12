import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { recursive, ruler, type Mark, type Order } from './ruler';
import { HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';

export const rulerDrawing: PlateCode = {
  id: 'ruler-drawing',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 60,
  params: [
    { kind: 'range', key: 'n', label: 'Height of the longest mark', min: 2, max: 10, step: 1, value: 6,
      rebuild: true },
    {
      kind: 'select', key: 'order', label: 'Drawing order', value: 'inorder', rebuild: true,
      options: [
        { value: 'inorder', label: 'Recursive: left half, mark, right half' },
        { value: 'preorder', label: 'Recursive: mark, then both halves' },
        { value: 'bottom-up', label: 'Bottom-up: all short marks first' },
      ],
    },
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'Start again when done', value: true },
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'marks' },
  create(p, ctx) {
    const params = ctx.params;
    let n = 6;
    let gen: Generator<Mark, number>;
    let order: Order = 'inorder';
    /** Total calls, known once the generator has finished. */
    let totalCalls = -1;
    let marks: Mark[] = [];
    let acc = 0;
    let hold = 0;
    let maxDepth = 0;
    const pacer = new Pacer('replay', 'marks', 8);

    const build = () => {
      n = num(params, 'n');
      order = str(params, 'order') as Order;
      gen = ruler(n, order);
      totalCalls = -1;
      marks = [];
      acc = 0;
      hold = 0;
      maxDepth = 0;
      pacer.start(2 ** n - 1);
    };
    const next = (): boolean => {
      const r = gen.next();
      if (r.done) {
        // a finished generator answers later calls with undefined: keep the first answer
        if (totalCalls < 0) totalCalls = r.value ?? 0;
        return false;
      }
      marks.push(r.value);
      maxDepth = Math.max(maxDepth, r.value.depth);
      return true;
    };

    return {
      pace: () => pacer.report(marks.length === 2 ** n - 1, params),
      setup() {
        build();
        if (ctx.thumbnail) while (next());
      },
      draw() {
        const total = 2 ** n - 1;
        if (!ctx.thumbnail) {
          acc += pacer.perFrame(params);
          while (acc >= 1) {
            acc -= 1;
            if (!next()) break;
          }
          if (marks.length === total && ++hold > HOLD_FRAMES && bool(params, 'loop')) build();
        }
        const pal = ctx.palette();
        const pad = Math.max(14, ctx.width * 0.04);
        const w = ctx.width - 2 * pad;
        const base = ctx.height - pad * 1.6;
        const tickMax = (ctx.height - pad * 3) * 0.42;
        const treeTop = pad;
        const treeBottom = base - tickMax - pad * 0.8;
        const X = (x: number) => pad + (x / 2 ** n) * w;
        const level = (h: number) => treeTop + ((n - h) / Math.max(1, n - 1)) * (treeBottom - treeTop);
        p.background(...ctx.bg);

        // the call tree: each mark is the middle of its interval, its children the halves' middles
        const made = new Set(marks.map((m) => m.x));
        p.strokeWeight(1);
        for (const m of marks) {
          if (m.h <= 1) continue;
          const half = 2 ** (m.h - 2);
          for (const cxp of [m.x - half, m.x + half]) {
            if (!made.has(cxp)) continue;
            p.stroke(...mix(ctx.bg, ctx.fg, 0.3));
            p.line(X(m.x), level(m.h), X(cxp), level(m.h - 1));
          }
        }
        p.noStroke();
        const r = Math.max(2.5, Math.min(8, w / 2 ** n * 0.6));
        for (const m of marks) {
          p.fill(...ramp(pal, (m.h - 1) / Math.max(1, n - 1)));
          p.circle(X(m.x), level(m.h), r * 2);
        }

        // the ruler itself
        p.stroke(...ctx.fg);
        p.strokeWeight(1.5);
        p.line(X(0), base, X(2 ** n), base);
        p.strokeCap(p.SQUARE);
        p.strokeWeight(Math.max(1, Math.min(4, w / 2 ** n * 0.5)));
        for (const m of marks) {
          p.stroke(...ramp(pal, (m.h - 1) / Math.max(1, n - 1)));
          p.line(X(m.x), base, X(m.x), base - (m.h / n) * tickMax);
        }
        const last = marks[marks.length - 1];
        if (last && marks.length < total) {
          p.stroke(...ctx.fg);
          p.strokeWeight(2);
          p.noFill();
          p.circle(X(last.x), level(last.h), r * 3.2);
        }
        p.strokeCap(p.ROUND);

        if (recursive(order)) {
          ctx.stats([
            { label: 'Marks drawn', value: `${marks.length} of ${total}` },
            totalCalls >= 0
              ? { label: 'Calls made in all', value: totalCalls.toLocaleString('en') }
              : { label: 'Calls made so far', value: last ? last.calls.toLocaleString('en') : '0' },
            { label: 'Recursion depth now', value: last ? String(last.depth) : '–' },
            { label: 'Deepest recursion seen', value: String(maxDepth) },
            pacer.row(params),
          ]);
        } else {
          // the bottom-up version makes no calls and keeps no stack: one pass per height
          ctx.stats([
            { label: 'Marks drawn', value: `${marks.length} of ${total}` },
            { label: 'Height being drawn', value: last ? `${last.h} of ${n}` : '–' },
            pacer.row(params),
          ]);
        }
      },
    };
  },
};

export default rulerDrawing;
