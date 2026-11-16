import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';
import { demoPlan } from './demo';
import { schedule, type ActionPlan } from './plan';

export const actionPlan: PlateCode = {
  id: 'action-plan',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 160,
  params: [
    { kind: 'range', key: 'cash', label: 'Cash at the start', min: 0, max: 600_000, step: 10_000, value: 100_000, rebuild: true },
    { kind: 'range', key: 'step', label: 'Loan step', min: 5_000, max: 50_000, step: 5_000, value: 10_000, rebuild: true },
    { kind: 'range', key: 'trains', label: 'Trains', min: 1, max: 8, step: 1, value: 3, rebuild: true },
    { kind: 'range', key: 'months', label: 'Months run before repaying', min: 1, max: 36, step: 1, value: 12, rebuild: true },
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'Replay when done', value: true },
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'steps' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'steps', 2);
    let plan: ActionPlan | string;
    let shown = 0;
    let hold = 0;

    function build() {
      const { actions, cash } = demoPlan({ cash: num(params, 'cash'), step: num(params, 'step'), trains: num(params, 'trains'), months: num(params, 'months') });
      plan = schedule(actions, { cash, loan: 0, maxLoan: 500_000 });
      shown = 0; hold = 0;
      pacer.start(typeof plan === 'string' ? 0 : plan.steps.length);
    }

    return {
      pace: () => pacer.report(typeof plan === 'string' || shown >= plan.steps.length, params),
      setup() { build(); },
      draw() {
        p.background(...ctx.bg);
        const pal = ctx.palette();
        if (typeof plan === 'string') {
          p.fill(...ctx.fg); p.noStroke(); p.textAlign(p.CENTER, p.CENTER); p.textSize(14);
          p.text(`Refused: ${plan}`, ctx.width / 2, ctx.height / 2, ctx.width * 0.8);
          ctx.stats([{ label: 'plan', value: 'refused' }, { label: 'reason', value: plan }, pacer.row(params)]);
          return;
        }
        const pl = plan;
        const done = shown >= pl.steps.length;
        shown = Math.min(pl.steps.length, shown + (ctx.thumbnail ? pl.steps.length : done ? 0 : pacer.take(params)));
        if (done) {
          hold++;
          if (bool(params, 'loop') && hold > HOLD_FRAMES * 2 && !ctx.thumbnail) { shown = 0; hold = 0; pacer.start(pl.steps.length); }
        }
        const current = shown > 0 ? pl.steps[shown - 1] : null;
        const finishedActions = new Set(pl.steps.slice(0, shown).filter((s) => s.press === s.presses).map((s) => s.action));
        // the DAG, one column per wave, above; the cash and loan after every step, below
        const top = 24; const dagH = ctx.height * 0.55; const pad = 20;
        const cols = pl.waves.length;
        const pos = new Map<string, [number, number]>();
        pl.waves.forEach((ids, w) => ids.forEach((id, k) => pos.set(id, [pad + ((w + 0.5) * (ctx.width - 2 * pad)) / cols, top + ((k + 0.5) * dagH) / ids.length])));
        const bw = Math.min(150, (ctx.width - 2 * pad) / cols - 16); const bh = 34;
        p.strokeWeight(1.5);
        for (const e of pl.graph.edges) {
          const [x0, y0] = pos.get(e.from)!; const [x1, y1] = pos.get(e.to)!;
          p.stroke(...mix(ctx.bg, ctx.fg, finishedActions.has(e.from) ? 0.7 : 0.3));
          p.line(x0 + bw / 2, y0, x1 - bw / 2, y1);
          p.noStroke(); p.fill(...mix(ctx.bg, ctx.fg, 0.6)); p.triangle(x1 - bw / 2, y1, x1 - bw / 2 - 7, y1 - 4, x1 - bw / 2 - 7, y1 + 4);
        }
        for (const node of pl.graph.nodes) {
          const [x, y] = pos.get(node.id)!;
          const active = current?.action === node.id && !done;
          const fin = finishedActions.has(node.id);
          p.stroke(...(active ? ramp(pal, 0.9) : mix(ctx.bg, ctx.fg, 0.4))); p.strokeWeight(active ? 2.5 : 1);
          p.fill(...(fin ? mix(ctx.bg, ramp(pal, 0.25), 0.5) : mix(ctx.bg, ctx.fg, 0.06)));
          p.rect(x - bw / 2, y - bh / 2, bw, bh, 6);
          p.noStroke(); p.fill(...ctx.fg); p.textAlign(p.CENTER, p.CENTER); p.textSize(11);
          const pressed = pl.steps.slice(0, shown).filter((s) => s.action === node.id).length;
          p.text(node.presses > 1 ? `${node.label} ${pressed}/${node.presses}` : node.label, x, y);
        }
        // cash (bright) and loan (faint) after each step
        const y0 = top + dagH + 30; const h = ctx.height - y0 - 16;
        const vals = pl.steps.flatMap((s) => [s.cash, s.loan]).concat([0]);
        const hi = Math.max(...vals) || 1;
        const sx = (i: number) => pad + (i / Math.max(1, pl.steps.length - 1)) * (ctx.width - 2 * pad);
        const sy = (v: number) => y0 + h - (v / hi) * h;
        p.stroke(...mix(ctx.bg, ctx.fg, 0.2)); p.strokeWeight(1); p.line(pad, sy(0), ctx.width - pad, sy(0));
        for (const [key, tone, weight] of [['loan', 0.15, 1.5], ['cash', 0.85, 2.5]] as const) {
          p.noFill(); p.stroke(...ramp(pal, tone)); p.strokeWeight(weight);
          p.beginShape();
          pl.steps.slice(0, shown).forEach((s, i) => p.vertex(sx(i), sy(s[key])));
          p.endShape();
        }
        p.noStroke(); p.fill(...ctx.fg); p.textAlign(p.LEFT, p.TOP); p.textSize(11);
        p.text('cash (bright) and loan (faint) after each step', pad, y0 - 18);
        ctx.stats([
          { label: 'steps', value: `${shown} of ${pl.steps.length}` },
          { label: 'actions', value: String(pl.graph.nodes.length) },
          { label: 'waves', value: String(pl.waves.length) },
          { label: 'now', value: current ? `${current.action} ${current.press}/${current.presses}` : '—' },
          { label: 'cash', value: (current ? current.cash : 0).toLocaleString('en') },
          { label: 'loan', value: (current ? current.loan : 0).toLocaleString('en') },
          { label: 'lowest cash', value: `${pl.lowest.cash.toLocaleString('en')} (step ${pl.lowest.at})` },
          { label: 'final loan', value: pl.final.loan.toLocaleString('en') },
          pacer.row(params),
        ]);
      },
    };
  },
};

export default actionPlan;
