import { str } from '../../core/plate';
import { mulberry32 } from '../../engines/signal/input';
import { MUL, type Meter, type Series, type SignalKernel, type View } from '../../engines/signal/trace';

const S3 = Math.sqrt(3);
const A10 = Math.sqrt(10);
const B10 = Math.sqrt(5 + 2 * A10);

/** Daubechies scaling filters with p vanishing moments, normalised to Σh = √2. */
export const FILTERS: Record<string, { label: string; h: number[] }> = {
  db1: { label: 'Haar (db1)', h: [1, 1].map((v) => v / Math.SQRT2) },
  db2: { label: 'D4 (db2)', h: [1 + S3, 3 + S3, 3 - S3, 1 - S3].map((v) => v / (4 * Math.SQRT2)) },
  db3: { label: 'D6 (db3)', h: [1 + A10 + B10, 5 + A10 + 3 * B10, 10 - 2 * A10 + 2 * B10,
    10 - 2 * A10 - 2 * B10, 5 + A10 - 3 * B10, 1 + A10 - B10].map((v) => v / (16 * Math.SQRT2)) },
  db4: { label: 'D8 (db4)', h: [0.2303778133088964, 0.7148465705529154, 0.6308807679298587,
    -0.0279837694168599, -0.1870348117190931, 0.0308413818355607, 0.0328830116668852,
    -0.0105974017850690] },
};

/** The quadrature-mirror wavelet filter g_k = (-1)^k h_{L-1-k}. */
export function highpass(h: number[]): number[] {
  return h.map((_, k) => (k % 2 ? -1 : 1) * h[h.length - 1 - k]);
}

/** One periodic analysis step: approximation and detail, each half the length. */
export function analyse(x: Float64Array, h: number[], meter?: Meter): [Float64Array, Float64Array] {
  const n = x.length; const g = highpass(h);
  const a = new Float64Array(n / 2); const d = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    for (let k = 0; k < h.length; k++) {
      const v = x[(2 * i + k) % n];
      a[i] += h[k] * v;
      d[i] += g[k] * v;
    }
  }
  meter?.add(MUL, n * h.length);
  return [a, d];
}

/** The inverse step: the transpose of `analyse`, exact because the filters are orthonormal. */
export function synthesise(a: Float64Array, d: Float64Array, h: number[], meter?: Meter): Float64Array {
  const n = 2 * a.length; const g = highpass(h);
  const x = new Float64Array(n);
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < h.length; k++) x[(2 * i + k) % n] += h[k] * a[i] + g[k] * d[i];
  }
  meter?.add(MUL, 2 * a.length * h.length);
  return x;
}

/** `levels` octaves: details d1 (finest) .. dL and the final approximation. */
export function dwt(x: Float64Array, h: number[], levels: number, meter?: Meter): { details: Float64Array[]; approx: Float64Array } {
  const details: Float64Array[] = [];
  let a = x;
  for (let j = 0; j < levels && a.length >= 2; j++) {
    const [na, d] = analyse(a, h, meter);
    details.push(d);
    a = na;
  }
  return { details, approx: a };
}

export function idwt(details: Float64Array[], approx: Float64Array, h: number[], meter?: Meter): Float64Array {
  let a = approx;
  for (let j = details.length - 1; j >= 0; j--) a = synthesise(a, details[j], h, meter);
  return a;
}

function testSignal(n: number, seed: number): Float64Array {
  const rnd = mulberry32(seed);
  const step = Math.floor(n * (0.3 + 0.2 * rnd()));
  const burst = Math.floor(n * (0.65 + 0.15 * rnd()));
  return Float64Array.from({ length: n }, (_, i) => {
    const t = i / n;
    let v = Math.sin(2 * Math.PI * 1.5 * t) + (i >= step ? 0.8 : 0);
    const u = (i - burst) / (n * 0.02);
    v += 0.6 * Math.exp(-u * u) * Math.sin(2 * Math.PI * 0.18 * (i - burst));
    return v;
  });
}

const energy = (x: ArrayLike<number>) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return s; };

