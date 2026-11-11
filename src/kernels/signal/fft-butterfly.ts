import { mulberry32, tones } from '../../engines/signal/input';
import { BUTTERFLY, fmtHz, MUL, type Meter, type Panel, type SignalKernel,
  type View } from '../../engines/signal/trace';
import { str } from '../../core/plate';
import { amplitude, argmax, bitReverse, fft, nextPow2, toDb, windowOf } from './_fft';

const FS = 1000;

function input(kind: string, n: number, seed: number): { x: Float64Array; truth: string } {
  const rnd = mulberry32(seed);
  if (kind === 'impulse') {
    const x = new Float64Array(n);
    const at = Math.floor(rnd() * n);
    x[at] = 1;
    return { x, truth: `impulse at n = ${at}` };
  }
  if (kind === 'square') {
    const period = 4 + Math.floor(rnd() * (n / 4));
    const x = Float64Array.from({ length: n }, (_, i) => ((i % period) < period / 2 ? 1 : -1));
    return { x, truth: `square, period ${period} samples` };
  }
  if (kind === 'chirp') {
    const x = Float64Array.from({ length: n }, (_, i) => Math.cos((Math.PI * 0.8 * i * i) / (2 * n)));
    return { x, truth: 'chirp sweeping 0 to 0.4 fs' };
  }
  const k1 = 1 + Math.floor(rnd() * (n / 4));
  const k2 = Math.min(n / 2 - 1, k1 + 2 + Math.floor(rnd() * (n / 4)));
  return {
    x: tones(n, FS, [{ f: (k1 * FS) / n, a: 1 }, { f: (k2 * FS) / n, a: 0.5, ph: 1 }]),
    truth: `tones at ${fmtHz((k1 * FS) / n)} and ${fmtHz((k2 * FS) / n)}`,
  };
}

/** The transform by its definition, O(N²), as the plate's own cross-check. */
function directDft(x: Float64Array): [Float64Array, Float64Array] {
  const n = x.length;
  const re = new Float64Array(n); const im = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      const a = (-2 * Math.PI * ((k * j) % n)) / n;
      re[k] += x[j] * Math.cos(a);
      im[k] += x[j] * Math.sin(a);
    }
  }
  return [re, im];
}

// Bit-reverse the input, then log2 N stages of N/2 butterflies each; every view is one stage.
export const kernel: SignalKernel = {
  rate: 1.5,
  params: [
    { kind: 'select', key: 'n', label: 'Transform size N', value: '32', options: ['8', '16', '32', '64'].map((v) => ({ value: v, label: v })) },
    { kind: 'select', key: 'signal', label: 'Signal', value: 'tones', options: [
      { value: 'tones', label: 'Two tones on bins' }, { value: 'square', label: 'Square wave' },
      { value: 'chirp', label: 'Chirp' }, { value: 'impulse', label: 'Impulse' }] },
  ],
  run(params, seed, meter: Meter): View[] {
    const n = Number(str(params, 'n'));
    const { x, truth } = input(str(params, 'signal'), n, seed);
    const re = Float64Array.from(x);
    const im = new Float64Array(n);
    const br = Float64Array.from(x); const bi = new Float64Array(n);
    bitReverse(br, bi);
    const mags: Float64Array[] = [br.map(Math.abs)];
    const stages = Math.log2(n);
    const views: View[] = [];
    const ops: [number, number, number][] = [[0, 0, 0]];
    const timeEnergy = x.reduce((s, v) => s + v * v, 0);
    const [dr, di] = directDft(x);
    const record = (s: number) => {
      const done = s === stages;
      const values = Float64Array.from({ length: n }, (_, i) => Math.hypot(re[i], im[i]));
      const panels: Panel[] = [
        { kind: 'wave', title: `Input, ${truth}`, series: [{ name: 'x[n]', y: x, stems: true, tone: 0.3 }] },
        { kind: 'butterfly', title: `Butterflies, stage ${s} of ${stages}`, n, done: s, mags: mags.slice() },
      ];
      const stats = [{ label: 'Stage', value: `${s} of ${stages}${s === 0 ? ' (bit-reversed input)' : ''}` }];
      if (done) {
        const half = Float64Array.from({ length: n / 2 + 1 }, (_, k) => Math.hypot(re[k], im[k]) / n);
        panels.push({ kind: 'spectrum', title: '|X[k]| / N', fmax: FS / 2, floor: -80, ceil: 10,
          series: [{ name: '|X|', y: toDb(half, -80), stems: true }] });
        const peak = argmax(half, 1);
        let freqEnergy = 0; let worst = 0;
        for (let k = 0; k < n; k++) {
          freqEnergy += re[k] * re[k] + im[k] * im[k];
          worst = Math.max(worst, Math.hypot(re[k] - dr[k], im[k] - di[k]));
        }
        freqEnergy /= n;
        stats.push(
          { label: 'Peak frequency (measured)', value: fmtHz((peak * FS) / n) },
          { label: 'Parseval: Σ|x|² vs Σ|X|²/N', value: `${timeEnergy.toFixed(4)} vs ${freqEnergy.toFixed(4)}` },
          { label: 'Largest difference from the direct DFT', value: worst.toExponential(2) },
        );
      } else {
        panels.push({ kind: 'wave', title: `|values| after stage ${s}, in memory order`, series: [{ name: '|x|', y: values, stems: true, tone: 0.8 }] });
      }
      views.push({
        panels, stats, counts: meter.snapshot(), layout: [[0, 2], [1]],
        chart: { title: 'Work by stage', x: { label: 'stage' }, y: { label: 'count' }, series: [
          { name: BUTTERFLY, points: ops.slice(0, s + 1).map((q) => [q[0], q[1]]) },
          { name: MUL, points: ops.slice(0, s + 1).map((q) => [q[0], q[2]]) }] },
      });
    };
    record(0);
    fft(re, im, meter, false, (s) => {
      mags.push(Float64Array.from({ length: n }, (_, i) => Math.hypot(re[i], im[i])));
      ops.push([s, meter.get(BUTTERFLY), meter.get(MUL)]);
      record(s);
    });
    return views;
  },
  lab(x, fs, meter) {
    const nfft = nextPow2(x.length);
    const a = amplitude(x, windowOf('rect', x.length), nfft, meter);
    return { kind: 'spectrum', title: 'amplitude spectrum', fmax: fs / 2, floor: -80, ceil: 0, series: [{ name: '|X|', y: toDb(a, -80) }] };
  },
};

