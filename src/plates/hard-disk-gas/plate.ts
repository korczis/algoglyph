import { optionId } from '../../core/data';
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import { diameterOf, DiskGas, fromTable, initialState, type DiskInit, type StartKind } from '../_shared/ensemble/hard-disks';
import { ksDistance } from '../_shared/two-slit/math';
import { rgba } from '../_shared/two-slit/draw';

/** Time steps of a run (the counted changes: every disk flies through one slice of time a step). */
export const STEPS = 600;
/** The most steps a frame takes, at the pace control's top. */
export const MAX_PER_FRAME = 20;
/** Pair predictions a frame may make: a frame takes at most this / N events from the queue, the
 * counted bound on a frame's work whatever the density, the temperature or the run length. */
export const PAIRS_PER_FRAME = 400_000;
/** The readouts' statistics are taken over the second half of the run, after the start has relaxed. */
const WINDOW_FROM = STEPS / 2;
/** Blocks of the window, for the standard errors of the time averages. */
const BLOCKS = 10;
/** Kolmogorov's distribution of √N·D for a sample from the law tested: mean and standard deviation. */
const KS_MEAN = 0.8687;
const KS_SD = 0.2603;
const BINS = 24;
const S_MAX = 4;

const pm = (v: number, se: number, d = 4) => `${v.toFixed(d)} ± ${se.toFixed(d)}`;
const sci = (v: number) => (v === 0 ? '0' : v.toExponential(1));

/** Mean and standard error of block values. */
function blockStats(xs: number[]): { mean: number; se: number } {
  const k = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / Math.max(1, k);
  const v = k > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (k - 1) : 0;
  return { mean, se: Math.sqrt(v / Math.max(1, k)) };
}

/**
 * The mean free path of a Maxwellian mixture over 1/(√2 nσ): a disk of mass m flies at the mean speed
 * √(πkT/2m) and meets a disk of mass m' at the mean relative speed √(πkT/2·(1/m + 1/m')), so the
 * path flown per collision ended is ⟨m^(−1/2)⟩ over ⟨(1/m + 1/m')^(1/2)⟩ of random pairs, times √2.
 */
export function mixFactor(masses: number[]): number {
  if (!masses.length) return 1;
  const counts = new Map<number, number>();
  for (const m of masses) counts.set(m, (counts.get(m) ?? 0) + 1);
  const kinds = [...counts];
  const n = masses.length;
  let speed = 0;
  let rel = 0;
  for (const [m, c] of kinds) {
    speed += (c / n) / Math.sqrt(m);
    for (const [m2, c2] of kinds) rel += ((c * c2) / (n * n)) * Math.sqrt(1 / m + 1 / m2);
  }
  return (Math.SQRT2 * speed) / rel;
}

interface Block { impulse: number; time: number; path: number; collisions: number; keLight: number; keHeavy: number; samples: number }

