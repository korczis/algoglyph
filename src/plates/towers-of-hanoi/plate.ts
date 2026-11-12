import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { apply, hanoi, pegs, type Move } from './hanoi';

export const towersOfHanoi: PlateCode = {
  id: 'towers-of-hanoi',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 30,
  params: [
    { kind: 'range', key: 'n', label: 'Discs', min: 1, max: 14, step: 1, value: 6, rebuild: true },
    { kind: 'range', key: 'speed', label: 'Moves per frame', min: 0.01, max: 4, step: 0.01, value: 0.06 },
    { kind: 'toggle', key: 'loop', label: 'Start again when done', value: true },
    paletteParam('ember'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let n = 6;
    let gen: Generator<Move>;
    let state: number[][];
    let current: Move | null = null;
    let phase = 0; // 0 … 1 through the current move
    let done = 0;
    let deepest = 0;
    let hold = 0;
    const perDisc: number[] = [];

    const build = () => {
      n = num(params, 'n');
      gen = hanoi(n);
      state = pegs(n);
      current = null;
      phase = 0;
      done = 0;
      deepest = 0;
      hold = 0;
      perDisc.length = 0;
      for (let d = 0; d <= n; d++) perDisc.push(0);
    };
    const take = (): boolean => {
      const r = gen.next();
      current = r.done ? null : r.value;
      if (current) deepest = Math.max(deepest, current.depth);
      return current !== null;
    };
    const finish = () => {
      if (!current) return;
      apply(state, current);
      perDisc[current.disc]++;
      done++;
      current = null;
    };

    return {
      setup() {
        build();
        if (ctx.thumbnail) {
          const stop = Math.floor((2 ** n - 1) / 3);
          while (done < stop && take()) finish();
          take();
          phase = 0.5;
        }
      },
      draw() {
        const total = 2 ** n - 1;
        if (!ctx.thumbnail) {
          let budget = num(params, 'speed');
          while (budget > 0) {
            if (!current && !take()) break;
            const use = Math.min(budget, 1 - phase);
            phase += use;
            budget -= use;
            if (phase >= 1 - 1e-9) {
              finish();
              phase = 0;
            }
          }
          if (done === total && ++hold > 150 && bool(params, 'loop')) build();
        }
        const pal = ctx.palette();
        const pad = Math.max(12, ctx.width * 0.03);
        const colW = (ctx.width - 2 * pad) / 3;
        const floor = ctx.height - pad * 2;
        const discH = Math.min(26, (ctx.height * 0.62) / Math.max(n, 1));
        const pegH = discH * (n + 1.2);
        const lift = floor - pegH - discH * 1.6;
        const maxW = colW * 0.92;
        const minW = Math.min(maxW * 0.22, 26);
        const width = (d: number) => (n === 1 ? maxW * 0.6 : minW + ((d - 1) / (n - 1)) * (maxW - minW));
        const pegX = (k: number) => pad + colW * (k + 0.5);
        p.background(...ctx.bg);
        p.noStroke();
        p.fill(...mix(ctx.bg, ctx.fg, 0.25));
        p.rect(pad, floor, ctx.width - 2 * pad, Math.max(3, discH * 0.3), 2);
        for (let k = 0; k < 3; k++) p.rect(pegX(k) - 2.5, floor - pegH, 5, pegH, 2);
        const disc = (d: number, x: number, y: number) => {
          p.fill(...ramp(pal, n === 1 ? 0.6 : (d - 1) / (n - 1)));
          const w = width(d);
          p.rect(x - w / 2, y - discH * 0.92, w, discH * 0.84, discH * 0.3);
        };
        for (let k = 0; k < 3; k++) {
          // the disc in flight is still on its source peg until it lands: draw it once, below
          const shown = current && current.from === k ? state[k].length - 1 : state[k].length;
          for (let i = 0; i < shown; i++) disc(state[k][i], pegX(k), floor - i * discH);
        }
        if (current) {
          // up, across, down: the three legs of the move share its progress
          const fromTop = floor - state[current.from].length * discH + discH;
          const toTop = floor - state[current.to].length * discH;
          const t = phase;
          let x: number;
          let y: number;
          if (t < 1 / 3) {
            x = pegX(current.from);
            y = fromTop + (lift - fromTop) * (t * 3);
          } else if (t < 2 / 3) {
            x = pegX(current.from) + (pegX(current.to) - pegX(current.from)) * ((t - 1 / 3) * 3);
            y = lift;
          } else {
            x = pegX(current.to);
            y = lift + (toTop - lift) * ((t - 2 / 3) * 3);
          }
          disc(current.disc, x, y);
        }
        p.fill(...ctx.fg);
        p.textFont('monospace');
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(Math.max(10, Math.min(14, ctx.width * 0.018)));
        p.text(`${done} / ${total} moves`, pad, pad * 0.6);

        ctx.stats([
          { label: 'Moves made', value: `${done.toLocaleString('en')} of ${total.toLocaleString('en')}` },
          { label: 'Disc in the air', value: current ? `${current.disc} (peg ${current.from + 1} → ${current.to + 1})` : '–' },
          { label: 'Recursion depth of this move', value: current ? String(current.depth) : '–' },
          { label: 'Moves of the smallest disc', value: perDisc[1] ? perDisc[1].toLocaleString('en') : '0' },
          { label: 'Moves of the largest disc', value: String(perDisc[n] ?? 0) },
          { label: 'Deepest call so far', value: String(deepest) },
        ]);
      },
    };
  },
};

export default towersOfHanoi;
