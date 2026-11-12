import { count } from '../../core/format';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { gaussian, mulberry32 } from '../../core/random';
import {
  attenuation, gridReading, MAX_GRID_WIDTH, type GridReading, type KernelKind,
} from '../_shared/two-slit/detector';
import { bars, curve, legend, rgba, type Panel } from '../_shared/two-slit/draw';
import { besselJ0, integrate, interpolate, ksBound, ksDistance, sinc } from '../_shared/two-slit/math';
import { closedForm, Wall, type WallState } from '../_shared/two-slit/recoil';
import {
  envelope, fringePeriod, oneSlit, referenceCdf, Screen, twoSlit, visibilityMoments,
  VisibilityEstimate, type Slits,
} from '../_shared/two-slit/screen';
import { MAX_PER_FRAME, roundRobin } from '../_shared/two-slit/pace';
import { Pacer, paceParam } from '../../core/pace';
import { deBroglie, electronMomentum, HBAR, length, PLANCK } from '../_shared/two-slit/units';

type Scenario = 'electrons' | 'watched' | 'resolution' | 'recoil';

const AMPLITUDE: Scenario[] = ['electrons', 'watched'];
/** Particles per frame, all runs, in the gallery thumbnail. */
const THUMB_RATE = 4500;
/** Bins of the hit histograms over the fringe windows of the resolution and recoil modes. */
const WINDOW_BINS = 96;
/** Beyond this many fringe periods a wrapped reading is uniform to double precision. */
const WRAP_LIMIT = 1e6;

const when = (...values: Scenario[]) => ({ key: 'scenario', values });
const signed = (v: number, digits: number) => v.toFixed(digits);
const pm = (v: number, se: number, digits = 3) =>
  Number.isFinite(v) ? `${signed(v, digits)} ± ${se.toFixed(digits)}` : 'after two hits';

