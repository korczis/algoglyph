// The picture both sorted-array search plates share: the keys as bars, the interval still in
// play and the probe being made; below, every probe ever made, placed at its key's position and
// its step in the search, joined to the probe after it. For binary search that map is the
// implicit decision tree; for interpolation search it shows how far each guess lands.
import { mix, paletteParam, ramp } from '../../../core/palette';
import { num, str, type PlateCode } from '../../../core/plate';
import { chartGate } from '../publish';
import { ProbeMap } from './probe-map';
import { query, sortedKeys, type Result, type Spread } from './search';

/** Most distinct probe points (and moves) the map holds and draws in a frame. */
export const MAP_LIMIT = 2048;

type Search = (a: ArrayLike<number>, key: number) => Result;

interface Tally {
  searches: number;
  hits: number;
  hitProbes: number;
  missProbes: number;
  most: number;
  total: number;
}

const tally = (): Tally => ({ searches: 0, hits: 0, hitProbes: 0, missProbes: 0, most: 0, total: 0 });

function count(t: Tally, r: Result): void {
  t.searches++;
  t.total += r.probes.length;
  t.most = Math.max(t.most, r.probes.length);
  if (r.index >= 0) {
    t.hits++;
    t.hitProbes += r.probes.length;
  } else t.missProbes += r.probes.length;
}

export interface SearchPlateOptions {
  id: string;
  name: string;
  search: Search;
  /** Run this search on the same queries and chart it beside the plate's own. */
  compare?: { name: string; search: Search };
  spread: Spread;
  palette: string;
}

