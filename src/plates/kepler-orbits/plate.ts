import { optionId } from '../../core/data';
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import { rgba } from '../_shared/two-slit/draw';
import {
  chiSquareQuantile, circularSpeed, deflection, measureOrbit, runOrbit, type CentralForce, type Integrator,
  type OrbitMeasure, type OrbitRun,
} from '../_shared/particles/central';

type Mode = 'kepler' | 'power' | 'relativity' | 'scattering' | 'data';

/** Samples of a run replayed, and points of the first period kept for the equal-area wedges. */
export const SAMPLES = 600;
const WEDGE_POINTS = 480;
/** Perihelion passages an orbit is integrated for. */
export const PERIHELIA = 10;
/** Equal times the first period is cut into for Kepler's second law. */
export const SECTORS = 12;
/** A reader's bodies are integrated for this long (ten periods of the orbit with a = 1). */
export const DATA_SPAN = 20 * Math.PI;
/** Scattering: equal-probability bins of the angle, the start distance and the step factor. */
export const BINS = 10;
const START = 1e4;
const ETA = 0.02;
/** Particles scattered in one frame at most: the pace control's top asks no more. */
const PARTICLES_PER_FRAME = 40;
/** Particles whose paths are kept for the picture. */
const PATHS = 40;
/** Length of the velocity arrow per unit speed, in length units. */
const ARROW = 0.5;
const when = (...values: Mode[]) => ({ key: 'mode', values });

const fixed = (x: number, d: number) => (Number.isFinite(x) ? x.toFixed(d) : 'not measured');
const sci = (x: number) => (Number.isFinite(x) ? x.toExponential(3) : 'not measured');
const NAMES: Record<Integrator, string> = {
  leapfrog: 'leapfrog (kick-drift-kick, symplectic, order 2)',
  rk4: 'classical Runge–Kutta (order 4, not symplectic)',
  'symplectic-euler': 'symplectic Euler (order 1)',
  euler: 'explicit Euler (order 1, energy grows)',
};

