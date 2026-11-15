// Bound states in one dimension (src/plates/_shared/quantum/eigen.ts): the levels and states of a box,
// a finite well, a double well, the harmonic oscillator and the hydrogen atom's radial equation, by
// an exact eigensolver of the finite-difference Hamiltonian, against the closed forms; the lowest two
// states' superposition evolved by its exact phases; and, in the double well, the same superposition
// evolved by the split-step solver of #/p/quantum-tunnelling (src/plates/_shared/quantum/schrodinger.ts),
// tunnelling from side to side in the time the splitting sets. A reader's V(x) replaces the preset.
import { optionId } from '../../core/data';
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { eigenvalues, eigenvector, finiteWellLevels, grid, nodes } from '../_shared/quantum/eigen';
import { Wave, type Potential } from '../_shared/quantum/schrodinger';
import { rgba } from '../_shared/two-slit/draw';

/** Time steps of a run; the superposition is drawn at each. */
export const STEPS = 600;
export const MAX_PER_FRAME = 8;
/** Grid points of the eigensolver, and of the split-step grid (a power of two) in the double well. */
const POINTS = 1200;
const WAVE_N = 512;
const WAVE_DX = 0.05;
/** The split-step solver's time step stays below this, taking up to MAX_SUB steps per step of the run. */
const DT_WAVE = 0.01;
const MAX_SUB = 48;
/** The double well: two wells of half-width W centred at ±C, depth V0 around them. */
const W = 0.8;
const C = 1.4;

type Preset = 'box' | 'finite' | 'double' | 'harmonic' | 'hydrogen';
const f6 = (v: number) => v.toFixed(6);
const list = (xs: number[], d = 6) => xs.map((v) => v.toFixed(d)).join(', ');

/** The double well as a piecewise-constant potential on the split-step grid (x = 0 a grid point). */
export function doubleWell(v0: number, barrier: number): Potential {
  return { edges: [-C - W, -C + W, C - W, C + W], values: [v0, 0, barrier, 0, v0] };
}

