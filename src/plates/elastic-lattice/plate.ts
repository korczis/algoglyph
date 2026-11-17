// Elastic lattice (src/plates/_shared/elastic): a triangular sheet of equal masses and springs.
// Pulled by grips at its ends it relaxes by conjugate gradients, and its middle narrows by
// Poisson's ratio; on a periodic sheet a plane wave runs at the lattice's own frequency, the
// longitudinal one √3 times the transverse; a kick at the centre sends out both fronts. Each
// measurement is held to what the bond sum and the dynamical matrix say (oracles.ts), computed
// without relaxing or stepping the sheet.
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { Dynamics, lattice, Relaxation, ROW, site, stretch, strainEnergy, stiffness, type Lattice } from '../_shared/elastic/lattice';
import { dispersion, poisson, speeds, young } from '../_shared/elastic/oracles';
import { rgba } from '../_shared/two-slit/draw';

type Mode = 'stretch' | 'waves' | 'pulse';

/** Samples of a time run (the paced unit of the waves and the kick). */
export const SAMPLES = 600;
/** Bond visits a frame may make: the cap that bounds a frame's work at any pace. */
export const WORK_PER_FRAME = 900_000;
/** The relaxation stops once the free residual is this far below its start. */
export const TOLERANCE = 1e-13;
/** A time step turns the fastest mode of the lattice through at most this angle. */
export const TURN_PER_STEP = 0.25;
const MAX_PER_FRAME = 30;
const BINS = 24;
const when = (...values: string[]) => ({ key: 'mode', values });
const fx = (v: number, d = 9) => v.toFixed(d);
const ex = (v: number) => v.toExponential(2);

/** Rows of the periodic sheet of nx columns: even, about 0.6 of its width. */
export const periodicRows = (nx: number): number => 2 * Math.max(2, Math.round((0.3 * nx) / ROW));

