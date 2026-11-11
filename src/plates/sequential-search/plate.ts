import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode } from '../../core/plate';
import { shuffle } from '../../core/random';
import { SequentialList, draw as drawRank, zipf, type Strategy } from './sequential';

const WINDOW = 100;

export const sequentialSearch: PlateCode = {
  id: 'sequential-search',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 30,
  params: [
    { kind: 'range', key: 'n', label: 'Keys in the list', min: 8, max: 400, step: 4, value: 96, rebuild: true },
    {
      kind: 'select', key: 'strategy', label: 'After a hit', value: 'move-to-front',
      options: [
        { value: 'static', label: 'Leave the list alone' },
        { value: 'move-to-front', label: 'Move the key to the front' },
        { value: 'transpose', label: 'Swap it one place forward' },
      ],
    },
    { kind: 'range', key: 'skew', label: 'Popularity skew (Zipf exponent)', min: 0, max: 2, step: 0.05,
      value: 1, rebuild: true },
    { kind: 'range', key: 'hit', label: 'Share of searches for a present key', min: 0, max: 1,
      step: 0.05, value: 0.9 },
    { kind: 'range', key: 'speed', label: 'Probes per frame', min: 1, max: 400, step: 1, value: 6 },
    paletteParam('phosphor'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let n = 0;
    let list: SequentialList;
    let cdf: Float64Array;
    // key k is the (k + 1)-th most popular; keys n … 2n − 1 are never stored
    let shownList: number[] = [];
    let current: { key: number; index: number; probes: number; shown: number } | null = null;
    let acc = 0;
    let searches = 0;
    let probes = 0;
    let hits = 0;
    const recent: number[] = [];
    const curve: [number, number][] = [];

    const begin = () => {
      const hit = ctx.rnd() < num(params, 'hit');
      const key = hit ? drawRank(cdf, ctx.rnd) : n + Math.floor(ctx.rnd() * n);
      // the scan is shown against the list as it was before any reorganisation
      const before = list.keys.slice();
      list.strategy = str(params, 'strategy') as Strategy;
      const r = list.search(key);
      current = { key, index: r.index, probes: r.probes, shown: 0 };
      shownList = before;
    };
    const complete = () => {
      if (!current) return;
      searches++;
      probes += current.probes;
      if (current.index >= 0) hits++;
      recent.push(current.probes);
      if (recent.length > WINDOW) recent.shift();
      curve.push([searches, recent.reduce((s, v) => s + v, 0) / recent.length]);
      if (curve.length > 1000) curve.shift();
      current = null;
      shownList = list.keys.slice();
    };

    return {
      setup() {
        n = num(params, 'n');
        cdf = zipf(n, num(params, 'skew'));
        list = new SequentialList(shuffle(Array.from({ length: n }, (_, k) => k), ctx.rnd));
        shownList = list.keys.slice();
        if (ctx.thumbnail) {
          list.strategy = str(params, 'strategy') as Strategy;
          for (let k = 0; k < 400; k++) {
            begin();
            complete();
          }
        }
      },
      draw() {
        if (!ctx.thumbnail) {
          acc += num(params, 'speed');
          while (acc >= 1) {
            acc -= 1;
            if (!current) begin();
            const c = current!;
            if (c.shown < c.probes) c.shown++;
            else complete();
          }
        }
        const pal = ctx.palette();
        const pad = Math.max(12, ctx.width * 0.03);
        const w = ctx.width - 2 * pad;
        const bw = w / n;
        const base = ctx.height - pad * 2.2;
        const H = base - pad * 2;
        const weight = (k: number) => cdf[k] - (k ? cdf[k - 1] : 0);
        const wMax = weight(0) || 1;
        p.background(...ctx.bg);
        p.noStroke();
        for (let i = 0; i < n; i++) {
          const k = shownList[i];
          const h = Math.max(2, Math.sqrt(weight(k) / wMax) * H);
          const scanned = current && i < current.shown;
          const c = ramp(pal, 1 - k / Math.max(1, n - 1));
          p.fill(...(scanned ? mix(c, ctx.fg, 0.55) : c));
          p.rect(pad + i * bw, base - h, Math.max(0.6, bw * 0.82), h);
        }
        if (current) {
          const x = pad + Math.max(0, current.shown - 0.5) * bw;
          p.stroke(...ctx.fg);
          p.strokeWeight(2);
          p.line(x, pad, x, base + pad * 0.6);
          p.noStroke();
        }
        p.fill(...mix(ctx.fg, ctx.bg, 0.35));
        p.textFont('monospace');
        p.textSize(10);
        p.textAlign(p.LEFT, p.TOP);
        p.text('front of the list → bar height: how often the key is sought', pad, base + pad * 0.8);

        const mean = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
        ctx.stats([
          { label: 'Searches', value: searches.toLocaleString('en') },
          { label: 'Found', value: hits.toLocaleString('en') },
          { label: 'Mean probes, all searches', value: searches ? (probes / searches).toFixed(2) : '–' },
          { label: `Mean probes, last ${recent.length}`, value: recent.length ? mean.toFixed(2) : '–' },
          { label: 'Probes of the search shown', value: current ? `${current.shown} of ${current.probes}` : '–' },
        ]);
        if (curve.length > 1) {
          ctx.chart({
            title: `Mean probes over the last ${WINDOW} searches`,
            x: { label: 'searches' },
            y: { label: 'probes' },
            series: [{ name: 'Mean probes', points: curve.slice() }],
          });
        }
      },
    };
  },
};

export default sequentialSearch;
