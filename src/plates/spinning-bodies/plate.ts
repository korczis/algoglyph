// Spinning bodies (src/plates/_shared/rigid): a free body of three unequal moments turning about
// each of its principal axes, the middle one unstable; a thin disc's wobble against its spin; a
// heavy top's precession and nutation. Each is integrated by the splitting method of rigid.ts and
// held to closed forms computed from the start alone (oracles.ts): the elliptic period of Euler's
// top, the growth rate near the middle axis, the reduced top's nutation and mean precession. A
// reader's own body, as point masses, replaces the box.
import { optionId } from '../../core/data';
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import {
  boxMoments, energy, identity, leanX, principal, spatial, step, symmetryAxis, toVertical,
  type Body, type RigidState,
} from '../_shared/rigid/rigid';
import {
  freePeriod, growthRate, steadyPrecession, symmetricRates, topMotion, wobblePeriod,
} from '../_shared/rigid/oracles';
import { rgba } from '../_shared/two-slit/draw';

type Kind = 'box' | 'disc' | 'top';
type Axis = 'smallest' | 'middle' | 'largest';

/** Samples revealed over a run (the paced unit). */
export const SAMPLES = 600;
export const MAX_PER_FRAME = 30;
/** Integration steps a frame may take: the cap that bounds a frame's work. */
export const STEPS_PER_FRAME = 16000;
/** Steps a run may take at most; a longer run takes larger steps (the readout says which). */
export const MAX_STEPS = SAMPLES * 800;
/** A step turns the fastest rate of the body through at most this angle. */
export const TURN_PER_STEP = 0.02;
/** The growth fit's window: the tilt from the middle axis, in radians. */
export const GROWTH_WINDOW: [number, number] = [1e-4, 1e-2];
/** A growth fit needs the tilt to start below this, so the decaying mode has died out. */
export const GROWTH_START = 1e-5;
const DISC: [number, number, number] = [0.25, 0.25, 0.5];
const AXES: Axis[] = ['smallest', 'middle', 'largest'];
const free = ['box', 'disc'];
const when = (...values: string[]) => ({ key: 'body', values });
const fx = (v: number, d = 9) => v.toFixed(d);
const ex = (v: number) => v.toExponential(2);

