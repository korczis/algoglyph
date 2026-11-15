import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { rgba } from '../_shared/two-slit/draw';
import { cw, pulse, vacuum, Yee, type Cells } from '../_shared/em/yee1d';
import { index, lorentz, type Resonance } from '../_shared/lumped/medium';

type Mode = 'dielectric' | 'conductor' | 'medium';

/** Changes a run is replayed in: each is an equal share of its time steps. */
export const CHANGES = 600;
/** Cell updates a frame at most: the pace control's top asks no more. */
export const WORK_PER_FRAME = 600_000;
/** The bound electrons of the medium experiment, in units where a cell is one length (c = 1). */
export const RESONANCE: Resonance = { w0: 0.3, f: 1, gamma: 0.01 };
export const WP2 = 0.05;
const when = (...values: Mode[]) => ({ key: 'mode', values });
const fx = (x: number, d = 6) => (Number.isFinite(x) ? x.toFixed(d) : 'not measured');

/** One experiment's grids and how it is measured as it runs and when it ends. */
interface Experiment {
  grids: Yee[];
  steps: number;
  /** Called after every step of every grid. */
  each(): void;
  rows(): Stat[];
  /** Shaded cells (the material) for the picture. */
  material: [number, number];
}

/** A dielectric slab from a = 15λ to b = 25λ; a pulse of carrier λ; probes before and after. */
function dielectric(lam: number, eps: number): Experiment {
  const w = (2 * Math.PI) / lam;
  const n = Math.round(35 * lam);
  const [a, b, pl, pr, src] = [15, 25, 10, 30, 5].map((k) => Math.round(k * lam));
  const slab: Cells = vacuum(n);
  for (let i = a; i < b; i++) slab.eps[i] = eps;
  const width = 1.5 * lam;
  const drive = pulse(w, width, 4 * width);
  const ref = new Yee(vacuum(n), 1, src, drive);
  const run = new Yee(slab, 1, src, drive);
  const ni = Math.sqrt(eps);
  // the front face's echo reaches the left probe at 4·width + (pl − src) + 2(a − pl); the back face's 2n(b − a) later
  const split = 4 * width + (pl - src) + 2 * (a - pl) + ni * (b - a);
  let inc = 0;
  let front = 0;
  let back = 0;
  let trans = 0;
  return {
    grids: [ref, run], material: [a, b],
    steps: Math.ceil(4 * width + 2 * n + 6 * ni * (b - a)),
    each() {
      const hr = 0.5 * (ref.H[pl] + ref.H[pl - 1]);
      inc += -ref.E[pl] * hr;
      // the field the slab scatters back is the run less the reference, at the left probe
      const e = run.E[pl] - ref.E[pl];
      const h = 0.5 * (run.H[pl] + run.H[pl - 1]) - hr;
      if (run.t < split) front += e * h; else back += e * h;
      trans += -run.E[pr] * 0.5 * (run.H[pr] + run.H[pr - 1]);
    },
    rows: () => [
      { label: 'reflectance of the front face, its echo’s energy over the pulse’s', value: fx(front / inc) },
      { label: 'reflectance ((n − 1)/(n + 1))² at normal incidence, n = √ε', value: fx(((ni - 1) / (ni + 1)) ** 2) },
      { label: 'reflected in all, the slab’s every echo', value: fx((front + back) / inc) },
      { label: 'transmitted through the slab', value: fx(trans / inc) },
      { label: 'reflected plus transmitted (energy conserved)', value: fx((front + back + trans) / inc, 9) },
    ],
  };
}

