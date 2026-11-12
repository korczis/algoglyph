import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { circle, survivor, tick, type Circle } from './josephus';
import { HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';

export const josephusCircle: PlateCode = {
  id: 'josephus-circle',
  mode: '2d',
  aspect: 1,
  thumbnailFrames: 120,
  params: [
    { kind: 'range', key: 'n', label: 'People (N)', min: 2, max: 240, step: 1, value: 41, rebuild: true },
    { kind: 'range', key: 'm', label: 'Every M-th leaves', min: 1, max: 16, step: 1, value: 3,
      rebuild: true },
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'Start again when done', value: true },
    paletteParam('ember'),
  ],
  pace: { kind: 'replay', unit: 'links' },
  create(p, ctx) {
    const params = ctx.params;
    let c: Circle;
    let acc = 0;
    let hold = 0;
    const pacer = new Pacer('replay', 'links', 60);
    /** The links a run walks to its end, counted on a copy of the circle. */
    const links = (n: number, m: number) => {
      const d = circle(n, m);
      let k = 1;
      while (tick(d) !== 'done') k++;
      return k;
    };

    const build = () => {
      c = circle(num(params, 'n'), num(params, 'm'));
      acc = 0;
      pacer.start(links(num(params, 'n'), num(params, 'm')));
      hold = 0;
    };

    return {
      pace: () => pacer.report(c.left <= 1, params),
      setup() {
        build();
        if (ctx.thumbnail) while (tick(c) !== 'done' && c.left > c.n * 0.25);
      },
      draw() {
        if (!ctx.thumbnail) {
          acc += pacer.perFrame(params);
          while (acc >= 1) {
            acc -= 1;
            if (tick(c) === 'done') break;
          }
          if (c.left <= 1 && ++hold > HOLD_FRAMES && bool(params, 'loop')) build();
        }
        const pal = ctx.palette();
        const n = c.n;
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const R = Math.min(ctx.width, ctx.height) * 0.42;
        const pos = (i: number): [number, number] => {
          const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
          return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
        };
        const dot = Math.max(3, Math.min(14, (2 * Math.PI * R) / n * 0.55));
        p.background(...ctx.bg);

        // the order of removal as a chord path, coloured by when each one left
        p.noFill();
        p.strokeWeight(Math.max(1, dot * 0.18));
        for (let k = 1; k < c.order.length; k++) {
          p.stroke(...ramp(pal, k / Math.max(1, n - 1)), 150);
          const [x0, y0] = pos(c.order[k - 1]);
          const [x1, y1] = pos(c.order[k]);
          p.line(x0, y0, x1, y1);
        }
        const rank = new Int32Array(n).fill(-1);
        c.order.forEach((v, k) => (rank[v] = k));
        p.noStroke();
        for (let i = 0; i < n; i++) {
          const [x, y] = pos(i);
          if (c.alive[i]) {
            p.fill(...ctx.fg);
            p.circle(x, y, dot);
          } else {
            p.fill(...mix(ctx.bg, ramp(pal, rank[i] / Math.max(1, n - 1)), 0.75));
            p.circle(x, y, dot * 0.55);
          }
        }
        // the cursor: the person the count stands on
        const done = c.left <= 1;
        const at = done ? survivor(c) : c.next[c.cursor];
        const [hx, hy] = pos(at);
        p.noFill();
        p.stroke(...ramp(pal, 1));
        p.strokeWeight(Math.max(1.5, dot * 0.25));
        p.circle(hx, hy, dot * (done ? 2.6 : 1.8));
        p.noStroke();
        p.fill(...ctx.fg);
        p.textFont('monospace');
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(Math.max(11, R * 0.1));
        p.text(done ? `#${survivor(c) + 1}` : `${c.left}`, cx, cy - R * 0.04);
        p.textSize(Math.max(9, R * 0.05));
        p.fill(...mix(ctx.fg, ctx.bg, 0.35));
        p.text(done ? 'survives' : 'still in the circle', cx, cy + R * 0.1);

        ctx.stats([
          { label: 'Still in the circle', value: String(c.left) },
          { label: 'Removed', value: String(c.order.length) },
          { label: 'Links followed', value: c.links.toLocaleString('en') },
          { label: 'Last removed', value: c.order.length ? `#${c.order[c.order.length - 1] + 1}` : '–' },
          { label: 'Survivor', value: done ? `#${survivor(c) + 1}` : '–' },
          pacer.row(params),
        ]);
      },
    };
  },
};

export default josephusCircle;
