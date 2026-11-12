import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { Raster } from '../../core/raster';
import {
  BOUNDED, interlace, julia, mandelbrot, toGrid, toPlane, zoomAt, type View,
} from './escape';

/** Iterations computed per frame before the progressive pass yields to the browser. */
const BUDGET = 3_000_000;
/** Fixed per-pixel overhead, in iteration equivalents, charged against the budget. */
const PIXEL_COST = 40;
/** Colour lookup entries per unit of the smooth count. */
const LUT_RES = 16;
/** Below this smooth count the colour fades into the ground. */
const FADE = 14;
/** Pixel level: computed (1), a copy from a coarser pass (its span), a preview, or unknown. */
const PREVIEW = 3;
const UNKNOWN = 255;
const INSET_ITER = 150;

export const MANDELBROT_VIEWS: Record<string, View> = {
  home: { cx: -0.65, cy: 0, width: 3.6 },
  seahorse: { cx: -0.7445, cy: 0.121, width: 0.025 },
  elephant: { cx: 0.2925, cy: 0.0145, width: 0.02 },
  minibrot: { cx: -1.7686, cy: 0, width: 0.05 },
  spiral: { cx: -0.743643887, cy: 0.131825904, width: 0.0012 },
};
const JULIA_HOME: View = { cx: 0, cy: 0, width: 3.4 };

/** Julia parameters c = [re, im]; whether each lies in M is tested in test/fractal.test.ts. */
export const JULIA_PRESETS: Record<string, [number, number]> = {
  rabbit: [-0.122561, 0.744862],
  basilica: [-1, 0],
  siegel: [-0.390541, -0.586788],
  dendrite: [0, 1],
  seahorse: [-0.745, 0.113],
  spirals: [-0.75, 0.2],
};

function complex(re: number, im: number, digits: number): string {
  const real = re.toFixed(digits).replace('-', '−');
  return `${real} ${im < 0 ? '−' : '+'} ${Math.abs(im).toFixed(digits)}i`;
}

