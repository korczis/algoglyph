// Thermo diagrams: a heat engine's cycle drawn twice, on the p–V plane where its area is the work
// and on the T–S plane where its area is the heat turned into work. A still diagram of the
// controls; the integrals along the legs are read against the efficiencies in closed form.
import { paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { carnotWork, closedEfficiency, integrate, legs, path, totals, type CycleId, type CycleSpec } from './cycle';

const GASES: Record<string, number> = { monatomic: 5 / 3, diatomic: 7 / 5 };
const when = (...v: string[]) => ({ key: 'cycle', values: v });
const exp = (x: number) => x.toExponential(2);

export const thermoDiagrams: PlateCode = {
  id: 'thermo-diagrams',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'cycle', label: 'Cycle', value: 'carnot',
      options: [
        { value: 'carnot', label: 'Carnot: two isotherms, two adiabats' },
        { value: 'otto', label: 'Otto: two adiabats, two isochores' },
        { value: 'diesel', label: 'Diesel: two adiabats, an isobar, an isochore' },
        { value: 'stirling', label: 'Stirling: two isotherms, two isochores' },
      ],
    },
    { kind: 'select', key: 'gas', label: 'Gas', value: 'diatomic', options: [{ value: 'diatomic', label: 'diatomic, γ = 7/5' }, { value: 'monatomic', label: 'monatomic, γ = 5/3' }] },
    { kind: 'range', key: 'Th', label: 'Hot reservoir (K)', min: 400, max: 2500, step: 10, value: 600, when: when('carnot', 'otto', 'stirling') },
    { kind: 'range', key: 'Tc', label: 'Cold reservoir, the intake (K)', min: 200, max: 390, step: 1, value: 300 },
    { kind: 'range', key: 'ratio', label: 'Volume ratio', min: 1.5, max: 25, step: 0.1, value: 2 },
    { kind: 'range', key: 'cutoff', label: 'Cutoff ratio ρ', min: 1.1, max: 4, step: 0.01, value: 2, when: when('diesel') },
    paletteParam('ember'),
  ],
  pace: { kind: 'still', why: 'a diagram of the controls: the cycle is integrated once when a control changes, and nothing in it moves' },
  create(p, ctx) {
    const params = ctx.params;
    let key = '';
    let rows: Stat[] = [];
    let drawn: ReturnType<typeof path> | null = null;
    let corners: number[] = [];

    const compute = () => {
      const spec: CycleSpec = {
        cycle: str(params, 'cycle') as CycleId, gamma: GASES[str(params, 'gas')] ?? 1.4,
        Th: num(params, 'Th'), Tc: num(params, 'Tc'), ratio: num(params, 'ratio'),
        // the burn must end before the stroke does: a cutoff past the ratio is held at 0.9 of it
        cutoff: Math.min(num(params, 'cutoff'), 0.9 * num(params, 'ratio')),
      };
      const sums = totals(legs(spec).map((l) => integrate(l, spec.gamma)));
      const eta = sums.work / sums.heatIn;
      const closed = closedEfficiency(spec);
      const carnotBound = 1 - spec.Tc / Math.max(...legs(spec).map((l) => Math.max(l.Ta, l.Tb)));
      drawn = path(spec);
      corners = legs(spec).map((_, i) => i * 61);
      rows = [
        { label: 'work per cycle ∮p dV', value: `${sums.work.toFixed(6)} J/mol` },
        { label: 'heat taken in', value: `${sums.heatIn.toFixed(6)} J/mol` },
        { label: 'heat given out', value: `${sums.heatOut.toFixed(6)} J/mol` },
        { label: 'efficiency, work over heat taken in', value: eta.toFixed(9) },
        { label: 'efficiency in closed form', value: closed.toFixed(9) },
        { label: 'Carnot\'s bound between its extreme temperatures', value: carnotBound.toFixed(9) },
        { label: 'Clausius ∮dQ/T', value: exp(Math.abs(sums.clausius)) },
        { label: 'first law, ∮p dV against heat in − out', value: exp(Math.abs(sums.work - (sums.heatIn - sums.heatOut))) },
      ];
      if (spec.cycle === 'diesel' && spec.cutoff < num(params, 'cutoff')) rows.push({ label: 'cutoff held at 0.9 of the ratio', value: spec.cutoff.toFixed(3) });
      if (spec.cycle === 'carnot') rows.push({ label: 'Carnot\'s work R(Th − Tc) ln r', value: `${carnotWork(spec).toFixed(6)} J/mol` });
    };

    const plot = (xs: number[], ys: number[], x0: number, y0: number, w: number, h: number, title: string, xl: string, yl: string) => {
      const fg = ctx.fg; const pal = ctx.palette();
      let xmin = Infinity; let xmax = -Infinity; let ymin = Infinity; let ymax = -Infinity;
      for (let i = 0; i < xs.length; i++) {
        xmin = Math.min(xmin, xs[i]); xmax = Math.max(xmax, xs[i]); ymin = Math.min(ymin, ys[i]); ymax = Math.max(ymax, ys[i]);
      }
      const px = (x: number) => x0 + (w * (x - xmin)) / (xmax - xmin || 1);
      const py = (y: number) => y0 + h - (h * (y - ymin)) / (ymax - ymin || 1);
      p.stroke(fg[0], fg[1], fg[2], 70); p.strokeWeight(1);
      p.line(x0, y0 + h, x0 + w, y0 + h); p.line(x0, y0, x0, y0 + h);
      const fill = ramp(pal, 0.35);
      p.fill(fill[0], fill[1], fill[2], 60);
      p.stroke(...ramp(pal, 0.7)); p.strokeWeight(2.5);
      p.beginShape();
      for (let i = 0; i < xs.length; i++) p.vertex(px(xs[i]), py(ys[i]));
      p.endShape(p.CLOSE);
      p.noStroke(); p.fill(fg[0], fg[1], fg[2]);
      corners.forEach((c, k) => { p.circle(px(xs[c]), py(ys[c]), 7); p.text(String(k + 1), px(xs[c]) + 6, py(ys[c]) - 6); });
      p.fill(fg[0], fg[1], fg[2], 190);
      p.textAlign(p.LEFT, p.BOTTOM); p.text(title, x0, y0 - 6);
      p.textAlign(p.RIGHT, p.TOP); p.text(xl, x0 + w, y0 + h + 4);
      p.textAlign(p.LEFT, p.TOP); p.text(yl, x0 + 4, y0);
    };

    return {
      setup() {},
      draw() {
        const k = ['cycle', 'gas', 'Th', 'Tc', 'ratio', 'cutoff'].map((n) => String(params[n])).join('|');
        if (k !== key || !drawn) { key = k; compute(); }
        const W = ctx.width; const H = ctx.height;
        p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
        p.textSize(Math.max(11, Math.min(15, W * 0.018)));
        const d = drawn!;
        plot(d.V.map((v) => v * 1000), d.p.map((x) => x / 1000), W * 0.07, H * 0.1, W * 0.38, H * 0.74,
          'p–V: the area is the work', 'V (litres)', 'p (kPa)');
        plot(d.S, d.T, W * 0.56, H * 0.1, W * 0.38, H * 0.74,
          'T–S: the area is the heat turned into work', 'S − S₁ (J/(mol·K))', 'T (K)');
        ctx.chart({
          title: 'The cycle on the p–V plane', x: { label: 'volume (litres)' }, y: { label: 'pressure (kPa)' },
          series: [{ name: 'cycle', points: d.V.map((v, i) => [v * 1000, d.p[i] / 1000] as [number, number]) }],
        });
        ctx.stats(rows);
      },
    };
  },
};

export default thermoDiagrams;