export const hardDiskGas: PlateCode = {
  id: 'hard-disk-gas',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'start', label: 'Start', value: 'equal', rebuild: true,
      options: [
        { value: 'equal', label: 'Every disk at one speed' },
        { value: 'maxwell', label: 'Already in Maxwell’s distribution' },
      ],
    },
    { kind: 'range', key: 'n', label: 'Disks N', min: 20, max: 600, step: 10, value: 300, rebuild: true },
    // the top is a dense fluid; past about 0.7 hard disks freeze, and the lattice start allows
    // at most π/4 of the box at a whole square of disks
    { kind: 'range', key: 'eta', label: 'Packing fraction η', min: 0.005, max: 0.45, step: 0.005, value: 0.1, rebuild: true },
    { kind: 'range', key: 'heavy', label: 'Fraction of heavy disks', min: 0, max: 1, step: 0.05, value: 0.5, rebuild: true },
    { kind: 'range', key: 'ratio', label: 'Heavy over light mass', min: 1, max: 16, step: 1, value: 4, rebuild: true },
    { kind: 'range', key: 'kT', label: 'Temperature kT', min: 0.25, max: 4, step: 0.25, value: 1, rebuild: true },
    { kind: 'range', key: 'run', label: 'Run length, free times', min: 5, max: 200, step: 5, value: 20, rebuild: true },
    paceParam(),
    paletteParam('ember'),
  ],
  pace: { kind: 'replay', unit: 'time steps' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'time steps', MAX_PER_FRAME);
    let gas: DiskGas;
    let input = '';
    let dt = 0;
    let steps = 0;
    let target = 0;
    let E0 = 0;
    let kT = 1;
    let eta = 0;
    /** A disk is heavy when its mass is above the geometric mean of the lightest and the heaviest. */
    let split = Infinity;
    /** Kinetic theory's free path for this mix of masses over the one-mass 1/(√2 nσ): the mean speed
     * over √2 times the mean relative speed of a random pair, both from Maxwell's law (1 for one mass). */
    let massFactor = 1;
    let blocks: Block[] = [];
    let open: Block;
    let lastImpulse = 0;
    let lastPath = 0;
    let lastCollisions = 0;
    let keTrace: [number, number][] = [];
    let rows: Stat[] = [];

    const fresh = (): Block => ({ impulse: 0, time: 0, path: 0, collisions: 0, keLight: 0, keHeavy: 0, samples: 0 });

    function speciesKE(): [number, number] {
      let l = 0; let nl = 0; let h = 0; let nh = 0;
      for (let i = 0; i < gas.n; i++) {
        const e = 0.5 * gas.m[i] * (gas.vx[i] ** 2 + gas.vy[i] ** 2);
        if (gas.m[i] > split) { h += e; nh++; } else { l += e; nl++; }
      }
      return [nl ? l / nl : NaN, nh ? h / nh : NaN];
    }

    /** u = m v²/2kT of every disk: exponential with mean 1 in two dimensions, whatever the mass. */
    function scaledEnergies(): Float64Array {
      const u = new Float64Array(gas.n);
      for (let i = 0; i < gas.n; i++) u[i] = (0.5 * gas.m[i] * (gas.vx[i] ** 2 + gas.vy[i] ** 2)) / kT;
      return u;
    }

    function measure(): Stat[] {
      const out: Stat[] = [pacer.row(params), { label: 'Input', value: input }];
      const n = gas.n;
      const d = gas.d;
      out.push(
        { label: 'time steps', value: `${steps} of ${STEPS}, t = ${gas.t.toFixed(3)}` },
        { label: 'disks, diameter, packing fraction η', value: `${n}, d = ${d.toFixed(5)}, η = ${eta.toFixed(4)}` },
        { label: 'collisions per disk', value: (n ? (2 * gas.collisions) / n : 0).toFixed(2) },
        { label: 'kT = E/N', value: kT.toFixed(4) },
        { label: 'energy drift |ΔE|/E (numerics)', value: sci(E0 > 0 ? Math.abs(gas.energy() - E0) / E0 : 0) },
      );
      const done = blocks.filter((b) => b.time > 0);
      if (!done.length || n < 2) return out;
      const A = gas.reach ** 2;
      const density = n / A;
      // pressure: impulse on the walls per unit time and per unit length of wall the centres reach
      const Z = blockStats(done.map((b) => (b.impulse / (b.time * 4 * gas.reach)) * (A / (n * kT))));
      const chi = (1 - (7 * eta) / 16) / (1 - eta) ** 2;
      out.push(
        { label: 'PA/NkT, measured at the walls', value: pm(Z.mean, Z.se) },
        { label: 'second virial, 1 + 2η', value: (1 + 2 * eta).toFixed(4) },
        { label: 'Henderson’s equation of state, (1 + η²/8)/(1 − η)²', value: ((1 + (eta * eta) / 8) / (1 - eta) ** 2).toFixed(4) },
      );
      const lam0 = 1 / (Math.SQRT2 * density * 2 * d);
      const withColl = done.filter((b) => b.collisions > 0);
      if (withColl.length) {
        const L = blockStats(withColl.map((b) => b.path / (2 * b.collisions) / lam0));
        out.push(
          { label: 'mean free path over 1/(√2 nσ), σ = 2d', value: pm(L.mean, L.se) },
          { label: 'Enskog’s free path for these masses, χ = (1 − 7η/16)/(1 − η)²', value: (massFactor / chi).toFixed(4) },
        );
      }
      const pairs = done.filter((b) => b.keLight > 0 && b.keHeavy > 0);
      if (pairs.length) {
        const R = blockStats(pairs.map((b) => b.keHeavy / b.keLight));
        out.push({ label: 'mean kinetic energy, heavy over light', value: pm(R.mean, R.se) });
      }
      const u = scaledEnergies();
      out.push(
        { label: 'KS distance of the speeds from Rayleigh’s law', value: ksDistance(u, (x) => 1 - Math.exp(-x)).toFixed(5) },
        { label: 'KS bound, (0.8687 + 4 × 0.2603)/√N', value: ((KS_MEAN + 4 * KS_SD) / Math.sqrt(n)).toFixed(5) },
      );
      return out;
    }

    /** The reader's disks, at the diameter that gives all their rows the packing fraction asked. */
    function stateFromData(): { state: DiskInit; d: number } {
      const table = ctx.data?.(optionId(params.start) ?? '') ?? null;
      const d = diameterOf(table?.rows ?? 1, num(params, 'eta'));
      if (!table) {
        input = 'your data: none attached; attach a table of x, y, vx, vy, m';
        const none = new Float64Array(0);
        return { state: { x: none, y: none, vx: none, vy: none, m: none }, d };
      }
      const [X, Y, VX, VY, M] = table.values;
      const { state, dropped } = fromTable({ x: X, y: Y, vx: VX, vy: VY, m: M }, d);
      input = `your data, ${state.x.length} disks${dropped ? ` (${dropped} overlapping rows left out)` : ''}`;
      return { state, d };
    }

    function closeStep(): void {
      steps++;
      if (steps > WINDOW_FROM) {
        open.impulse += gas.wallImpulse - lastImpulse;
        open.time += dt;
        open.path += gas.path - lastPath;
        open.collisions += gas.collisions - lastCollisions;
        const [l, h] = speciesKE();
        if (Number.isFinite(l) && Number.isFinite(h)) { open.keLight += l; open.keHeavy += h; open.samples++; }
        if ((steps - WINDOW_FROM) % ((STEPS - WINDOW_FROM) / BLOCKS) === 0) { blocks.push(open); open = fresh(); }
      }
      lastImpulse = gas.wallImpulse;
      lastPath = gas.path;
      lastCollisions = gas.collisions;
      keTrace.push(speciesKE());
    }

    return {
      setup() {
        const raw = str(params, 'start');
        const rnd = mulberry32(Math.floor(ctx.rnd() * 0x7fffffff) + 1);
        let st: DiskInit;
        let d: number;
        if (optionId(raw)) {
          ({ state: st, d } = stateFromData());
        } else {
          const n = num(params, 'n');
          d = diameterOf(n, num(params, 'eta'));
          st = initialState({
            n, eta: num(params, 'eta'), kT: num(params, 'kT'), heavy: num(params, 'heavy'), ratio: num(params, 'ratio'),
            start: raw as StartKind,
          }, rnd);
          const kinds = new Set(Array.from(st.m));
          input = `seeded start: ${raw === 'equal' ? 'every disk at one speed' : 'Maxwell’s distribution'}, ${kinds.size} mass${kinds.size > 1 ? 'es' : ''}`;
        }
        const n = st.x.length;
        gas = new DiskGas(st, d);
        eta = (n * Math.PI * d * d) / 4;
        const masses = Array.from(st.m);
        const [lo, hi] = n ? [Math.min(...masses), Math.max(...masses)] : [1, 1];
        split = hi > lo ? Math.sqrt(lo * hi) : Infinity;
        massFactor = mixFactor(masses);
        E0 = gas.energy();
        kT = n ? E0 / n : 1;
        // the clock: a step is a fixed share of the run, and the run lasts `run` free times of the
        // light disks (the ideal-gas mean free path, or the box when that is shorter, over their
        // mean speed √(πkT/2m)); it only sets how long the run is, never what is measured
        const density = n / Math.max(1e-12, gas.reach ** 2);
        const lam0 = n > 1 ? Math.min(1, 1 / (Math.SQRT2 * density * 2 * d)) : 1;
        const vbar = Math.sqrt((Math.PI * Math.max(kT, 1e-12)) / 2);
        dt = (num(params, 'run') * lam0) / vbar / STEPS;
        steps = 0;
        target = 0;
        blocks = [];
        open = fresh();
        lastImpulse = 0;
        lastPath = 0;
        lastCollisions = 0;
        keTrace = [speciesKE()];
        pacer.start(STEPS);
        rows = measure();
      },
      pace: () => pacer.report(steps >= STEPS, params),
      draw() {
        target = Math.min(STEPS, target + (ctx.thumbnail ? MAX_PER_FRAME : pacer.take(params)));
        // the frame's counted work: at most PAIRS_PER_FRAME pair predictions, N per event
        let events = Math.max(1, Math.floor(PAIRS_PER_FRAME / Math.max(1, gas.n)));
        while (steps < target && events > 0) {
          const until = (steps + 1) * dt;
          events -= gas.advance(until, events);
          if (gas.t >= until) closeStep();
        }
        rows = measure();
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        // the box, and every disk in it, coloured by its mass
        const side = Math.min(H * 0.9, W * 0.55);
        const bx = H * 0.05;
        const by = (H - side) / 2;
        g.strokeStyle = rgba(fg, 0.8);
        g.lineWidth = 1.5;
        g.strokeRect(bx, by, side, side);
        const light = rgba(ramp(pal, 0.45), 0.9);
        const heavy = rgba(ramp(pal, 0.9), 0.95);
        const r = Math.max(1.2, (gas.d / 2) * side);
        for (let i = 0; i < gas.n; i++) {
          g.fillStyle = gas.m[i] > split ? heavy : light;
          g.beginPath();
          g.arc(bx + gas.x[i] * side, by + (1 - gas.y[i]) * side, r, 0, 2 * Math.PI);
          g.fill();
        }
        // the speeds, scaled by each disk's own mass, s = v√(m/kT), and Rayleigh's law s·e^(−s²/2)
        const px = bx + side + W * 0.05;
        const pw = W - px - W * 0.03;
        const top = H * 0.1;
        const ph = H * 0.36;
        const hist = new Float64Array(BINS);
        for (let i = 0; i < gas.n; i++) {
          const s = Math.hypot(gas.vx[i], gas.vy[i]) * Math.sqrt(gas.m[i] / kT);
          const b = Math.floor((s / S_MAX) * BINS);
          if (b >= 0 && b < BINS) hist[b]++;
        }
        const width = S_MAX / BINS;
        const peakLaw = Math.exp(-0.5);
        const scale = Math.max(peakLaw, ...Array.from(hist, (c) => c / (Math.max(1, gas.n) * width)));
        g.fillStyle = rgba(ramp(pal, 0.55), 0.55);
        for (let b = 0; b < BINS; b++) {
          const h = (hist[b] / (Math.max(1, gas.n) * width) / scale) * ph;
          g.fillRect(px + (b / BINS) * pw, top + ph - h, Math.max(1, pw / BINS - 1), h);
        }
        g.strokeStyle = rgba(fg, 0.85);
        g.setLineDash([4, 3]);
        g.beginPath();
        for (let k = 0; k <= 120; k++) {
          const s = (k / 120) * S_MAX;
          const yy = top + ph - ((s * Math.exp(-0.5 * s * s)) / scale) * ph;
          if (k === 0) g.moveTo(px, yy);
          else g.lineTo(px + (s / S_MAX) * pw, yy);
        }
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = rgba(fg, 0.75);
        g.font = '11px monospace';
        g.fillText('speeds s = v√(m/kT), and Rayleigh’s law (dashed)', px, top - 8);
        // each species' mean kinetic energy against time, and kT, where equipartition puts both
        const ty = top + ph + H * 0.14;
        const th = H * 0.3;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
        g.strokeRect(px, ty, pw, th);
        const eMax = Math.max(2 * kT, ...keTrace.flat().filter(Number.isFinite)) * 1.05;
        const yOf = (e: number) => ty + th - (e / eMax) * th;
        g.strokeStyle = rgba(fg, 0.6);
        g.setLineDash([4, 3]);
        g.beginPath();
        g.moveTo(px, yOf(kT));
        g.lineTo(px + pw, yOf(kT));
        g.stroke();
        g.setLineDash([]);
        for (const [which, colour] of [[0, light], [1, heavy]] as const) {
          g.strokeStyle = colour;
          g.beginPath();
          let started = false;
          keTrace.forEach((e, k) => {
            const v = e[which];
            if (!Number.isFinite(v)) return;
            const xx = px + (k / STEPS) * pw;
            if (!started) { g.moveTo(xx, yOf(v)); started = true; } else g.lineTo(xx, yOf(v));
          });
          g.stroke();
        }
        g.fillStyle = rgba(fg, 0.75);
        g.fillText('mean kinetic energy, light and heavy; kT dashed', px, ty - 8);
        g.restore();
        ctx.stats(rows);
      },
    };
  },
};

export default hardDiskGas;