export const mandelbrotJulia: PlateCode = {
  id: 'mandelbrot-julia',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 40,
  params: [
    {
      kind: 'select', key: 'mode', label: 'Set', value: 'mandelbrot', rebuild: true,
      options: [
        { value: 'mandelbrot', label: 'Mandelbrot (vary c)' },
        { value: 'julia', label: 'Julia (fix c)' },
      ],
    },
    {
      kind: 'select', key: 'view', label: 'View', value: 'home', rebuild: true,
      hint: 'Mandelbrot starting views; choosing one resets the zoom.',
      options: [
        { value: 'home', label: 'Home' },
        { value: 'seahorse', label: 'Seahorse valley' },
        { value: 'elephant', label: 'Elephant valley' },
        { value: 'minibrot', label: 'Mini-brot on the antenna' },
        { value: 'spiral', label: 'Double spiral' },
      ],
    },
    {
      kind: 'select', key: 'julia', label: 'Julia parameter c', value: 'rabbit', rebuild: true,
      hint: 'Used in Julia mode.',
      options: [
        { value: 'rabbit', label: 'Douady rabbit' },
        { value: 'basilica', label: 'Basilica (c = −1)' },
        { value: 'siegel', label: 'Siegel disc' },
        { value: 'dendrite', label: 'Dendrite (c = i)' },
        { value: 'seahorse', label: 'Seahorse dust' },
        { value: 'spirals', label: 'Spiral dust' },
        { value: 'pointer', label: 'Follow the pointer' },
      ],
    },
    {
      kind: 'select', key: 'click', label: 'Click', value: 'in',
      options: [
        { value: 'in', label: 'Zoom in ×3' },
        { value: 'out', label: 'Zoom out ×3' },
      ],
    },
    { kind: 'range', key: 'iter', label: 'Max iterations', min: 50, max: 2000, step: 50,
      value: 300, hint: 'Deeper zooms need more.' },
    { kind: 'range', key: 'res', label: 'Pixel size', min: 1, max: 4, step: 1, value: 1,
      rebuild: true },
    { kind: 'range', key: 'density', label: 'Colour cycle density', min: 0.1, max: 4,
      step: 0.05, value: 1 },
    { kind: 'toggle', key: 'inset', label: 'Show the c-plane map', value: true },
    paletteParam('ember'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let rw = 1;
    let rh = 1;
    let res = 1;
    let mu: Float32Array;
    let level: Uint8Array;
    let raster: Raster;
    let order: [number, number][] = [];
    let cursor = 0;
    let view: View = MANDELBROT_VIEWS.home;
    let isJulia = false;
    let pointer = false;
    let cr = 0;
    let ci = 0;
    let maxIter = 300;
    let rowsDone = 0;
    let pixelsDone = 0;
    let escaped = 0;
    let muSum = 0;
    let lut = new Uint8ClampedArray(0);
    let lutKey = '';
    let dirty = true;
    let inset: Raster | null = null;
    let insetMu: Float32Array | null = null;
    let insetShown = false;

    const buildLut = () => {
      const pal = ctx.palette();
      const density = num(params, 'density');
      const n = (maxIter + 2) * LUT_RES;
      lut = new Uint8ClampedArray(n * 3);
      for (let j = 0; j < n; j++) {
        const v = j / LUT_RES;
        const c = ramp(pal, density * 0.3 * (Math.sqrt(v + 1) - 1), true);
        const k = Math.min(1, v / FADE) ** 1.5;
        const m = mix(ctx.bg, c, k);
        lut[j * 3] = m[0];
        lut[j * 3 + 1] = m[1];
        lut[j * 3 + 2] = m[2];
      }
    };

    const paint = (target: Raster, values: Float32Array, from: number, to: number) => {
      const d = target.data;
      const top = lut.length / 3 - 1;
      const [br, bgc, bb] = ctx.bg;
      for (let i = from; i < to; i++) {
        const v = values[i];
        const o = i * 4;
        if (v < 0) {
          d[o] = br;
          d[o + 1] = bgc;
          d[o + 2] = bb;
        } else {
          const j = Math.min(top, (v * LUT_RES) | 0) * 3;
          d[o] = lut[j];
          d[o + 1] = lut[j + 1];
          d[o + 2] = lut[j + 2];
        }
        d[o + 3] = 255;
      }
    };

    const restart = (keep: number) => {
      cursor = 0;
      rowsDone = 0;
      pixelsDone = 0;
      escaped = 0;
      muSum = 0;
      if (keep) level.fill(keep);
      dirty = true;
    };

    const renderRow = (r: number, span: number): number => {
      let cost = rw * PIXEL_COST;
      const base = r * rw;
      const [re0, im] = toPlane(view, rw, rh, 0.5, r + 0.5);
      const step = view.width / rw;
      for (let x = 0; x < rw; x++) {
        const re = re0 + x * step;
        const v = isJulia ? julia(re, im, cr, ci, maxIter) : mandelbrot(re, im, maxIter);
        mu[base + x] = v;
        level[base + x] = 1;
        if (v === BOUNDED) cost += maxIter;
        else {
          cost += v + 1;
          escaped++;
          muSum += v;
        }
      }
      pixelsDone += rw;
      rowsDone++;
      // let this row stand in for the rows below it that nothing better covers yet
      let last = r + 1;
      for (let y = r + 1; y < r + span; y++) {
        for (let x = 0; x < rw; x++) {
          const i = y * rw + x;
          if (level[i] > span) {
            mu[i] = mu[base + x];
            level[i] = span;
          }
        }
        last = y + 1;
      }
      paint(raster, mu, base, last * rw);
      return cost;
    };

    /** Resample the current picture into a new view, as a preview until rows are recomputed. */
    const moveTo = (next: View) => {
      const old = mu.slice();
      const oldView = view;
      view = next;
      // the old grid coordinate is affine in the new one
      const ratio = view.width / oldView.width;
      for (let y = 0; y < rh; y++) {
        const [re, im] = toPlane(view, rw, rh, 0.5, y + 0.5);
        const [ox0, oy] = toGrid(oldView, rw, rh, re, im);
        for (let x = 0; x < rw; x++) {
          const ox = ox0 + x * ratio;
          const i = y * rw + x;
          if (ox >= 0 && oy >= 0 && ox < rw && oy < rh) {
            mu[i] = old[Math.floor(oy) * rw + Math.floor(ox)];
            level[i] = PREVIEW;
          } else {
            mu[i] = BOUNDED;
            level[i] = UNKNOWN;
          }
        }
      }
      paint(raster, mu, 0, rw * rh);
      restart(0);
    };

    const zoom = (x: number, y: number) => {
      const factor = str(params, 'click') === 'out' ? 1 / 3 : 3;
      const gx = (x / ctx.width) * rw;
      const gy = (y / ctx.height) * rh;
      const next = zoomAt(view, rw, rh, gx, gy, factor);
      // stop where neighbouring pixels would no longer be distinct doubles
      const scale = Math.max(1, Math.abs(next.cx), Math.abs(next.cy));
      if (next.width / rw < 16 * Number.EPSILON * scale) next.width = view.width;
      next.width = Math.min(next.width, 12);
      moveTo(next);
    };

    const pick = (x: number, y: number) => {
      [cr, ci] = toPlane(MANDELBROT_VIEWS.home, ctx.width, ctx.height, x, y);
      restart(UNKNOWN);
    };

    const buildInset = () => {
      const iw = Math.max(48, Math.round(ctx.width * 0.22));
      const ih = Math.max(30, Math.round((iw * ctx.height) / ctx.width));
      inset = new Raster(iw, ih);
      insetMu = new Float32Array(iw * ih);
      for (let y = 0; y < ih; y++) {
        for (let x = 0; x < iw; x++) {
          const [re, im] = toPlane(MANDELBROT_VIEWS.home, iw, ih, x + 0.5, y + 0.5);
          insetMu[y * iw + x] = mandelbrot(re, im, INSET_ITER);
        }
      }
    };

    const drawInset = () => {
      if (!inset || !insetMu) return;
      const margin = 12;
      const x0 = margin;
      const y0 = ctx.height - inset.h - margin;
      inset.blit(p, true, x0, y0, inset.w, inset.h);
      p.noFill();
      p.stroke(...mix(ctx.bg, ctx.fg, 0.35));
      p.strokeWeight(1);
      p.rect(x0 - 0.5, y0 - 0.5, inset.w + 1, inset.h + 1);
      const [gx, gy] = toGrid(MANDELBROT_VIEWS.home, inset.w, inset.h, cr, ci);
      p.stroke(...ctx.fg);
      p.strokeWeight(1.5);
      p.circle(x0 + gx, y0 + gy, 9);
      p.line(x0 + gx - 9, y0 + gy, x0 + gx - 5, y0 + gy);
      p.line(x0 + gx + 5, y0 + gy, x0 + gx + 9, y0 + gy);
    };

    return {
      setup() {
        res = num(params, 'res');
        rw = Math.max(1, Math.floor(ctx.width / res));
        rh = Math.max(1, Math.floor(ctx.height / res));
        mu = new Float32Array(rw * rh).fill(BOUNDED);
        level = new Uint8Array(rw * rh).fill(UNKNOWN);
        raster = new Raster(rw, rh);
        raster.fill(ctx.bg);
        order = interlace(rh);
        isJulia = str(params, 'mode') === 'julia';
        const preset = str(params, 'julia');
        pointer = isJulia && preset === 'pointer';
        [cr, ci] = JULIA_PRESETS[preset] ?? JULIA_PRESETS.rabbit;
        view = isJulia ? { ...JULIA_HOME }
          : { ...(MANDELBROT_VIEWS[str(params, 'view')] ?? MANDELBROT_VIEWS.home) };
        maxIter = num(params, 'iter');
        lutKey = '';
        inset = null;
        insetMu = null;
        if (isJulia) buildInset();
        restart(0);
      },
      reset() {
        // back to the starting view; a c picked with the pointer is the picture, so it stays
        const picked: [number, number] | null = pointer ? [cr, ci] : null;
        this.setup();
        if (picked) {
          [cr, ci] = picked;
          restart(UNKNOWN);
        }
      },
      pressed(x, y) {
        if (pointer) pick(x, y);
        else zoom(x, y);
      },
      dragged(x, y) {
        if (pointer) pick(x, y);
      },
      draw() {
        const iter = num(params, 'iter');
        if (iter !== maxIter) {
          maxIter = iter;
          restart(PREVIEW);
        }
        const showInset = isJulia && bool(params, 'inset');
        if (showInset !== insetShown) {
          insetShown = showInset;
          dirty = true;
        }
        const key = `${ctx.palette().id}|${num(params, 'density')}|${maxIter}`;
        if (key !== lutKey) {
          lutKey = key;
          buildLut();
          paint(raster, mu, 0, rw * rh);
          if (inset && insetMu) paint(inset, insetMu, 0, inset.w * inset.h);
          dirty = true;
        }

        let spent = 0;
        while (cursor < order.length && (spent === 0 || spent < BUDGET)) {
          const [r, span] = order[cursor++];
          spent += renderRow(r, span);
          dirty = true;
        }

        if (dirty) {
          raster.blit(p, res === 1);
          if (showInset) drawInset();
          dirty = false;
        }

        const digits = Math.min(15, Math.max(3, Math.ceil(-Math.log10(view.width)) + 3));
        const home = isJulia ? JULIA_HOME.width : MANDELBROT_VIEWS.home.width;
        const rows = [
          { label: 'view centre', value: complex(view.cx, view.cy, digits) },
          {
            label: 'view width',
            value: `${view.width.toPrecision(3)} (×${(home / view.width).toPrecision(3)})`,
          },
          { label: 'max iterations', value: maxIter.toLocaleString('en') },
          {
            label: 'escaped',
            value: pixelsDone
              ? `${((100 * escaped) / pixelsDone).toFixed(1)} % of `
                + `${pixelsDone.toLocaleString('en')} px`
              : '—',
          },
          { label: 'mean escape count ν', value: escaped ? (muSum / escaped).toFixed(2) : '—' },
          { label: 'rows rendered', value: `${rowsDone} / ${rh}` },
        ];
        if (isJulia) rows.splice(1, 0, { label: 'c', value: complex(cr, ci, 5) });
        ctx.stats(rows);
      },
    };
  },
};

export default mandelbrotJulia;
