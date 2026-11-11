import { mix, paletteParam, ramp } from '../../core/palette';
import { num, type PlateCode } from '../../core/plate';
import { arrive, tick, traffic, type Traffic } from './ring';

export const circularQueue: PlateCode = {
  id: 'circular-queue',
  mode: '2d',
  aspect: 1,
  thumbnailFrames: 90,
  params: [
    { kind: 'range', key: 'capacity', label: 'Slots in the ring', min: 2, max: 48, step: 1, value: 16,
      rebuild: true },
    { kind: 'range', key: 'arrive', label: 'Arrival chance per tick', min: 0, max: 1, step: 0.01,
      value: 0.52 },
    { kind: 'range', key: 'serve', label: 'Service chance per tick', min: 0, max: 1, step: 0.01,
      value: 0.48 },
    { kind: 'range', key: 'speed', label: 'Ticks per frame', min: 0.05, max: 4, step: 0.05,
      value: 0.25 },
    paletteParam('riso'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let t: Traffic;
    let acc = 0;
    const history: [number, number][] = [];

    const record = () => {
      history.push([t.ticks, t.queue.size]);
      if (history.length > 600) history.shift();
    };
    const step = () => {
      tick(t, ctx.rnd, num(params, 'arrive'), num(params, 'serve'));
      record();
    };

    return {
      setup() {
        t = traffic(num(params, 'capacity'));
        if (ctx.thumbnail) for (let k = 0; k < 60; k++) step();
      },
      draw() {
        acc += ctx.thumbnail ? 0 : num(params, 'speed');
        while (acc >= 1) {
          step();
          acc -= 1;
        }
        const pal = ctx.palette();
        const q = t.queue;
        const cap = q.capacity;
        const cx = ctx.width / 2;
        const cy = ctx.height / 2;
        const R = Math.min(ctx.width, ctx.height) * 0.36;
        const thick = Math.min(R * 0.42, (2 * Math.PI * R) / cap * 0.8);
        const gap = Math.min(0.08, 0.3 / cap) * 2 * Math.PI;
        const arc = (2 * Math.PI) / cap;
        const ang = (i: number) => -Math.PI / 2 + i * arc;
        p.background(...ctx.bg);
        p.noFill();
        p.strokeCap(p.SQUARE);
        p.strokeWeight(thick);
        for (let i = 0; i < cap; i++) {
          const v = q.slots[i];
          p.stroke(...(v < 0 ? mix(ctx.bg, ctx.fg, 0.12) : ramp(pal, (v * 0.137) % 1, true)));
          p.arc(cx, cy, 2 * R, 2 * R, ang(i) + gap / 2, ang(i + 1) - gap / 2);
        }
        // head (read) and tail (write) hands
        const hand = (i: number, r0: number, r1: number, weight: number) => {
          const a = ang(i) + arc / 2;
          p.strokeWeight(weight);
          p.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        };
        p.strokeCap(p.ROUND);
        p.stroke(...ctx.fg);
        hand(q.head, R - thick * 0.5 - R * 0.05, R * 0.42, Math.max(2, R * 0.03));
        p.stroke(...mix(ctx.fg, ctx.bg, 0.45));
        hand(q.tail, R + thick * 0.5 + R * 0.04, R + thick * 0.5 + R * 0.2, Math.max(2, R * 0.03));
        p.noStroke();
        p.fill(...ctx.fg);
        p.textFont('monospace');
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(Math.max(10, R * 0.09));
        p.text(`${q.size} / ${cap}`, cx, cy);
        p.textSize(Math.max(9, R * 0.05));
        p.fill(...mix(ctx.fg, ctx.bg, 0.35));
        p.textAlign(p.CENTER, p.BOTTOM);
        p.text('inner hand: head (read) · outer hand: tail (write)', cx, ctx.height - 6);

        ctx.stats([
          { label: 'In the queue', value: `${q.size} of ${cap}` },
          { label: 'Enqueued', value: t.enqueued.toLocaleString('en') },
          { label: 'Dequeued', value: t.dequeued.toLocaleString('en') },
          { label: 'Refused (ring full)', value: t.rejected.toLocaleString('en') },
          { label: 'Polls on an empty ring', value: t.idle.toLocaleString('en') },
          { label: 'Laps of the tail', value: t.wraps.toLocaleString('en') },
        ]);
        if (history.length > 1) {
          ctx.chart({
            title: 'Occupancy of the ring',
            x: { label: 'tick' },
            y: { label: 'items queued' },
            series: [{ name: 'Items queued', points: history.slice() }],
          });
        }
      },
      pressed() {
        arrive(t);
        record();
      },
    };
  },
};

export default circularQueue;
