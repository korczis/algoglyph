// A Poincaré section of the Hénon–Heiles system H = ½(px² + py²) + ½(x² + y²) + λ(x²y − y³/3):
// orbits on one energy surface are integrated with the leapfrog (velocity Verlet) scheme, and
// every upward crossing of the plane x = 0 is located by linear interpolation and kept as a
// point (y, py). Islands mark regular orbits, the scattered sea chaotic ones.
import { mulberry32 } from '../../core/random';
import { drain, fmt, int, type Layer, type NumericKernel, type NumericRun, type RunInput, type XY } from '../../engines/numeric/trace';

export interface Orbit { section: XY[]; path: XY[]; drift: number }

type S = [number, number, number, number]; // x, y, px, py

export const potential = (x: number, y: number, lam: number) => 0.5 * (x * x + y * y) + lam * (x * x * y - (y * y * y) / 3);
export const energy = ([x, y, px, py]: S, lam: number) => 0.5 * (px * px + py * py) + potential(x, y, lam);

const force = (x: number, y: number, lam: number): [number, number] => [-x - 2 * lam * x * y, -y - lam * (x * x - y * y)];

/** Start on the section x = 0 at (y, py) with px > 0 fixed by the energy; null if (y, py) is outside. */
export function start(y: number, py: number, E: number, lam: number): S | null {
  const k = 2 * (E - potential(0, y, lam)) - py * py;
  return k > 0 ? [0, y, Math.sqrt(k), py] : null;
}

export function orbit(s0: S, lam: number, crossings: number, h = 0.01, pathSteps = 3000): Orbit {
  return drain(orbitSteps(s0, lam, crossings, h, pathSteps));
}

/** orbit(), resumable: it yields every 2^14 integration steps. */
export function* orbitSteps(s0: S, lam: number, crossings: number, h = 0.01, pathSteps = 3000): Generator<void, Orbit, void> {
  let s = s0.slice() as S;
  const E0 = energy(s, lam);
  const section: XY[] = []; const path: XY[] = [];
  let [fx, fy] = force(s[0], s[1], lam);
  let drift = 0;
  for (let i = 0; section.length < crossings && i < 4_000_000; i++) {
    const prev = s.slice() as S;
    const px = s[2] + 0.5 * h * fx; const py = s[3] + 0.5 * h * fy;
    const x = s[0] + h * px; const y = s[1] + h * py;
    [fx, fy] = force(x, y, lam);
    s = [x, y, px + 0.5 * h * fx, py + 0.5 * h * fy];
    if (i < pathSteps) path.push([x, y]);
    if (prev[0] < 0 && s[0] >= 0 && s[2] > 0) {
      const t = -prev[0] / (s[0] - prev[0]);
      section.push([prev[1] + t * (s[1] - prev[1]), prev[3] + t * (s[3] - prev[3])]);
    }
    if (i % 64 === 0) drift = Math.max(drift, Math.abs(energy(s, lam) - E0) / Math.abs(E0));
    if ((i & 0x3fff) === 0x3fff) yield;
  }
  return { section, path, drift };
}

function* build({ seed, params }: RunInput): Generator<void, NumericRun, void> {
  const rnd = mulberry32(seed);
  const E = Number(params.energy ?? 0.125);
  const K = Number(params.orbits ?? 16);
  const lam = 1;
  const crossings = 160;
  const orbits: Orbit[] = [];
  for (let k = 0; orbits.length < K && k < 50 * K; k++) {
    const s = start(-0.45 + 1.1 * rnd(), -0.6 + 1.2 * rnd(), E, lam);
    if (s) { orbits.push(yield* orbitSteps(s, lam, crossings)); yield; }
  }
  const all: XY[] = []; const tones: number[] = [];
  orbits.forEach((o, i) => o.section.forEach((q) => { all.push(q); tones.push(i / Math.max(1, orbits.length - 1)); }));
  // the boundary of the section: ½ py² + ½ y² − y³/3 = E
  const edge: XY[] = [];
  for (let i = 0; i <= 400; i++) {
    const y = -0.7 + (1.5 * i) / 400;
    const k = 2 * (E - potential(0, y, lam));
    if (k >= 0) { edge.push([y, Math.sqrt(k)]); }
  }
  const boundary = [...edge, ...edge.slice().reverse().map(([y, p]) => [y, -p] as XY)];
  const drift = Math.max(...orbits.map((o) => o.drift));
  const per = 10;
  const steps = [];
  for (let n = per; n <= all.length + per; n += per) {
    const upto = Math.min(n, all.length);
    const which = Math.min(orbits.length - 1, Math.floor((upto - 1) / crossings));
    const layers: Layer[] = [
      { kind: 'curve', pts: boundary, alpha: 0.4, weight: 1 },
      { kind: 'points', pts: all, tones, n: upto, size: 2 },
      { kind: 'curve', panel: 1, pts: orbits[which].path, tone: tones[which * crossings], weight: 1, alpha: 0.8 },
    ];
    steps.push({
      layers,
      stats: [
        { label: 'Energy', value: fmt(E) },
        { label: 'Section points', value: `${int(upto)} (orbit ${which + 1} of ${orbits.length})` },
        { label: 'Largest relative energy drift', value: fmt(drift) },
        { label: 'Integrator', value: 'leapfrog (velocity Verlet), h 0.01' },
      ],
    });
    if (upto === all.length) break;
    if (steps.length % 32 === 0) yield;
  }
  return {
    panels: [
      { title: 'Section x = 0, px > 0: (y, py)', x: [-0.75, 0.95], y: [-0.65, 0.65], equal: true, axes: true, weight: 1.3 },
      { title: 'The current orbit in (x, y)', x: [-0.95, 0.95], y: [-0.75, 1.05], equal: true, axes: true },
    ],
    steps,
  };
}

export const kernel: NumericKernel = {
  params: [
    { kind: 'range', key: 'energy', label: 'Energy E (escape at 1/6)', min: 0.04, max: 0.165, step: 0.005, value: 0.125, rebuild: true },
    { kind: 'range', key: 'orbits', label: 'Orbits', min: 4, max: 30, step: 1, value: 16, rebuild: true },
  ],
  rate: 8,
  aspect: 16 / 9,
  palette: 'spectral',
  build,
  run: (inp) => drain(build(inp)),
};