/** The angle of a turn from `from` to `to`, wrapped into (−π, π]. */
function turned(from: number, to: number): number {
  let d = to - from;
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

export const spinningBodies: PlateCode = {
  id: 'spinning-bodies',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'body', label: 'Body', value: 'box', rebuild: true,
      options: [
        { value: 'box', label: 'A box with three unequal moments (free)' },
        { value: 'disc', label: 'A thin disc, the wobbling plate (free)' },
        { value: 'top', label: 'A heavy top on a pivot' },
      ],
    },
    // sides from 0.2 to 4: a ratio of 20, where the thinnest box is already a plate or a rod
    { kind: 'range', key: 'a', label: 'Box side a', min: 0.2, max: 4, step: 0.1, value: 1, rebuild: true, when: when('box') },
    { kind: 'range', key: 'b', label: 'Box side b', min: 0.2, max: 4, step: 0.1, value: 2, rebuild: true, when: when('box') },
    { kind: 'range', key: 'c', label: 'Box side c', min: 0.2, max: 4, step: 0.1, value: 3, rebuild: true, when: when('box') },
    {
      kind: 'select', key: 'axis', label: 'Spin it about the axis of', value: 'middle', rebuild: true, when: when(...free),
      options: [
        { value: 'largest', label: 'the largest moment (stable)' },
        { value: 'middle', label: 'the middle moment (it flips)' },
        { value: 'smallest', label: 'the smallest moment (stable)' },
      ],
    },
    { kind: 'range', key: 'tilt', label: 'Tilt of ω from that axis (degrees)', min: 0.0001, max: 89, step: 0.0001, value: 1, log: true,
      rebuild: true, when: when(...free), hint: 'From a ten-thousandth of a degree, where the growth near the middle axis can be fitted over four decades, to 89°, short of the next axis.' },
    { kind: 'range', key: 'spin', label: 'Angular speed |ω| (rad/s)', min: 0.2, max: 5, step: 0.1, value: 1, rebuild: true, when: when(...free) },
    { kind: 'range', key: 'time', label: 'Simulated time (s)', min: 20, max: 600, step: 10, value: 120, rebuild: true, when: when(...free) },
    { kind: 'range', key: 'ratio', label: 'Moment about the axis over the moment about the pivot, I₃/I⊥', min: 0.1, max: 1.9, step: 0.05, value: 0.5,
      rebuild: true, when: when('top'), hint: 'Below 2: a body pivoted at a distance from its centre always has I₃ < 2I⊥.' },
    { kind: 'range', key: 'w3', label: 'Spin about its own axis ω₃ (rad/s)', min: 5, max: 300, step: 1, value: 100, rebuild: true, when: when('top') },
    { kind: 'range', key: 'lean', label: 'Lean of the axis from vertical (degrees)', min: 1, max: 179, step: 1, value: 30, rebuild: true,
      when: when('top'), hint: 'At 0° and 180° the axis has no azimuth to precess in.' },
    { kind: 'range', key: 'mgl', label: 'Gravity’s torque arm Mgl', min: 0.5, max: 20, step: 0.5, value: 10, rebuild: true, when: when('top') },
    {
      kind: 'select', key: 'start', label: 'Released', value: 'rest', rebuild: true, when: when('top'),
      options: [
        { value: 'rest', label: 'with its axis at rest (it nutates)' },
        { value: 'steady', label: 'already precessing steadily' },
      ],
    },
    { kind: 'range', key: 'run', label: 'Simulated time of the top (s)', min: 5, max: 120, step: 5, value: 40, rebuild: true, when: when('top') },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'samples' },
  create(p, ctx) {
    const params = ctx.params;
    let pacer = new Pacer('replay', 'samples', MAX_PER_FRAME);
    let kind: Kind | 'data' = 'box';
    let body: Body = { I: [1, 1, 1], sym: -1, mgl: 0 };
    let s: RigidState = { R: identity(), L: new Float64Array(3) };
    let input = '';
    let fixed: Stat[] = [];
    let total = 0;
    let shown = 0;
    let stepsPerSample = 1;
    let h = 0.01;
    let t = 0;
    // what the body looks like: box half-sides, or point masses in the body frame
    let half: [number, number, number] = [0.5, 1, 1.5];
    let points: Float64Array[] = [];
    let spinAxis = 1;
    // conserved at the start
    let E0 = 0;
    let Lmag0 = 0;
    const Ls0 = new Float64Array(3);
    const Ls = new Float64Array(3);
    let L30 = 0;
    // measured
    let dE = 0;
    let dL = 0;
    let dLs = 0;
    let dL3 = 0;
    let prevW1 = 0;
    let ups: number[] = [];
    let flips = 0;
    let growth = { n: 0, st: 0, sy: 0, stt: 0, sty: 0, open: true };
    let tilt0 = 0;
    let wob = 0;
    let spun = 0;
    let wobAt = 0;
    let spinAt = 0;
    // the top
    let phiU = 0;
    let phiAt = 0;
    let prevUd = 0;
    let bottoms: [number, number][] = [];
    let thMin = Infinity;
    let thMax = -Infinity;
    // the trail: the spin axis's tip in space, and ω in the body, a sample each
    let trail: Float64Array = new Float64Array(0);
    let wTrail: Float64Array = new Float64Array(0);
    let wBound: [number, number, number] = [1, 1, 1];
    let yaw = 0.6;
    let pitch = 0.35;
    let grab: [number, number] | null = null;

    function setFree(I: [number, number, number]) {
      body = { I, sym: symmetryAxis(I), mgl: 0 };
      const k = AXES.indexOf(str(params, 'axis') as Axis);
      const j = k === 1 ? 2 : 1;
      const tl = (num(params, 'tilt') * Math.PI) / 180;
      const w = num(params, 'spin');
      const om = [0, 0, 0];
      om[k] = w * Math.cos(tl);
      om[j] = w * Math.sin(tl);
      const L = Float64Array.from(om.map((v, i) => v * I[i]));
      s = { R: toVertical(L), L };
      spinAxis = k;
      tilt0 = Math.atan2(Math.hypot(L[(k + 1) % 3], L[(k + 2) % 3]), Math.abs(L[k]));
      const rate = Math.hypot(L[0], L[1], L[2]) / Math.min(...I);
      plan(num(params, 'time'), rate);
      wBound = [0, 1, 2].map((i) => Math.min(Math.hypot(...L) / I[i], Math.sqrt((2 * energy(body, s)) / I[i]))) as [number, number, number];
    }

    function setTop() {
      const Ip = 1;
      const I3 = num(params, 'ratio');
      const w3 = num(params, 'w3');
      const th = (num(params, 'lean') * Math.PI) / 180;
      const mgl = num(params, 'mgl');
      body = { I: [Ip, Ip, I3], sym: 2, mgl };
      const steady = str(params, 'start') === 'steady' ? steadyPrecession(Ip, I3, w3, mgl, th) : null;
      // at rest the axis does not move: ω = ω₃ along it; steadily, ω = Ω ẑ + ψ̇ e₃ with ω₃ = ψ̇ + Ω cos θ
      const L = Float64Array.from([0, steady === null ? 0 : Ip * steady * Math.sin(th), I3 * w3]);
      s = { R: leanX(th), L };
      spinAxis = 2;
      const rate = Math.max(Math.hypot(L[0] / Ip, L[1] / Ip, L[2] / I3), (I3 * w3) / Ip, Math.sqrt(mgl / Ip));
      plan(num(params, 'run'), rate);
      input = `seeded: a top, I⊥ = 1, I₃ = ${I3}, Mgl = ${mgl}, leaning ${num(params, 'lean')}°, spinning at ω₃ = ${w3} rad/s`;
      const tm = topMotion(Ip, mgl, s.R, L);
      const want = str(params, 'start') === 'steady';
      fixed = [
        { label: 'roots of the reduced top f(u), u = cos θ', value: tm.roots.map((u) => u.toFixed(9)).join(', ') },
        { label: 'mean precession of the reduced top, by quadrature (rad/s)', value: fx(tm.precession, 10) },
        { label: 'gyroscope approximation Mgl/(I₃ω₃) (rad/s)', value: fx(mgl / (I3 * w3), 10) },
      ];
      if (want) {
        fixed.push({ label: 'steady precession, slow root of I⊥ cos θ Ω² − I₃ω₃Ω + Mgl = 0 (rad/s)',
          value: steady === null ? 'none: the spin is too slow, I₃²ω₃² < 4I⊥Mgl cos θ; released at rest instead' : fx(steady, 10) });
      }
      if (steady === null) {
        fixed.push(
          { label: 'nutation period 4K(k)/√(β(u₃ − u₁)) (s)', value: fx(tm.nutation, 10) },
          { label: 'fast-top nutation period 2πI⊥/(I₃ω₃) (s)', value: fx((2 * Math.PI * Ip) / (I3 * w3), 10) },
        );
      }
    }

    function plan(time: number, rate: number) {
      h = Math.max(TURN_PER_STEP / rate, time / MAX_STEPS);
      stepsPerSample = Math.max(1, Math.ceil(time / SAMPLES / h));
      h = time / (SAMPLES * stepsPerSample);
    }

    function freeFixed(): Stat[] {
      const { I, sym } = body;
      const out: Stat[] = [{ label: 'principal moments I₁ ≤ I₂ ≤ I₃', value: I.map((v) => v.toPrecision(9)).join(', ') }];
      const w = num(params, 'spin');
      if (sym < 0) {
        const fp = freePeriod(I, s.L);
        out.push(
          { label: 'period of the body’s motion 4K(k)·√(I₁I₂I₃/((I₃ − I₂)(L² − 2EI₁))) (s)', value: Number.isFinite(fp.period) ? fx(fp.period) : 'none: on the separatrix' },
          { label: 'its orbit circles the axis of the', value: `${fp.around} moment, k² = ${fp.m.toFixed(9)}` },
        );
        if (spinAxis === 1) out.push({ label: 'growth rate λ = ω√((I₃ − I₂)(I₂ − I₁)/(I₁I₃)) (1/s)', value: fx(growthRate(I, w)) });
        else out.push({ label: 'small-wobble period 2π/Ω about that axis (s)', value: fx(wobblePeriod(I, spinAxis as 0 | 2, w)) });
      } else {
        const perp = I[(sym + 1) % 3];
        const Lm = Math.hypot(s.L[0], s.L[1], s.L[2]);
        const r = symmetricRates(I[sym as 0 | 1 | 2], perp, s.L[sym], Lm);
        out.push(
          { label: 'wobble |L|/I⊥ (rad/s)', value: fx(r.wobble) },
          { label: 'spin L_s(1/I_s − 1/I⊥) (rad/s)', value: fx(r.spin) },
          { label: '|wobble/spin| = I_s/(|I⊥ − I_s| cos θ)', value: r.spin === 0 ? 'none: no spin about the symmetry axis' : fx(Math.abs(r.wobble / r.spin)) },
        );
      }
      return out;
    }

    function setup() {
      const raw = str(params, 'body');
      shown = 0;
      t = 0;
      fixed = [];
      total = SAMPLES;
      if (optionId(raw)) {
        kind = 'data';
        const table = ctx.data?.(optionId(raw) ?? '') ?? null;
        const n = table ? table.rows : 0;
        const pr = table ? principal(table.values[0], table.values[1], table.values[2], table.values[3]) : null;
        if (!pr || pr.mass <= 0 || pr.I[0] <= 1e-9 * pr.I[2]) {
          input = !table ? 'your data: none attached; attach a table of x, y, z, m'
            : `your data, ${n} points: ${pr && pr.mass > 0 ? 'they lie on a line, which has no moment about itself, so the body is not run' : 'their masses add up to zero, so the body is not run'}`;
          total = 0;
          points = [];
          body = { I: [1, 1, 1], sym: -1, mgl: 0 };
          s = { R: identity(), L: new Float64Array(3) };
        } else {
          input = `your data, ${n} points, mass ${pr.mass.toPrecision(6)}`;
          const scale = pr.I[2];
          setFree(pr.I.map((v) => v / scale) as [number, number, number]);
          // the points in the principal frame, sized to the view
          const V = pr.V;
          let rmax = 0;
          points = [new Float64Array(n), new Float64Array(n), new Float64Array(n)];
          for (let i = 0; i < n; i++) {
            const d = [table!.values[0][i] - pr.centre[0], table!.values[1][i] - pr.centre[1], table!.values[2][i] - pr.centre[2]];
            for (let a = 0; a < 3; a++) points[a][i] = V[a] * d[0] + V[3 + a] * d[1] + V[6 + a] * d[2];
            rmax = Math.max(rmax, Math.hypot(points[0][i], points[1][i], points[2][i]));
          }
          for (let a = 0; a < 3; a++) for (let i = 0; i < n; i++) points[a][i] /= rmax || 1;
          fixed = freeFixed();
        }
      } else {
        kind = raw as Kind;
        points = [];
        if (kind === 'top') setTop();
        else {
          let I: [number, number, number];
          if (kind === 'disc') {
            I = [...DISC];
            input = 'seeded: a thin disc of radius 1 and unit mass, I = ¼, ¼, ½';
          } else {
            const sides = [num(params, 'a'), num(params, 'b'), num(params, 'c')].sort((x, y) => y - x);
            // the largest moment is about the shortest side: ascending moments, descending sides
            I = boxMoments(sides[0], sides[1], sides[2]).sort((x, y) => x - y) as [number, number, number];
            half = [sides[0] / 2, sides[1] / 2, sides[2] / 2];
            input = `seeded: a box ${num(params, 'a')} × ${num(params, 'b')} × ${num(params, 'c')} of unit mass`;
          }
          setFree(I);
          fixed = freeFixed();
        }
      }
      E0 = energy(body, s);
      spatial(s, Ls0);
      Lmag0 = Math.hypot(s.L[0], s.L[1], s.L[2]);
      L30 = s.L[2];
      dE = 0; dL = 0; dLs = 0; dL3 = 0;
      prevW1 = s.L[1] / body.I[1];
      ups = [];
      flips = 0;
      growth = { n: 0, st: 0, sy: 0, stt: 0, sty: 0, open: true };
      wob = 0; spun = 0;
      wobAt = body.sym >= 0 ? Math.atan2(s.R[3 + body.sym], s.R[body.sym]) : 0;
      spinAt = body.sym >= 0 ? Math.atan2(s.L[(body.sym + 2) % 3], s.L[(body.sym + 1) % 3]) : 0;
      phiU = 0;
      phiAt = Math.atan2(s.R[5], s.R[2]);
      prevUd = 0;
      bottoms = [];
      thMin = Infinity;
      thMax = -Infinity;
      trail = new Float64Array(3 * (total + 1));
      wTrail = new Float64Array(3 * (total + 1));
      record(0);
      pacer = new Pacer('replay', 'samples', Math.max(1, Math.min(MAX_PER_FRAME, Math.floor(STEPS_PER_FRAME / stepsPerSample))));
      pacer.start(total);
    }

    function record(i: number) {
      for (let r = 0; r < 3; r++) trail[3 * i + r] = s.R[3 * r + spinAxis];
      for (let a = 0; a < 3; a++) wTrail[3 * i + a] = s.L[a] / body.I[a];
    }

    /** One step and what it measures. */
    function advance() {
      step(body, s, h);
      t += h;
      const { L, R } = s;
      dE = Math.max(dE, Math.abs(energy(body, s) - E0) / Math.abs(E0));
      spatial(s, Ls);
      if (kind === 'top') {
        dLs = Math.max(dLs, Math.abs(Ls[2] - Ls0[2]) / Lmag0);
        dL3 = Math.max(dL3, Math.abs(L[2] - L30) / Lmag0);
        const ax = R[2];
        const ay = R[5];
        const az = R[8];
        const ph = Math.atan2(ay, ax);
        const d = turned(phiAt, ph);
        phiU += d;
        phiAt = ph;
        const th = Math.acos(Math.max(-1, Math.min(1, az)));
        thMin = Math.min(thMin, th);
        thMax = Math.max(thMax, th);
        // u̇ = (ω × a)_z, ω in space: a bottom of the nutation is where u̇ turns from − to +
        const w0 = L[0] / body.I[0];
        const w1 = L[1] / body.I[1];
        const w2 = L[2] / body.I[2];
        const wx = R[0] * w0 + R[1] * w1 + R[2] * w2;
        const wy = R[3] * w0 + R[4] * w1 + R[5] * w2;
        const ud = wx * ay - wy * ax;
        if (prevUd < 0 && ud >= 0) {
          const f = -prevUd / (ud - prevUd);
          bottoms.push([t - h + f * h, phiU - d + f * d]);
        }
        prevUd = ud;
        return;
      }
      dL = Math.max(dL, Math.abs(Math.hypot(L[0], L[1], L[2]) - Lmag0) / Lmag0);
      dLs = Math.max(dLs, Math.hypot(Ls[0] - Ls0[0], Ls[1] - Ls0[1], Ls[2] - Ls0[2]) / Lmag0);
      const w1 = L[1] / body.I[1];
      if ((prevW1 < 0) !== (w1 < 0)) flips++;
      if (prevW1 < 0 && w1 >= 0) ups.push(t - h + (-prevW1 / (w1 - prevW1)) * h);
      prevW1 = w1;
      if (spinAxis === 1 && growth.open && tilt0 < GROWTH_START) {
        const tl = Math.atan2(Math.hypot(L[0], L[2]), Math.abs(L[1]));
        if (tl > GROWTH_WINDOW[1]) growth.open = false;
        else if (tl >= GROWTH_WINDOW[0]) {
          const y = Math.log(tl);
          growth.n++; growth.st += t; growth.sy += y; growth.stt += t * t; growth.sty += t * y;
        }
      }
      if (body.sym >= 0) {
        const k = body.sym;
        const wa = Math.atan2(R[3 + k], R[k]);
        wob += turned(wobAt, wa);
        wobAt = wa;
        const sa = Math.atan2(L[(k + 2) % 3], L[(k + 1) % 3]);
        spun -= turned(spinAt, sa);
        spinAt = sa;
      }
    }

    function stats(): Stat[] {
      const done = shown >= total;
      const late = (v: string) => (done ? v : 'after the run');
      const rows: Stat[] = [pacer.row(params), { label: 'Input', value: input },
        { label: 'samples of the run', value: `${shown} of ${total}` }];
      if (total === 0) return rows;
      rows.push({ label: 'time step h (s)', value: h.toPrecision(6) }, ...fixed);
      rows.push({ label: 'energy, largest relative change |E − E₀|/|E₀|, numerics', value: ex(dE) });
      if (kind === 'top') {
        rows.push(
          { label: 'L_z in space, largest change over |L|, numerics', value: ex(dLs) },
          { label: 'L₃ along the axis, largest change over |L|, numerics', value: ex(dL3) },
        );
        const steady = fixed.some((r) => r.label.startsWith('steady precession') && !r.value.startsWith('none'));
        if (steady) {
          rows.push(
            { label: 'mean precession rate, measured over the run (rad/s)', value: late(fx(phiU / t, 10)) },
            { label: 'range of the lean over the run, measured (rad)', value: late(ex(thMax - thMin)) },
          );
        } else {
          const n = bottoms.length;
          const span = n > 1 ? bottoms[n - 1][0] - bottoms[0][0] : 0;
          rows.push(
            { label: 'mean precession rate, measured over whole nutations (rad/s)', value: late(n > 1 ? fx((bottoms[n - 1][1] - bottoms[0][1]) / span, 10) : 'none: fewer than two nutations; run longer') },
            { label: 'nutation period, measured between the lowest points of the axis (s)', value: late(n > 1 ? fx(span / (n - 1), 10) : 'none: fewer than two nutations; run longer') },
            { label: 'range of the lean over the run, measured (degrees)', value: late(fx(((thMax - thMin) * 180) / Math.PI, 6)) },
          );
        }
        return rows;
      }
      rows.push(
        { label: '|L|, largest relative change, numerics', value: ex(dL) },
        { label: 'L in space, largest change |L − L₀|/|L₀|, numerics', value: ex(dLs) },
      );
      if (body.sym < 0) {
        const n = ups.length;
        rows.push(
          { label: 'period of the body’s motion, measured between upward zeros of ω₂ (s)', value: late(n > 1 ? fx((ups[n - 1] - ups[0]) / (n - 1)) : 'none: fewer than two periods; run longer') },
          { label: 'flips of ω₂, the middle axis, counted', value: `${flips}` },
        );
        if (spinAxis === 1) {
          const g = growth;
          const slope = (g.n * g.sty - g.st * g.sy) / (g.n * g.stt - g.st * g.st);
          rows.push({
            label: `growth rate of the tilt from the middle axis, fitted from ${GROWTH_WINDOW[0]} to ${GROWTH_WINDOW[1]} rad (1/s)`,
            value: tilt0 >= GROWTH_START ? `none: start within ${GROWTH_START} rad of the axis` : late(g.n > 2 && !g.open ? fx(slope) : 'none: the tilt did not grow through the window; run longer'),
          });
        }
      } else {
        rows.push(
          { label: 'wobble of the symmetry axis about L, measured (rad/s)', value: late(fx(wob / t)) },
          { label: 'spin about the symmetry axis, measured (rad/s)', value: late(fx(spun / t)) },
          { label: '|wobble/spin|, measured', value: late(spun === 0 ? 'none' : fx(Math.abs(wob / spun))) },
        );
      }
      return rows;
    }

    /** Space to screen: a turn by yaw about z, a tilt by pitch, then x right and z up. */
    function project(x: number, y: number, z: number, cx: number, cy: number, sc: number): [number, number] {
      const xr = Math.cos(yaw) * x + Math.sin(yaw) * y;
      const d = -Math.sin(yaw) * x + Math.cos(yaw) * y;
      const yr = Math.cos(pitch) * z - Math.sin(pitch) * d;
      return [cx + sc * xr, cy - sc * yr];
    }

    function drawBody(g: CanvasRenderingContext2D, cx: number, cy: number, sc: number, col: string, fg: string) {
      const { R } = s;
      const toSpace = (b: number[]): [number, number, number] => [
        R[0] * b[0] + R[1] * b[1] + R[2] * b[2], R[3] * b[0] + R[4] * b[1] + R[5] * b[2], R[6] * b[0] + R[7] * b[1] + R[8] * b[2]];
      const at = (b: number[], k = 1) => { const v = toSpace(b); return project(k * v[0], k * v[1], k * v[2], cx, cy, sc); };
      g.strokeStyle = col;
      g.lineWidth = 1.5;
      if (kind === 'data') {
        g.fillStyle = col;
        const n = points[0]?.length ?? 0;
        for (let i = 0; i < n; i++) {
          const [X, Y] = at([points[0][i], points[1][i], points[2][i]], 0.9);
          g.fillRect(X - 1.5, Y - 1.5, 3, 3);
        }
      } else if (kind === 'box') {
        const m = Math.hypot(...half);
        const corner = (i: number) => [0, 1, 2].map((a) => ((i >> a) & 1 ? 1 : -1) * (half[a] / m));
        g.beginPath();
        for (let i = 0; i < 8; i++) for (let a = 0; a < 3; a++) {
          const j = i ^ (1 << a);
          if (j < i) continue;
          const [x0, y0] = at(corner(i));
          const [x1, y1] = at(corner(j));
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
        }
        g.stroke();
      } else {
        // a disc (free, its axis is body axis 2) or the top's disc at the end of its axis
        const off = kind === 'top' ? 1 : 0;
        const rad = kind === 'top' ? 0.45 : 0.9;
        g.beginPath();
        for (let k = 0; k <= 48; k++) {
          const a = (2 * Math.PI * k) / 48;
          const [X, Y] = at([rad * Math.cos(a), rad * Math.sin(a), off]);
          if (k === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
        }
        const [sx, sy] = at([0, 0, off]);
        const [ex0, ey0] = at([rad, 0, off]);
        g.moveTo(sx, sy);
        g.lineTo(ex0, ey0);
        if (kind === 'top') {
          const [px, py] = project(0, 0, 0, cx, cy, sc);
          g.moveTo(px, py);
          g.lineTo(sx, sy);
        }
        g.stroke();
      }
      // L in space (constant for a free body), dashed
      if (Lmag0 > 0) {
        spatial(s, Ls);
        const m = Math.hypot(Ls[0], Ls[1], Ls[2]) || 1;
        const [ax, ay] = project(0, 0, 0, cx, cy, sc);
        const [bx, by] = project((1.15 * Ls[0]) / m, (1.15 * Ls[1]) / m, (1.15 * Ls[2]) / m, cx, cy, sc);
        g.strokeStyle = fg;
        g.setLineDash([4, 3]);
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.stroke();
        g.setLineDash([]);
      }
      g.lineWidth = 1;
    }

    return {
      setup,
      pace: () => pacer.report(shown >= total, params),
      pressed(x, y) { grab = [x, y]; },
      dragged(x, y) {
        if (!grab) { grab = [x, y]; return; }
        yaw += (x - grab[0]) * 0.01;
        pitch = Math.max(-1.4, Math.min(1.4, pitch + (y - grab[1]) * 0.01));
        grab = [x, y];
      },
      reset() { yaw = 0.6; pitch = 0.35; grab = null; },
      draw() {
        const take = ctx.thumbnail ? pacer.maxPerFrame : pacer.take(params);
        for (let k = 0; k < take && shown < total; k++) {
          for (let q = 0; q < stepsPerSample; q++) advance();
          shown++;
          record(shown);
        }
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        g.font = '11px monospace';
        // left: the body in space, the trail of its spin axis's tip
        const cx = W * 0.27;
        const cy = H * (kind === 'top' ? 0.62 : 0.52);
        const sc = Math.min(W * 0.22, H * 0.36);
        g.strokeStyle = rgba(ramp(pal, 0.2), 0.8);
        g.beginPath();
        for (let i = 0; i <= shown; i++) {
          const k = kind === 'top' ? 1 : 1.05;
          const [X, Y] = project(k * trail[3 * i], k * trail[3 * i + 1], k * trail[3 * i + 2], cx, cy, sc);
          if (i === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
        }
        g.stroke();
        drawBody(g, cx, cy, sc, rgba(ramp(pal, 0.8), 1), rgba(fg, 0.6));
        g.fillStyle = rgba(fg, 0.75);
        g.fillText(kind === 'top' ? 'the top; its axis’s tip leaves the trail' : 'the body; the dashed line is L, fixed in space', W * 0.03, H * 0.07);
        g.fillText('drag to turn the view', W * 0.03, H * 0.96);
        // right: ω in the body against time, one lane each; or the top's lean against its azimuth
        const x0 = W * 0.55;
        const w = W * 0.41;
        const y0 = H * 0.1;
        const hh = H * 0.8;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
        g.strokeRect(x0, y0, w, hh);
        if (kind === 'top') {
          // the lean θ against the unwrapped azimuth φ, over the run so far: loops, waves or cusps
          const pts: [number, number][] = [];
          let az = Math.atan2(trail[1], trail[0]);
          let acc = 0;
          let lo = Infinity;
          let hi = -Infinity;
          for (let i = 0; i <= shown; i++) {
            const a = Math.atan2(trail[3 * i + 1], trail[3 * i]);
            acc += turned(az, a);
            az = a;
            const th = Math.acos(Math.max(-1, Math.min(1, trail[3 * i + 2])));
            pts.push([acc, th]);
            lo = Math.min(lo, th);
            hi = Math.max(hi, th);
          }
          const span = Math.max(1e-9, Math.abs(pts[pts.length - 1][0]));
          const pad = Math.max(1e-9, (hi - lo) * 0.1);
          g.strokeStyle = rgba(ramp(pal, 0.75), 1);
          g.beginPath();
          pts.forEach(([a, th], i) => {
            const X = x0 + (Math.abs(a) / span) * w;
            const Y = y0 + ((th - lo + pad) / (hi - lo + 2 * pad)) * hh;
            if (i === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
          });
          g.stroke();
          g.fillStyle = rgba(fg, 0.75);
          g.fillText('lean θ (down) against azimuth φ: the nutation', x0, y0 - 6);
        } else if (total > 0) {
          const lane = hh / 3;
          for (let a = 0; a < 3; a++) {
            const mid = y0 + lane * (a + 0.5);
            g.strokeStyle = rgba(mix(ctx.bg, fg, 0.15), 1);
            g.beginPath();
            g.moveTo(x0, mid);
            g.lineTo(x0 + w, mid);
            g.stroke();
            g.strokeStyle = rgba(ramp(pal, 0.15 + 0.35 * a), 1);
            g.beginPath();
            for (let i = 0; i <= shown; i++) {
              const X = x0 + (i / total) * w;
              const Y = mid - (wTrail[3 * i + a] / (wBound[a] || 1)) * lane * 0.45;
              if (i === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
            }
            g.stroke();
            g.fillStyle = rgba(fg, 0.75);
            g.fillText(`ω${'₁₂₃'[a]}`, x0 + 4, mid - lane * 0.3);
          }
          g.fillText('ω in the body against time: I₁ ≤ I₂ ≤ I₃', x0, y0 - 6);
        }
        g.restore();
        ctx.stats(stats());
      },
    };
  },
};

export default spinningBodies;
