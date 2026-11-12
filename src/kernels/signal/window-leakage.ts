import { str } from '../../core/plate';
import { mulberry32, tones } from '../../engines/signal/input';
import { MUL, type Meter, type SignalKernel, type View } from '../../engines/signal/trace';
import { amplitude, argmax, fft, toDb, WINDOWS, windowOf } from './_fft';

const N = 64;
const PAD = 16;

/** Highest side lobe (dB re the main lobe) and −3 dB width (bins), measured from the window's
 * own zero-padded transform. */
export function lobes(id: string, n = N, pad = PAD, meter?: Meter): { sidelobe: number; width3: number } {
  const re = new Float64Array(n * pad);
  const im = new Float64Array(n * pad);
  re.set(windowOf(id, n));
  fft(re, im, meter);
  const d = toDb(Float64Array.from({ length: n * pad / 2 + 1 }, (_, k) => Math.hypot(re[k], im[k])), -300);
  let edge = 1;
  while (edge + 1 < d.length && d[edge + 1] < d[edge]) edge++;
  let side = -300;
  for (let k = edge; k < d.length; k++) side = Math.max(side, d[k]);
  let k3 = 0;
  while (k3 + 1 < d.length && d[k3 + 1] > d[0] - 3.0103) k3++;
  // linear interpolation of the −3 dB crossing, two-sided width in bins
  const frac = (d[0] - 3.0103 - d[k3]) / (d[k3 + 1] - d[k3]);
  return { sidelobe: side - d[0], width3: (2 * (k3 + frac)) / pad };
}

const leak10 = (r: number) => (r > 1e-8 ? `${(20 * Math.log10(r)).toFixed(1)} dB` : 'below −160 dB');

// One window, a tone sliding from on-bin to half-way between bins and back, and a weak tone a
// few bins away that leakage can bury. The sample rate is the window length, so one bin is one
// hertz at either length.
export const kernel: SignalKernel = {
  aspect: 16 / 9,
  params: [
    { kind: 'select', key: 'window', label: 'Window', value: 'hann', options: WINDOWS.map((w) => ({ value: w.id, label: w.label })) },
    { kind: 'range', key: 'weak', label: 'Weak tone level (dB)', min: -100, max: -10, step: 5, value: -50 },
    { kind: 'range', key: 'gap', label: 'Weak tone distance (bins)', min: 2, max: 20, step: 1, value: 6 },
    { kind: 'select', key: 'n', label: 'Window length N', value: String(N),
      options: ['64', '128'].map((v) => ({ value: v, label: `${v} samples` })) },
  ],
  *run(params, seed, meter): Generator<View | null> {
    const id = str(params, 'window');
    const n = Number(str(params, 'n'));
    const fs = n;
    const rnd = mulberry32(seed);
    const k0 = 8 + Math.floor(rnd() * 6);
    const gap = Number(params.gap);
    const weak = 10 ** (Number(params.weak) / 20);
    const w = windowOf(id, n);
    const lobe = lobes(id, n, PAD, meter);
    const offsets = Array.from({ length: 21 }, (_, i) => (i <= 10 ? i : 20 - i) * 0.05);
    // scalloping of every window over the offsets, for the chart
    const scallop = WINDOWS.map((def) => {
      const ww = windowOf(def.id, n);
      return { name: def.label, points: offsets.slice(0, 11).map((o): [number, number] => {
        const a = amplitude(tones(n, fs, [{ f: k0 + o, a: 1 }]), ww, n);
        return [o, 20 * Math.log10(Math.max(...a))];
      }) };
    });
    yield null;
    for (const off of offsets) {
      const ph = rnd() * 2 * Math.PI;
      const x = tones(n, fs, [{ f: k0 + off, a: 1, ph }, { f: k0 + off + gap, a: weak, ph: 2 * ph }]);
      const fine = amplitude(x, w, n * PAD, meter);
      const bins = amplitude(x, w, n, meter);
      const kp = argmax(bins, 1);
      const kw = Math.round(k0 + off + gap);
      const resolved = kw + 1 < bins.length && bins[kw] > bins[kw - 1] && bins[kw] > bins[kw + 1];
      const far = Math.min(bins.length - 1, kp + 10);
      meter.add(MUL, n);
      const shaped = Float64Array.from(x, (v, i) => v * w[i]);
      yield {
        layout: [[0], [1]],
        panels: [
          { kind: 'wave', title: `${n} samples, tone at ${(k0 + off).toFixed(2)} bins, and its ${WINDOWS.find((d) => d.id === id)?.label} window`, series: [
            { name: 'signal', y: x, tone: -1, alpha: 110 }, { name: 'windowed', y: shaped, tone: 0.75 },
            { name: 'window', y: w, tone: 0.3 }] },
          { kind: 'spectrum', title: `Spectrum: ${n} DFT bins (stems) on the ${PAD}× zero-padded transform`, fmax: fs / 2, floor: -120, ceil: 5, series: [
            { name: 'zero-padded', y: toDb(fine, -120), tone: 0.3, alpha: 200 },
            { name: 'DFT bins', y: toDb(bins, -120), tone: 0.8, stems: true }],
          marks: [{ at: k0 + off, label: 'tone' }, { at: k0 + off + gap, label: 'weak' }] },
        ],
        stats: [
          { label: 'Tone offset from its bin', value: `${off.toFixed(2)} bin` },
          { label: 'Highest side lobe (measured)', value: `${lobe.sidelobe.toFixed(1)} dB` },
          { label: 'Main lobe −3 dB width', value: `${lobe.width3.toFixed(2)} bins` },
          { label: 'Scalloping loss now', value: `${(20 * Math.log10(bins[kp])).toFixed(2)} dB` },
          { label: 'Leakage 10 bins from the peak', value: leak10(bins[far] / bins[kp]) },
          { label: `Weak tone at ${params.weak} dB`, value: resolved ? 'resolved (a local peak)' : 'buried in leakage' },
        ],
        counts: meter.snapshot(),
        chart: { title: 'Peak bin amplitude as the tone leaves its bin', x: { label: 'offset (bins)' }, y: { label: 'peak (dB)' }, series: scallop },
      };
    }
  },
};
