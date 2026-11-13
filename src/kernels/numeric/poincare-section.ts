// A Poincaré section of the Hénon–Heiles system H = ½(px² + py²) + ½(x² + y²) + λ(x²y − y³/3):
// orbits on one energy surface are integrated with the leapfrog (velocity Verlet) scheme of the
// one integrator library (src/plates/_shared/ode), and every upward crossing of the plane x = 0
// is located by linear interpolation and kept as a point (y, py). Islands mark regular orbits, the scattered sea chaotic ones.
import { mulberry32 } from '../../core/random';
import { leapfrog } from '../../plates/_shared/ode/ode';
import { drain, fmt, int, type Layer, type NumericKernel, type NumericRun, type RunInput, type XY } from '../../engines/numeric/trace';

export interface Orbit { section: XY[]; path: XY[]; drift: number }

type S = [number, number, number, number]; // x, y, px, py

export const potential = (x: number, y: number, lam: number) => 0.5 * (x * x + y * y) + lam * (x * x * y - (y * y * y) / 3);
export const energy = ([x, y, px, py]: S, lam: number) => 0.5 * (px * px + py * py) + potential(x, y, lam);

/** The acceleration −∇V at q = (x, y), written into a: the library's leapfrog calls it. */
export const accelOf = (lam: number) => (q: Float64Array, a: Float64Array): void => {
  const x = q[0]; const y = q[1];
  a[0] = -x - 2 * lam * x * y;
  a[1] = -y - lam * (x * x - y * y);
};

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
  const E0 = energy(s0, lam);
  const section: XY[] = []; const path: XY[] = [];
  const q = Float64Array.of(s0[0], s0[1]); const p = Float64Array.of(s0[2], s0[3]);
  const accel = accelOf(lam);
  const a = new Float64Array(2);
  accel(q, a);
  let drift = 0;
  for (let i = 0; section.length < crossings && i < 4_000_000; i++) {
    const x0 = q[0]; const y0 = q[1]; const py0 = p[1];
    leapfrog(q, p, a, h, accel);
    if (i < pathSteps) path.push([q[0], q[1]]);
    if (x0 < 0 && q[0] >= 0 && p[0] > 0) {
      const t = -x0 / (q[0] - x0);
      section.push([y0 + t * (q[1] - y0), py0 + t * (p[1] - py0)]);
    }
    // at every step, so the largest drift reported is the largest there was
    const e = 0.5 * (p[0] * p[0] + p[1] * p[1]) + potential(q[0], q[1], lam); // energy(), unpacked
    drift = Math.max(drift, Math.abs(e - E0) / Math.abs(E0));
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
  aspect: 16 / 9,
  palette: 'spectral',
  build,
  run: (inp) => drain(build(inp)),
};
