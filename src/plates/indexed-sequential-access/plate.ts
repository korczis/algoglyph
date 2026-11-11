import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { chartGate } from '../_shared/publish';
import { sortedKeys } from '../_shared/sorted-search/search';
import { Isam, type Lookup } from './isam';

const WINDOW = 50;

export const indexedSequentialAccess: PlateCode = {
  id: 'indexed-sequential-access',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 20,
  params: [
    { kind: 'range', key: 'n', label: 'Keys at load time', min: 32, max: 480, step: 16, value: 160,
      rebuild: true },
    { kind: 'range', key: 'page', label: 'Keys per page', min: 4, max: 16, step: 1, value: 8, rebuild: true },
    { kind: 'range', key: 'fill', label: 'Load factor of each page', min: 0.5, max: 1, step: 0.05,
      value: 0.75, rebuild: true },
    { kind: 'range', key: 'inserts', label: 'Share of operations that insert', min: 0, max: 1, step: 0.05,
      value: 0.4 },
    { kind: 'toggle', key: 'hot', label: 'Inserts crowd into one key range', value: true },
    { kind: 'range', key: 'speed', label: 'Operations per frame', min: 0.02, max: 10, step: 0.02, value: 0.2 },
    paletteParam('abyss'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let isam: Isam;
    let loaded = 0;
    /** Every stored key, in no order: what searches for a present key pick from. */
    let stored: number[] = [];
    let top = 1;
    let acc = 0;
    let last: { insert: boolean; key: number; look: Lookup; ok: boolean } | null = null;
    let searches = 0;
    let reads = 0;
    let probes = 0;
    const recent: number[] = [];
    const curve: [number, number][] = [];
    const gate = chartGate();

    const operate = () => {
      const insert = ctx.rnd() < num(params, 'inserts') && isam.size < loaded * 3;
      let key: number;
      if (insert) {
        key = bool(params, 'hot') ? Math.floor(top * (0.4 + 0.05 * ctx.rnd())) : Math.floor(ctx.rnd() * top);
        const ok = isam.insert(key);
        if (ok) stored.push(key);
        last = { insert, key, look: isam.search(key), ok };
        return;
      }
      key = ctx.rnd() < 0.8 ? stored[Math.floor(ctx.rnd() * stored.length)] : Math.floor(ctx.rnd() * top);
      const look = isam.search(key);
      searches++;
      reads += look.pageReads;
      probes += look.indexProbes;
      recent.push(look.pageReads);
      if (recent.length > WINDOW) recent.shift();
      curve.push([isam.size - loaded, recent.reduce((s, v) => s + v, 0) / recent.length]);
      gate.mark();
      if (curve.length > 800) curve.shift();
      last = { insert, key, look, ok: look.found };
    };

    return {
      setup() {
        const n = num(params, 'n');
        const keys = sortedKeys(n, 'uniform', ctx.rnd);
        top = keys[n - 1] + 1;
        loaded = n;
        stored = keys.slice();
        isam = new Isam(keys, num(params, 'page'), num(params, 'fill'));
        if (ctx.thumbnail) for (let k = 0; k < n * 0.8; k++) operate();
      },
      draw() {
        if (!ctx.thumbnail) {
          acc += num(params, 'speed');
          while (acc >= 1) {
            acc -= 1;
            operate();
          }
        }
        const pal = ctx.palette();
        const pages = isam.pages.length;
        const size = isam.pageSize;
        const pad = Math.max(12, ctx.width * 0.03);
        const cw = (ctx.width - 2 * pad) / pages;
        const indexY = pad * 1.8;
        const indexH = Math.max(6, Math.min(16, cw * 0.8));
        const primaryY = indexY + indexH + pad * 1.2;
        const longest = Math.max(2, isam.longestChain());
        const avail = ctx.height - primaryY - pad;
        // a page is a column of slots; its overflow pages hang beneath it, a little apart
        const slot = Math.max(1, Math.min(cw * 0.8, avail / ((size + 0.6) * (1 + longest))));
        const pageH = size * slot;
        const key = (v: number) => ramp(pal, v / top);
        const hot = last ? last.look.page : -1;
        p.background(...ctx.bg);
        p.noStroke();
        for (let i = 0; i < pages; i++) {
          const x = pad + i * cw + (cw - Math.max(1, cw * 0.8)) / 2;
          const wPage = Math.max(1, cw * 0.8);
          // the index entry: the page's first key
          p.fill(...key(isam.index[i]));
          p.rect(x, indexY, wPage, indexH * (i === hot ? 1 : 0.7));
          const columns: number[][] = [isam.pages[i], ...isam.overflow[i]];
          columns.forEach((pg, c) => {
            const y = primaryY + c * (pageH + slot * 0.6);
            const read = last && i === hot && c < last.look.pageReads;
            p.fill(...mix(ctx.bg, ctx.fg, read ? 0.3 : c ? 0.1 : 0.06));
            p.rect(x - 1, y - 1, wPage + 2, pageH + 2, 2);
            pg.forEach((v, s) => {
              p.fill(...(last && v === last.key ? ctx.fg : key(v)));
              p.rect(x, y + s * slot, wPage, Math.max(0.8, slot * 0.86));
            });
          });
        }
        p.fill(...mix(ctx.fg, ctx.bg, 0.3));
        p.textFont('monospace');
        p.textSize(10);
        p.textAlign(p.LEFT, p.TOP);
        p.text('index: first key of each page', pad, pad * 0.5);
        if (last) {
          const what = last.insert ? (last.ok ? 'inserted' : 'already stored') : (last.ok ? 'found' : 'not found');
          p.textAlign(p.RIGHT, p.TOP);
          p.text(`${last.insert ? 'insert' : 'search'} ${last.key}: ${what}, ${last.look.pageReads} page read${last.look.pageReads > 1 ? 's' : ''}`,
            ctx.width - pad, pad * 0.5);
        }

        const mean = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
        ctx.stats([
          { label: 'Keys stored', value: isam.size.toLocaleString('en') },
          { label: 'Inserted since the load', value: (isam.size - loaded).toLocaleString('en') },
          { label: 'Primary pages', value: String(pages) },
          { label: 'Overflow pages', value: String(isam.overflowPages()) },
          { label: 'Longest overflow chain', value: String(isam.longestChain()) },
          { label: 'Index comparisons per search', value: searches ? (probes / searches).toFixed(2) : '–' },
          { label: 'Page reads per search, all', value: searches ? (reads / searches).toFixed(2) : '–' },
          { label: `Page reads per search, last ${recent.length}`, value: recent.length ? mean.toFixed(2) : '–' },
        ]);
        if (curve.length > 1 && gate.open()) {
          ctx.chart({
            title: `Page reads per search (mean of the last ${WINDOW})`,
            x: { label: 'keys inserted since the load' },
            y: { label: 'page reads' },
            series: [{ name: 'Page reads', points: curve.slice() }],
          });
        }
      },
    };
  },
};

export default indexedSequentialAccess;