export const elasticLattice: PlateCode = {
  id: 'elastic-lattice',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'mode', label: 'Experiment', value: 'stretch', rebuild: true,
      options: [
        { value: 'stretch', label: 'Pull a strip by its ends' },
        { value: 'waves', label: 'Plane waves on a periodic sheet' },
        { value: 'pulse', label: 'A kick at the centre' },
      ],
    },
    {
      kind: 'select', key: 'grips', label: 'The grips', value: 'sliding', rebuild: true, when: when('stretch'),
      options: [
        { value: 'sliding', label: 'slide sideways (the ends narrow freely)' },
        { value: 'clamped', label: 'hold the ends fast' },
      ],
    },
    // a strip from 8 to 80 sites long: below 8 there is no middle to measure; above 80 columns, or
    // 40 rows, a bond is under 4 px at the phone's width and the sheet blurs. A frame's work is capped
    // by WORK_PER_FRAME at any size, so the frame budget does not end these ranges.
    { kind: 'range', key: 'columns', label: 'Strip length (sites)', min: 8, max: 80, step: 1, value: 48, rebuild: true, when: when('stretch') },
    { kind: 'range', key: 'rows', label: 'Strip width (rows)', min: 3, max: 40, step: 1, value: 12, rebuild: true, when: when('stretch') },
    { kind: 'range', key: 'strain', label: 'Pull, as a strain (%)', min: 0.1, max: 5, step: 0.1, value: 1, rebuild: true, when: when('stretch'),
      hint: 'The springs are linear: the pull scales every displacement and force, and leaves the ratios alone. Past 5% the bonds’ turning, which the linear springs leave out, would matter.' },
    // 64 columns is the widest periodic sheet whose bonds stay legible at the phone's width
    { kind: 'range', key: 'size', label: 'Sheet size (columns)', min: 16, max: 64, step: 2, value: 48, rebuild: true, when: when('waves', 'pulse') },
    { kind: 'range', key: 'waves', label: 'Wavelengths across the sheet', min: 1, max: 12, step: 1, value: 1, rebuild: true, when: when('waves'),
      hint: 'One is the longest wave the sheet holds; at twelve on 48 columns, four sites to a wavelength, the lattice’s dispersion shows in the ratio of the speeds. Past half the columns a wave is the same as a longer one.' },
    { kind: 'range', key: 'periods', label: 'Run for this many transverse periods', min: 2, max: 12, step: 1, value: 4, rebuild: true, when: when('waves'),
      hint: 'Two periods give the zeros a frequency needs; past twelve the measured frequencies do not move in their ninth digit.' },
    { kind: 'range', key: 'k', label: 'Spring constant k', min: 0.25, max: 4, step: 0.25, value: 1, rebuild: true,
      hint: 'k scales every frequency by √k and every modulus by k, and no ratio: a factor of 16 shows that, and more would show nothing new.' },
    { kind: 'range', key: 'magnify', label: 'Drawn displacement, exaggerated', min: 1, max: 100, step: 1, value: 20, cosmetic: true,
      hint: 'The strip: 20 draws the true displacement. Waves and the kick: the largest displacement is drawn as a fiftieth of this, in sites.' },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'steps' },
  create(p, ctx) {
    const params = ctx.params;
    let pacer = new Pacer('replay', 'steps', MAX_PER_FRAME);
    let mode: Mode = 'stretch';
    let L: Lattice = lattice(2, 2, 1, true);
    let ux = new Float64Array(0);
    let uy = new Float64Array(0);
    let relax: Relaxation | null = null;
    let dyn: Dynamics | null = null;
    let fixed: Stat[] = [];
    let total = 0;
    let shown = 0;
    let perUnit = 1;
    let h = 0.1;
    let t = 0;
    let k = 1;
    let eps = 0.01;
    // the stretch
    let held = new Uint8Array(0);
    let gripRight: number[] = [];
    // the waves
    let q = 0;
    let cosq = new Float64Array(0);
    let cos2 = 1;
    let E0 = 0;
    let dE = 0;
    let dP = 0;
    let P0: [number, number] = [0, 0];
    let zeros: [number[], number[]] = [[], []];
    let prev: [number, number] = [0, 0];
    let trace: Float64Array[] = [new Float64Array(SAMPLES + 1), new Float64Array(SAMPLES + 1)];
    let amp0 = 1;
    let input = '';

    function amplitudes(): [number, number] {
      let a = 0;
      let b = 0;
      for (let s = 0; s < ux.length; s++) {
        a += ux[s] * cosq[s];
        b += uy[s] * cosq[s];
      }
      return [a / cos2, b / cos2];
    }

    function setup() {
      mode = str(params, 'mode') as Mode;
      k = num(params, 'k');
      shown = 0;
      t = 0;
      relax = null;
      dyn = null;
      dE = 0;
      dP = 0;
      zeros = [[], []];
      if (mode === 'stretch') setStretch();
      else setTime();
      pacer = new Pacer('replay', 'steps', Math.max(1, Math.min(MAX_PER_FRAME, Math.floor(WORK_PER_FRAME / (perUnit * L.bp.length)))));
      pacer.start(total);
    }

    function setStretch() {
      const nx = num(params, 'columns');
      const ny = num(params, 'rows');
      eps = num(params, 'strain') / 100;
      L = lattice(nx, ny, k, false);
      const n = nx * ny;
      held = new Uint8Array(2 * n);
      gripRight = [];
      const clamped = str(params, 'grips') === 'clamped';
      // the grips move their sites by the affine stretch ε·x; sliding grips leave y free
      const start = () => {
        ux = new Float64Array(n);
        uy = new Float64Array(n);
        for (let j = 0; j < ny; j++) {
          for (const i of [0, nx - 1]) {
            const s = site(nx, i, j);
            held[2 * s] = 1;
            ux[s] = eps * L.x[s];
            if (clamped) held[2 * s + 1] = 1;
          }
        }
        // a sliding sheet may still move up and down as a whole: hold one site's y
        held[2 * site(nx, 0, Math.floor(ny / 2)) + 1] = 1;
        return new Relaxation(L, ux, uy, held);
      };
      // a dry run counts the iterations the relaxation needs, so the replay knows its length
      const dry = start();
      const cap = 4 * n;
      while (dry.residual() > TOLERANCE && dry.iterations < cap) dry.iterate();
      total = Math.max(1, dry.iterations);
      for (let j = 0; j < ny; j++) gripRight.push(site(nx, nx - 1, j));
      relax = start();
      perUnit = 2;
      input = `seeded: a strip of ${nx} × ${ny} sites, k = ${k}, pulled by ${num(params, 'strain')}% with ${clamped ? 'clamped' : 'sliding'} grips`;
      fixed = [
        { label: 'Poisson’s ratio λ/(λ + 2μ) of the bond sum', value: fx(poisson(k), 12) },
        { label: 'Young’s modulus 4μ(λ + μ)/(λ + 2μ) of the bond sum', value: fx(young(k), 12) },
      ];
    }

    function setTime() {
      const nx = num(params, 'size');
      const ny = periodicRows(nx);
      L = lattice(nx, ny, k, true);
      const n = nx * ny;
      ux = new Float64Array(n);
      uy = new Float64Array(n);
      const vx = new Float64Array(n);
      const vy = new Float64Array(n);
      const c = speeds(k);
      // the fastest mode of the sheet: ω² ≤ 2k Σ|n|² over six bonds = 12k
      const wMax = Math.sqrt(12 * k);
      let time: number;
      if (mode === 'waves') {
        const nw = num(params, 'waves');
        q = (2 * Math.PI * nw) / nx;
        cosq = new Float64Array(n);
        cos2 = 0;
        for (let s = 0; s < n; s++) {
          cosq[s] = Math.cos(q * L.x[s]);
          cos2 += cosq[s] * cosq[s];
        }
        // both polarisations at once, each an exact normal mode of the lattice along a bond
        for (let s = 0; s < n; s++) {
          ux[s] = cosq[s];
          uy[s] = cosq[s];
        }
        const d = dispersion(k, q);
        time = (num(params, 'periods') * 2 * Math.PI) / d.wT;
        input = `seeded: a periodic sheet of ${nx} × ${ny} sites, k = ${k}, ${nw} wavelength${nw > 1 ? 's' : ''} across, qa = ${q.toFixed(6)}`;
        fixed = [
          { label: 'longitudinal ω of the lattice’s dispersion (rad/s)', value: fx(d.wL, 12) },
          { label: 'transverse ω of the lattice’s dispersion (rad/s)', value: fx(d.wT, 12) },
          { label: 'c_L/c_T = √((λ + 2μ)/μ) of the bond sum', value: fx(c.cL / c.cT, 12) },
          { label: 'ω_L/ω_T of the lattice’s dispersion', value: fx(d.wL / d.wT, 12) },
        ];
        prev = amplitudes();
        amp0 = Math.max(Math.abs(prev[0]), Math.abs(prev[1]), 1e-30);
      } else {
        // a kick along x, a Gaussian of two sites across, at the centre
        const cx = nx / 2;
        const cy = (ny * ROW) / 2;
        for (let s = 0; s < n; s++) vx[s] = Math.exp(-((L.x[s] - cx) ** 2 + (L.y[s] - cy) ** 2) / 8);
        time = (0.45 * Math.min(nx, ny * ROW)) / c.cL;
        input = `seeded: a periodic sheet of ${nx} × ${ny} sites, k = ${k}, kicked along x at its centre`;
        fixed = [
          { label: 'longitudinal speed c_L = √((λ + 2μ)/ρ) of the bond sum (sites/s)', value: fx(c.cL, 12) },
          { label: 'transverse speed c_T = √(μ/ρ) of the bond sum (sites/s)', value: fx(c.cT, 12) },
        ];
      }
      dyn = new Dynamics(L, ux, uy, vx, vy);
      E0 = dyn.energy();
      P0 = dyn.momentum();
      const steps = Math.ceil(time / (TURN_PER_STEP / wMax));
      perUnit = Math.max(1, Math.ceil(steps / SAMPLES));
      total = SAMPLES;
      h = time / (SAMPLES * perUnit);
      trace = [new Float64Array(SAMPLES + 1), new Float64Array(SAMPLES + 1)];
      if (mode === 'waves') {
        trace[0][0] = prev[0] / amp0;
        trace[1][0] = prev[1] / amp0;
      }
    }

    function advance() {
      if (relax) {
        if (relax.residual() > TOLERANCE) relax.iterate();
        return;
      }
      if (!dyn) return;
      for (let i = 0; i < perUnit; i++) {
        dyn.step(h);
        t += h;
        if (mode === 'waves') {
          const a = amplitudes();
          for (let c = 0; c < 2; c++) {
            if ((prev[c] > 0) !== (a[c] > 0)) zeros[c].push(t - h + (h * prev[c]) / (prev[c] - a[c]));
          }
          prev = a;
        }
      }
      const e = dyn.energy();
      dE = Math.max(dE, Math.abs(e - E0) / E0);
      const P = dyn.momentum();
      dP = Math.max(dP, Math.hypot(P[0] - P0[0], P[1] - P0[1]));
      if (mode === 'waves') {
        trace[0][shown + 1] = prev[0] / amp0;
        trace[1][shown + 1] = prev[1] / amp0;
      }
    }

    /** −ε_yy at column i over the strip's width, from its first and last rows. */
    function lateral(i: number): number {
      const b = site(L.nx, i, 0);
      const e = site(L.nx, i, L.ny - 1);
      return -(uy[e] - uy[b]) / (L.y[e] - L.y[b]) / eps;
    }

    function frequency(z: number[]): number | null {
      const n = z.length;
      return n > 1 ? (Math.PI * (n - 1)) / (z[n - 1] - z[0]) : null;
    }

    function stats(): Stat[] {
      const done = shown >= total;
      const late = (v: string) => (done ? v : 'after the run');
      const rows: Stat[] = [pacer.row(params), { label: 'Input', value: input }];
      if (mode === 'stretch' && relax) {
        rows.push(
          { label: 'iterations of conjugate gradients', value: `${relax.iterations} of ${total}` },
          { label: 'free residual, relative to the start', value: ex(relax.residual()) },
          ...fixed,
        );
        if (L.ny < 2) return rows;
        const mid = Math.floor(L.nx / 2);
        // the grips' reaction: K·u at the right grip's sites, along x
        const fxr = new Float64Array(ux.length);
        const fyr = new Float64Array(ux.length);
        stiffness(L, ux, uy, fxr, fyr);
        let F = 0;
        for (const s of gripRight) F += fxr[s];
        let work = 0;
        for (let s = 0; s < ux.length; s++) {
          if (held[2 * s]) work += fxr[s] * ux[s];
          if (held[2 * s + 1]) work += fyr[s] * uy[s];
        }
        const U = strainEnergy(L, ux, uy);
        const span = L.x[gripRight[0]] - L.x[site(L.nx, 0, 0)];
        const height = L.ny * ROW;
        rows.push(
          { label: 'Poisson’s ratio, measured: −ε_yy/ε_xx across the middle column', value: late(fx(lateral(mid), 12)) },
          { label: 'Poisson’s ratio, measured at the column next to a grip', value: late(fx(lateral(1), 12)) },
          { label: 'Young’s modulus, measured: the grip’s pull over the strip’s width and the strain', value: late(fx(F / height / eps, 12)) },
          { label: 'strain energy against half the grips’ work, |U − ½Σf·u|/U, numerics', value: late(ex(Math.abs(U - 0.5 * work) / U)) },
          { label: 'grip separation (sites)', value: fx(span, 3) },
        );
        return rows;
      }
      rows.push({ label: 'simulated time (s)', value: fx(t, 3) }, { label: 'time step h (s)', value: h.toPrecision(6) }, ...fixed,
        { label: 'energy, largest relative change |E − E₀|/E₀, numerics', value: ex(dE) },
        { label: 'momentum, largest change |P − P₀|, numerics', value: ex(dP) });
      if (mode === 'waves') {
        const wL = frequency(zeros[0]);
        const wT = frequency(zeros[1]);
        const none = 'none: fewer than two zeros; run longer';
        rows.push(
          { label: 'longitudinal ω, measured between zeros of the x amplitude (rad/s)', value: late(wL === null ? none : fx(wL, 12)) },
          { label: 'transverse ω, measured between zeros of the y amplitude (rad/s)', value: late(wT === null ? none : fx(wT, 12)) },
          { label: 'c_L/c_T, measured as ω_L/ω_T', value: late(wL === null || wT === null ? none : fx(wL / wT, 12)) },
        );
      }
      return rows;
    }

    function bondColour(): (b: number) => number {
      if (mode === 'stretch') return (b) => 0.5 + 0.5 * Math.max(-1, Math.min(1, stretch(L, b, ux, uy) / eps));
      let top = 1e-30;
      for (let b = 0; b < L.bp.length; b++) top = Math.max(top, Math.abs(stretch(L, b, ux, uy)));
      return (b) => 0.5 + 0.5 * stretch(L, b, ux, uy) / top;
    }

    return {
      setup,
      pace: () => pacer.report(shown >= total, params),
      draw() {
        const take = ctx.thumbnail ? pacer.maxPerFrame : pacer.take(params);
        for (let i = 0; i < take && shown < total; i++) {
          advance();
          shown++;
        }
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        g.font = '11px monospace';
        const side = mode === 'pulse' ? 0 : W * 0.36;
        const sheetW = (mode === 'stretch' ? 1 + eps * Math.max(1, num(params, 'magnify') / 20) : 1) * (L.nx + 0.5);
        const sheetH = L.ny * ROW;
        const sc = Math.min((W - side - W * 0.08) / sheetW, (H * 0.8) / sheetH);
        const ox = W * 0.04;
        const oy = H * 0.5 + (sheetH * sc) / 2;
        let mag = num(params, 'magnify') / 20;
        if (mode !== 'stretch') {
          let top = 1e-30;
          for (let s = 0; s < ux.length; s++) top = Math.max(top, Math.hypot(ux[s], uy[s]));
          mag = num(params, 'magnify') / 50 / top;
        }
        const mx = (s: number) => ox + (L.x[s] + mag * ux[s]) * sc;
        const my = (s: number) => oy - (L.y[s] + mag * uy[s]) * sc;
        const colour = bondColour();
        const paths: Path2D[] = Array.from({ length: BINS }, () => new Path2D());
        for (let b = 0; b < L.bp.length; b++) {
          const a = L.bp[b];
          const c = L.bq[b];
          // a periodic bond that wraps round the sheet is not drawn across it
          if (Math.abs(L.x[c] - L.x[a]) > 1 || Math.abs(L.y[c] - L.y[a]) > 1) continue;
          const bin = Math.max(0, Math.min(BINS - 1, Math.floor(colour(b) * BINS)));
          paths[bin].moveTo(mx(a), my(a));
          paths[bin].lineTo(mx(c), my(c));
        }
        g.lineWidth = Math.max(0.6, Math.min(2, sc * 0.12));
        paths.forEach((path, i) => {
          g.strokeStyle = rgba(ramp(pal, (i + 0.5) / BINS), 1);
          g.stroke(path);
        });
        g.fillStyle = rgba(fg, 0.75);
        if (mode === 'stretch') {
          g.fillStyle = rgba(mix(ctx.bg, fg, 0.5), 1);
          for (let j = 0; j < L.ny; j++) {
            for (const s of [site(L.nx, 0, j), site(L.nx, L.nx - 1, j)]) g.fillRect(mx(s) - 2, my(s) - 2, 4, 4);
          }
          g.fillStyle = rgba(fg, 0.75);
          g.fillText('bonds coloured by stretch over the pull: one end of the palette stretched, the other squeezed', W * 0.03, H * 0.07);
        } else if (mode === 'waves') {
          g.fillText('the largest displacement drawn as a fiftieth of the exaggeration, in sites; bonds coloured by stretch', W * 0.03, H * 0.07);
        } else {
          const c = speeds(k);
          const cx = ox + (L.nx / 2) * sc;
          const cy = oy - (sheetH / 2) * sc;
          g.setLineDash([4, 4]);
          g.strokeStyle = rgba(fg, 0.6);
          for (const v of [c.cL, c.cT]) {
            g.beginPath();
            g.arc(cx, cy, v * t * sc, 0, 2 * Math.PI);
            g.stroke();
          }
          g.setLineDash([]);
          g.fillText('dashed: c_L·t and c_T·t of the bond sum; bonds coloured by stretch', W * 0.03, H * 0.07);
        }
        // the side panel: the strip's narrowing along its length, or the two amplitudes in time
        if (side > 0) {
          const x0 = W - side + W * 0.02;
          const w = side - W * 0.05;
          const y0 = H * 0.14;
          const hh = H * 0.72;
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
          g.strokeRect(x0, y0, w, hh);
          if (mode === 'stretch' && L.ny > 1) {
            const nu = poisson(k);
            const Y = (v: number) => y0 + hh - (Math.max(0, Math.min(1.5 * nu, v)) / (1.5 * nu)) * hh;
            g.setLineDash([4, 4]);
            g.strokeStyle = rgba(fg, 0.5);
            g.beginPath();
            g.moveTo(x0, Y(nu));
            g.lineTo(x0 + w, Y(nu));
            g.stroke();
            g.setLineDash([]);
            g.strokeStyle = rgba(ramp(pal, 0.85), 1);
            g.beginPath();
            for (let i = 0; i < L.nx; i++) {
              const X = x0 + (i / (L.nx - 1)) * w;
              if (i === 0) g.moveTo(X, Y(lateral(i))); else g.lineTo(X, Y(lateral(i)));
            }
            g.stroke();
            g.fillStyle = rgba(fg, 0.75);
            g.fillText('−ε_yy/ε_xx along the strip; dashed: λ/(λ + 2μ)', x0, y0 - 6);
          } else if (mode === 'waves') {
            for (let c = 0; c < 2; c++) {
              const mid = y0 + hh * (0.25 + 0.5 * c);
              g.strokeStyle = rgba(ramp(pal, 0.15 + 0.7 * c), 1);
              g.beginPath();
              for (let i = 0; i <= shown; i++) {
                const X = x0 + (i / SAMPLES) * w;
                const Yv = mid - trace[c][i] * hh * 0.22;
                if (i === 0) g.moveTo(X, Yv); else g.lineTo(X, Yv);
              }
              g.stroke();
              g.fillStyle = rgba(fg, 0.75);
              g.fillText(c === 0 ? 'x amplitude: longitudinal' : 'y amplitude: transverse', x0 + 4, mid - hh * 0.2);
            }
          }
        }
        g.restore();
        ctx.stats(stats());
      },
    };
  },
};

export default elasticLattice;
