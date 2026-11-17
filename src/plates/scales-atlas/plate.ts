// Scales atlas: the lengths and times the constants of nature set, from the Planck length to the
// light-year, placed on one logarithmic ruler. A still diagram of the controls; each rung is
// computed from its formula and read against its tabled value.
import { paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { CODATA, rungs, TABLED } from './scales';

export const scalesAtlas: PlateCode = {
  id: 'scales-atlas',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    { kind: 'select', key: 'kind', label: 'Ruler', value: 'length', options: [{ value: 'length', label: 'lengths (m)' }, { value: 'time', label: 'times (s)' }] },
    { kind: 'range', key: 'lo', label: 'From 10^…', min: -45, max: 10, step: 1, value: -36 },
    { kind: 'range', key: 'hi', label: 'to 10^…', min: -35, max: 20, step: 1, value: 17 },
    paletteParam('spectral'),
  ],
  pace: { kind: 'still', why: 'a ruler of the controls: the scales are computed once from the constants, and nothing in it moves' },
  create(p, ctx) {
    const params = ctx.params;
    const all = rungs(CODATA);
    return {
      setup() {},
      draw() {
        const kind = str(params, 'kind');
        const lo = Math.min(num(params, 'lo'), num(params, 'hi') - 1);
        const hi = Math.max(num(params, 'hi'), lo + 1);
        const W = ctx.width; const H = ctx.height;
        const pal = ctx.palette(); const fg = ctx.fg;
        p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
        p.textSize(Math.max(10, Math.min(14, W * 0.016)));

        // the ruler: one tick per decade, a label every fifth
        const x0 = W * 0.05; const x1 = W * 0.95; const y = H * 0.5;
        const at = (v: number) => x0 + ((x1 - x0) * (Math.log10(v) - lo)) / (hi - lo);
        p.stroke(fg[0], fg[1], fg[2], 120); p.strokeWeight(1.5); p.line(x0, y, x1, y);
        p.textAlign(p.CENTER, p.TOP);
        for (let d = Math.ceil(lo); d <= hi; d++) {
          const x = x0 + ((x1 - x0) * (d - lo)) / (hi - lo);
          p.stroke(fg[0], fg[1], fg[2], 90); p.line(x, y - 4, x, y + 4);
          if (d % 5 === 0) { p.noStroke(); p.fill(fg[0], fg[1], fg[2], 160); p.text(`10^${d}`, x, y + 8); }
        }
        // the rungs of this ruler inside the window, labels alternating above and below
        const shown = all.filter((r) => r.kind === kind && Math.log10(r.value) >= lo && Math.log10(r.value) <= hi);
        shown.forEach((r, i) => {
          const x = at(r.value);
          const c = ramp(pal, 0.15 + (0.7 * i) / Math.max(1, shown.length - 1));
          const up = i % 2 === 0;
          const ly = up ? y - 40 - 22 * (i % 4 === 0 ? 1 : 0) : y + 40 + 22 * (i % 4 === 1 ? 1 : 0);
          p.stroke(c[0], c[1], c[2]); p.strokeWeight(2); p.line(x, y, x, ly);
          p.noStroke(); p.fill(c[0], c[1], c[2]); p.circle(x, y, 8);
          p.textAlign(p.CENTER, up ? p.BOTTOM : p.TOP);
          p.text(`${r.name}, ${r.formula}`, Math.min(x1 - 60, Math.max(x0 + 60, x)), up ? ly - 2 : ly + 2);
        });
        p.noStroke(); p.fill(fg[0], fg[1], fg[2], 190); p.textAlign(p.LEFT, p.TOP);
        p.text(`${shown.length} of the ${all.filter((r) => r.kind === kind).length} ${kind === 'time' ? 'times' : 'lengths'} lie between 10^${lo} and 10^${hi}`, W * 0.03, H * 0.04);

        const rows: Stat[] = [];
        for (const r of all) {
          rows.push({ label: `${r.name}, ${r.formula}`, value: `${r.value.toPrecision(12)} ${r.kind === 'time' ? 's' : 'm'}` });
          const t = TABLED[r.id];
          if (t && t.relU > 0) rows.push({ label: `${r.name} against its tabled value`, value: (Math.abs(r.value - t.value) / t.value).toExponential(2) });
        }
        const ly = all.find((r) => r.id === 'light-year')!;
        rows.push({ label: 'light-year, in whole metres', value: `${ly.value.toFixed(0)} m` });
        ctx.stats(rows);
      },
    };
  },
};

export default scalesAtlas;
