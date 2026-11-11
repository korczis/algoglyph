import { gaussian, mulberry32 } from '../../core/random';
import { lineFit } from '../../engines/signal/fit';
import { FRAME, MUL, type Meter, type SignalKernel, type View } from '../../engines/signal/trace';
import { welch, windowOf } from './_fft';

const FS = 8000;
const BLOCK = 2048;
const FRAME_LEN = 1024;
const BANDS_FROM = 50;
const BANDS_TO = 1600;

export function white(n: number, rnd: () => number): Float64Array {
  return Float64Array.from({ length: n }, () => gaussian(rnd));
}

/**
 * Voss–McCartney pink noise: `rows` held random values, row r refreshed every 2^r samples (the
 * row is the counter's number of trailing zeros), summed with a fresh white value.
 */
export function pink(n: number, rnd: () => number, rows = 16): Float64Array {
  const held = Float64Array.from({ length: rows }, () => gaussian(rnd));
  let sum = held.reduce((s, v) => s + v, 0);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const c = i + 1;
    const r = Math.min(rows - 1, 31 - Math.clz32(c & -c));
    sum -= held[r];
    held[r] = gaussian(rnd);
    sum += held[r];
    y[i] = (sum + gaussian(rnd)) / Math.sqrt(rows + 1);
  }
  return y;
}

/** Brown (red) noise: white noise through a leaky integrator y[n] = a·y[n-1] + w[n]. */
export function brown(n: number, rnd: () => number, a = 0.998, meter?: Meter): Float64Array {
  const y = new Float64Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) { s = a * s + gaussian(rnd); y[i] = s * Math.sqrt(1 - a * a); }
  meter?.add(MUL, 2 * n);
  return y;
}

/** Mean power in third-octave bands, and the fitted slope in dB per octave. */
export function slope(psd: Float64Array, fs: number, frame: number, from = BANDS_FROM, to = BANDS_TO): { slope: number; bands: [number, number][] } {
  const df = fs / frame;
  const bands: [number, number][] = [];
  for (let lo = from; lo * 2 ** (1 / 3) <= to * 1.0001; lo *= 2 ** (1 / 3)) {
    const hi = lo * 2 ** (1 / 3);
    let s = 0; let c = 0;
    for (let k = Math.ceil(lo / df); k * df < hi && k < psd.length; k++) { s += psd[k]; c++; }
    if (c) bands.push([Math.sqrt(lo * hi), 10 * Math.log10(s / c)]);
  }
  const fit = lineFit(bands.map((b) => Math.log2(b[0])), bands.map((b) => b[1]));
  return { slope: fit.slope, bands };
}

// Three noises from one seed: white, pink by Voss–McCartney, brown by a leaky integrator. Welch's
// average over more and more frames shows the slopes of 0, −3 and −6 dB per octave emerge.
export const kernel: SignalKernel = {
  rate: 6,
  params: [{ kind: 'range', key: 'rows', label: 'Voss–McCartney rows', min: 4, max: 20, step: 1, value: 16 }],
  run(params, seed, meter): View[] {
    const rnd = mulberry32(seed);
    const blocks = 48;
    const n = blocks * BLOCK;
    const sigs = [
      { name: 'white', y: white(n, rnd), ideal: 0, tone: 0.9 },
      { name: 'pink', y: pink(n, rnd, Number(params.rows)), ideal: -10 * Math.log10(2), tone: 0.55 },
      { name: 'brown', y: brown(n, rnd, 0.998, meter), ideal: -20 * Math.log10(2), tone: 0.15 },
    ];
    meter.add('Samples generated', 3 * n);
    const w = windowOf('hann', FRAME_LEN);
    const views: View[] = [];
    const hop = FRAME_LEN / 2;
    const acc = sigs.map(() => ({ sum: new Float64Array(FRAME_LEN / 2 + 1), frames: 0, from: 0 }));
    for (let b = 1; b <= blocks; b++) {
      const res = sigs.map((s, i) => {
        const a = acc[i];
        // only the frames this block completes are transformed; the running sum is Welch's mean
        for (; a.from + FRAME_LEN <= b * BLOCK; a.from += hop) {
          const one = welch(s.y.subarray(a.from, a.from + FRAME_LEN), FRAME_LEN, hop, w, meter);
          for (let k = 0; k < a.sum.length; k++) a.sum[k] += one.psd[k];
          a.frames++;
          meter.add(FRAME);
        }
        const psd = Float64Array.from(a.sum, (v) => v / Math.max(1, a.frames));
        return { ...s, psd, frames: a.frames, fit: slope(psd, FS, FRAME_LEN) };
      });
      const ref = (psd: Float64Array) => Float64Array.from(psd, (v) => 10 * Math.log10(Math.max(1e-12, v)));
      views.push({
        layout: [[0], [1]],
        panels: [
          { kind: 'lanes', title: `Latest ${BLOCK} samples of each`, lanes: res.map((r) => ({ name: r.name, y: r.y.subarray((b - 1) * BLOCK, b * BLOCK), tone: r.tone })) },
          { kind: 'spectrum', title: `Welch average of ${res[0].frames} frames each (log frequency)`, fmax: FS / 2, fmin: 10, logx: true, floor: -70, ceil: 20,
            series: res.map((r) => ({ name: r.name, y: ref(r.psd), tone: r.tone })),
            marks: [{ at: BANDS_FROM, label: 'fit' }, { at: BANDS_TO }] },
        ],
        stats: [
          { label: 'Frames averaged', value: String(res[0].frames) },
          ...res.map((r) => ({ label: `${r.name} slope (measured)`, value: `${r.fit.slope.toFixed(2)} dB/octave (ideal ${r.ideal.toFixed(2)})` })),
        ],
        counts: meter.snapshot(),
        chart: { title: 'Power in third-octave bands', x: { label: 'frequency (Hz)', log: true }, y: { label: 'power (dB)' },
          series: res.map((r) => ({ name: r.name, points: r.fit.bands })) },
      });
    }
    return views;
  },
};
