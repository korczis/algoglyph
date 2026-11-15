import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import {
  CrankNicolsonChain, chainMode, chainSpectrum, moments, packet, type Wave,
} from '../_shared/quantum/tight-binding';
import { rgba } from '../_shared/two-slit/draw';

type Experiment = 'band' | 'packet' | 'defect';

export const SAMPLES = 600;
/** Site-steps (sites × Crank–Nicolson steps) a frame may take: the per-frame cap of a packet run. */
export const SITE_STEPS_PER_FRAME = 240000;
export const MAX_PER_FRAME = 30;
const A = 1;
/** The packet's chain: long enough that the packet never reaches an end in its run. */
const CHAIN = 600;
const START = 150;
const IMPURITY = 300;
const TRAVEL = 240;
const DT = 0.02;
const when = (...values: Experiment[]) => ({ key: 'experiment', values });

/** The transmission of a single-site impurity, |t(k)|² = 1/(1 + (ε/2A sin k)²), averaged over the
 * packet's wavenumbers, distributed as exp(−2σ²(k − k₀)²), by Simpson's rule over ±8 of their spreads. */
export function packetTransmission(eps: number, k0: number, sigma: number): number {
  const sd = 1 / (2 * sigma);
  const M = 2000;
  const lo = k0 - 8 * sd;
  const hi = k0 + 8 * sd;
  const h = (hi - lo) / M;
  let num0 = 0;
  let den = 0;
  for (let i = 0; i <= M; i++) {
    const k = lo + i * h;
    const w = (i === 0 || i === M ? 1 : i % 2 ? 4 : 2) * Math.exp(-2 * sigma * sigma * (k - k0) ** 2);
    const s = 2 * A * Math.sin(k);
    num0 += w * (s * s) / (s * s + eps * eps);
    den += w;
  }
  return num0 / den;
}

