import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type Plate } from '../../core/plate';
import { Raster } from '../../core/raster';
import { fnv1aWords, popcount, sha256Words } from './hash';

const FUNCTIONS = {
  sha256: { label: 'SHA-256', bits: 256, run: sha256Words },
  fnv1a: { label: 'FNV-1a 32', bits: 32, run: fnv1aWords },
} as const;

type Fn = keyof typeof FUNCTIONS;

export const hashAvalanche: Plate = {
  id: 'hash-avalanche',
  title: 'Avalanche Matrix',
  category: 'algorithms',
  mode: '2d',
  aspect: 16 / 10,
  summary: 'Flip one input bit, count which output bits flip. A good hash turns the matrix into '
    + 'flat grey noise at exactly one half; a weak one leaves its wiring exposed.',
  notes: [
    'Rows are the 256 bits of a random 32-byte message, columns the output bits of the hash. '
      + 'Each trial picks a message and an input bit, flips it, hashes both versions and adds the '
      + 'difference to that row. A cell\'s colour is how often that output bit flipped.',
    'The strict avalanche criterion asks for every cell to be 1/2. The colour scale is '
      + 'stretched around one half (the gain), so the remaining noise for SHA-256 is sampling '
      + 'error, shrinking like 1/√trials, and it is reported as the largest deviation measured.',
    'Switch to FNV-1a: a fast multiplicative hash for tables, not for security. A flip in its '
      + 'last byte passes through one multiplication, which only carries upwards: the output bit '
      + 'at the flipped position always flips, the bits below it never do, and the bottom rows '
      + 'turn into a hard staircase within seconds.',
  ],
  complexity: '1 hash pair per trial',
  tags: ['cryptography', 'SHA-256', 'statistics'],
  thumbnailFrames: 40,
  params: [
    {
      kind: 'select', key: 'fn', label: 'Function', value: 'sha256', rebuild: true,
      options: Object.entries(FUNCTIONS).map(([value, f]) => ({ value, label: f.label })),
    },
    { kind: 'range', key: 'trials', label: 'Trials per frame', min: 16, max: 4096, step: 16,
      value: 512 },
    { kind: 'range', key: 'gain', label: 'Gain around 1/2', min: 1, max: 40, step: 1, value: 8 },
    paletteParam('spectral'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let fn: Fn = 'sha256';
    let flips: Uint32Array;
    let tries: Uint32Array;
    let raster: Raster;
    let trials = 0;
    let flippedSum = 0;
    const msg = new Uint32Array(8);
    const alt = new Uint32Array(8);
    const ha = new Uint32Array(8);
    const hb = new Uint32Array(8);
    const word = () => Math.floor(ctx.rnd() * 0x100000000) >>> 0;

    return {
      setup() {
        fn = (str(params, 'fn') in FUNCTIONS ? str(params, 'fn') : 'sha256') as Fn;
        const bits = FUNCTIONS[fn].bits;
        flips = new Uint32Array(256 * bits);
        tries = new Uint32Array(256);
        raster = new Raster(bits, 256);
        trials = 0;
        flippedSum = 0;
      },
      draw() {
        const f = FUNCTIONS[fn];
        const outWords = f.bits / 32;
        const n = num(params, 'trials');
        for (let t = 0; t < n; t++) {
          for (let i = 0; i < 8; i++) msg[i] = word();
          const bit = Math.floor(ctx.rnd() * 256);
          alt.set(msg);
          alt[bit >> 5] ^= 0x80000000 >>> (bit & 31);
          f.run(msg, ha);
          f.run(alt, hb);
          tries[bit]++;
          const row = bit * f.bits;
          for (let k = 0; k < outWords; k++) {
            const d = (ha[k] ^ hb[k]) >>> 0;
            flippedSum += popcount(d);
            for (let b = 0; b < 32; b++) if ((d >>> (31 - b)) & 1) flips[row + k * 32 + b]++;
          }
        }
        trials += n;

        const pal = ctx.palette();
        const gain = num(params, 'gain');
        let worst = 0;
        for (let r = 0; r < 256; r++) {
          for (let b = 0; b < f.bits; b++) {
            const q = tries[r] ? flips[r * f.bits + b] / tries[r] : 0.5;
            const dev = q - 0.5;
            if (tries[r] && Math.abs(dev) > worst) worst = Math.abs(dev);
            const t = 0.5 + Math.max(-0.5, Math.min(0.5, dev * gain));
            const c = Math.abs(dev * gain) < 0.04 ? mix(ctx.bg, ctx.fg, 0.16) : ramp(pal, t);
            raster.set(b, r, c[0], c[1], c[2]);
          }
        }

        p.background(...ctx.bg);
        const margin = 28;
        const side = Math.min(ctx.height - margin * 2, ctx.width * 0.62);
        const mw = f.bits === 256 ? side : side * 0.25;
        const mx = (ctx.width - mw) / 2 - ctx.width * 0.12;
        raster.blit(p, false, mx, margin, mw, side);

        p.noStroke();
        p.fill(...ctx.fg);
        p.textFont('monospace');
        p.textSize(10);
        p.text('input bit ↓ (0 → 255)', mx, margin - 10);
        p.text(`${f.label} output bits →`, mx, margin + side + 18);

        // legend: the gain-stretched scale from "never flips" to "always flips"
        const lx = mx + mw + 40;
        const lw = 14;
        for (let i = 0; i < 100; i++) {
          p.fill(...ramp(pal, 1 - i / 99));
          p.rect(lx, margin + (i / 100) * side, lw, side / 100 + 1);
        }
        p.fill(...ctx.fg);
        const top = (0.5 + 0.5 / gain).toFixed(3);
        const bottom = (0.5 - 0.5 / gain).toFixed(3);
        p.text(`≥ ${top}`, lx + lw + 6, margin + 8);
        p.text('0.500', lx + lw + 6, margin + side / 2 + 3);
        p.text(`≤ ${bottom}`, lx + lw + 6, margin + side);

        const mean = trials ? flippedSum / trials : 0;
        ctx.stats([
          { label: 'trials', value: trials.toLocaleString('en') },
          { label: 'mean output bits flipped', value: `${mean.toFixed(2)} of ${f.bits}` },
          { label: 'ideal', value: `${f.bits / 2}` },
          { label: 'largest |P − ½| in a cell', value: worst.toFixed(4) },
        ]);
      },
    };
  },
};