/** A conductor filling the right half; a wave of carrier λ switched on smoothly; its decay measured. */
function conductor(lam: number, sigma: number): Experiment {
  const w = (2 * Math.PI) / lam;
  const n = Math.round(14 * lam);
  const a = Math.round(7 * lam);
  const c = vacuum(n);
  for (let i = a; i < n; i++) c.sigma[i] = sigma;
  const run = new Yee(c, 1, Math.round(1.5 * lam), cw(w, 2 * lam));
  const settle = Math.ceil(12 * lam);
  const lock = Math.round(4 * lam);
  const span = Math.max(4, Math.round(Math.min(lam, 3 / Math.max(1e-6, decayRate(w, sigma)))));
  const cs = new Float64Array(span + 1);
  const sn = new Float64Array(span + 1);
  return {
    grids: [run], material: [a, n], steps: settle + lock,
    each() {
      if (run.steps <= settle) return;
      for (let k = 0; k <= span; k++) {
        cs[k] += run.E[a + 4 + k] * Math.cos(w * run.t);
        sn[k] += run.E[a + 4 + k] * Math.sin(w * run.t);
      }
    },
    rows: () => {
      const alpha = Math.log(Math.hypot(cs[0], sn[0]) / Math.hypot(cs[span], sn[span])) / span;
      return [
        { label: 'decay rate of the amplitude inside, measured over the first cells (per cell)', value: fx(alpha, 7) },
        { label: 'decay rate Im k = ω√(½(√(1 + (σ/ω)²) − 1)), the continuum', value: fx(decayRate(w, sigma), 7) },
        { label: 'skin depth 1/α, measured (cells)', value: fx(1 / alpha, 3) },
        { label: 'good-conductor skin depth √(2/σω) (cells)', value: fx(Math.sqrt(2 / (sigma * w)), 3) },
      ];
    },
  };
}

const decayRate = (w: number, sigma: number) => w * Math.sqrt(0.5 * (Math.sqrt(1 + (sigma / w) ** 2) - 1));

/** A medium of bound electrons from the middle on, its far part made lossy so nothing returns; a wave at ω. */
function medium(w: number): Experiment {
  const lam = (2 * Math.PI) / w;
  const n = Math.max(1400, Math.round(30 * lam));
  const a = Math.round(n / 3);
  const c = vacuum(n);
  // the electrons' damping rises smoothly over the last third, so the wave dies before it can come back
  const tail = Math.round((2 * n) / 3);
  for (let i = a; i < n; i++) {
    c.lorentz[i] = i < tail ? RESONANCE : { ...RESONANCE, gamma: RESONANCE.gamma + 0.5 * ((i - tail) / (n - tail)) ** 2 };
  }
  c.wp2 = WP2;
  const S = 0.5;
  const run = new Yee(c, S, Math.round(a / 2), cw(w, 3 * lam));
  const settle = Math.ceil((n / S) * 1.2);
  const lock = Math.round((8 * lam) / S);
  const [p0, p1] = [a + Math.round(lam), a + Math.round(3 * lam)];
  const cs = new Float64Array(p1 - p0 + 1);
  const sn = new Float64Array(p1 - p0 + 1);
  return {
    grids: [run], material: [a, n], steps: settle + lock,
    each() {
      if (run.steps <= settle) return;
      for (let k = p0; k <= p1; k++) {
        cs[k - p0] += run.E[k] * Math.cos(w * run.t);
        sn[k - p0] += run.E[k] * Math.sin(w * run.t);
      }
    },
    rows: () => {
      let ph = 0;
      for (let k = 0; k < p1 - p0; k++) {
        let d = Math.atan2(sn[k], cs[k]) - Math.atan2(sn[k + 1], cs[k + 1]);
        while (d < -Math.PI) d += 2 * Math.PI;
        while (d > Math.PI) d -= 2 * Math.PI;
        ph += d;
      }
      const model = index(lorentz({ wp2: WP2, resonances: [RESONANCE], dense: false }, w));
      return [
        { label: 'index inside, measured from the phase across two wavelengths', value: fx(Math.abs(ph) / (p1 - p0) / w, 5) },
        { label: 'index n = Re √(1 + χ) of the bound-electron model', value: fx(model.re, 5) },
        { label: 'phase velocity c/n, measured', value: fx(((p1 - p0) * w) / Math.abs(ph), 5) },
      ];
    },
  };
}

