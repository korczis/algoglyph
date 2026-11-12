// Delay embedding: only x(t) of a system is observed, and the vectors (x(t), x(t + τ), ...)
// rebuild an attractor equivalent to the hidden one. τ is the first minimum of the average
// mutual information; the dimension is where false nearest neighbours stop appearing.
import { drain, fmt, int, mapSliced, span, type Layer, type NumericKernel, type NumericRun, type RunInput, type XY } from '../../engines/numeric/trace';
import { embed, falseNeighbourSteps, firstMinimum, mutualInformation } from './_embed';
import { lorenzOrbit, noise } from './_systems';

const N = 1400;

export function signal(kind: string, seed: number): { s: number[]; hidden: XY[] } {
  if (kind === 'sine') {
    const s = Array.from({ length: N }, (_, i) => Math.sin(0.11 * i) + 0.5 * Math.sin(0.0353 * i + 1));
    return { s, hidden: s.map((_, i) => [Math.sin(0.11 * i), Math.sin(0.0353 * i + 1)] as XY) };
  }
  if (kind === 'noise') { const s = noise(N, seed); return { s, hidden: s.map((v, i) => [i, v] as XY) }; }
  const o = lorenzOrbit(seed, N, 0.01, 4);
  return { s: o.map((v) => v[0]), hidden: o.map((v) => [v[0], v[2]] as XY) };
}

function* build({ seed, params }: RunInput): Generator<void, NumericRun, void> {
  const kind = String(params.signal ?? 'lorenz');
  const { s, hidden } = signal(kind, seed);
  yield;
  const ami = yield* mapSliced(Array.from({ length: 41 }, (_, lag) => lag), (lag) => mutualInformation(s, lag), 10);
  const tau = Math.max(1, firstMinimum(ami));
  const fnn: XY[] = [];
  for (const m of [1, 2, 3, 4, 5]) fnn.push([m, 100 * (yield* falseNeighbourSteps(s.slice(0, 900), m, tau))]);
  const dim = fnn.find((q) => q[1] < 5)?.[0];
  const e2: XY[] = embed(s, 2, tau).map((v) => [v[0], v[1]]);
  const sr = span(s);
  const hx = span(hidden.map((q) => q[0])); const hy = span(hidden.map((q) => q[1]));
  const marks = Array.from({ length: 120 }, (_, i) => Math.round(((i + 1) * e2.length) / 120));
  const steps = yield* mapSliced(marks, (n) => {
    const win = Math.max(0, n - 300);
    const layers: Layer[] = [
      { kind: 'curve', pts: s.slice(win, n + tau).map((v, i) => [i, v] as XY), tone: 0.2, weight: 1.5 },
      { kind: 'points', pts: [[n - 1 - win, s[n - 1]], [n - 1 - win + tau, s[n - 1 + tau]]], size: 7, tone: 0.9 },
      { kind: 'curve', panel: 1, pts: e2, n, tone: 0.85, weight: 1, alpha: 0.8 },
      { kind: 'curve', panel: 2, pts: hidden, n, alpha: 0.6, weight: 1 },
    ];
    return {
      layers,
      stats: [
        { label: 'Delay τ (first minimum of mutual information)', value: `${int(tau)} samples` },
        { label: 'False nearest neighbours, m = 1 … 5', value: fnn.map((q) => `${fmt(q[1], 3)}%`).join(', ') },
        { label: 'Smallest m under 5% false neighbours', value: dim ? int(dim) : 'none up to 5 (no low-dimensional attractor)' },
        { label: 'Vectors embedded', value: `${int(n)} of ${int(e2.length)}` },
      ],
      chart: { title: 'False nearest neighbours against dimension', x: { label: 'embedding dimension m' }, y: { label: 'false neighbours (%)' }, series: [{ name: 'Kennel test', points: fnn }] },
    };
  }, 12);
  return {
    panels: [
      { title: 'Observed signal (latest samples)', x: [0, 300 + tau], y: sr },
      { title: `Rebuilt: (s(t), s(t + ${tau}))`, x: sr, y: sr, equal: true },
      { title: kind === 'noise' ? 'Noise has no hidden state' : 'Hidden state, never observed', x: hx, y: hy },
    ],
    steps,
  };
}

export const kernel: NumericKernel = {
  params: [{ kind: 'select', key: 'signal', label: 'Observed signal', value: 'lorenz', rebuild: true,
    options: [{ value: 'lorenz', label: 'x(t) of the Lorenz flow' }, { value: 'sine', label: 'Two incommensurate sines' }, { value: 'noise', label: 'Gaussian white noise' }] }],
  rate: 12,
  aspect: 2.2,
  build,
  run: (inp) => drain(build(inp)),
};
