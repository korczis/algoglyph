import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode } from '../../core/plate';
import { permutations, type Method, type Step } from './perm';
import { Pacer, paceParam } from '../../core/pace';

function factorial(n: number): number {
  let f = 1;
  for (let k = 2; k <= n; k++) f *= k;
  return f;
}

export const permutationGeneration: PlateCode = {
  id: 'permutation-generation',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 40,
  params: [
    { kind: 'range', key: 'n', label: 'Items', min: 2, max: 7, step: 1, value: 5, rebuild: true },
    {
      kind: 'select', key: 'method', label: 'Method', value: 'heap', rebuild: true,
      options: [
        { value: 'heap', label: "Heap's method (any pair)" },
        { value: 'johnson-trotter', label: 'Johnson–Trotter (neighbours only)' },
      ],
    },
    paceParam(),
    // the picture is painted once, column by column, so a new palette repaints it from the start
    { ...paletteParam('spectral'), rebuild: true },
  ],
  pace: { kind: 'replay', unit: 'permutations' },
  create(p, ctx) {
    const params = ctx.params;
    const n = num(params, 'n');
    const total = factorial(n);
    const pacer = new Pacer('replay', 'permutations', 120);
    pacer.start(total);
    const gen = permutations(n, str(params, 'method') as Method);
    const seen = new Set<string>();
    let made = 0;
    let adjacent = 0;
    let longest = 0;
    let acc = 0;
    let cell = 4;
    let perBand = 1;
    let ox = 0;
    let oy = 0;

    // lay out n! columns of n cells in bands that fill the canvas
    const layout = () => {
      const W = ctx.width * 0.94;
      const H = ctx.height * 0.92;
      for (cell = Math.max(1, Math.floor(Math.sqrt((W * H) / (total * (n + 1))))); cell > 1; cell--) {
        perBand = Math.floor(W / cell);
        const bands = Math.ceil(total / perBand);
        if (bands * (n + 1) * cell <= H) break;
      }
      perBand = Math.max(1, Math.floor(W / cell));
      const bands = Math.ceil(total / perBand);
      ox = (ctx.width - Math.min(total, perBand) * cell) / 2;
      oy = (ctx.height - (bands * (n + 1) - 1) * cell) / 2;
    };

    const paint = (s: Step) => {
      const pal = ctx.palette();
      const k = made;
      const x = ox + (k % perBand) * cell;
      const y = oy + Math.floor(k / perBand) * (n + 1) * cell;
      p.noStroke();
      for (let r = 0; r < n; r++) {
        p.fill(...ramp(pal, n === 1 ? 0.5 : s.perm[r] / (n - 1)));
        p.rect(x, y + r * cell, cell + 0.4, cell + 0.4);
      }
      if (s.i >= 0 && cell >= 3) {
        // a thin thread joins the two cells this permutation exchanged
        p.stroke(...mix(ctx.bg, ctx.fg, 0.85));
        p.strokeWeight(Math.max(1, cell * 0.2));
        p.line(x + cell / 2, y + (s.i + 0.5) * cell, x + cell / 2, y + (s.j + 0.5) * cell);
      }
    };

    const next = (): boolean => {
      const r = gen.next();
      if (r.done) return false;
      const s = r.value;
      paint(s);
      seen.add(s.perm.join(''));
      if (s.i >= 0) {
        if (s.j - s.i === 1) adjacent++;
        longest = Math.max(longest, s.j - s.i);
      }
      made++;
      return true;
    };

    return {
      pace: () => pacer.report(made >= total, params),
      setup() {
        p.background(...ctx.bg);
        layout();
        if (ctx.thumbnail) while (next());
      },
      draw() {
        if (ctx.thumbnail) return;
        acc += pacer.perFrame(params);
        while (acc >= 1) {
          acc -= 1;
          if (!next()) break;
        }
        const exchanges = Math.max(0, made - 1);
        ctx.stats([
          { label: 'Permutations', value: `${made.toLocaleString('en')} of ${total.toLocaleString('en')}` },
          { label: 'Distinct so far', value: seen.size.toLocaleString('en') },
          { label: 'Exchanges', value: exchanges.toLocaleString('en') },
          { label: 'Of them between neighbours', value: adjacent.toLocaleString('en') },
          { label: 'Widest exchange (positions apart)', value: String(longest) },
          pacer.row(params),
        ]);
      },
    };
  },
};

export default permutationGeneration;