export const maxwell1d: PlateCode = {
  id: 'maxwell-1d',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'mode', label: 'Experiment', value: 'dielectric', rebuild: true,
      options: [
        { value: 'dielectric', label: 'A pulse meets a slab of glass' },
        { value: 'conductor', label: 'A wave enters a conductor: the skin depth' },
        { value: 'medium', label: 'A wave in a medium of bound electrons' },
      ],
    },
    { kind: 'range', key: 'eps', label: 'Slab’s permittivity ε', min: 1, max: 16, step: 0.25, value: 4, rebuild: true,
      when: when('dielectric') },
    { kind: 'range', key: 'sigma', label: 'Conductivity σ (per unit time)', min: 0.005, max: 1, step: 0.005, value: 0.05,
      rebuild: true, when: when('conductor') },
    { kind: 'range', key: 'cells', label: 'Cells per vacuum wavelength', min: 20, max: 160, step: 10, value: 80, rebuild: true,
      when: when('dielectric', 'conductor') },
    { kind: 'range', key: 'w', label: 'Frequency ω (the resonance is at 0.3)', min: 0.05, max: 1, step: 0.01, value: 0.45,
      rebuild: true, when: when('medium') },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'views' },
  create(p, ctx) {
    const params = ctx.params;
    let pacer = new Pacer('replay', 'views', 1);
    let ex: Experiment;
    let per = 1;
    let done = 0;
    let rows: Stat[] = [];
    let mode: Mode = 'dielectric';

    function setup() {
      mode = str(params, 'mode') as Mode;
      const lam = num(params, 'cells');
      ex = mode === 'dielectric' ? dielectric(lam, num(params, 'eps')) : mode === 'conductor' ? conductor(lam, num(params, 'sigma')) : medium(num(params, 'w'));
      per = Math.ceil(ex.steps / CHANGES);
      const cost = per * ex.grids.reduce((s, g) => s + g.cells.n, 0);
      pacer = new Pacer('replay', 'views', Math.max(1, Math.floor(WORK_PER_FRAME / cost)));
      pacer.start(CHANGES);
      done = 0;
      rows = [{ label: 'time steps', value: `0 of ${per * CHANGES}` }];
      if (ctx.thumbnail) advance(CHANGES / 4);
    }

    function advance(k: number) {
      for (let c = 0; c < k && done < CHANGES; c++, done++) {
        for (let s = 0; s < per; s++) {
          for (const g of ex.grids) g.step();
          ex.each();
        }
      }
      const g = ex.grids[ex.grids.length - 1];
      rows = [
        { label: 'time steps', value: `${g.steps} of ${per * CHANGES}, Courant number ${g.S}` },
        { label: 'grid', value: `${g.cells.n} cells` },
        ...(done >= CHANGES ? ex.rows() : []),
      ];
    }

    return {
      setup,
      pace: () => pacer.report(done >= CHANGES, params),
      draw() {
        const take = ctx.thumbnail ? 0 : pacer.take(params);
        if (take > 0) advance(take);
        render();
        ctx.stats([pacer.row(params), ...rows]);
      },
    };

    function render() {
      const W = ctx.width;
      const H = ctx.height;
      const g = p.drawingContext as CanvasRenderingContext2D;
      const pal = ctx.palette();
      p.background(...ctx.bg);
      g.save();
      const grid = ex.grids[ex.grids.length - 1];
      const n = grid.cells.n;
      const X = (i: number) => (i / (n - 1)) * W;
      const [a, b] = ex.material;
      g.fillStyle = rgba(ramp(pal, 0.5), 0.12);
      g.fillRect(X(a), 0, X(b) - X(a), H);
      let peak = 1e-12;
      for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(grid.E[i]), Math.abs(grid.H[i]));
      const lines: [Float64Array, number, number[]][] = [[grid.E, 0.85, []], [grid.H, 0.3, [4, 3]]];
      for (const [f, t, dash] of lines) {
        g.strokeStyle = rgba(ramp(pal, t), 1);
        g.setLineDash(dash);
        g.lineWidth = 1.4;
        g.beginPath();
        const stride = Math.max(1, Math.floor(n / W));
        for (let i = 0; i < n; i += stride) {
          const y = H / 2 - (f[i] / peak) * H * 0.4;
          if (i === 0) g.moveTo(X(i), y); else g.lineTo(X(i), y);
        }
        g.stroke();
      }
      g.setLineDash([]);
      g.strokeStyle = rgba(mix(ctx.bg, ctx.fg, 0.3), 1);
      g.beginPath();
      g.moveTo(0, H / 2);
      g.lineTo(W, H / 2);
      g.stroke();
      g.fillStyle = rgba(ctx.fg, 0.75);
      g.font = '11px monospace';
      g.fillText('E (solid) and H (dashed) along the line; the shaded cells are the material', 12, 18);
      g.restore();
    }
  },
};

export default maxwell1d;
