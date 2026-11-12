import { HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import { chartGate } from '../_shared/publish';
import {
  cycle, diagnosticity, inconsistency, inconsistencyByRow, placeLabel, rank, RATING_LABEL, standing,
  synthetic, type Matrix,
} from './ach';

export const achMatrix: PlateCode = {
  id: 'ach-matrix',
  mode: '2d',
  aspect: 4 / 3,
  thumbnailFrames: 10,
  params: [
    { kind: 'range', key: 'h', label: 'Hypotheses', min: 2, max: 6, step: 1, value: 4, rebuild: true },
    { kind: 'range', key: 'e', label: 'Items of evidence', min: 3, max: 24, step: 1, value: 12, rebuild: true },
    { kind: 'range', key: 'noise', label: 'Evidence that misleads', min: 0, max: 0.6, step: 0.05,
      value: 0.15, rebuild: true, hint: 'Chance that an item contradicts the hypothesis that is true.' },
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'New case when done', value: true },
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'items' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'items', 0.5);
    let m: Matrix;
    let truth = 0;
    let shown = 0;
    let acc = 0;
    let hold = 0;
    let generation = 0;
    let edits = 0;
    let geo = { x0: 0, y0: 0, cw: 0, rh: 0 };
    const gate = chartGate();
    let chartedAt = '';

    const build = () => {
      const rnd = mulberry32(ctx.seed + generation * 15485863);
      const k = num(params, 'h');
      truth = Math.floor(rnd() * k);
      m = synthetic(rnd, k, num(params, 'e'), truth, num(params, 'noise'));
      shown = 0;
      acc = 0;
      hold = 0;
      edits = 0;
      pacer.start(m.evidence.length);
    };

    return {
      pace: () => pacer.report(shown === m.evidence.length, params),
      setup() {
        build();
        if (ctx.thumbnail) shown = m.evidence.length;
      },
      draw() {
        if (!ctx.thumbnail) {
          acc += pacer.perFrame(params);
          while (acc >= 1 && shown < m.evidence.length) {
            acc -= 1;
            shown++;
          }
          if (shown === m.evidence.length && ++hold > HOLD_FRAMES && bool(params, 'loop') && edits === 0) {
            generation++;
            build();
            gate.reset();
          }
        }
        // read the sizes after a possible rebuild: the new case may have other dimensions
        const rows = m.evidence.length;
        const k = m.hypotheses.length;
        const pal = ctx.palette();
        const pad = Math.max(12, ctx.width * 0.03);
        const labelW = Math.min(90, ctx.width * 0.16);
        const barsH = Math.min(ctx.height * 0.22, 120);
        const x0 = pad + labelW;
        const cw = (ctx.width - x0 - pad) / k;
        const headH = 22;
        const y0 = pad + headH;
        const rh = (ctx.height - y0 - barsH - pad * 2) / rows;
        geo = { x0, y0, cw, rh };
        const scores = inconsistency(m, shown);
        const order = rank(scores);
        // every hypothesis sharing the lowest score leads: a tie is reported, never broken
        const lead = scores.map((_, h) => shown > 0 && standing(scores, h).place === 1);
        const worst = Math.max(1, ...inconsistency(m));
        p.background(...ctx.bg);
        p.textFont('monospace');
        p.noStroke();

        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(Math.max(10, Math.min(13, cw * 0.2)));
        for (let h = 0; h < k; h++) {
          p.fill(...(lead[h] ? ctx.fg : mix(ctx.fg, ctx.bg, 0.4)));
          p.text(m.hypotheses[h], x0 + (h + 0.5) * cw, pad + headH / 2);
        }
        const cellText = Math.max(8, Math.min(13, rh * 0.5, cw * 0.22));
        for (let e = 0; e < rows; e++) {
          const y = y0 + e * rh;
          const open = e < shown;
          const flat = diagnosticity(m.cells[e]) === 0;
          p.textAlign(p.LEFT, p.CENTER);
          p.textSize(cellText);
          p.fill(...mix(ctx.fg, ctx.bg, open ? 0.2 : 0.7));
          const ev = m.evidence[e];
          p.text(`${ev.label} ×${ev.weight}`, pad, y + rh / 2);
          for (let h = 0; h < k; h++) {
            const x = x0 + h * cw;
            const r = m.cells[e][h];
            let c = open ? ramp(pal, (r + 2) / 4) : mix(ctx.bg, ctx.fg, 0.06);
            if (open && flat) c = mix(c, ctx.bg, 0.65);
            p.fill(...c);
            p.rect(x + 1.5, y + 1, cw - 3, rh - 2, 3);
            if (open && rh > 10) {
              p.fill(...(flat ? mix(ctx.fg, ctx.bg, 0.4) : ctx.bg));
              p.textAlign(p.CENTER, p.CENTER);
              p.text(RATING_LABEL[r], x + cw / 2, y + rh / 2);
            }
          }
        }
        // inconsistency bars: the shortest bar is the hypothesis least contradicted
        const by = ctx.height - pad - barsH;
        for (let h = 0; h < k; h++) {
          const bh = (scores[h] / worst) * (barsH - 18);
          p.fill(...(lead[h] ? ctx.fg : mix(ctx.bg, ctx.fg, 0.45)));
          p.rect(x0 + h * cw + cw * 0.2, by + 4, cw * 0.6, Math.max(1, bh), 2);
          p.textAlign(p.CENTER, p.TOP);
          p.textSize(10);
          p.fill(...mix(ctx.fg, ctx.bg, 0.25));
          p.text(scores[h].toFixed(1), x0 + (h + 0.5) * cw, by + 6 + Math.max(1, bh));
        }
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(9);
        p.text('against', pad, by + 4);

        const leaders = () => {
          const names = m.hypotheses.filter((_, h) => lead[h]);
          const best = scores[order[0]].toFixed(1);
          return names.length > 1 ? `${names.join(', ')} (tied 1st, ${best})` : `${names[0]} (${best})`;
        };
        const flatRows = m.cells.slice(0, shown).filter((row) => diagnosticity(row) === 0).length;
        const margin = k > 1 && shown ? scores[order[1]] - scores[order[0]] : 0;
        ctx.stats([
          { label: 'Evidence weighed', value: `${shown} of ${rows}` },
          pacer.row(params),
          { label: 'Least contradicted', value: shown ? leaders() : '–' },
          { label: 'Lead over the runner-up', value: shown ? margin.toFixed(1) : '–' },
          { label: 'Items that fit every hypothesis alike', value: String(flatRows) },
          { label: 'Rank of the hypothesis the case was built on',
            value: shown === rows ? `${placeLabel(standing(scores, truth))} of ${k}` : '–' },
          { label: 'Cells changed by hand', value: String(edits) },
        ]);
        const state = `${generation}:${shown}:${edits}`;
        if (state !== chartedAt) gate.mark();
        if ((shown > 0 || generation > 0) && gate.open()) {
          chartedAt = state;
          const byRow = inconsistencyByRow(m, shown);
          ctx.chart({
            title: 'Weighted inconsistency as evidence is weighed',
            x: { label: 'items of evidence' },
            y: { label: 'inconsistency' },
            series: m.hypotheses.map((name, h) => ({
              name,
              points: byRow.map((row, r) => [r, row[h]] as [number, number]),
            })),
          });
        }
      },
      pressed(x, y) {
        const h = Math.floor((x - geo.x0) / geo.cw);
        const e = Math.floor((y - geo.y0) / geo.rh);
        if (h < 0 || h >= m.hypotheses.length || e < 0 || e >= shown) return;
        m.cells[e][h] = cycle(m.cells[e][h]);
        edits++;
      },
    };
  },
};

export default achMatrix;