export function searchPlate(o: SearchPlateOptions): PlateCode {
  return {
    id: o.id,
    mode: '2d',
    aspect: 16 / 10,
    thumbnailFrames: 30,
    params: [
      { kind: 'range', key: 'n', label: 'Keys', min: 8, max: 1024, step: 8, value: 128, rebuild: true },
      {
        kind: 'select', key: 'spread', label: 'Key values', value: o.spread, rebuild: true,
        options: [
          { value: 'uniform', label: 'Spread evenly' },
          { value: 'logarithmic', label: 'Spread on a log scale' },
        ],
      },
      { kind: 'range', key: 'hit', label: 'Share of searches for a present key', min: 0, max: 1,
        step: 0.05, value: 0.75 },
      { kind: 'range', key: 'speed', label: 'Probes per frame', min: 0.05, max: 30, step: 0.05,
        value: 0.25 },
      paletteParam(o.palette),
    ],
    create(p, ctx) {
      const params = ctx.params;
      let keys: number[] = [];
      let present = new Set<number>();
      let current: { key: number; r: Result; shown: number } | null = null;
      let acc = 0;
      let maxDepth = 4;
      const own = tally();
      const other = tally();
      let map = new ProbeMap(1, MAP_LIMIT);
      const gate = chartGate();
      const curve: [number, number][] = [];
      const curveOther: [number, number][] = [];

      const begin = () => {
        const key = query(keys, num(params, 'hit'), ctx.rnd, present);
        current = { key, r: o.search(keys, key), shown: 0 };
      };
      const complete = () => {
        if (!current) return;
        const { r, key } = current;
        count(own, r);
        map.record(r.probes);
        gate.mark();
        maxDepth = Math.max(maxDepth, r.probes.length);
        curve.push([own.searches, own.total / own.searches]);
        if (o.compare) {
          count(other, o.compare.search(keys, key));
          curveOther.push([other.searches, other.total / other.searches]);
        }
        if (curve.length > 800) {
          curve.splice(0, curve.length - 800);
          curveOther.splice(0, Math.max(0, curveOther.length - 800));
        }
        current = null;
      };

      return {
        setup() {
          keys = sortedKeys(num(params, 'n'), str(params, 'spread') as Spread, ctx.rnd);
          present = new Set(keys);
          map = new ProbeMap(keys.length, MAP_LIMIT);
          if (ctx.thumbnail) {
            for (let k = 0; k < 80; k++) {
              begin();
              complete();
            }
          }
          begin();
          if (ctx.thumbnail && current) current.shown = Math.ceil(current.r.probes.length / 2);
        },
        draw() {
          if (!ctx.thumbnail) {
            acc += num(params, 'speed');
            while (acc >= 1) {
              acc -= 1;
              if (!current) begin();
              const c = current!;
              if (c.shown < c.r.probes.length) c.shown++;
              else {
                complete();
                begin();
              }
            }
          }
          const pal = ctx.palette();
          const n = keys.length;
          const pad = Math.max(12, ctx.width * 0.03);
          const w = ctx.width - 2 * pad;
          const bw = w / n;
          const X = (i: number) => pad + (i + 0.5) * bw;
          const barsBottom = ctx.height * 0.4;
          const barsTop = pad * 1.6;
          const top = keys[n - 1] || 1;
          const mapTop = barsBottom + pad * 1.2;
          const mapBottom = ctx.height - pad;
          const Y = (d: number) => mapTop + (d / Math.max(1, maxDepth - 1)) * (mapBottom - mapTop);
          p.background(...ctx.bg);

          const c = current;
          const step = c ? Math.max(0, c.shown - 1) : -1;
          const [lo, hi] = c && c.shown > 0 ? c.r.bounds[step] : [0, n - 1];
          p.noStroke();
          p.fill(...mix(ctx.bg, ctx.fg, 0.07));
          p.rect(pad + lo * bw, barsTop - pad * 0.4, (hi - lo + 1) * bw, barsBottom - barsTop + pad * 0.4);
          for (let i = 0; i < n; i++) {
            const h = Math.max(1, (keys[i] / top) * (barsBottom - barsTop));
            const inside = i >= lo && i <= hi;
            p.fill(...(inside ? ramp(pal, keys[i] / top) : mix(ctx.bg, ctx.fg, 0.18)));
            p.rect(pad + i * bw, barsBottom - h, Math.max(0.6, bw * 0.8), h);
          }
          if (c) {
            // the key sought as a level line; each probe made so far as a tick
            const ky = barsBottom - (Math.min(c.key, top) / top) * (barsBottom - barsTop);
            p.stroke(...ctx.fg);
            p.strokeWeight(1);
            p.line(pad, ky, pad + w, ky);
            for (let k = 0; k < c.shown; k++) {
              const last = k === c.shown - 1;
              p.stroke(...(last ? ctx.fg : mix(ctx.bg, ctx.fg, 0.5)));
              p.strokeWeight(last ? 2.5 : 1.2);
              p.line(X(c.r.probes[k]), barsBottom + 2, X(c.r.probes[k]), barsBottom + pad * 0.7);
            }
          }

          // the probe map
          p.strokeWeight(1);
          p.stroke(...mix(ctx.bg, ctx.fg, 0.22));
          for (let k = 0; k < map.moves; k++) {
            const d = map.moveStep[k];
            p.line(X(map.moveFrom[k]), Y(d - 1), X(map.moveTo[k]), Y(d));
          }
          p.noStroke();
          const most = Math.max(1, own.searches);
          const dot = Math.max(2.5, Math.min(7, bw * 0.9));
          for (let k = 0; k < map.points; k++) {
            p.fill(...ramp(pal, Math.min(1, 0.25 + 0.75 * Math.sqrt(map.hits[k] / most))));
            p.circle(X(map.pos[k]), Y(map.step[k]), dot);
          }
          if (c && c.shown > 0) {
            p.noFill();
            p.stroke(...ctx.fg);
            p.strokeWeight(1.5);
            p.circle(X(c.r.probes[step]), Y(step), Math.max(8, Math.min(14, bw * 2)));
          }
          p.noStroke();
          p.fill(...mix(ctx.fg, ctx.bg, 0.35));
          p.textFont('monospace');
          p.textSize(10);
          p.textAlign(p.LEFT, p.TOP);
          p.text('probe 1 ↓', pad, mapTop - 12);

          const mean = (t: Tally) => (t.searches ? (t.total / t.searches).toFixed(2) : '–');
          const rows = [
            { label: 'Searches', value: own.searches.toLocaleString('en') },
            { label: 'Found / not found', value: `${own.hits} / ${own.searches - own.hits}` },
            { label: `Mean probes, ${o.name}`, value: mean(own) },
            { label: 'Mean probes when found', value: own.hits ? (own.hitProbes / own.hits).toFixed(2) : '–' },
            { label: 'Mean probes when absent', value: own.searches > own.hits
              ? (own.missProbes / (own.searches - own.hits)).toFixed(2) : '–' },
            { label: 'Most probes in one search', value: String(own.most) },
            { label: 'Probe points mapped', value: map.dropped
              ? `${map.points} (map full, ${map.dropped.toLocaleString('en')} not drawn)` : String(map.points) },
          ];
          if (o.compare) rows.push({ label: `Mean probes, ${o.compare.name} on the same keys`, value: mean(other) });
          ctx.stats(rows);
          if (curve.length > 1 && gate.open()) {
            const series = [{ name: o.name, points: curve.slice() }];
            if (o.compare) series.push({ name: o.compare.name, points: curveOther.slice() });
            ctx.chart({
              title: 'Mean probes per search',
              x: { label: 'searches' },
              y: { label: 'probes' },
              series,
            });
          }
        },
      };
    },
  };
}