export const tightBindingChain: PlateCode = {
  id: 'tight-binding-chain',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'experiment', label: 'Experiment', value: 'band', rebuild: true,
      options: [
        { value: 'band', label: 'The energies of a chain (the band)' },
        { value: 'packet', label: 'A wave packet moving along it' },
        { value: 'defect', label: 'A packet meeting an impurity' },
      ],
    },
    { kind: 'range', key: 'sites', label: 'Sites in the chain', min: 4, max: 800, step: 1, value: 60, rebuild: true,
      when: when('band'), hint: 'The spectrum is found by bisection, a cost that grows as the square of the sites; 800 is what a rebuild affords.' },
    { kind: 'range', key: 'impurity', label: 'Impurity energy ε at the middle site (units of A)', min: -3, max: 3,
      step: 0.1, value: 1, rebuild: true, when: when('band', 'defect') },
    { kind: 'range', key: 'k0', label: 'Packet wavenumber k₀ (units of π/b)', min: 0.05, max: 0.95, step: 0.05,
      value: 0.5, rebuild: true, when: when('packet', 'defect') },
    { kind: 'range', key: 'sigma', label: 'Packet width σ (sites)', min: 5, max: 40, step: 1, value: 15, rebuild: true,
      when: when('packet', 'defect'), hint: 'Up to 40 sites, so that the packet stays a fifth of the chain wide.' },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'samples' },
  create(p, ctx) {
    const params = ctx.params;
    let pacer = new Pacer('replay', 'samples', MAX_PER_FRAME);
    let experiment: Experiment = 'band';
    let total = 1;
    let shown = 0;
    let fixed: Stat[] = [];
    // band
    let energies: number[] = [];
    let mode: Float64Array = new Float64Array(0);
    let N = 0;
    // packet
    let wave: Wave = { re: new Float64Array(0), im: new Float64Array(0) };
    let cn: CrankNicolsonChain;
    let steps = 1;
    let means: number[] = [];
    let normDrift = 0;
    let k0 = 0.5;
    let sigma = 15;
    let eps = 0;
    let vg = 1;

    function setup() {
      experiment = str(params, 'experiment') as Experiment;
      eps = num(params, 'impurity');
      shown = 0;
      if (experiment === 'band') {
        N = Math.round(num(params, 'sites'));
        const site = new Float64Array(N);
        site[Math.floor(N / 2)] = eps;
        energies = chainSpectrum(site, A);
        // the mode drawn: the bound state of the impurity when it has one, else the lowest
        const bound = eps > 0 ? energies[N - 1] : energies[0];
        mode = chainMode(site, A, bound);
        let gap = 0;
        energies.forEach((e, n) => { gap = Math.max(gap, Math.abs(e - -2 * A * Math.cos(((n + 1) * Math.PI) / (N + 1)))); });
        fixed = [{ label: 'energies of the chain', value: `${N}, from ${energies[0].toFixed(9)} to ${energies[N - 1].toFixed(9)}` }];
        if (eps === 0) fixed.push({ label: 'largest |Eₙ − (−2A cos(nπ/(N + 1)))|, the cosine band', value: gap.toExponential(2) });
        else {
          // the impurity's bound state lies outside the band at sign(ε)√(ε² + 4A²), decaying as e^(−κ|n|)
          const c = Math.floor(N / 2);
          const kappa = Math.log(Math.abs(mode[c] / mode[c + 4])) / 4;
          fixed.push(
            { label: 'energy of the state outside the band, measured', value: bound.toFixed(12) },
            { label: 'bound state of one impurity, sign(ε)√(ε² + 4A²)', value: (Math.sign(eps) * Math.sqrt(eps * eps + 4 * A * A)).toFixed(12) },
            { label: 'decay of the bound state κ, from its amplitudes', value: kappa.toFixed(9) },
            { label: 'decay, closed form asinh(|ε|/2A)', value: Math.asinh(Math.abs(eps) / (2 * A)).toFixed(9) },
          );
        }
        total = N;
        pacer = new Pacer('replay', 'modes', MAX_PER_FRAME);
      } else {
        k0 = num(params, 'k0') * Math.PI;
        sigma = num(params, 'sigma');
        vg = 2 * A * Math.sin(k0);
        const site = new Float64Array(CHAIN);
        if (experiment === 'defect') site[IMPURITY] = eps;
        wave = packet(CHAIN, START, sigma, k0);
        cn = new CrankNicolsonChain(site, A, DT);
        // long enough to carry the packet's centre TRAVEL sites
        steps = Math.max(1, Math.ceil(TRAVEL / vg / DT / SAMPLES));
        means = [moments(wave).mean];
        normDrift = 0;
        total = SAMPLES;
        fixed = [];
        pacer = new Pacer('replay', 'samples', Math.max(1, Math.min(MAX_PER_FRAME, Math.floor(SITE_STEPS_PER_FRAME / (steps * CHAIN)))));
      }
      pacer.start(total);
    }

    function advance() {
      for (let s = 0; s < steps; s++) cn.step(wave);
      const m = moments(wave, IMPURITY);
      means.push(m.mean);
      normDrift = Math.max(normDrift, Math.abs(m.norm - 1));
    }

    function stats(): Stat[] {
      const rows: Stat[] = [pacer.row(params), { label: experiment === 'band' ? 'energies shown' : 'samples of the run', value: `${shown} of ${total}` }, ...fixed];
      if (experiment === 'band') return rows;
      const done = shown >= total;
      const dtS = steps * DT;
      rows.push({ label: 'norm − 1, largest, numerics', value: normDrift.toExponential(2) });
      if (experiment === 'packet') {
        // the speed of ⟨n⟩ by least squares over the run
        let v = Number.NaN;
        if (done) {
          let sx = 0; let sy = 0; let sxx = 0; let sxy = 0;
          means.forEach((y, i) => { const x = i * dtS; sx += x; sy += y; sxx += x * x; sxy += x * y; });
          const n = means.length;
          v = (n * sxy - sx * sy) / (n * sxx - sx * sx);
        }
        rows.push(
          { label: 'speed of the packet’s centre ⟨n⟩, fitted (sites per unit time)', value: done ? v.toFixed(9) : 'after the run' },
          { label: 'group velocity 2Ab sin k₀ · e^(−1/8σ²), the packet’s mean', value: (vg * Math.exp(-1 / (8 * sigma * sigma))).toFixed(9) },
        );
      } else {
        const m = moments(wave, IMPURITY);
        const s = 2 * A * Math.sin(k0);
        rows.push(
          { label: 'probability past the impurity at the end, measured', value: done ? m.beyond.toFixed(9) : 'after the run' },
          { label: 'transmission |t(k)|² = 1/(1 + (ε/2A sin k)²), averaged over the packet', value: packetTransmission(eps, k0, sigma).toFixed(9) },
          { label: 'transmission at k₀ alone', value: ((s * s) / (s * s + eps * eps)).toFixed(9) },
        );
      }
      return rows;
    }

    return {
      setup,
      pace: () => pacer.report(shown >= total, params),
      draw() {
        const take = ctx.thumbnail ? total : pacer.take(params);
        for (let k = 0; k < take && shown < total; k++) { if (experiment !== 'band') advance(); shown++; }
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        g.font = '11px monospace';
        const x0 = W * 0.08;
        const w = W * 0.86;
        if (experiment === 'band') {
          // the energies against n/(N + 1), with the cosine band dashed; the drawn mode below
          const y0 = H * 0.1;
          const h = H * 0.5;
          const lo = Math.min(-2 * A, energies[0]) - 0.2;
          const hi = Math.max(2 * A, energies[N - 1]) + 0.2;
          const Y = (e: number) => y0 + h - ((e - lo) / (hi - lo)) * h;
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
          g.strokeRect(x0, y0, w, h);
          g.strokeStyle = rgba(fg, 0.6);
          g.setLineDash([4, 3]);
          g.beginPath();
          for (let i = 0; i <= 200; i++) { const x = i / 200; if (i === 0) g.moveTo(x0 + x * w, Y(-2 * A * Math.cos(Math.PI * x))); else g.lineTo(x0 + x * w, Y(-2 * A * Math.cos(Math.PI * x))); }
          g.stroke();
          g.setLineDash([]);
          g.fillStyle = rgba(ramp(pal, 0.85), 1);
          for (let n = 0; n < shown; n++) g.fillRect(x0 + ((n + 1) / (N + 1)) * w - 2, Y(energies[n]) - 2, 4, 4);
          g.fillStyle = rgba(fg, 0.75);
          g.fillText('Eₙ against n/(N + 1) (dots); −2A cos(nπ/(N + 1)) (dashed)', x0, y0 - 6);
          const my = H * 0.66;
          const mh = H * 0.28;
          const peak = Math.max(1e-12, ...Array.from(mode, Math.abs));
          g.strokeStyle = rgba(ramp(pal, 0.2), 1);
          g.beginPath();
          mode.forEach((v, n) => { const x = x0 + ((n + 0.5) / N) * w; const y = my + mh / 2 - (v / peak) * (mh / 2); if (n === 0) g.moveTo(x, y); else g.lineTo(x, y); });
          g.stroke();
          g.fillText(eps === 0 ? 'the lowest mode' : 'the state outside the band, bound to the impurity', x0, my - 6);
        } else {
          const y0 = H * 0.12;
          const h = H * 0.76;
          let peak = 1e-12;
          for (let n = 0; n < CHAIN; n++) peak = Math.max(peak, wave.re[n] ** 2 + wave.im[n] ** 2);
          peak = Math.max(peak, 1 / (Math.sqrt(2 * Math.PI) * sigma));
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
          g.strokeRect(x0, y0, w, h);
          if (experiment === 'defect') {
            g.strokeStyle = rgba(fg, 0.7);
            g.beginPath();
            g.moveTo(x0 + (IMPURITY / CHAIN) * w, y0);
            g.lineTo(x0 + (IMPURITY / CHAIN) * w, y0 + h);
            g.stroke();
          }
          g.fillStyle = rgba(ramp(pal, 0.8), 0.85);
          for (let n = 0; n < CHAIN; n++) {
            const v = (wave.re[n] ** 2 + wave.im[n] ** 2) / peak;
            g.fillRect(x0 + (n / CHAIN) * w, y0 + h - v * h, Math.max(1, w / CHAIN), v * h);
          }
          g.fillStyle = rgba(fg, 0.75);
          g.fillText(experiment === 'defect' ? '|ψₙ|² along the chain; the line is the impurity' : '|ψₙ|² along the chain', x0, y0 - 6);
        }
        g.restore();
        ctx.stats(stats());
      },
    };
  },
};

export default tightBindingChain;