export const keplerOrbits: PlateCode = {
  id: 'kepler-orbits',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'mode', label: 'Experiment', value: 'kepler', rebuild: true,
      options: [
        { value: 'kepler', label: 'An inverse-square orbit: Kepler’s three laws' },
        { value: 'power', label: 'Another force law: which orbits close (Bertrand)' },
        { value: 'relativity', label: 'The weak-field relativistic correction: perihelion advance' },
        { value: 'scattering', label: 'A repulsive inverse square: Rutherford scattering' },
      ],
    },
    {
      kind: 'select', key: 'integrator', label: 'Integrator', value: 'leapfrog', rebuild: true,
      when: { key: 'mode', values: ['kepler', 'power', 'relativity', 'data:bodies'] },
      options: [
        { value: 'leapfrog', label: 'Leapfrog (symplectic, order 2)' },
        { value: 'rk4', label: 'Runge–Kutta 4 (order 4)' },
        { value: 'symplectic-euler', label: 'Symplectic Euler (order 1)' },
        { value: 'euler', label: 'Explicit Euler (order 1)' },
      ],
    },
    { kind: 'range', key: 'resolution', label: 'Steps per time 2π (one orbit at a = 1)', min: 50, max: 8000, step: 50,
      value: 2000, rebuild: true, when: { key: 'mode', values: ['kepler', 'power', 'relativity', 'data:bodies'] } },
    { kind: 'range', key: 'a', label: 'Semimajor axis a', min: 0.5, max: 3, step: 0.1, value: 1, rebuild: true,
      when: when('kepler', 'relativity') },
    // e < 1 is a closed ellipse; e = 1 is a parabola that never returns, so it has no period to measure
    { kind: 'range', key: 'e', label: 'Eccentricity e', min: 0, max: 0.99, step: 0.01, value: 0.5, rebuild: true,
      when: when('kepler', 'relativity') },
    // below n = −3 no circular orbit is stable (the apsidal angle π/√(n + 3) is not real): it falls in or leaves
    { kind: 'range', key: 'n', label: 'Force ∝ rⁿ: the exponent n', min: -2.9, max: 10, step: 0.1, value: -1,
      rebuild: true, when: when('power') },
    // above 0 only: at zero speed the body falls straight into the centre, where the force is infinite
    { kind: 'range', key: 's', label: 'Launch speed over the circular speed', min: 0.1, max: 1.6, step: 0.01,
      value: 1.05, rebuild: true, when: when('power') },
    // above 0.02 the field is not weak: the first-order advance the plate compares with is off by over 10 %
    { kind: 'range', key: 'delta', label: 'Field strength GM/(c²a)', min: 0, max: 0.02, step: 0.0005, value: 0.001,
      rebuild: true, when: when('relativity') },
    { kind: 'range', key: 'particles', label: 'Particles in the beam', min: 100, max: 4000, step: 100, value: 1000,
      rebuild: true, when: when('scattering') },
    { kind: 'range', key: 'beam', label: 'Beam radius over κ/v₀²', min: 2, max: 50, step: 1, value: 10,
      rebuild: true, when: when('scattering') },
    paceParam(),
    paletteParam('ember'),
  ],
  pace: { kind: 'replay', unit: 'samples' },
  create(p, ctx) {
    const params = ctx.params;
    let pacer = new Pacer('replay', 'samples', SAMPLES);
    let mode: Mode = 'kepler';
    let rows: Stat[] = [];
    /** Replayed paths: one per body, each SAMPLES points of [x, y] (NaN once a body has left). */
    let paths: Float64Array[] = [];
    let wedge: [number, number][] = [];
    let apsides: { x: number; y: number; peri: boolean; t: number }[] = [];
    let runTime = 1;
    let shown = 0;
    let extent = 1;
    let start = { x: 1, y: 0, vx: 0, vy: 1 };
    let dragged: { vx: number; vy: number } | null = null;
    // scattering
    let impact: Float64Array = new Float64Array(0);
    let angles: number[] = [];
    let residual = 0;
    let beamPaths: [number, number][][] = [];
    let edges: number[] = [];
    let counts: number[] = [];
    let kappa = 1;

    const integrator = () => str(params, 'integrator') as Integrator;
    const h = () => (2 * Math.PI) / num(params, 'resolution');

    /** One orbit integrated to its PERIHELIA (or for `span`), every step kept for the replay and the wedges. */
    function orbit(f: CentralForce, x0: number, y0: number, vx0: number, vy0: number, span?: number):
      { run: OrbitRun; m: OrbitMeasure | null; xs: Float64Array; ys: Float64Array; ts: Float64Array } {
      const step = h();
      const maxSteps = Math.ceil((span ?? 80 * Math.PI) / step);
      let xs = new Float64Array(Math.min(maxSteps + 1, 1 << 14));
      let ys = new Float64Array(xs.length);
      let ts = new Float64Array(xs.length);
      let n = 1;
      xs[0] = x0;
      ys[0] = y0;
      const run = runOrbit(f, x0, y0, vx0, vy0, {
        h: step, integrator: integrator(), perihelia: span === undefined ? PERIHELIA : Infinity, maxSteps, escapeR: 50,
        record: (t, x, y) => {
          if (n === xs.length) {
            const grow = (a: Float64Array) => { const b = new Float64Array(Math.min(maxSteps + 1, 2 * a.length)); b.set(a); return b; };
            xs = grow(xs); ys = grow(ys); ts = grow(ts);
          }
          xs[n] = x; ys[n] = y; ts[n] = t; n++;
        },
      });
      return { run, m: measureOrbit(run), xs: xs.subarray(0, n), ys: ys.subarray(0, n), ts: ts.subarray(0, n) };
    }

    /** The largest finite distance from the centre along a path, at most 50 (the escape radius), and at least `from`. */
    function farthest(xs: Float64Array, ys: Float64Array, from: number): number {
      let out = from;
      for (let i = 0; i < xs.length; i++) {
        const r = Math.hypot(xs[i], ys[i]);
        if (Number.isFinite(r) && r <= 50 && r > out) out = r;
      }
      return out;
    }

    /** SAMPLES positions at equal times over [0, tEnd]; NaN past a body's last recorded step. */
    function resample(xs: Float64Array, ys: Float64Array, ts: Float64Array, tEnd: number): Float64Array {
      const out = new Float64Array(2 * SAMPLES).fill(Number.NaN);
      let j = 0;
      for (let i = 0; i < SAMPLES; i++) {
        const t = (i / (SAMPLES - 1)) * tEnd;
        while (j + 1 < ts.length && ts[j + 1] < t) j++;
        if (j + 1 >= ts.length && t > ts[ts.length - 1]) break;
        const k = Math.min(j + 1, ts.length - 1);
        const u = ts[k] === ts[j] ? 0 : (t - ts[j]) / (ts[k] - ts[j]);
        out[2 * i] = xs[j] + u * (xs[k] - xs[j]);
        out[2 * i + 1] = ys[j] + u * (ys[k] - ys[j]);
      }
      return out;
    }

    /** Kepler's second law, measured: the area swept in SECTORS equal times of the first period. */
    function sectorAreas(xs: Float64Array, ys: Float64Array, ts: Float64Array, t0: number, T: number): number[] {
      const areas = new Array<number>(SECTORS).fill(0);
      for (let i = 0; i + 1 < ts.length; i++) {
        const a = ts[i];
        const b = ts[i + 1];
        if (b <= t0 || a >= t0 + T) continue;
        const tri = 0.5 * Math.abs(xs[i] * ys[i + 1] - xs[i + 1] * ys[i]);
        // the step's triangle is shared between the sectors its time interval overlaps (one or two)
        const first = Math.max(0, Math.floor(((a - t0) * SECTORS) / T));
        for (let s = first; s < Math.min(SECTORS, first + 2); s++) {
          const lo = t0 + (s * T) / SECTORS;
          const hi = t0 + ((s + 1) * T) / SECTORS;
          const overlap = Math.min(b, hi) - Math.max(a, lo);
          if (overlap > 0) areas[s] += (tri * overlap) / (b - a);
        }
      }
      return areas;
    }

    function setLaunch(): { f: CentralForce; x: number; y: number; vx: number; vy: number } {
      if (mode === 'power') {
        const f: CentralForce = { k: 1, n: num(params, 'n'), g: 0 };
        const v = num(params, 's') * circularSpeed(f, 1);
        return { f, x: 1, y: 0, vx: 0, vy: v };
      }
      const a = num(params, 'a');
      const e = num(params, 'e');
      // start at perihelion with the vis-viva speed of the ellipse asked for: only the initial condition
      const rp = a * (1 - e);
      const vp = Math.sqrt((1 + e) / rp);
      let g = 0;
      if (mode === 'relativity') {
        const c2 = 1 / (num(params, 'delta') * a);
        g = num(params, 'delta') > 0 ? (3 * (rp * vp) ** 2) / c2 : 0;
      }
      return { f: { k: 1, n: -2, g }, x: rp, y: 0, vx: 0, vy: vp };
    }

    function orbitSetup() {
      const L = setLaunch();
      if (dragged) { L.vx = dragged.vx; L.vy = dragged.vy; }
      if (mode === 'relativity' && dragged) {
        // a dragged launch keeps the field strength: g = 3h²/c², with the new h
        const c2 = 1 / (num(params, 'delta') * num(params, 'a'));
        L.f = { ...L.f, g: num(params, 'delta') > 0 ? (3 * (L.x * L.vy - L.y * L.vx) ** 2) / c2 : 0 };
      }
      start = { x: L.x, y: L.y, vx: L.vx, vy: L.vy };
      const o = orbit(L.f, L.x, L.y, L.vx, L.vy);
      runTime = o.ts[o.ts.length - 1];
      paths = [resample(o.xs, o.ys, o.ts, runTime)];
      extent = Math.min(farthest(o.xs, o.ys, 1e-6), 50);
      apsides = o.run.apsides.map((x) => ({ x: x.r * Math.cos(x.angle), y: x.r * Math.sin(x.angle), peri: x.kind === 'peri', t: x.t }));
      const m = o.m;
      const head: Stat[] = [
        { label: 'integrator', value: NAMES[integrator()] },
        { label: 'steps per time 2π', value: String(num(params, 'resolution')) },
        { label: 'launch', value: dragged ? `dragged: v = (${dragged.vx.toFixed(3)}, ${dragged.vy.toFixed(3)})` : 'from the controls, at perihelion' },
        { label: 'perihelion passages measured', value: !m ? (o.run.escaped ? 'none: it escaped' : 'fewer than two')
          : m.perihelia === 0 ? 'none: a circle to round-off, the period from whole turns'
            : m.perihelia < PERIHELIA && !o.run.escaped ? `${m.perihelia} (the run stops at time 80π)` : String(m.perihelia) },
      ];
      wedge = [];
      if (mode === 'kepler') {
        let spread = Number.NaN;
        if (m) {
          const peri = o.run.apsides.filter((x) => x.kind === 'peri');
          const areas = sectorAreas(o.xs, o.ys, o.ts, peri[0].t, m.period);
          const mean = areas.reduce((s, x) => s + x, 0) / SECTORS;
          spread = (Math.max(...areas) - Math.min(...areas)) / mean;
          let j = 0;
          for (let i = 0; i <= WEDGE_POINTS; i++) {
            const t = peri[0].t + (i / WEDGE_POINTS) * m.period;
            while (j + 1 < o.ts.length && o.ts[j] < t) j++;
            wedge.push([o.xs[j], o.ys[j]]);
          }
        }
        rows = [...head,
          { label: 'period T, measured between perihelia', value: fixed(m?.period ?? NaN, 7) },
          { label: 'Kepler III: 2π√(a³/GM), a measured', value: fixed(m ? 2 * Math.PI * Math.sqrt(m.a ** 3) : NaN, 7) },
          { label: 'semimajor axis (r_peri + r_apo)/2, measured', value: fixed(m?.a ?? NaN, 7) },
          { label: 'eccentricity (r_apo − r_peri)/(r_apo + r_peri), measured', value: fixed(m?.e ?? NaN, 7) },
          { label: 'eccentricity of the launch', value: dragged ? 'dragged' : num(params, 'e').toFixed(2) },
          { label: 'energy per unit mass at the start', value: o.run.energy0.toFixed(7) },
          { label: 'energy −GM/2a, a measured', value: fixed(m ? -1 / (2 * m.a) : NaN, 7) },
          { label: 'Kepler II: areas swept in 12 equal times, spread (max − min)/mean', value: sci(spread) },
          { label: 'largest energy error |ΔE/E|', value: sci(o.run.energyDrift) },
          { label: 'largest energy error, first half then second half', value: `${sci(o.run.energyDriftFirstHalf)}, ${sci(o.run.energyDriftSecondHalf)}` },
          { label: 'angular momentum drift |Δh/h|', value: sci(o.run.hDrift) },
          { label: 'perihelion advance per orbit, the integrator’s own (rad)', value: sci(m?.precession ?? NaN) },
        ];
      } else if (mode === 'power') {
        const n = num(params, 'n');
        rows = [...head,
          { label: 'force exponent n, |F| ∝ rⁿ', value: n.toFixed(1) },
          { label: 'launch speed over the circular speed', value: dragged ? 'dragged' : num(params, 's').toFixed(2) },
          { label: 'apsidal angle, perihelion to aphelion, measured (°)', value: fixed(m ? (m.apsidal * 180) / Math.PI : NaN, 6) },
          { label: 'apsidal angle 180°/√(n + 3), the near-circular closed form', value: (180 / Math.sqrt(n + 3)).toFixed(6) },
          { label: 'perihelion advance per orbit, measured (°)', value: fixed(m ? (m.precession * 180) / Math.PI : NaN, 6) },
          { label: 'radial range r_apo/r_peri, measured', value: fixed(m ? m.rApo / m.rPeri : NaN, 6) },
          { label: 'largest energy error |ΔE/E|', value: sci(o.run.energyDrift) },
          { label: 'angular momentum drift |Δh/h|', value: sci(o.run.hDrift) },
        ];
      } else {
        // the integrator's own advance, measured on the same launch without the correction
        const plain = orbit({ ...L.f, g: 0 }, L.x, L.y, L.vx, L.vy);
        const own = plain.m?.precession ?? NaN;
        const delta = num(params, 'delta');
        const c2 = delta > 0 ? 1 / (delta * num(params, 'a')) : Infinity;
        rows = [...head,
          { label: 'field strength GM/(c²a) set', value: delta.toFixed(4) },
          { label: 'perihelion advance per orbit, measured (rad)', value: fixed(m?.precession ?? NaN, 8) },
          { label: 'the integrator’s own advance without the correction (rad, numerics)', value: sci(own) },
          { label: 'relativistic advance: measured less the integrator’s own (rad)', value: fixed(m ? m.precession - own : NaN, 8) },
          { label: 'first-order weak field 6πGM/(c²a(1 − e²)), a and e measured (rad)', value: fixed(m ? (6 * Math.PI) / (c2 * m.a * (1 - m.e ** 2)) : NaN, 8) },
          { label: 'semimajor axis and eccentricity, measured', value: m ? `${m.a.toFixed(6)}, ${m.e.toFixed(6)}` : 'not measured' },
          { label: 'largest energy error |ΔE/E|', value: sci(o.run.energyDrift) },
        ];
      }
    }

    function dataSetup() {
      const table = ctx.data?.(optionId(params.mode) ?? '') ?? null;
      if (!table) {
        paths = [];
        rows = [{ label: 'Input', value: 'your data: none attached; attach a table of x, y, vx, vy' }];
        return;
      }
      const [X, Y, VX, VY] = table.values;
      paths = [];
      apsides = [];
      const f: CentralForce = { k: 1, n: -2, g: 0 };
      const body: Stat[] = [];
      let bound = 0;
      let closed = 0;
      let escaped = 0;
      let tooClose = 0;
      let worstKepler = 0;
      let worstE = 0;
      let worstH = 0;
      extent = 1e-6;
      for (let i = 0; i < table.rows; i++) {
        if (Math.hypot(X[i], Y[i]) < 0.05) {
          tooClose++;
          paths.push(new Float64Array(2 * SAMPLES).fill(Number.NaN));
          body.push({ label: `body ${i + 1}`, value: 'skipped: starts within r = 0.05 of the centre' });
          continue;
        }
        const o = orbit(f, X[i], Y[i], VX[i], VY[i], DATA_SPAN);
        paths.push(resample(o.xs, o.ys, o.ts, DATA_SPAN));
        extent = farthest(o.xs, o.ys, extent);
        if (o.run.energy0 < 0) bound++;
        if (o.run.escaped) escaped++;
        worstE = Math.max(worstE, o.run.energyDrift);
        worstH = Math.max(worstH, o.run.hDrift);
        const m = o.m;
        if (m) {
          closed++;
          worstKepler = Math.max(worstKepler, Math.abs(m.period - 2 * Math.PI * Math.sqrt(m.a ** 3)) / m.period);
        }
        if (i < 8) {
          body.push({ label: `body ${i + 1}`, value: m ? `a ${m.a.toFixed(4)}, e ${m.e.toFixed(4)}, T ${m.period.toFixed(4)}`
            : o.run.escaped ? `escaped (energy ${o.run.energy0.toFixed(4)})` : `not closed within 20π (energy ${o.run.energy0.toFixed(4)})` });
        }
      }
      extent = Math.min(Math.max(extent, 0.2), 50);
      runTime = DATA_SPAN;
      start = { x: Number.NaN, y: Number.NaN, vx: 0, vy: 0 };
      rows = [
        { label: 'Input', value: `your data, ${table.rows} bodies around GM = 1` },
        { label: 'integrator', value: NAMES[integrator()] },
        { label: 'bound bodies, energy below zero', value: String(bound) },
        { label: 'orbits closed, two perihelia within 20π', value: String(closed) },
        { label: 'escaped beyond r = 50', value: String(escaped) },
        { label: 'skipped, starting within r = 0.05', value: String(tooClose) },
        { label: 'largest Kepler III residual |T − 2π√(a³/GM)|/T, closed orbits', value: closed ? sci(worstKepler) : 'none closed' },
        { label: 'largest energy error |ΔE/E|', value: sci(worstE) },
        { label: 'largest angular momentum drift |Δh/h|', value: sci(worstH) },
        ...body,
      ];
    }

    function scatterSetup() {
      const N = num(params, 'particles');
      const bmax = num(params, 'beam');
      // κ/v₀² = 1: lengths are in units of the distance at which the potential energy is the kinetic
      kappa = 1;
      const rnd = mulberry32(ctx.seed);
      impact = new Float64Array(N);
      // a beam uniform over a disc: the probability of an impact parameter below b is (b/b_max)²
      for (let i = 0; i < N; i++) impact[i] = bmax * Math.sqrt(rnd());
      angles = [];
      residual = 0;
      beamPaths = [];
      // equal-probability bins: P(θ > Θ) = (cot(Θ/2)/b_max)², so the edges are 2 atan(1/(b_max√(j/BINS)))
      edges = [];
      for (let j = 0; j <= BINS; j++) edges.push(j === 0 ? Math.PI : 2 * Math.atan(1 / (bmax * Math.sqrt(j / BINS))));
      counts = new Array<number>(BINS).fill(0);
    }

    function scatterRows(): Stat[] {
      const N = impact.length;
      const done = angles.length;
      const bmax = num(params, 'beam');
      const E = done / BINS;
      let chi2 = 0;
      for (const c of counts) chi2 += E > 0 ? ((c - E) ** 2) / E : 0;
      const back = angles.filter((x) => x > Math.PI / 2).length;
      const pBack = 1 / (bmax * bmax);
      const se = Math.sqrt(done * pBack * (1 - pBack));
      return [
        { label: 'particles scattered', value: `${done} of ${N}` },
        { label: 'beam radius b_max over κ/v₀²', value: bmax.toFixed(0) },
        { label: 'χ² of the counts in 10 bins of equal Rutherford probability', value: done ? chi2.toFixed(3) : 'not measured' },
        { label: 'χ² 99.9 % point for 9 degrees of freedom', value: chiSquareQuantile(0.999, BINS - 1).toFixed(3) },
        { label: 'largest |θ − 2 atan(κ/(v₀² b))| over the beam (rad)', value: done ? residual.toExponential(3) : 'not measured' },
        { label: 'deflected beyond 90°, counted', value: String(back) },
        { label: 'deflected beyond 90°, in standard errors from Rutherford’s N(κ/(v₀² b_max))²', value: done && se > 0 ? ((back - done * pBack) / se).toFixed(3) : 'not measured' },
      ];
    }

    function setup() {
      dragged = null;
      const raw = String(params.mode);
      mode = optionId(raw) ? 'data' : (raw as Mode);
      if (mode === 'scattering') {
        pacer = new Pacer('replay', 'particles', PARTICLES_PER_FRAME);
        scatterSetup();
        pacer.start(impact.length);
        rows = scatterRows();
      } else {
        pacer = new Pacer('replay', 'samples', SAMPLES);
        if (mode === 'data') dataSetup();
        else orbitSetup();
        pacer.start(paths.length ? SAMPLES : 1);
      }
      shown = 0;
      if (ctx.thumbnail) shown = SAMPLES;
    }

    // the view: the orbit's extent fits the shorter side with a margin
    const view = () => {
      const left = mode === 'scattering' ? ctx.width * 0.55 : ctx.width;
      const sc = (Math.min(left, ctx.height) * 0.45) / (mode === 'scattering' ? 14 : extent);
      const cx = mode === 'scattering' ? left / 2 : ctx.width / 2;
      return { sc, cx, cy: ctx.height / 2 };
    };

    function launchAt(x: number, y: number) {
      if (mode === 'scattering' || mode === 'data') return;
      const v = view();
      const wx = (x - v.cx) / v.sc;
      const wy = -(y - v.cy) / v.sc;
      dragged = { vx: (wx - start.x) / ARROW, vy: (wy - start.y) / ARROW };
      orbitSetup();
      shown = 0;
      pacer.start(SAMPLES);
    }

    return {
      setup,
      pace: () => pacer.report(mode === 'scattering' ? angles.length >= impact.length : shown >= (paths.length ? SAMPLES : 1), params),
      pressed: launchAt,
      dragged: launchAt,
      draw() {
        if (mode === 'scattering') {
          const take = ctx.thumbnail ? PARTICLES_PER_FRAME : pacer.take(params);
          for (let k = 0; k < take && angles.length < impact.length; k++) {
            const b = impact[angles.length];
            const path: [number, number][] = [];
            const keep = angles.length >= impact.length - PATHS || beamPaths.length < PATHS;
            const r = deflection(kappa, 1, b, START, ETA, keep ? (x, y) => { if (Math.abs(x) < 16 && Math.abs(y) < 16) path.push([x, y]); } : undefined);
            residual = Math.max(residual, Math.abs(r.angle - 2 * Math.atan(kappa / b)));
            angles.push(r.angle);
            for (let j = 0; j < BINS; j++) if (r.angle <= edges[j] && r.angle > edges[j + 1]) { counts[j]++; break; }
            if (keep) { beamPaths.push(path); if (beamPaths.length > PATHS) beamPaths.shift(); }
          }
          rows = scatterRows();
        } else {
          const take = ctx.thumbnail ? SAMPLES : pacer.take(params);
          shown = Math.min(SAMPLES, shown + take);
        }
        render();
        ctx.stats([pacer.row(params), ...rows]);
      },
    };

    function render() {
      const W = ctx.width;
      const H = ctx.height;
      const g = p.drawingContext as CanvasRenderingContext2D;
      const pal = ctx.palette();
      const fg = ctx.fg;
      p.background(...ctx.bg);
      g.save();
      g.font = '11px monospace';
      const v = view();
      const X = (x: number) => v.cx + x * v.sc;
      const Y = (y: number) => v.cy - y * v.sc;
      // the attracting or repelling centre
      g.fillStyle = rgba(ramp(pal, 0.95), 1);
      g.beginPath();
      g.arc(v.cx, v.cy, 5, 0, 2 * Math.PI);
      g.fill();
      if (mode === 'scattering') {
        renderScattering(g, X, Y, W, H, pal, fg);
        g.restore();
        return;
      }
      if (wedge.length) {
        const per = WEDGE_POINTS / SECTORS;
        for (let s = 0; s < SECTORS; s++) {
          g.fillStyle = rgba(ramp(pal, 0.35), s % 2 ? 0.12 : 0.24);
          g.beginPath();
          g.moveTo(v.cx, v.cy);
          for (let i = s * per; i <= (s + 1) * per; i++) g.lineTo(X(wedge[i][0]), Y(wedge[i][1]));
          g.closePath();
          g.fill();
        }
      }
      paths.forEach((path, b) => {
        const colour = ramp(pal, paths.length > 1 ? 0.25 + (0.65 * b) / Math.max(1, paths.length - 1) : 0.75);
        g.strokeStyle = rgba(colour, 0.9);
        g.lineWidth = 1.3;
        g.beginPath();
        let pen = false;
        let last = -1;
        for (let i = 0; i < shown; i++) {
          const x = path[2 * i];
          const y = path[2 * i + 1];
          if (!Number.isFinite(x)) { pen = false; continue; }
          if (!pen) { g.moveTo(X(x), Y(y)); pen = true; } else g.lineTo(X(x), Y(y));
          last = i;
        }
        g.stroke();
        if (last >= 0) {
          g.fillStyle = rgba(colour, 1);
          g.beginPath();
          g.arc(X(path[2 * last]), Y(path[2 * last + 1]), 4, 0, 2 * Math.PI);
          g.fill();
        }
      });
      const tNow = (Math.max(0, shown - 1) / (SAMPLES - 1)) * runTime;
      for (const a of apsides) {
        if (a.t > tNow) continue;
        g.strokeStyle = rgba(fg, 0.7);
        g.fillStyle = rgba(fg, 0.7);
        g.beginPath();
        g.arc(X(a.x), Y(a.y), 3, 0, 2 * Math.PI);
        if (a.peri) g.fill(); else g.stroke();
      }
      if (Number.isFinite(start.x)) {
        // the launch velocity: drag on the canvas to set it
        g.strokeStyle = rgba(ramp(pal, 0.95), 0.9);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(X(start.x), Y(start.y));
        g.lineTo(X(start.x + ARROW * start.vx), Y(start.y + ARROW * start.vy));
        g.stroke();
        g.fillStyle = rgba(fg, 0.75);
        g.fillText('drag to launch', X(start.x + ARROW * start.vx) + 6, Y(start.y + ARROW * start.vy));
      }
      g.fillStyle = rgba(fg, 0.75);
      const title = mode === 'kepler' ? 'the orbit, and the areas swept in twelve equal times of one period'
        : mode === 'power' ? 'the orbit under |F| ∝ rⁿ: filled dots perihelia, rings aphelia'
          : mode === 'relativity' ? 'the orbit with the 1/r⁴ correction: the perihelia (filled) advance'
            : 'your bodies around GM = 1, over 20π';
      g.fillText(title, 12, 18);
      g.restore();
    }

    function renderScattering(g: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number,
      W: number, H: number, pal: ReturnType<typeof ctx.palette>, fg: typeof ctx.fg) {
      g.lineWidth = 1;
      for (const path of beamPaths) {
        g.strokeStyle = rgba(ramp(pal, 0.6), 0.55);
        g.beginPath();
        path.forEach(([x, y], i) => { if (i === 0) g.moveTo(X(x), Y(y)); else g.lineTo(X(x), Y(y)); });
        g.stroke();
      }
      g.fillStyle = rgba(fg, 0.75);
      g.fillText('paths of the latest particles near the nucleus', 12, 18);
      // dN/dΩ per bin, measured (dots) against Rutherford's N/(π b_max²) · 1/(4 sin⁴(θ/2)) (curve), on log axes
      const x0 = W * 0.6;
      const w = W * 0.36;
      const y0 = H * 0.12;
      const hh = H * 0.74;
      g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
      g.strokeRect(x0, y0, w, hh);
      g.fillText('dN/dΩ against θ, log scale', x0, y0 - 6);
      const done = angles.length;
      const bmax = num(params, 'beam');
      const theory = (th: number) => (done / (Math.PI * bmax * bmax)) / (4 * Math.sin(th / 2) ** 4);
      const tmin = edges[BINS];
      const lx = (th: number) => x0 + ((th - tmin) / (Math.PI - tmin)) * w;
      const top = Math.log10(Math.max(1e-9, theory(tmin)));
      const bottom = Math.log10(Math.max(1e-12, theory(Math.PI))) - 0.5;
      const ly = (val: number) => y0 + hh - ((Math.log10(Math.max(val, 1e-12)) - bottom) / (top - bottom)) * hh;
      if (done) {
        g.strokeStyle = rgba(fg, 0.6);
        g.beginPath();
        for (let i = 0; i <= 80; i++) {
          const th = tmin + ((Math.PI - tmin) * i) / 80;
          if (i === 0) g.moveTo(lx(th), ly(theory(th))); else g.lineTo(lx(th), ly(theory(th)));
        }
        g.stroke();
        g.fillStyle = rgba(ramp(pal, 0.85), 1);
        for (let j = 0; j < BINS; j++) {
          const dOmega = 2 * Math.PI * (Math.cos(edges[j + 1]) - Math.cos(edges[j]));
          if (!counts[j]) continue;
          const mid = (edges[j] + edges[j + 1]) / 2;
          g.fillRect(lx(mid) - 3, ly(counts[j] / dOmega) - 3, 6, 6);
        }
      }
    }
  },
};

export default keplerOrbits;
