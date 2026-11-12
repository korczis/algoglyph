import { str } from '../../core/plate';
import { addNoise, chirp, chirpFreq, mulberry32, tones } from '../../engines/signal/input';
import { chartPoints, FRAME, fmtHz, MUL, type Meter, type SignalKernel, type View } from '../../engines/signal/trace';
import { amplitude, argmax, parabolic, WINDOWS, windowOf } from './_fft';

const FS = 8000;
const LEN = 16000;
const F0 = 200;
const F1 = 3400;

/** Short-time amplitude spectra: one row per frame, bins 0..frame/2. */
export function stft(x: Float64Array, frame: number, hop: number, win: string, meter?: Meter): Float64Array[] {
  const w = windowOf(win, frame);
  const rows: Float64Array[] = [];
  for (let from = 0; from + frame <= x.length; from += hop) {
    rows.push(amplitude(x, w, frame, meter, from));
    meter?.add(FRAME);
  }
  return rows;
}

const dbOf = (a: number) => (a > 0 ? Math.max(-120, 20 * Math.log10(a)) : -120);

// A chirp over a steady tone in noise: each frame's peak follows the chirp, while Welch's average
// of all frames keeps the tone and lowers the noise's variance.
export const kernel: SignalKernel = {
  params: [
    { kind: 'select', key: 'frame', label: 'Frame length', value: '256', options: ['128', '256', '512', '1024'].map((v) => ({ value: v, label: `${v} samples` })) },
    { kind: 'select', key: 'overlap', label: 'Overlap', value: '0.5', options: [
      { value: '0', label: 'None' }, { value: '0.5', label: '50 %' }, { value: '0.75', label: '75 %' }] },
    { kind: 'select', key: 'window', label: 'Window', value: 'hann', options: WINDOWS.map((w) => ({ value: w.id, label: w.label })) },
    { kind: 'range', key: 'snr', label: 'Signal-to-noise ratio (dB)', min: -10, max: 40, step: 1, value: 10 },
    { kind: 'select', key: 'len', label: 'Signal length (samples)', value: String(LEN),
      options: ['4000', '8000', '16000'].map((v) => ({ value: v, label: `${v} samples` })) },
  ],
  *run(params, seed, meter): Generator<View | null> {
    const rnd = mulberry32(seed);
    const frame = Number(str(params, 'frame'));
    const hop = Math.max(1, Math.round(frame * (1 - Number(str(params, 'overlap')))));
    const tone = Math.round(1000 + rnd() * 1500);
    const len = Number(str(params, 'len'));
    const x = chirp(len, FS, F0, F1, 0.5);
    const t = tones(len, FS, [{ f: tone, a: 0.25 }]);
    for (let i = 0; i < len; i++) x[i] += t[i];
    addNoise(x, rnd, Number(params.snr));
    const win = str(params, 'window');
    const w = windowOf(win, frame);
    const rows: Float32Array[] = [];
    const avg = new Float64Array(frame / 2 + 1);
    const total = Math.floor((len - frame) / hop) + 1;
    const every = Math.max(1, Math.ceil(total / 80));
    const df = FS / frame;
    let ridge = 0;
    for (let f = 0; f < total; f++) {
      const from = f * hop;
      const a = amplitude(x, w, frame, meter, from);
      meter.add(FRAME);
      for (let k = 0; k < a.length; k++) avg[k] += a[k] * a[k];
      meter.add(MUL, a.length);
      rows.push(Float32Array.from(a, dbOf));
      const k = argmax(a, 1, a.length - 1);
      const peak = (k + parabolic(a[k - 1], a[k], a[k + 1])) * df;
      const truth = chirpFreq(len, FS, F0, F1, from + frame / 2);
      ridge += Math.abs(peak - truth);
      if (f % every !== 0 && f !== total - 1) continue;
      const mean = Float64Array.from(avg, (v) => 10 * Math.log10(Math.max(1e-12, v / (f + 1))));
      const wk = argmax(mean, 1, mean.length - 1);
      const sorted = Array.from(mean).sort((p, q) => p - q);
      const segment = Float64Array.from({ length: frame }, (_, i) => x[from + i] * w[i]);
      yield {
        layout: [[0], [1, 2]],
        panels: [
          { kind: 'waterfall', title: `Spectrogram, ${frame}-sample ${win} frames, hop ${hop}`, rows, upto: rows.length, fmax: FS / 2, floor: -40, ceil: -6 },
          { kind: 'wave', title: `Frame ${f + 1}, windowed`, series: [{ name: 'x·w', y: segment, tone: 0.7 }] },
          { kind: 'spectrum', title: 'This frame and the running average', fmax: FS / 2, floor: -80, ceil: 0, series: [
            { name: 'frame', y: rows[rows.length - 1], tone: 0.75, alpha: 170 },
            { name: 'Welch average', y: mean, tone: 0.2 }],
          marks: [{ at: truth, label: 'chirp' }] },
        ],
        stats: [
          { label: 'Frame time', value: `${((from + frame / 2) / FS).toFixed(3)} s` },
          { label: 'Frame peak (measured)', value: fmtHz(peak) },
          { label: 'Chirp frequency at that time', value: fmtHz(truth) },
          { label: 'Mean ridge error so far', value: fmtHz(ridge / (f + 1)) },
          { label: 'Welch average peak', value: `${fmtHz(wk * df)} (tone at ${fmtHz(tone)})` },
          { label: 'Welch noise floor (median bin)', value: `${sorted[sorted.length >> 1].toFixed(1)} dB` },
          { label: 'Resolution', value: `${fmtHz(df)} per bin, ${(1000 * hop / FS).toFixed(1)} ms per hop` },
        ],
        counts: meter.snapshot(),
        chart: {
          title: 'Welch average and the latest frame', x: { label: 'frequency (Hz)' }, y: { label: 'amplitude (dB)' },
          series: [
            { name: 'Welch average', points: chartPoints(mean, (i) => i * df) },
            { name: 'Latest frame', points: chartPoints(rows[rows.length - 1], (i) => i * df) },
          ],
        },
      };
    }
  },
  lab(x, fs, meter) {
    const rows = stft(x, 128, 64, 'hann', meter).map((r) => Float32Array.from(r, dbOf));
    return { kind: 'waterfall', title: 'spectrogram', rows, upto: rows.length, fmax: fs / 2, floor: -70, ceil: 0 };
  },
};