// Split octave by octave into details and a coarser approximation; then keep only the largest
// coefficients and rebuild, which is wavelet compression.
export const kernel: SignalKernel = {
  rate: 1.2,
  params: [
    { kind: 'select', key: 'wavelet', label: 'Wavelet', value: 'db2', options: Object.entries(FILTERS).map(([value, f]) => ({ value, label: f.label })) },
    { kind: 'range', key: 'levels', label: 'Levels', min: 1, max: 6, step: 1, value: 5 },
    { kind: 'range', key: 'keep', label: 'Coefficients kept for compression (%)', min: 1, max: 50, step: 1, value: 8 },
  ],
  run(params, seed, meter): View[] {
    const n = 512;
    const h = FILTERS[str(params, 'wavelet')]?.h ?? FILTERS.db2.h;
    const levels = Number(params.levels);
    const x = testSignal(n, seed);
    const total = energy(x);
    const views: View[] = [];
    const details: Float64Array[] = [];
    let a = x;
    const lane = (d: Float64Array, name: string, tone: number): Series => ({ name, y: d, stems: true, tone });
    const energies: [number, number][] = [];
    for (let j = 1; j <= levels; j++) {
      const [na, d] = analyse(a, h, meter);
      details.push(d);
      a = na;
      energies.push([j, (100 * energy(d)) / total]);
      // the approximation at this octave, brought back to full length with the details zeroed
      const smooth = idwt(details.map((q) => new Float64Array(q.length)), a, h);
      views.push({
        layout: [[0], [1]],
        panels: [
          { kind: 'lanes', title: `Coefficients after ${j} level${j > 1 ? 's' : ''}`, lanes: [
            { name: 'x', y: x, tone: -1 }, ...details.map((q, i) => lane(q, `d${i + 1}`, 0.2 + 0.6 * (i / Math.max(1, levels - 1)))),
            lane(a, `a${j}`, 0.95)] },
          { kind: 'wave', title: `Approximation a${j}, rebuilt to full length`, series: [
            { name: 'x', y: x, tone: -1, alpha: 110 }, { name: `a${j}`, y: smooth, tone: 0.8 }] },
        ],
        stats: [
          { label: 'Level', value: `${j} of ${levels}` },
          { label: `Energy in d${j}`, value: `${energies[j - 1][1].toFixed(2)} %` },
          { label: `Energy in a${j}`, value: `${((100 * energy(a)) / total).toFixed(2)} %` },
        ],
        counts: meter.snapshot(),
        chart: { title: 'Energy by octave', x: { label: 'level' }, y: { label: 'share of energy (%)' }, series: [{ name: 'detail energy', points: energies.slice() }] },
      });
    }
    // perfect reconstruction, then compression by keeping the largest coefficients
    const back = idwt(details, a, h, meter);
    let worst = 0;
    for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(back[i] - x[i]));
    const all = [...details.flatMap((d) => Array.from(d)), ...Array.from(a)].map(Math.abs).sort((p, q) => q - p);
    const kept = Math.max(1, Math.round((Number(params.keep) / 100) * n));
    const cut = all[kept - 1];
    let k = 0;
    const thr = (d: Float64Array) => d.map((v) => (Math.abs(v) >= cut && k++ < kept ? v : 0));
    const ta = thr(a);
    const td = details.map(thr);
    const comp = idwt(td, ta, h, meter);
    let err = 0;
    for (let i = 0; i < n; i++) err += (comp[i] - x[i]) ** 2;
    const snr = 10 * Math.log10(total / Math.max(1e-300, err));
    views.push({
      layout: [[0], [1]],
      panels: [
        { kind: 'lanes', title: `Kept: the largest ${kept} of ${n} coefficients`, lanes: [
          ...td.map((q, i) => lane(q, `d${i + 1}`, 0.2 + 0.6 * (i / Math.max(1, levels - 1)))), lane(ta, `a${levels}`, 0.95)] },
        { kind: 'wave', title: 'Rebuilt from the kept coefficients', series: [
          { name: 'x', y: x, tone: -1, alpha: 110 }, { name: 'rebuilt', y: comp, tone: 0.8 }] },
      ],
      stats: [
        { label: 'Perfect reconstruction, largest error', value: worst.toExponential(2) },
        { label: 'Coefficients kept', value: `${kept} of ${n}` },
        { label: 'Compression SNR (measured)', value: `${snr.toFixed(1)} dB` },
      ],
      counts: meter.snapshot(),
      chart: views[views.length - 1]?.chart,
    });
    return views;
  },
  lab(x, _fs, meter) {
    const { details, approx } = dwt(x, FILTERS.db2.h, 5, meter);
    return { kind: 'lanes', title: 'D4 coefficients, five octaves', lanes: [
      ...details.map((d, i) => ({ name: `d${i + 1}`, y: d, stems: true, tone: 0.2 + 0.15 * i })), { name: 'a5', y: approx, stems: true, tone: 0.95 }] };
  },
};
