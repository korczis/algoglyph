import { mix, paletteParam, ramp } from '../../core/palette';
import { num, type PlateCode } from '../../core/plate';
import { chartGate } from '../_shared/publish';
import { mulberry32 } from '../../core/random';
import { SkipList } from './skiplist';
import { Pacer, paceParam } from '../../core/pace';

type Op = 'insert' | 'search' | 'remove';

export const skipList: PlateCode = {
  id: 'skip-list',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 20,
  params: [
    { kind: 'range', key: 'n', label: 'Keys to hold', min: 8, max: 160, step: 4, value: 48, rebuild: true },
    {
      kind: 'select', key: 'p', label: 'Chance to rise a level', value: '0.5', rebuild: true,
      options: [
        { value: '0.5', label: '1/2' },
        { value: '0.25', label: '1/4' },
      ],
    },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'stream', unit: 'comparisons' },
  create(p, ctx) {
    const params = ctx.params;
    const target = num(params, 'n');
    const prob = Number(params.p);
    const maxLevel = Math.min(16, Math.ceil(Math.log(target) / Math.log(1 / prob)) + 3);
    const sl = new SkipList(maxLevel, prob, mulberry32(ctx.seed ^ 0x5bd1e995));
    const span = target * 4;
    let acc = 0;
    const pacer = new Pacer('stream', 'comparisons', 32);
    let last: { op: Op; key: number; ok: boolean; path: [number, number][]; node: number; cmp: number }
      | null = null;
    let churning = false;
    let searches = 0;
    let searchCmp = 0;
    let inserts = 0;
    let insertCmp = 0;
    const window: number[] = [];
    const curve: [number, number][] = [];
    const gate = chartGate();

    const operate = () => {
      let op: Op;
      if (sl.size < target) op = 'insert';
      else op = ctx.rnd() < 0.7 ? 'search' : ctx.rnd() < 0.5 ? 'remove' : 'insert';
      const keys = op === 'remove' || (op === 'search' && ctx.rnd() < 0.6) ? sl.keys() : null;
      const key = keys ? keys[Math.floor(ctx.rnd() * keys.length)] : Math.floor(ctx.rnd() * span);
      const look = sl.search(key);
      if (op === 'search') {
        searches++;
        searchCmp += look.cmp;
        last = { op, key, ok: look.found, path: look.path, node: look.node, cmp: look.cmp };
      } else if (op === 'insert') {
        const r = sl.insert(key);
        if (r.inserted) {
          inserts++;
          insertCmp += r.cmp;
          window.push(r.cmp);
          if (window.length > 16) window.shift();
          // the growth curve covers the build only; afterwards the size just hovers
          if (!churning) {
            curve.push([sl.size, window.reduce((s, v) => s + v, 0) / window.length]);
            gate.mark();
          }
        }
        last = { op, key, ok: r.inserted, path: look.path, node: r.node, cmp: r.cmp };
      } else {
        // a removed node's slot is gone: show the path, not the node
        churning = true;
        last = { op, key, ok: sl.remove(key), path: look.path, node: -1, cmp: look.cmp };
      }
    };

    return {
      pace: () => pacer.report(false, params),
      setup() {
        const first = ctx.thumbnail ? target + 6 : Math.ceil(target / 2);
        for (let k = 0; k < first; k++) operate();
      },
      draw() {
        if (!ctx.thumbnail) {
          // an operation lights its whole search path at once: it shows that many changes
          acc += pacer.perFrame(params);
          while (acc >= 1) {
            operate();
            acc -= Math.max(1, last ? last.cmp : 1);
          }
        }
        const pal = ctx.palette();
        const order = sl.lane(0);
        const col = new Map<number, number>([[0, 0]]);
        order.forEach((x, i) => col.set(x, i + 1));
        const pad = Math.max(12, ctx.width * 0.03);
        const levels = Math.max(sl.level, 3);
        const cw = (ctx.width - 2 * pad) / (order.length + 1.5);
        const lh = Math.min(28, (ctx.height - pad * 3) / (levels + 0.5));
        const base = ctx.height - pad * 1.8;
        const X = (node: number) => pad + ((col.get(node) ?? 0) + 0.5) * cw;
        const Y = (lv: number) => base - lv * lh;
        const box = Math.max(2, Math.min(cw * 0.7, lh * 0.62));
        p.background(...ctx.bg);

        // the lists, one per level, ending in a nil marker on the right
        p.strokeWeight(1);
        for (let lv = 0; lv < sl.level; lv++) {
          const lane = [0, ...sl.lane(lv)];
          p.stroke(...mix(ctx.bg, ctx.fg, 0.3));
          for (let k = 0; k < lane.length; k++) {
            const x1 = k + 1 < lane.length ? X(lane[k + 1]) : ctx.width - pad;
            p.line(X(lane[k]), Y(lv), x1, Y(lv));
          }
        }
        p.noStroke();
        for (const x of [0, ...order]) {
          const h = sl.height(x);
          const shown = x === 0 ? sl.level : h;
          for (let lv = 0; lv < shown; lv++) {
            const c = x === 0 ? mix(ctx.bg, ctx.fg, 0.55) : ramp(pal, lv / Math.max(1, maxLevel - 1));
            p.fill(...(x === last?.node && last.ok ? mix(c, ctx.fg, 0.5) : c));
            p.rect(X(x) - box / 2, Y(lv) - box / 2, box, box, 2);
          }
        }
        if (last && last.path.length) {
          // the search path: right along a level, down when the next key would overshoot
          p.noFill();
          p.stroke(...ctx.fg);
          p.strokeWeight(2.5);
          p.beginShape();
          for (const [x, lv] of last.path) {
            const px = col.has(x) ? X(x) : X(0);
            p.vertex(px, Y(lv));
          }
          const [endX] = last.path[last.path.length - 1];
          p.vertex(col.has(endX) ? X(endX) : X(0), Y(0) + box);
          p.endShape();
        }
        p.noStroke();
        p.fill(...mix(ctx.fg, ctx.bg, 0.3));
        p.textFont('monospace');
        p.textSize(10);
        p.textAlign(p.LEFT, p.TOP);
        if (last) {
          const verb = last.op === 'search' ? (last.ok ? 'found' : 'not found')
            : last.op === 'insert' ? (last.ok ? 'inserted' : 'already there') : (last.ok ? 'removed' : 'absent');
          p.text(`${last.op} ${last.key}: ${verb}`, pad, pad * 0.5);
        }

        const perLevel: string[] = [];
        for (let lv = 0; lv < sl.level; lv++) perLevel.push(String(sl.lane(lv).length));
        ctx.stats([
          { label: 'Keys', value: String(sl.size) },
          { label: 'Levels in use', value: String(sl.level) },
          { label: 'Nodes per level, bottom up', value: perLevel.join(' · ') },
          { label: 'Mean comparisons per search', value: searches ? (searchCmp / searches).toFixed(2) : '–' },
          { label: 'Mean comparisons per insert', value: inserts ? (insertCmp / inserts).toFixed(2) : '–' },
          { label: 'Comparisons of the last walk', value: last ? String(last.cmp) : '–' },
          pacer.row(params),
        ]);
        if (curve.length > 1 && gate.open()) {
          ctx.chart({
            title: 'Comparisons per insert as the list grows',
            x: { label: 'keys in the list' },
            y: { label: 'comparisons (mean of the last 16 inserts)' },
            series: [{ name: 'Comparisons per insert', points: curve.slice() }],
          });
        }
      },
    };
  },
};

export default skipList;
