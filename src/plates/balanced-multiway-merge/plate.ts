import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { chartGate } from '../_shared/publish';
import { mulberry32 } from '../../core/random';
import { machine, runs, step, type Machine } from './merge';
import { HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';

export const balancedMultiwayMerge: PlateCode = {
  id: 'balanced-multiway-merge',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 60,
  params: [
    { kind: 'range', key: 'records', label: 'Records in the file', min: 20, max: 600, step: 10,
      value: 240, rebuild: true },
    { kind: 'range', key: 'memory', label: 'Records that fit in memory (M)', min: 2, max: 60, step: 1,
      value: 8, rebuild: true },
    { kind: 'range', key: 'ways', label: 'Ways (P), on 2P tapes', min: 2, max: 6, step: 1, value: 3,
      rebuild: true },
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'Start again when sorted', value: true },
    paletteParam('abyss'),
  ],
  pace: { kind: 'replay', unit: 'records' },
  create(p, ctx) {
    const params = ctx.params;
    let s: Machine;
    let acc = 0;
    let hold = 0;
    let generation = 0;
    const pacer = new Pacer('replay', 'records', 60);
    let range = 1;
    const gate = chartGate();
    let charted = -1;
    /** A looped restart publishes the new, still empty chart in place of the last run's. */
    let restarted = false;

    const build = () => {
      const n = num(params, 'records');
      const rnd = mulberry32(ctx.seed + generation * 7919);
      const input = Array.from({ length: n }, () => Math.floor(rnd() * 1000));
      range = Math.max(1, ...input);
      s = machine(input, num(params, 'memory'), num(params, 'ways'));
      acc = 0;
      hold = 0;
      // the steps a whole sort takes, counted on a copy of the machine
      const copy = machine(input, num(params, 'memory'), num(params, 'ways'));
      let steps = 0;
      while (step(copy)) steps++;
      pacer.start(steps);
    };

    return {
      pace: () => pacer.report(s.phase === 'done', params),
      setup() {
        build();
        if (ctx.thumbnail) {
          // stop half-way through the first merge pass
          const n = s.input.length;
          while (s.writes < n * 1.5 && step(s));
        }
      },
      draw() {
        if (!ctx.thumbnail) {
          acc += pacer.perFrame(params);
          while (acc >= 1) {
            acc -= 1;
            if (!step(s)) break;
          }
          if (s.phase === 'done' && ++hold > HOLD_FRAMES && bool(params, 'loop')) {
            generation++;
            build();
            gate.reset();
            restarted = true;
          }
        }
        const pal = ctx.palette();
        const n = s.input.length;
        const tapes = s.tapes.length;
        const pad = Math.max(12, ctx.width * 0.03);
        const labelW = Math.min(64, ctx.width * 0.12);
        const top = pad + Math.min(70, ctx.height * 0.16);
        const laneH = (ctx.height - top - pad) / tapes;
        const x0 = pad + labelW;
        const w = ctx.width - x0 - pad;
        // records plus a gap per run, sized for the most fragmented moment (distribution)
        const runsMax = Math.ceil(n / s.m);
        const unit = w / (n + Math.ceil(runsMax / s.p) * 1.5 + 2);
        const key = (v: number) => ramp(pal, v / range);
        p.background(...ctx.bg);
        p.noStroke();
        p.textFont('monospace');
        p.textSize(Math.max(9, Math.min(12, laneH * 0.32)));

        // the unread input and the block in memory
        p.fill(...mix(ctx.fg, ctx.bg, 0.3));
        p.textAlign(p.LEFT, p.CENTER);
        const inputY = pad;
        const inputH = (top - pad) * 0.4;
        p.text('input', pad, inputY + inputH / 2);
        const left = n - s.read;
        const iu = w / Math.max(1, n);
        for (let k = 0; k < left; k++) {
          p.fill(...key(s.input[s.read + k]));
          p.rect(x0 + k * iu, inputY, Math.max(0.6, iu * 0.9), inputH);
        }
        const memY = inputY + inputH + (top - pad) * 0.15;
        p.fill(...mix(ctx.fg, ctx.bg, 0.3));
        p.text('memory', pad, memY + inputH / 2);
        p.fill(...mix(ctx.bg, ctx.fg, 0.08));
        const mu = Math.min(iu * 3, w / s.m);
        p.rect(x0, memY, mu * s.m, inputH);
        if (s.phase === 'distribute') {
          for (let k = s.memoryAt; k < s.memory.length; k++) {
            p.fill(...key(s.memory[k]));
            p.rect(x0 + k * mu, memY, Math.max(0.6, mu * 0.9), inputH);
          }
        }

        const inputGroup = s.phase === 'distribute' ? -1 : s.from;
        for (let t = 0; t < tapes; t++) {
          const y = top + t * laneH;
          const reading = inputGroup >= 0 && t >= inputGroup && t < inputGroup + s.p;
          p.fill(...mix(ctx.bg, ctx.fg, t === s.lastTape ? 0.12 : 0.05));
          p.rect(x0, y + laneH * 0.12, w, laneH * 0.76, 3);
          p.fill(...mix(ctx.fg, ctx.bg, 0.3));
          p.text(`T${t + 1} ${s.phase === 'done' ? '' : reading ? 'in' : 'out'}`, pad, y + laneH / 2);
          let x = x0 + unit;
          s.tapes[t].forEach((run, r) => {
            // the front run of an input tape is consumed from its left end during a merge
            const from = reading && s.merging && r === 0 ? s.pos[t - s.from] : 0;
            for (let k = 0; k < run.length; k++) {
              if (k >= from) {
                p.fill(...key(run[k]));
                p.rect(x, y + laneH * 0.2, Math.max(0.6, unit * 0.9), laneH * 0.6);
              }
              x += unit;
            }
            x += unit * 1.5;
          });
        }

        const phase = s.phase === 'distribute' ? 'distributing sorted runs'
          : s.phase === 'merge' ? `merge pass ${s.pass + 1}` : 'sorted';
        ctx.stats([
          { label: 'Phase', value: phase },
          { label: 'Runs on the tapes', value: String(runs(s)) },
          { label: 'Merge passes done', value: String(s.pass) },
          { label: 'Records written', value: s.writes.toLocaleString('en') },
          { label: 'Key comparisons', value: s.comparisons.toLocaleString('en') },
          pacer.row(params),
        ]);
        if (s.runsAfter.length !== charted) gate.mark();
        if ((s.runsAfter.length || restarted) && gate.open()) {
          charted = s.runsAfter.length;
          restarted = s.runsAfter.length === 0 && restarted;
          ctx.chart({
            title: 'Runs left after each pass',
            x: { label: 'pass (0 = distribution)' },
            y: { label: 'runs', log: true },
            series: [{ name: 'Runs', points: s.runsAfter.map((r, k) => [k, r] as [number, number]) }],
          });
        }
      },
    };
  },
};

export default balancedMultiwayMerge;
