import { count } from '../../core/format';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, type PlateCode } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import {
  compare, fire, MIN_BINS, tally, type Comparison, type Gun, type Openings, type Tally,
} from '../_shared/two-slit/ballistic';
import { bars, curve, legend, rgba, type Panel } from '../_shared/two-slit/draw';
import { Pacer, rateParam, roundRobin } from '../_shared/two-slit/pace';

const DEG = Math.PI / 180;
/** Gun to wall and wall to backstop (m), and the backstop's half-height (m). */
const L1 = 1;
const L2 = 1;
const Y = 0.3;
/** Fringe period of the interference hypothesis the power check tests, in bins. */
const HYPOTHESIS_BINS = 4;
/** Tracks of recent bullets drawn in the apparatus. */
const TRACKS = 40;
/** Bullets per frame, all runs, in the gallery thumbnail. */
const THUMB_RATE = 4500;

const RUNS: Openings[] = ['one', 'two', 'both'];

export const twoSlitClassical: PlateCode = {
  id: 'two-slit-classical',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 30,
  params: [
    { kind: 'range', key: 'spread', label: 'Gun spread, half-angle (°)', min: 1, max: 10, step: 0.5,
      value: 3, rebuild: true },
    { kind: 'range', key: 'a', label: 'Hole width a (cm)', min: 0.5, max: 4, step: 0.25, value: 2,
      rebuild: true },
    { kind: 'range', key: 'd', label: 'Hole separation d (cm)', min: 4.5, max: 12, step: 0.5,
      value: 6, rebuild: true },
    { kind: 'range', key: 'ricochet', label: 'Ricochet at the hole, σ (°)', min: 1, max: 20,
      step: 0.5, value: 6, rebuild: true,
      hint: 'A modelled deflection at the hole, normal with this standard deviation.' },
    { kind: 'range', key: 'bins', label: 'Backstop bins', min: 24, max: 96, step: 8, value: 48,
      rebuild: true },
    // a default run is a demonstration that lasts DEMO_N × 3 / 24 ≈ 44 s at the calm pace; the
    // claims pin their own n (src/plates/_shared/two-slit/pace.ts)
    { kind: 'range', key: 'n', label: 'Bullets fired per run', min: 50, max: 80000, step: 50,
      value: 350, rebuild: true },
    rateParam('Bullets'),
    paletteParam('ember'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let gun: Gun;
    let runs: Tally[] = [];
    let rnds: (() => number)[] = [];
    let n = 0;
    let result: Comparison | null = null;
    let tracks: { yw: number; y: number; detected: boolean }[] = [];
    const pacer = new Pacer();

    return {
      setup() {
        gun = {
          spread: num(params, 'spread') * DEG,
          a: num(params, 'a') / 100,
          d: num(params, 'd') / 100,
          ricochet: num(params, 'ricochet') * DEG,
          L1, L2, Y,
          bins: num(params, 'bins'),
        };
        n = num(params, 'n');
        runs = RUNS.map(() => tally(gun));
        // one stream per run, each from the plate's seed: the three runs are independent samples
        rnds = RUNS.map(() => mulberry32(Math.floor(ctx.rnd() * 0x7fffffff) + 1));
        result = null;
        tracks = [];
      },
      draw() {
        const budget = ctx.thumbnail ? THUMB_RATE : pacer.take(num(params, 'rate'));
        roundRobin(budget, (r) => n - runs[r].emitted, RUNS.length, (r) => {
          const t = runs[r];
          fire(gun, RUNS[r], rnds[r], t);
          if (r === 2) {
            tracks.push(t.last);
            if (tracks.length > TRACKS) tracks.shift();
          }
        });
        const done = runs.every((t) => t.emitted >= n);
        if (done && !result) {
          result = compare(gun, runs[0].hist, runs[1].hist, runs[2].hist,
            (HYPOTHESIS_BINS * 2 * Y) / gun.bins);
        }

        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();

        // the apparatus, side on: the gun, the wall with its holes, the backstop
        const top = H * 0.08;
        const span = H * 0.84;
        const yPx = (y: number) => top + span / 2 - (y / Y) * (span / 2);
        const gx = W * 0.05;
        const wx = W * 0.3;
        const bx = W * 0.56;
        const wallC = rgba(mix(ctx.bg, fg, 0.6), 1);
        g.fillStyle = wallC;
        const holes = [gun.d / 2, -gun.d / 2];
        let from = -Y;
        for (const c of [-gun.d / 2, gun.d / 2]) {
          g.fillRect(wx - 3, yPx(c - gun.a / 2), 6, yPx(from) - yPx(c - gun.a / 2));
          from = c + gun.a / 2;
        }
        g.fillRect(wx - 3, yPx(Y), 6, yPx(from) - yPx(Y));
        g.fillRect(bx - 2, yPx(Y), 4, span);
        g.fillStyle = rgba(fg, 0.75);
        g.beginPath();
        g.arc(gx, yPx(0), 6, 0, 2 * Math.PI);
        g.fill();
        g.strokeStyle = rgba(ramp(pal, 0.8), 0.35);
        g.lineWidth = 1;
        for (const tr of tracks) {
          g.beginPath();
          g.moveTo(gx, yPx(0));
          g.lineTo(wx, yPx(tr.yw));
          if (!Number.isNaN(tr.y)) g.lineTo(bx, yPx(Math.max(-Y, Math.min(Y, tr.y))));
          g.stroke();
        }
        g.font = '11px monospace';
        g.fillStyle = rgba(fg, 0.7);
        g.textBaseline = 'top';
        g.fillText('gun', gx - 10, yPx(0) + 10);
        g.fillText('wall', wx - 12, top + span + 4);
        g.fillText('backstop', bx - 24, top + span + 4);
        for (const [i, c] of holes.entries()) g.fillText(String(i + 1), wx + 6, yPx(c) - 6);

        // the three histograms against backstop position
        const panel: Panel = { x: bx + 6, w: W * 0.4, y: top, h: span };
        const n1 = runs[0].hist;
        const n2 = runs[1].hist;
        const n12 = runs[2].hist;
        const sum = n1.map((v, i) => v + n2[i]);
        let peak = 1;
        for (let i = 0; i < gun.bins; i++) peak = Math.max(peak, n12[i], sum[i]);
        const c12 = ramp(pal, 0.75);
        bars(g, panel, n12, peak, rgba(c12, 0.55));
        curve(g, panel, n1, peak, rgba(ramp(pal, 0.25), 0.9), 1.2);
        curve(g, panel, n2, peak, rgba(ramp(pal, 0.45), 0.9), 1.2);
        curve(g, panel, sum, peak, rgba(fg, 0.85), 1.4, [4, 3]);
        legend(g, panel.x + panel.w * 0.45, top + 8, [
          [rgba(c12, 0.8), 'N₁₂ both holes'],
          [rgba(ramp(pal, 0.25), 1), 'N₁ hole 2 shut'],
          [rgba(ramp(pal, 0.45), 1), 'N₂ hole 1 shut'],
          [rgba(fg, 0.85), 'N₁ + N₂'],
        ], fg);
        g.restore();

        const both = runs[2];
        const balance = both.emitted - both.blocked - both.detected - both.missed;
        const progress = runs.map((t) => t.emitted).reduce((a, b) => Math.min(a, b), n);
        ctx.stats([
          { label: 'bullets fired, each run', value: `${count(progress)} of ${count(n)}` },
          { label: 'both holes: blocked / detected / missed',
            value: `${count(both.blocked)} / ${count(both.detected)} / ${count(both.missed)}` },
          { label: 'count balance, fired − blocked − detected − missed', value: String(balance) },
          { label: 'bins judged (tails merged to ≥ 5 expected)',
            value: result ? `${result.k} of ${gun.bins}` : 'after the runs' },
          { label: 'χ²/k of N₁₂ against N₁ + N₂',
            value: result ? result.additive.toFixed(3) : 'after the runs' },
          // Wilson–Hilferty is used from MIN_BINS bins on; below, the band is not claimed
          { label: 'χ²ₖ/k band, 0.1 % to 99.9 %',
            value: !result ? 'after the runs' : result.k < MIN_BINS ? `not given for k below ${MIN_BINS}`
              : `${result.band[0].toFixed(3)} to ${result.band[1].toFixed(3)}` },
          { label: `χ²/k against full-contrast fringes, ${HYPOTHESIS_BINS}-bin period`,
            value: result ? result.coherent.toFixed(2) : 'after the runs' },
          { label: `smallest fringe visibility this run rejects, ${HYPOTHESIS_BINS}-bin period`,
            value: result ? result.sensitivity.toFixed(3) : 'after the runs' },
        ]);
      },
    };
  },
};

export default twoSlitClassical;