export const twoSlitAmplitudes: PlateCode = {
  id: 'two-slit-amplitudes',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 30,
  params: [
    {
      kind: 'select', key: 'scenario', label: 'Experiment', value: 'electrons', rebuild: true,
      options: [
        { value: 'electrons', label: 'Electrons through two slits' },
        { value: 'watched', label: 'Watched by a light behind the slits' },
        { value: 'resolution', label: 'Fine fringes and a coarse detector' },
        { value: 'recoil', label: 'A slit wall free to recoil' },
      ],
    },
    { kind: 'range', key: 'energy', label: 'Electron energy (eV)', min: 10, max: 500, step: 10,
      value: 50, rebuild: true, when: when('electrons', 'watched', 'recoil') },
    { kind: 'range', key: 'd', label: 'Slit separation d (µm)', min: 1, max: 5, step: 0.1,
      value: 2.5, rebuild: true },
    { kind: 'range', key: 'a', label: 'Slit width a (µm)', min: 0.1, max: 1, step: 0.05,
      value: 0.5, rebuild: true, when: when(...AMPLITUDE) },
    { kind: 'range', key: 'L', label: 'Slits to screen L (m)', min: 0.2, max: 2, step: 0.1,
      value: 1, rebuild: true },
    { kind: 'range', key: 'bins', label: 'Counter bins across the screen', min: 21, max: 121,
      step: 10, value: 61, rebuild: true, when: when(...AMPLITUDE) },
    { kind: 'range', key: 'eta', label: 'Chance an electron scatters a photon', min: 0, max: 1,
      step: 0.05, value: 1, rebuild: true, when: when('watched') },
    { kind: 'range', key: 'photon', label: 'Photon wavelength, log₁₀ of nm', min: 2.3, max: 4.5,
      step: 0.01, value: 3.62, rebuild: true, when: when('watched') },
    {
      kind: 'select', key: 'scatter', label: 'Photon scattering', value: 'plane', rebuild: true,
      when: when('watched'),
      options: [
        { value: 'plane', label: 'Uniform in the plane: γ = J₀(kd)' },
        { value: 'sphere', label: 'Isotropic in space: γ = sin(kd)/kd' },
      ],
    },
    { kind: 'range', key: 'mass', label: 'Particle mass, log₁₀ of kg', min: -30.04, max: -2,
      step: 0.01, value: -2, rebuild: true, when: when('resolution') },
    { kind: 'range', key: 'speed', label: 'Particle speed (m/s)', min: 1, max: 1000, step: 1,
      value: 300, rebuild: true, when: when('resolution') },
    {
      kind: 'select', key: 'detector', label: 'Detector response', value: 'gaussian', rebuild: true,
      when: when('resolution'),
      options: [
        { value: 'gaussian', label: 'Gaussian, width σ' },
        { value: 'box', label: 'Box (a bin), width w' },
      ],
    },
    { kind: 'range', key: 'width', label: 'Detector width, log₁₀ of m', min: -9, max: 0,
      step: 0.01, value: -3, rebuild: true, when: when('resolution') },
    {
      kind: 'select', key: 'wall', label: 'State of the wall', value: 'gaussian', rebuild: true,
      when: when('recoil'),
      options: [
        { value: 'gaussian', label: 'Gaussian, σₓσₚ = ħ/2' },
        { value: 'chirped', label: 'Chirped Gaussian, σₓσₚ = (ħ/2)√5' },
      ],
    },
    { kind: 'range', key: 'spread', label: 'Wall momentum spread σₚ/Δq, log₁₀', min: -1.3, max: 1,
      step: 0.01, value: -0.3, rebuild: true, when: when('recoil') },
    // a default run is a demonstration: one run (or the three of the electron mode) of this many
    // particles, paced from their count (config/pacing.yaml); the claims pin their own n
    { kind: 'range', key: 'n', label: 'Particles emitted per run', min: 50, max: 60000,
      step: 50, value: 450, rebuild: true },
    paceParam(),
    paletteParam('abyss'),
  ],
  pace: { kind: 'replay', unit: 'particles' },
  create(p, ctx) {
    const params = ctx.params;
    let scenario: Scenario = 'electrons';
    let n = 0;
    let stats: () => Stat[] = () => [];
    /** Advance the runs by this frame's particles, all runs together. */
    let step: (budget: number) => void = () => {};
    const pacer = new Pacer('replay', 'particles', MAX_PER_FRAME);
    /** The particles every run of the scenario still has to emit. */
    let left: () => number = () => 0;
    let render: (g: CanvasRenderingContext2D) => void = () => {};
    const stream = () => mulberry32(Math.floor(ctx.rnd() * 0x7fffffff) + 1);

    /** Electrons or watched electrons: the far-field amplitudes on a counter's bins. */
    function amplitudes(watched: boolean) {
      const lambda = deBroglie(electronMomentum(num(params, 'energy')));
      const s: Slits = { lambda, d: num(params, 'd') * 1e-6, a: num(params, 'a') * 1e-6, L: num(params, 'L') };
      const screen = new Screen(s);
      const X = screen.X;
      const bins = num(params, 'bins');
      const w = (2 * X) / bins;
      const binOf = (x: number) => Math.min(bins - 1, Math.floor(((x + X) / (2 * X)) * bins));
      const k = (2 * Math.PI) / screen.period;
      const moments = visibilityMoments(s, X);
      const centre = (bins - 1) / 2;
      const rnds = [stream(), stream(), stream()];
      // electrons: hole 2 shut, hole 1 shut, both; watched: one run sorted by flash
      const runs = (watched ? [0] : [0, 1, 2]).map(() => ({ emitted: 0, hits: 0, hist: new Float64Array(bins) }));
      const both = new Float64Array(n);
      let bothHits = 0;
      const est = { all: new VisibilityEstimate(screen.period, moments),
        flash: new VisibilityEstimate(screen.period, moments),
        dark: new VisibilityEstimate(screen.period, moments) };
      const flashHist = new Float64Array(bins);
      const darkHist = new Float64Array(bins);
      let flashes = 0;
      const eta = num(params, 'eta');
      const lambdaPh = 10 ** num(params, 'photon') * 1e-9;
      const kd = (2 * Math.PI * s.d) / lambdaPh;
      const plane = str(params, 'scatter') === 'plane';
      // the photon's overlap in closed form, for the readout the hits are compared with
      const gamma = plane ? besselJ0(kd) : sinc(kd);
      const gammaEff = 1 - eta + eta * gamma;
      // the expected counts per bin, by Simpson on each bin of the closed form
      const expect12 = new Float64Array(bins);
      const expect1 = new Float64Array(bins);
      for (let i = 0; i < bins; i++) {
        const lo = -X + i * w;
        expect12[i] = n * integrate((x) => envelope(s, x) * (1 + (watched ? gammaEff : 1) * Math.cos(k * x)), lo, lo + w, 64);
        expect1[i] = n * integrate((x) => oneSlit(s, x), lo, lo + w, 64);
      }
      const cLo = -X + centre * w;
      const ratioExpected = integrate((x) => twoSlit(s, x), cLo, cLo + w, 256)
        / integrate((x) => 2 * oneSlit(s, x), cLo, cLo + w, 256);
      let ks: number | null = null;

      left = () => runs.reduce((t, run) => t + Math.max(0, n - run.emitted), 0);
      step = (budget) => {
        roundRobin(budget, (r) => n - runs[r].emitted, runs.length, (r) => {
          const run = runs[r];
          run.emitted++;
          const rnd = rnds[r];
          if (watched) {
            const flash = rnd() < eta;
            // the photon's direction sets the phase it kicks into the second path: x-momentum
            // k·sin φ in the plane, k·nₓ (uniform in [−1, 1]) for isotropic scattering in space;
            // the illumination is along the beam, so the incident photon adds no phase
            const theta = !flash ? 0 : plane ? kd * Math.sin(2 * Math.PI * rnd()) : kd * (2 * rnd() - 1);
            const out = screen.emitTwo(rnd, theta);
            if (out.outcome !== 'hit') return;
            run.hits++;
            const b = binOf(out.x);
            run.hist[b]++;
            est.all.add(out.x);
            if (flash) {
              flashes++;
              flashHist[b]++;
              est.flash.add(out.x);
            } else {
              darkHist[b]++;
              est.dark.add(out.x);
            }
            return;
          }
          const out = r === 2 ? screen.emitTwo(rnd) : screen.emitOne(rnd);
          if (out.outcome !== 'hit') return;
          run.hits++;
          run.hist[binOf(out.x)]++;
          if (r === 2) {
            both[bothHits++] = out.x;
            est.all.add(out.x);
          }
        });
        if (!watched && ks === null && runs.every((run) => run.emitted >= n)) {
          const ref = referenceCdf(s, X, 1);
          ks = ksDistance(both.subarray(0, bothHits), (x) => interpolate(ref, -X, X, x));
        }
      };

      stats = () => {
        const done = runs.every((run) => run.emitted >= n);
        const rows: Stat[] = [
          { label: 'electron wavelength λ', value: `${(lambda * 1e9).toFixed(5)} nm` },
          { label: 'fringe period Λ = λL/d', value: length(screen.period) },
          { label: 'emitted, each run', value: `${count(Math.min(...runs.map((r) => r.emitted)))} of ${count(n)}` },
        ];
        const all = est.all.value();
        if (!watched) {
          const n12 = runs[2].hist[centre];
          const n1n2 = runs[0].hist[centre] + runs[1].hist[centre];
          const ratio = n1n2 > 0 ? n12 / n1n2 : NaN;
          const se = n12 > 0 && n1n2 > 0 ? ratio * Math.sqrt(1 / n12 + 1 / n1n2) : NaN;
          rows.push(
            { label: 'hits in the window, both slits', value: count(runs[2].hits) },
            { label: 'centre bin N₁₂ / (N₁ + N₂)', value: pm(ratio, se) },
            { label: 'centre bin ratio expected, 1 + sinc(πw/Λ) on the envelope',
              value: `${ratioExpected.toFixed(4)} for a bin of ${length(w)}` },
            // the gap judged in the measurement's own standard errors, not a fixed width
            { label: 'centre bin ratio, standard errors from expected',
              value: Number.isFinite(se) && se > 0 ? ((ratio - ratioExpected) / se).toFixed(2) : 'after the runs' },
            { label: 'visibility from the both-slit hits', value: pm(all.v, all.se) },
            { label: 'KS distance of the hits from p(x)', value: ks === null ? 'after the runs' : ks.toFixed(5) },
            { label: 'KS 95 % bound, 1.36/√N', value: done ? ksBound(bothHits).toFixed(5) : 'after the runs' },
          );
          return rows;
        }
        const fl = est.flash.value();
        const dk = est.dark.value();
        rows.push(
          { label: 'photon wavelength and kd', value: `${(lambdaPh * 1e9).toFixed(0)} nm, kd = ${kd.toFixed(3)}` },
          { label: 'photon overlap γ, closed form', value: signed(gamma, 4) },
          { label: 'γ_eff = (1 − η) + η·γ', value: signed(gammaEff, 4) },
          { label: 'visibility from all hits', value: pm(all.v, all.se) },
          { label: 'visibility, hits with a scattered photon', value: pm(fl.v, fl.se) },
          { label: 'visibility, hits with no photon', value: pm(dk.v, dk.se) },
          { label: 'hits with a photon / all hits', value: `${count(flashes)} / ${count(runs[0].hits)}` },
        );
        return rows;
      };

      render = (g) => {
        const W = ctx.width;
        const H = ctx.height;
        const pal = ctx.palette();
        const fg = ctx.fg;
        const top = H * 0.08;
        const span = H * 0.84;
        const sx = W * 0.07;
        const wx = W * 0.27;
        const cx = W * 0.5;
        const yMid = top + span / 2;
        // the apparatus, schematic: slits drawn far apart from the screen's scale
        const gap = span * 0.12;
        const slitH = Math.max(3, gap * (s.a / s.d));
        g.fillStyle = rgba(mix(ctx.bg, fg, 0.6), 1);
        g.fillRect(wx - 3, top, 6, yMid - gap / 2 - slitH / 2 - top);
        g.fillRect(wx - 3, yMid - gap / 2 + slitH / 2, 6, gap - slitH);
        g.fillRect(wx - 3, yMid + gap / 2 + slitH / 2, 6, top + span - (yMid + gap / 2 + slitH / 2));
        g.fillRect(cx - 2, top, 4, span);
        g.fillStyle = rgba(fg, 0.75);
        g.beginPath();
        g.arc(sx, yMid, 5, 0, 2 * Math.PI);
        g.fill();
        g.font = '11px monospace';
        g.textBaseline = 'top';
        g.fillText('electron gun', sx - 30, yMid + 10);
        g.fillText('slits', wx - 14, top + span + 4);
        g.fillText('counter', cx - 20, top + span + 4);
        if (watched) {
          // the light behind the wall, its wavelength drawn to the slits' scale
          const per = gap * (lambdaPh / s.d);
          g.strokeStyle = rgba(ramp(pal, 0.9), 0.8);
          g.lineWidth = 1.2;
          g.beginPath();
          const x0 = wx + 18;
          for (let y = yMid - gap; y <= yMid + gap; y += 1) {
            const xx = x0 + 5 * Math.sin((2 * Math.PI * (y - yMid)) / Math.max(per, 1e-9));
            if (y === yMid - gap) g.moveTo(xx, y);
            else g.lineTo(xx, y);
          }
          g.stroke();
          g.fillStyle = rgba(fg, 0.7);
          g.fillText('light', x0 - 10, yMid + gap + 6);
        }
        const panel: Panel = { x: cx + 6, w: W * 0.46, y: top, h: span };
        let peak = 1;
        for (let i = 0; i < bins; i++) peak = Math.max(peak, expect12[i] * 1.15, runs[watched ? 0 : 2].hist[i]);
        const main = ramp(pal, 0.75);
        bars(g, panel, runs[watched ? 0 : 2].hist, peak, rgba(main, 0.55));
        curve(g, panel, expect12, peak, rgba(fg, 0.9), 1.3);
        if (!watched) {
          curve(g, panel, runs[0].hist, peak, rgba(ramp(pal, 0.25), 0.9), 1.1);
          curve(g, panel, runs[1].hist, peak, rgba(ramp(pal, 0.45), 0.9), 1.1);
          curve(g, panel, expect1.map((v) => 2 * v), peak, rgba(fg, 0.6), 1.1, [4, 3]);
          legend(g, panel.x + panel.w * 0.58, top + 8, [
            [rgba(main, 0.8), 'N₁₂ both slits'], [rgba(fg, 0.9), 'expected'],
            [rgba(ramp(pal, 0.25), 1), 'N₁ slit 2 shut'], [rgba(ramp(pal, 0.45), 1), 'N₂ slit 1 shut'],
            [rgba(fg, 0.6), 'P₁ + P₂ expected'],
          ], fg);
        } else {
          curve(g, panel, flashHist, peak, rgba(ramp(pal, 0.95), 0.9), 1.1);
          curve(g, panel, darkHist, peak, rgba(ramp(pal, 0.3), 0.9), 1.1);
          legend(g, panel.x + panel.w * 0.58, top + 8, [
            [rgba(main, 0.8), 'all hits'], [rgba(fg, 0.9), 'expected, γ_eff'],
            [rgba(ramp(pal, 0.95), 1), 'hits with a photon'], [rgba(ramp(pal, 0.3), 1), 'hits with none'],
          ], fg);
        }
      };
    }

    /** Fine fringes read by a detector of finite width (the bullets' figure). */
    function resolution() {
      const mass = 10 ** num(params, 'mass');
      const speed = num(params, 'speed');
      const lambda = PLANCK / (mass * speed);
      const s: Slits = { lambda, d: num(params, 'd') * 1e-6, a: 0, L: num(params, 'L') };
      const period = fringePeriod(s);
      const kind = str(params, 'detector') as KernelKind;
      const width = 10 ** num(params, 'width');
      const ratio = width / period;
      const grid: GridReading | null = gridReading(kind, ratio);
      const periods = grid ? grid.periods : 4;
      const hist = new Float64Array(WINDOW_BINS);
      let emitted = 0;
      const rnd = stream();
      const closed = attenuation(kind, ratio);
      // Σ cos(2πx/Λ) and its square over the arrivals and over the readings: on whole periods
      // the mean of the cosine is half the contrast, so each is measured from the hits themselves
      const arrived = { s: 0, s2: 0 };
      const readd = { s: 0, s2: 0 };
      const contrast = (m: { s: number; s2: number }) => {
        if (emitted < 2) return 'after two hits';
        const mean = m.s / emitted;
        const sd = Math.sqrt(Math.max(0, (m.s2 - emitted * mean * mean) / (emitted - 1)));
        return pm(2 * mean, (2 * sd) / Math.sqrt(emitted));
      };

      left = () => Math.max(0, n - emitted);
      step = (budget) => {
        const shots = Math.min(budget, n - emitted);
        for (let i = 0; i < shots; i++) {
          emitted++;
          // where the particle arrives: the fringe 1 + cos(2πx/Λ) over whole periods
          let x: number;
          do x = rnd() * periods; while (2 * rnd() >= 1 + Math.cos(2 * Math.PI * x));
          // where the detector says it arrived
          const noise = kind === 'gaussian' ? ratio * gaussian(rnd) : ratio * (rnd() - 0.5);
          let read: number;
          if (ratio * 8 > WRAP_LIMIT) read = rnd() * periods;
          else read = (((x + noise) % periods) + periods) % periods;
          hist[Math.min(WINDOW_BINS - 1, Math.floor((read / periods) * WINDOW_BINS))]++;
          const ca = Math.cos(2 * Math.PI * x);
          const cr = Math.cos(2 * Math.PI * read);
          arrived.s += ca;
          arrived.s2 += ca * ca;
          readd.s += cr;
          readd.s2 += cr * cr;
        }
      };

      stats = () => [
        { label: 'de Broglie wavelength h/mv', value: length(lambda) },
        { label: 'fringe period Λ = λL/d', value: length(period) },
        { label: 'detector width over Λ', value: ratio.toExponential(3) },
        { label: 'contrast as the particles arrive, read on the grid',
          value: grid ? grid.vTrue.toFixed(7) : 'not on a grid' },
        { label: 'contrast as the detector reads it, read on the grid',
          value: grid ? signed(grid.vMeasured, 7)
            : `beyond the grid (width over Λ above ${MAX_GRID_WIDTH[kind]})` },
        { label: 'contrast factor, closed form',
          value: kind === 'box' && ratio > WRAP_LIMIT
            ? `at most ${(1 / (Math.PI * ratio)).toExponential(2)} in size`
            : closed === 0 ? '0 (below the smallest double)' : closed.toExponential(5) },
        { label: 'contrast of the arrivals, from the hits', value: contrast(arrived) },
        { label: 'contrast of the readings, from the hits', value: contrast(readd) },
        { label: 'kernel weights − 1, numerics', value: grid ? grid.kernelSumError.toExponential(2) : 'not on a grid' },
        { label: 'reading total − arrival total, numerics', value: grid ? grid.normError.toExponential(2) : 'not on a grid' },
        { label: 'readings', value: `${count(emitted)} of ${count(n)}` },
      ];

      render = (g) => {
        const W = ctx.width;
        const H = ctx.height;
        const pal = ctx.palette();
        const fg = ctx.fg;
        const left = W * 0.06;
        const right = W * 0.94;
        const rowH = H * 0.36;
        const tops = [H * 0.07, H * 0.53];
        const xs = (u: number) => left + (u / periods) * (right - left);
        // the arrivals: fringes of the true density, drawn over whole periods
        g.strokeStyle = rgba(ramp(pal, 0.8), 0.95);
        g.lineWidth = 1.4;
        g.beginPath();
        for (let i = 0; i <= 600; i++) {
          const u = (i / 600) * periods;
          const y = tops[0] + rowH - ((1 + Math.cos(2 * Math.PI * u)) / 2) * rowH * 0.9;
          if (i === 0) g.moveTo(xs(u), y);
          else g.lineTo(xs(u), y);
        }
        g.stroke();
        // the reading: the grid's convolved pattern, else the closed-form contrast
        g.strokeStyle = rgba(fg, 0.9);
        g.beginPath();
        const cells = grid ? grid.cells : 600;
        for (let i = 0; i <= cells; i++) {
          const u = (i / cells) * periods;
          const v = grid ? grid.measured[i % grid.cells] : 1 + (Number.isFinite(closed) ? closed : 0) * Math.cos(2 * Math.PI * u);
          const y = tops[1] + rowH - (v / 2) * rowH * 0.9;
          if (i === 0) g.moveTo(xs(u), y);
          else g.lineTo(xs(u), y);
        }
        g.stroke();
        let peak = 1;
        for (const h of hist) peak = Math.max(peak, h);
        const bw = (right - left) / WINDOW_BINS;
        g.fillStyle = rgba(ramp(pal, 0.5), 0.45);
        for (let i = 0; i < WINDOW_BINS; i++) {
          const hh = (hist[i] / peak) * rowH * 0.9;
          g.fillRect(left + i * bw, tops[1] + rowH - hh, Math.max(1, bw - 1), hh);
        }
        g.fillStyle = rgba(fg, 0.75);
        g.font = '11px monospace';
        g.textBaseline = 'bottom';
        g.fillText(`where the particles arrive: ${periods} fringe periods of ${length(period)}`, left, tops[0]);
        g.fillText('what the detector reads, and its readings as bars', left, tops[1]);
      };
    }

    /** The recoiling wall (the uncertainty figure). */
    function recoil() {
      const pe = electronMomentum(num(params, 'energy'));
      const dq = (pe * num(params, 'd') * 1e-6) / num(params, 'L');
      const period = (2 * Math.PI * HBAR) / dq;
      const state = str(params, 'wall') as WallState;
      const sp = 10 ** num(params, 'spread');
      const wall = new Wall(state, sp);
      const sp2 = wall.spreads();
      const g0 = wall.overlap();
      const vOverlap = Math.hypot(g0.re, g0.im);
      const vSmear = wall.smearedContrast();
      const d = wall.distinguishability();
      const cf = closedForm(state, sp);
      const draw = wall.sampler();
      const rnd = stream();
      const hist = new Float64Array(WINDOW_BINS);
      let emitted = 0;
      let sum = 0;
      let sumSq = 0;
      const pk = wall.momentum();

      left = () => Math.max(0, n - emitted);
      step = (budget) => {
        const shots = Math.min(budget, n - emitted);
        for (let i = 0; i < shots; i++) {
          emitted++;
          const X = draw(rnd);
          let x: number;
          do x = rnd() * 4; while (2 * rnd() >= 1 + Math.cos(2 * Math.PI * (x - X)));
          hist[Math.min(WINDOW_BINS - 1, Math.floor((x / 4) * WINDOW_BINS))]++;
          const c = Math.cos(2 * Math.PI * x);
          sum += c;
          sumSq += c * c;
        }
      };

      stats = () => {
        const mean = emitted ? sum / emitted : NaN;
        const sd = emitted > 1 ? Math.sqrt(Math.max(0, (sumSq - emitted * mean * mean) / (emitted - 1))) : NaN;
        return [
          { label: 'momentum kick between the paths Δq = pd/L', value: `${dq.toExponential(4)} kg m/s` },
          { label: 'fringe period Λ = 2πħ/Δq', value: length(period) },
          { label: 'wall spreads σₓ and σₚ',
            value: `${length(wall.sigmaX * period)}, ${(sp * dq).toExponential(3)} kg m/s` },
          { label: 'σₓσₚ / (ħ/2), from the grid, numerics', value: (2 * sp2.dx * sp2.dk).toFixed(7) },
          { label: 'visibility, overlap of the kicked wall states |γ|', value: vOverlap.toFixed(7) },
          { label: 'visibility, fitted to the smeared pattern, numerics', value: vSmear.toFixed(7) },
          { label: 'visibility, closed form exp(−Δq²σₓ²/2ħ²)', value: cf.v.toFixed(7) },
          { label: 'visibility from the hits', value: emitted > 1 ? pm(2 * mean, (2 * sd) / Math.sqrt(emitted)) : 'after two hits' },
          { label: 'distinguishability D, reading the wall’s momentum', value: d.toFixed(5) },
          { label: 'D, closed form erf(Δq/2√2σₚ)', value: cf.d.toFixed(5) },
          { label: 'D² + V²', value: (d * d + vOverlap * vOverlap).toFixed(5) },
          { label: 'D² + V², closed form', value: (cf.d * cf.d + cf.v * cf.v).toFixed(5) },
          // Englert's bound is reached by the optimal (Helstrom) measurement of the wall: its
          // distinguishability is √(1 − |γ|²) for these pure states
          { label: 'D of the optimal measurement, √(1 − V²)', value: Math.sqrt(Math.max(0, 1 - vOverlap * vOverlap)).toFixed(5) },
          { label: 'hits', value: `${count(emitted)} of ${count(n)}` },
        ];
      };

      render = (g) => {
        const W = ctx.width;
        const H = ctx.height;
        const pal = ctx.palette();
        const fg = ctx.fg;
        const top = H * 0.1;
        const h = H * 0.34;
        // the wall's position density, within ±4σₓ
        const lw = W * 0.42;
        const lx = W * 0.05;
        let rmax = 0;
        for (const r of wall.rho) rmax = Math.max(rmax, r);
        g.strokeStyle = rgba(ramp(pal, 0.8), 0.95);
        g.lineWidth = 1.4;
        g.beginPath();
        const span = 4 * wall.sigmaX;
        let first = true;
        for (let i = 0; i < wall.x.length; i++) {
          if (Math.abs(wall.x[i]) > span) continue;
          const xx = lx + ((wall.x[i] + span) / (2 * span)) * lw;
          const yy = top + h - (wall.rho[i] / rmax) * h * 0.9;
          if (first) g.moveTo(xx, yy);
          else g.lineTo(xx, yy);
          first = false;
        }
        g.stroke();
        // its momentum density and the same density kicked by Δq: their overlap is what D misses
        const top2 = top + h + H * 0.12;
        const N = pk.length;
        const kmax = Math.max(4, 4 * sp + 1.5);
        let pmax = 0;
        for (const v of pk) pmax = Math.max(pmax, v);
        for (const [shift, at] of [[0, 0.35], [1, 0.85]] as const) {
          g.strokeStyle = rgba(ramp(pal, at), 0.95);
          g.beginPath();
          let started = false;
          for (let j = 0; j < N; j++) {
            const kj = (j < N / 2 ? j : j - N) / wall.periods; // in units of Δq
            const u = kj + shift;
            if (Math.abs(u - 0.5) > kmax / 2) continue;
            const xx = lx + ((u - 0.5 + kmax / 2) / kmax) * lw;
            const yy = top2 + h - (pk[j] / pmax) * h * 0.9;
            if (!started) g.moveTo(xx, yy);
            else g.lineTo(xx, yy);
            started = true;
          }
          g.stroke();
        }
        // the screen: hits over four fringe periods and the smeared pattern
        const panelX = W * 0.53;
        const pw = W * 0.42;
        let peak = 1;
        for (const v of hist) peak = Math.max(peak, v);
        const bw = pw / WINDOW_BINS;
        g.fillStyle = rgba(ramp(pal, 0.6), 0.5);
        const ph = H * 0.8;
        for (let i = 0; i < WINDOW_BINS; i++) {
          const hh = (hist[i] / (peak * 1.1)) * ph;
          g.fillRect(panelX + i * bw, top + ph - hh, Math.max(1, bw - 1), hh);
        }
        g.strokeStyle = rgba(fg, 0.9);
        g.beginPath();
        for (let i = 0; i <= 400; i++) {
          const u = (i / 400) * 4;
          const v = 1 + g0.re * Math.cos(2 * Math.PI * u) + g0.im * Math.sin(2 * Math.PI * u);
          const yy = top + ph - ((v * emitted) / WINDOW_BINS / (peak * 1.1)) * ph;
          if (i === 0) g.moveTo(panelX + (u / 4) * pw, yy);
          else g.lineTo(panelX + (u / 4) * pw, yy);
        }
        g.stroke();
        g.fillStyle = rgba(fg, 0.75);
        g.font = '11px monospace';
        g.textBaseline = 'bottom';
        g.fillText('wall position |φ(X)|², ±4σₓ', lx, top - 2);
        g.fillText('wall momentum, as left and as kicked by Δq', lx, top2 - 2);
        g.fillText('hits over four fringe periods', panelX, top - 2);
      };
    }

    return {
      setup() {
        scenario = str(params, 'scenario') as Scenario;
        n = num(params, 'n');
        if (scenario === 'electrons' || scenario === 'watched') amplitudes(scenario === 'watched');
        else if (scenario === 'resolution') resolution();
        else recoil();
        pacer.start(left());
      },
      pace: () => pacer.report(left() === 0, params),
      draw() {
        step(ctx.thumbnail ? THUMB_RATE : pacer.take(params));
        const g = p.drawingContext as CanvasRenderingContext2D;
        p.background(...ctx.bg);
        g.save();
        render(g);
        g.restore();
        ctx.stats([...stats(), pacer.row(params)]);
      },
    };
  },
};

export default twoSlitAmplitudes;