export const boundStates: PlateCode = {
  id: 'bound-states',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'potential', label: 'Potential', value: 'double', rebuild: true,
      options: [
        { value: 'double', label: 'A double well (tunnelling)' },
        { value: 'box', label: 'A box with hard walls' },
        { value: 'finite', label: 'A finite square well' },
        { value: 'harmonic', label: 'The harmonic oscillator' },
        { value: 'hydrogen', label: 'Hydrogen, the radial equation' },
      ],
    },
    { kind: 'range', key: 'levels', label: 'Levels shown', min: 2, max: 8, step: 1, value: 4, rebuild: true },
    // the depth and the barrier stop where the tunnelling time outgrows what the split-step solver
    // can follow at its step in one run (the splitting falls exponentially with the barrier)
    { kind: 'range', key: 'v0', label: 'Well depth V₀', min: 4, max: 16, step: 1, value: 10, rebuild: true, when: { key: 'potential', values: ['finite', 'double'] } },
    { kind: 'range', key: 'barrier', label: 'Barrier between the wells', min: 1, max: 6, step: 0.5, value: 4, rebuild: true, when: { key: 'potential', values: ['double'] } },
    { kind: 'range', key: 'l', label: 'Angular momentum ℓ', min: 0, max: 3, step: 1, value: 0, rebuild: true, when: { key: 'potential', values: ['hydrogen'] } },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'time steps' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'time steps', MAX_PER_FRAME);
    let preset: Preset | 'data' = 'double';
    let x: Float64Array = new Float64Array(0);
    let V: Float64Array = new Float64Array(0);
    let h = 1;
    let E: number[] = [];
    let states: Float64Array[] = [];
    let fixed: Stat[] = [];
    let steps = 0;
    let span = 1;
    let wave: Wave | null = null;
    let sub = 1;
    /** The unwrapped relative phase of ⟨φ₁|ψ⟩ and ⟨φ₀|ψ⟩ of the split-step state, at each step. */
    let phases: number[] = [];
    let tunnelRow: Stat | null = null;
    let rows: Stat[] = [];
    let input = '';

    /** The potential on the eigensolver's grid, by preset. */
    function build(): boolean {
      const raw = str(params, 'potential');
      wave = null;
      if (optionId(raw)) {
        preset = 'data';
        const table = ctx.data?.(optionId(raw) ?? '') ?? null;
        if (!table) { input = 'your data: none attached; attach a table of x, v'; return false; }
        const order = Array.from({ length: table.rows }, (_, i) => i).sort((i, j) => table.values[0][i] - table.values[0][j]);
        const xs = order.map((i) => table.values[0][i]);
        const vs = order.map((i) => table.values[1][i]);
        if (xs[xs.length - 1] - xs[0] <= 0) { input = 'your data: every x is the same'; return false; }
        ({ x, h } = grid(xs[0], xs[xs.length - 1], POINTS));
        let j = 0;
        V = Float64Array.from(x, (s) => {
          while (j + 1 < xs.length - 1 && xs[j + 1] < s) j++;
          const t = (s - xs[j]) / Math.max(1e-300, xs[j + 1] - xs[j]);
          return vs[j] + Math.min(1, Math.max(0, t)) * (vs[j + 1] - vs[j]);
        });
        input = `your data, V(x) through ${table.rows} points, ψ = 0 at both ends`;
        return true;
      }
      preset = raw as Preset;
      const v0 = num(params, 'v0');
      input = `seeded: ${raw}`;
      if (preset === 'box') { ({ x, h } = grid(-1, 1, POINTS)); V = new Float64Array(POINTS); }
      if (preset === 'finite') { ({ x, h } = grid(-5, 5, POINTS)); V = Float64Array.from(x, (s) => (Math.abs(s) < 1 ? 0 : v0)); }
      if (preset === 'harmonic') { ({ x, h } = grid(-10, 10, POINTS)); V = Float64Array.from(x, (s) => 0.5 * s * s); }
      if (preset === 'hydrogen') {
        const l = num(params, 'l');
        // the box reaches three times the outermost level's 2n² radius
        ({ x, h } = grid(0, Math.max(60, 6 * (num(params, 'levels') + l) ** 2), 4 * POINTS));
        V = Float64Array.from(x, (r) => (l * (l + 1)) / (2 * r * r) - 1 / r);
      }
      if (preset === 'double') {
        // the eigensolver on the split-step grid's own points, so both see one potential
        const pot = doubleWell(v0, num(params, 'barrier'));
        wave = new Wave({ n: WAVE_N, dx: WAVE_DX, dt: 0.01, absorb: 0 }, pot);
        x = Float64Array.from(wave.x);
        h = WAVE_DX;
        V = Float64Array.from(wave.v);
      }
      return true;
    }

    function analyse(): Stat[] {
      const n = num(params, 'levels');
      E = eigenvalues(V, h, n);
      states = E.map((e) => eigenvector(V, h, e));
      const out: Stat[] = [
        { label: 'lowest levels, exact eigenvalues of the grid’s Hamiltonian', value: list(E) },
        { label: 'nodes of each state (numerics: Sturm’s n − 1)', value: states.map(nodes).join(', ') },
      ];
      const L = x[x.length - 1] - x[0] + 2 * h;
      if (preset === 'box') {
        out.push(
          { label: 'closed form n²π²/2L²', value: list(E.map((_, k) => ((k + 1) ** 2 * Math.PI ** 2) / (2 * L * L))) },
          { label: 'the grid’s own (1 − cos kπ/(N + 1))/h² (numerics)', value: list(E.map((_, k) => (1 - Math.cos(((k + 1) * Math.PI) / (x.length + 1))) / (h * h))) },
        );
      } else if (preset === 'harmonic') {
        out.push({ label: 'closed form n + ½', value: list(E.map((_, k) => k + 0.5)) });
        // the ground state's ΔxΔp, from the state itself: ⟨x²⟩ and ⟨p²⟩ = ∫ψ′² dx
        const g = states[0];
        let x2 = 0; let p2 = 0;
        for (let i = 0; i < g.length; i++) {
          x2 += x[i] * x[i] * g[i] * g[i] * h;
          const d = ((g[i + 1] ?? 0) - g[i]) / h;
          p2 += d * d * h;
        }
        out.push({ label: 'ground state ΔxΔp, from the state', value: f6(Math.sqrt(x2 * p2)) });
      } else if (preset === 'hydrogen') {
        const l = num(params, 'l');
        out.push({ label: 'closed form −1/2n², n = n_r + ℓ + 1', value: list(E.map((_, k) => -1 / (2 * (k + l + 1) ** 2))) });
      } else if (preset === 'finite') {
        const roots = finiteWellLevels(num(params, 'v0'), 1).slice(0, E.length);
        out.push({ label: 'matching conditions k tan ka = κ, −k cot ka = κ, by bisection', value: list(roots) });
      } else if (preset === 'double') {
        const dE = E[1] - E[0];
        out.push(
          { label: 'splitting E₁ − E₀', value: f6(dE) },
          { label: 'half-period of the tunnelling, π/(E₁ − E₀)', value: f6(Math.PI / dE) },
        );
      }
      return out;
    }

    /** |ψ(t)|² of (ψ₀ + ψ₁)/√2 at time t, by the exact phases e^(−iEt). */
    function density(t: number): Float64Array {
      const out = new Float64Array(x.length);
      if (states.length < 2) return out;
      const ph = (E[1] - E[0]) * t;
      for (let i = 0; i < x.length; i++) {
        const a = states[0][i];
        const b = states[1][i];
        out[i] = 0.5 * (a * a + b * b + 2 * a * b * Math.cos(ph));
      }
      return out;
    }

    function measure(): Stat[] {
      const t = (steps / STEPS) * span;
      return [pacer.row(params), { label: 'Input', value: input }, { label: 'time', value: `${steps} of ${STEPS} steps, t = ${t.toFixed(3)}` },
        ...fixed, ...(tunnelRow ? [tunnelRow] : [])];
    }

    /** The split-step state's relative phase arg(⟨φ₁|ψ⟩/⟨φ₀|ψ⟩), unwrapped onto the last one. */
    function relativePhase(): number {
      let r0 = 0; let i0 = 0; let r1 = 0; let i1 = 0;
      for (let i = 0; i < WAVE_N; i++) {
        r0 += states[0][i] * wave!.re[i]; i0 += states[0][i] * wave!.im[i];
        r1 += states[1][i] * wave!.re[i]; i1 += states[1][i] * wave!.im[i];
      }
      // c₁ c₀* has the phase −(E₁ − E₀)t when φ₀ and φ₁ are the evolution's own states
      let ph = Math.atan2(i1 * r0 - r1 * i0, r1 * r0 + i1 * i0);
      const last = phases.length ? phases[phases.length - 1] : 0;
      while (ph - last > Math.PI) ph -= 2 * Math.PI;
      while (ph - last < -Math.PI) ph += 2 * Math.PI;
      return ph;
    }

    /** The splitting the split-step solver shows: minus the least-squares slope of the phase in time. */
    function measuredSplitting(): number {
      const dtStep = span / STEPS;
      const n = phases.length;
      let st = 0; let sp = 0; let stt = 0; let stp = 0;
      phases.forEach((ph, k) => { const t = k * dtStep; st += t; sp += ph; stt += t * t; stp += t * ph; });
      return -(n * stp - st * sp) / (n * stt - st * st);
    }

    return {
      setup() {
        steps = 0;
        phases = [];
        tunnelRow = null;
        fixed = [];
        E = [];
        states = [];
        if (build()) fixed = analyse();
        // the run lasts one tunnelling period in the double well, else one period of the lowest two
        span = E.length > 1 ? (2 * Math.PI) / (E[1] - E[0]) : 1;
        if (wave && states.length > 1) {
          // the split-step solver starts from the same superposition, on its own grid
          sub = Math.min(MAX_SUB, Math.ceil(span / STEPS / DT_WAVE));
          const dtWave = span / STEPS / sub;
          wave = new Wave({ n: WAVE_N, dx: WAVE_DX, dt: dtWave, absorb: 0 }, doubleWell(num(params, 'v0'), num(params, 'barrier')));
          for (let i = 0; i < WAVE_N; i++) { wave.re[i] = Math.SQRT1_2 * (states[0][i] + states[1][i]); wave.im[i] = 0; }
          phases = [relativePhase()];
        }
        pacer.start(STEPS);
        rows = measure();
      },
      pace: () => pacer.report(steps >= STEPS, params),
      draw() {
        const take = ctx.thumbnail ? MAX_PER_FRAME : pacer.take(params);
        for (let k = 0; k < take && steps < STEPS; k++) {
          steps++;
          if (wave && states.length > 1) {
            wave.step(sub);
            phases.push(relativePhase());
            if (steps === STEPS) tunnelRow = { label: 'splitting by the split-step solver, from the phase of ⟨φ₁|ψ⟩ against ⟨φ₀|ψ⟩', value: f6(measuredSplitting()) };
          }
        }
        rows = measure();
        const Wd = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        g.font = '11px monospace';
        if (E.length) {
          // the view: x across, energy up, from below the lowest level to above the highest
          const isH = preset === 'hydrogen';
          const xs = isH ? [0, 40 * (E.length + num(params, 'l'))] : preset === 'double' ? [-4, 4] : preset === 'harmonic' ? [-5, 5] : [x[0] - h, x[x.length - 1] + h];
          const eLo = Math.min(E[0], 0) - 0.15 * (E[E.length - 1] - E[0] + 1e-9);
          const eHi = E[E.length - 1] + 0.35 * (E[E.length - 1] - E[0] + 1e-9);
          const X = (s: number) => Wd * 0.05 + ((s - xs[0]) / (xs[1] - xs[0])) * Wd * 0.9;
          const Y = (e: number) => H * 0.92 - ((e - eLo) / (eHi - eLo)) * H * 0.82;
          const scale = (0.6 * (eHi - eLo)) / (E.length + 1);
          g.strokeStyle = rgba(fg, 0.8);
          g.lineWidth = 1.5;
          g.beginPath();
          let started = false;
          for (let i = 0; i < x.length; i++) {
            if (x[i] < xs[0] || x[i] > xs[1]) continue;
            const yy = Y(Math.min(eHi, Math.max(eLo, V[i])));
            if (!started) { g.moveTo(X(x[i]), yy); started = true; } else g.lineTo(X(x[i]), yy);
          }
          g.stroke();
          states.forEach((s, k) => {
            g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
            g.setLineDash([2, 3]);
            g.beginPath(); g.moveTo(X(xs[0]), Y(E[k])); g.lineTo(X(xs[1]), Y(E[k])); g.stroke();
            g.setLineDash([]);
            let peak = 1e-300;
            for (let i = 0; i < s.length; i++) peak = Math.max(peak, Math.abs(s[i]));
            g.strokeStyle = rgba(ramp(pal, E.length > 1 ? k / (E.length - 1) : 0.5), 1);
            g.beginPath();
            let st = false;
            for (let i = 0; i < s.length; i += Math.max(1, Math.floor(s.length / 600))) {
              if (x[i] < xs[0] || x[i] > xs[1]) continue;
              const yy = Y(E[k] + (s[i] / peak) * scale);
              if (!st) { g.moveTo(X(x[i]), yy); st = true; } else g.lineTo(X(x[i]), yy);
            }
            g.stroke();
          });
          // the superposition's density now, by exact phases (filled), and by the split-step (dashed)
          const t = (steps / STEPS) * span;
          const rho = density(t);
          let rmax = 1e-300;
          for (let i = 0; i < rho.length; i++) rmax = Math.max(rmax, rho[i]);
          const base = Y(eLo) - 2;
          g.fillStyle = rgba(ramp(pal, 0.85), 0.35);
          g.beginPath();
          g.moveTo(X(xs[0]), base);
          for (let i = 0; i < x.length; i += Math.max(1, Math.floor(x.length / 600))) {
            if (x[i] < xs[0] || x[i] > xs[1]) continue;
            g.lineTo(X(x[i]), base - (rho[i] / rmax) * H * 0.18);
          }
          g.lineTo(X(xs[1]), base);
          g.fill();
          if (wave) {
            g.strokeStyle = rgba(fg, 0.9);
            g.setLineDash([4, 3]);
            g.beginPath();
            let st = false;
            for (let i = 0; i < WAVE_N; i += 2) {
              if (wave.x[i] < xs[0] || wave.x[i] > xs[1]) continue;
              const d = wave.re[i] ** 2 + wave.im[i] ** 2;
              const yy = base - (d / rmax) * H * 0.18;
              if (!st) { g.moveTo(X(wave.x[i]), yy); st = true; } else g.lineTo(X(wave.x[i]), yy);
            }
            g.stroke();
            g.setLineDash([]);
          }
          g.fillStyle = rgba(fg, 0.75);
          g.fillText(wave ? 'V(x), the levels and states; the lowest two superposed: exact phases (filled), split-step (dashed)'
            : 'V(x), the levels and states; the lowest two superposed, by their exact phases', Wd * 0.05, 16);
        }
        g.restore();
        ctx.stats(rows);
      },
    };
  },
};

export default boundStates;
