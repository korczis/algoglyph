import { mix, paletteParam, ramp } from '../../core/palette';
import { num, type PlateCode } from '../../core/plate';
import { Pacer, paceParam } from '../../core/pace';
import { MODES, world } from './demo';
import { DEFAULT_PARAMS, invest, type Plan, type Place } from './invest';

const TONE: Record<string, number> = { bus: 0.15, rail: 0.55, air: 0.9 };

export const transportInvestment: PlateCode = {
  id: 'transport-investment',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 60,
  params: [
    { kind: 'range', key: 'demands', label: 'Demands', min: 2, max: 16, step: 1, value: 8, rebuild: true },
    { kind: 'range', key: 'payback', label: 'Payback (months)', min: 6, max: 60, step: 6, value: 24, rebuild: true },
    { kind: 'range', key: 'budget', label: 'Budget (thousands, 0 = none)', min: 0, max: 3_000, step: 50, value: 0, rebuild: true },
    { kind: 'range', key: 'load', label: 'Load factor', min: 0.3, max: 1, step: 0.05, value: DEFAULT_PARAMS.load_factor, rebuild: true },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'demands' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'demands', 0.25);
    let places: Place[] = [];
    let plan: Plan | string = 'not planned';
    let shown = 0;
    const W = 256; const H = 160;

    function build() {
      const wd = world(W, H, ctx.seed, num(params, 'demands'));
      places = wd.places;
      const budget = num(params, 'budget') * 1000;
      plan = invest(wd.places, wd.demands, MODES, wd.hubs, [], { ...DEFAULT_PARAMS, payback_months: num(params, 'payback'), load_factor: num(params, 'load'), ...(budget > 0 ? { budget } : {}) });
      shown = 0;
      pacer.start(typeof plan === 'string' ? 0 : plan.options.length);
    }

    return {
      pace: () => pacer.report(typeof plan === 'string' || shown >= plan.options.length, params),
      setup() { build(); },
      draw() {
        p.background(...ctx.bg);
        const pal = ctx.palette();
        if (typeof plan === 'string') { ctx.stats([{ label: 'plan', value: plan }]); return; }
        const pl = plan;
        const done = shown >= pl.options.length;
        shown = Math.min(pl.options.length, shown + (ctx.thumbnail ? pl.options.length : done ? 0 : pacer.take(params)));
        const pad = 24;
        const sx = (x: number) => pad + (x / W) * (ctx.width - 2 * pad);
        const sy = (y: number) => pad + (y / H) * (ctx.height * 0.8 - 2 * pad);
        const at = new Map(places.map((q) => [q.id, q]));
        const chosen = new Set(pl.chosen.map((c) => c.demand));
        // every demand's best route, chosen ones bright, the rest faint; legs coloured by mode
        for (const opts of pl.options.slice(0, shown)) {
          const best = opts[0];
          if (!best) continue;
          const on = chosen.has(best.demand);
          for (const l of best.legs) {
            const a = at.get(l.from)!; const b = at.get(l.to)!;
            p.stroke(...(on ? ramp(pal, TONE[l.mode] ?? 0.5) : mix(ctx.bg, ctx.fg, 0.2)));
            p.strokeWeight(on ? 3 : 1.5);
            const [x0, y0, x1, y1] = [sx(a.x), sy(a.y), sx(b.x), sy(b.y)];
            if (l.mode === 'air') {
              // a flight is drawn dashed: no track or road on the ground between its airports
              const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 8));
              for (let i = 0; i < n; i += 2) p.line(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, x0 + ((x1 - x0) * (i + 1)) / n, y0 + ((y1 - y0) * (i + 1)) / n);
            } else p.line(x0, y0, x1, y1);
          }
        }
        p.noStroke();
        const hubs = new Set(pl.options.flatMap((o) => o.flatMap((x) => x.legs.slice(1).map((l) => l.from))));
        for (const q of places) {
          p.fill(...(hubs.has(q.id) ? ramp(pal, 0.75) : ctx.fg));
          p.circle(sx(q.x), sy(q.y), hubs.has(q.id) ? 10 : 7);
        }
        // the legend: one swatch per mode
        p.textSize(11); p.textAlign(p.LEFT, p.CENTER);
        Object.entries(TONE).forEach(([m, t], i) => { p.fill(...ramp(pal, t)); p.rect(pad + i * 80, ctx.height - 22, 14, 6); p.fill(...ctx.fg); p.text(m, pad + i * 80 + 20, ctx.height - 19); });
        const count = (m: string) => pl.why.slice(0, shown).filter((w) => w.mode === m).length;
        ctx.stats([
          { label: 'demands', value: `${shown} of ${pl.options.length}` },
          { label: 'routes considered', value: String(pl.routes_considered) },
          { label: 'chosen', value: String(pl.chosen.length) },
          { label: 'best by ROI', value: `bus ${count('bus')}, rail ${count('rail')}, air ${count('air')}, with a transfer ${pl.why.slice(0, shown).filter((w) => w.mode.includes('+')).length}` },
          { label: 'portfolio score', value: Math.round(pl.best_total).toLocaleString('en') },
          pacer.row(params),
        ]);
      },
    };
  },
};

export default transportInvestment;
