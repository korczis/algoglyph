import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { rgba } from '../_shared/two-slit/draw';
import {
  expectation, overlap, spinMatrices, spinUp, step, type Field, type Spin, type State,
} from '../_shared/quantum/spin';

type Experiment = 'larmor' | 'rabi' | 'rotation';

/** Samples of a run (the counted changes), and Crank–Nicolson substeps between two samples. */
export const SAMPLES = 600;
export const SUBSTEPS = 40;
export const MAX_PER_FRAME = 60;
const GAMMA = 1;
const when = (...values: Experiment[]) => ({ key: 'experiment', values });

export const spinPrecession: PlateCode = {
  id: 'spin-precession',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'experiment', label: 'Experiment', value: 'rabi', rebuild: true,
      options: [
        { value: 'larmor', label: 'Precession in a static field' },
        { value: 'rabi', label: 'Resonance with a rotating field (Rabi)' },
        { value: 'rotation', label: 'A rotation by whole turns' },
      ],
    },
    {
      kind: 'select', key: 'j', label: 'Spin j', value: '0.5', rebuild: true,
      options: [
        { value: '0.5', label: '½' },
        { value: '1', label: '1' },
        { value: '1.5', label: '3/2' },
      ],
    },
    { kind: 'range', key: 'B0', label: 'Static field B₀ (along z)', min: 1, max: 10, step: 0.5, value: 4,
      rebuild: true, when: when('larmor', 'rabi') },
    { kind: 'range', key: 'B1', label: 'Rotating field B₁', min: 0.1, max: 2, step: 0.1, value: 0.5,
      rebuild: true, when: when('rabi') },
    { kind: 'range', key: 'detune', label: 'Detuning Δ in units of γB₁', min: -3, max: 3, step: 0.25,
      value: 0, rebuild: true, when: when('rabi') },
    { kind: 'range', key: 'tilt', label: 'Starting tilt from +z (°)', min: 0, max: 180, step: 5,
      value: 90, rebuild: true, when: when('larmor') },
    { kind: 'range', key: 'turns', label: 'Rotation, in whole turns of 2π', min: 0, max: 2, step: 0.125,
      value: 1, rebuild: true, when: when('rotation') },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'samples' },
  create(p, ctx) {
    const params = ctx.params;
    // at most MAX_PER_FRAME samples a frame (each SUBSTEPS Crank–Nicolson steps): the frame the budget measures
    const pacer = new Pacer('replay', 'samples', MAX_PER_FRAME);
    let experiment: Experiment = 'rabi';
    let sp: Spin;
    let psi: State;
    let start: State;
    let field: Field = () => [0, 0, 0];
    let T = 1;
    let sample = 0;
    let trail: [number, number, number][] = [];
    let curve: number[] = [];
    let closed: (t: number) => number = () => 0;
    let phase: number[] = [];
    let lastAzimuth = 0;
    let atHalf = Number.NaN;
    let j = 0.5;

    const flip = (s: State) => s.re[sp.dim - 1] ** 2 + s.im[sp.dim - 1] ** 2;
    const norm = (s: State) => s.re.reduce((t, v, i) => t + v * v + s.im[i] ** 2, 0);

    function record() {
      const v: [number, number, number] = [expectation(psi, sp.x) / j, expectation(psi, sp.y) / j, expectation(psi, sp.z) / j];
      trail.push(v);
      if (experiment === 'rabi') curve.push(flip(psi));
      else if (experiment === 'larmor') {
        // the azimuth of ⟨J⟩, unwrapped sample by sample
        const a = Math.atan2(v[1], v[0]);
        if (!phase.length) phase.push(a);
        else {
          let d = a - lastAzimuth;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          phase.push(phase[phase.length - 1] + d);
        }
        lastAzimuth = a;
        curve.push(v[0]);
      } else curve.push(overlap(start, psi).re);
      if (sample === SAMPLES / 2) atHalf = experiment === 'rabi' ? flip(psi) : Number.NaN;
    }

    function setup() {
      experiment = str(params, 'experiment') as Experiment;
      j = Number(str(params, 'j'));
      sp = spinMatrices(j);
      start = spinUp(j);
      const B0 = num(params, 'B0');
      trail = [];
      curve = [];
      phase = [];
      sample = 0;
      atHalf = Number.NaN;
      if (experiment === 'larmor') {
        // tilt |j, j⟩ from +z by rotating it about y, then precess for two turns
        const tilt = (num(params, 'tilt') * Math.PI) / 180;
        const s = { re: Float64Array.from(start.re), im: Float64Array.from(start.im) };
        for (let i = 0; i < 400; i++) step(s, sp, () => [0, -1, 0], (i * tilt) / 400, tilt / 400, GAMMA);
        start = s;
        field = () => [0, 0, B0];
        T = (2 * 2 * Math.PI) / (GAMMA * B0);
        closed = (t) => Math.sin(tilt) * Math.cos(GAMMA * B0 * t);
      } else if (experiment === 'rabi') {
        const B1 = num(params, 'B1');
        const w1 = GAMMA * B1;
        const w = GAMMA * B0 + num(params, 'detune') * w1;
        const Omega = Math.hypot(w1, w - GAMMA * B0);
        // H = −γB·J precesses clockwise about +z: the drive rotates the same way
        field = (t) => [B1 * Math.cos(w * t), -B1 * Math.sin(w * t), B0];
        T = (2 * Math.PI) / Omega;
        closed = (t) => ((w1 * w1) / (Omega * Omega)) * Math.sin((Omega * t) / 2) ** 2;
      } else {
        const turns = num(params, 'turns');
        const alpha = 2 * Math.PI * turns;
        field = () => [1, 0, 0];
        T = Math.max(alpha, 1e-9) / GAMMA;
        closed = (t) => Math.cos((GAMMA * t) / 2) ** (2 * j);
      }
      psi = { re: Float64Array.from(start.re), im: Float64Array.from(start.im) };
      record();
      pacer.start(SAMPLES);
    }

    function advance() {
      const h = T / (SAMPLES * SUBSTEPS);
      for (let k = 0; k < SUBSTEPS; k++) {
        const t = (sample * SUBSTEPS + k) * h;
        step(psi, sp, field, t, h, GAMMA);
      }
      sample++;
      record();
    }

    function stats(): Stat[] {
      const done = sample >= SAMPLES;
      const rows: Stat[] = [pacer.row(params),
        { label: 'samples of the run', value: `${sample} of ${SAMPLES}, ${SUBSTEPS} Crank–Nicolson steps each` },
        { label: 'norm − 1, numerics', value: (norm(psi) - 1).toExponential(2) },
      ];
      const B0 = num(params, 'B0');
      if (experiment === 'larmor') {
        // the precession rate from a least-squares line through the unwrapped azimuth
        let rate = Number.NaN;
        if (done) {
          const n = phase.length;
          const dt = T / SAMPLES;
          let sx = 0; let sy = 0; let sxx = 0; let sxy = 0;
          for (let i = 0; i < n; i++) { const x = i * dt; sx += x; sy += phase[i]; sxx += x * x; sxy += x * phase[i]; }
          rate = (n * sxy - sx * sy) / (n * sxx - sx * sx);
        }
        rows.push(
          { label: 'precession rate, measured from ⟨J⟩ (rad per unit time)', value: done ? Math.abs(rate).toFixed(7) : 'after the run' },
          { label: 'sense of precession about +z', value: done ? (rate < 0 ? 'clockwise' : 'anticlockwise') : 'after the run' },
          { label: 'Larmor rate γB₀', value: (GAMMA * B0).toFixed(7) },
        );
      } else if (experiment === 'rabi') {
        const w1 = GAMMA * num(params, 'B1');
        const d = num(params, 'detune') * w1;
        const O = Math.hypot(w1, d);
        rows.push(
          { label: 'Rabi frequency Ω = √(Ω₁² + Δ²)', value: O.toFixed(7) },
          { label: 'flip probability at t = π/Ω, measured', value: Number.isFinite(atHalf) ? atHalf.toFixed(7) : 'at mid-run' },
          { label: 'flip probability at t = π/Ω, Rabi’s formula Ω₁²/Ω²', value: ((w1 * w1) / (O * O)).toFixed(7) },
          { label: 'flip probability at the end of one Rabi cycle', value: done ? flip(psi).toExponential(2) : 'after the run' },
        );
      } else {
        const turns = num(params, 'turns');
        const o = overlap(start, psi);
        rows.push(
          { label: 'rotation angle, in turns of 2π', value: turns.toFixed(3) },
          { label: 'overlap ⟨ψ₀|ψ⟩ after the rotation, real part', value: done ? o.re.toFixed(9) : 'after the run' },
          { label: 'overlap, imaginary part', value: done ? o.im.toExponential(2) : 'after the run' },
          { label: 'overlap, closed form cos²ʲ(α/2)', value: (Math.cos(Math.PI * turns) ** (2 * j)).toFixed(9) },
        );
      }
      return rows;
    }

    return {
      setup,
      pace: () => pacer.report(sample >= SAMPLES, params),
      draw() {
        const take = ctx.thumbnail ? 40 : pacer.take(params);
        for (let k = 0; k < take && sample < SAMPLES; k++) advance();
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        // the Bloch sphere, tilted towards the reader, with the trail of ⟨J⟩/j
        const cx = W * 0.26;
        const cy = H * 0.5;
        const r = Math.min(W * 0.22, H * 0.4);
        const tiltV = 0.35;
        const proj = ([x, y, z]: [number, number, number]): [number, number] =>
          [cx + r * (x * 0.94 - y * 0.34), cy - r * (z * Math.cos(tiltV) + (x * 0.34 + y * 0.94) * Math.sin(tiltV) * -1)];
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.35), 1);
        g.lineWidth = 1;
        g.beginPath();
        g.arc(cx, cy, r, 0, 2 * Math.PI);
        g.stroke();
        g.beginPath();
        for (let k = 0; k <= 64; k++) {
          const a = (2 * Math.PI * k) / 64;
          const [x, y] = proj([Math.cos(a), Math.sin(a), 0]);
          if (k === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
        g.strokeStyle = rgba(ramp(pal, 0.8), 0.9);
        g.lineWidth = 1.4;
        g.beginPath();
        trail.forEach((v, k) => { const [x, y] = proj(v); if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); });
        g.stroke();
        const last = trail[trail.length - 1];
        if (last) {
          const [x, y] = proj(last);
          g.strokeStyle = rgba(ramp(pal, 0.1), 1);
          g.lineWidth = 2.5;
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(x, y);
          g.stroke();
        }
        g.fillStyle = rgba(fg, 0.75);
        g.font = '11px monospace';
        g.fillText('+z', cx - 6, cy - r - 6);
        g.fillText('⟨J⟩ / j', cx - r, cy + r + 16);
        // the measured curve against the closed form
        const x0 = W * 0.54;
        const w = W * 0.42;
        const y0 = H * 0.15;
        const h = H * 0.7;
        const lo = experiment === 'rabi' ? 0 : -1;
        const yOf = (v: number) => y0 + h - ((v - lo) / (1 - lo)) * h;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
        g.strokeRect(x0, y0, w, h);
        g.setLineDash([4, 3]);
        g.strokeStyle = rgba(fg, 0.7);
        g.beginPath();
        for (let k = 0; k <= 200; k++) {
          const t = (k / 200) * T;
          const xx = x0 + (k / 200) * w;
          if (k === 0) g.moveTo(xx, yOf(closed(t)));
          else g.lineTo(xx, yOf(closed(t)));
        }
        g.stroke();
        g.setLineDash([]);
        g.strokeStyle = rgba(ramp(pal, 0.85), 1);
        g.lineWidth = 1.6;
        g.beginPath();
        curve.forEach((v, k) => { const xx = x0 + (k / SAMPLES) * w; if (k === 0) g.moveTo(xx, yOf(v)); else g.lineTo(xx, yOf(v)); });
        g.stroke();
        g.fillStyle = rgba(fg, 0.75);
        g.fillText(experiment === 'rabi' ? 'flip probability (solid), Rabi’s formula (dashed)'
          : experiment === 'larmor' ? '⟨Jx⟩/j (solid), sin θ cos γB₀t (dashed)'
            : 'overlap ⟨ψ₀|ψ⟩ (solid), cos²ʲ(γBt/2) (dashed)', x0, y0 - 8);
        g.restore();
        ctx.stats(stats());
      },
    };
  },
};

export default spinPrecession;
