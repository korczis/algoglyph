// A polarisation bench and a plane interface (src/plates/_shared/optics/jones.ts): light through a
// polariser, an optional wave plate and an analyser, by Jones matrices and photon by photon by
// Born's rule; and Fresnel's reflection and transmission at an interface, with Brewster's angle found
// by bisection and total internal reflection. A reader's Malus curve is fitted for its amplitude,
// its axis and its extinction.
import { optionId } from '../../core/data';
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import {
  apply, cx, fresnel, intensity, matrixOf, photon, stokes, unitarityDefect, wavePlate, type Element, type Jones,
} from '../_shared/optics/jones';
import { rgba } from '../_shared/two-slit/draw';

/** The most photons a frame sends, at the pace control's top. */
export const MAX_PER_FRAME = 50;
const DEG = Math.PI / 180;
const f6 = (v: number) => v.toFixed(6);

type View = 'bench' | 'interface';

/** The input's Jones vectors and weights: one pure state, or unpolarised light as an equal mixture. */
export function inputStates(kind: string): { psi: Jones; w: number }[] {
  const r = Math.SQRT1_2;
  if (kind === 'v') return [{ psi: [cx(0), cx(1)], w: 1 }];
  if (kind === 'd') return [{ psi: [cx(r), cx(r)], w: 1 }];
  if (kind === 'r') return [{ psi: [cx(r), cx(0, -r)], w: 1 }];
  if (kind === 'unpolarised') return [{ psi: [cx(1), cx(0)], w: 0.5 }, { psi: [cx(0), cx(1)], w: 0.5 }];
  return [{ psi: [cx(1), cx(0)], w: 1 }];
}

/** The light reaching the first polariser in the direction θ, by its kind alone: cos² for linear
 * light at α, one half for circular and unpolarised light. */
export function firstPass(kind: string, theta: number): number {
  const alpha = kind === 'v' ? Math.PI / 2 : kind === 'd' ? Math.PI / 4 : 0;
  if (kind === 'r' || kind === 'unpolarised') return 0.5;
  return Math.cos(theta - alpha) ** 2;
}

/**
 * I(θ) = a + b cos 2θ + c sin 2θ by least squares (the normal equations of three unknowns, solved by
 * Cramer's rule), which is A cos²(θ − θ₀) + B: amplitude A = 2√(b² + c²), axis θ₀ = ½ atan2(c, b),
 * floor B = a − √(b² + c²).
 */
export function fitMalus(deg: ArrayLike<number>, I: ArrayLike<number>): { A: number; axis: number; floor: number; rms: number } {
  const n = deg.length;
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const y = [0, 0, 0];
  for (let k = 0; k < n; k++) {
    const t = 2 * deg[k] * DEG;
    const f = [1, Math.cos(t), Math.sin(t)];
    for (let i = 0; i < 3; i++) { y[i] += f[i] * I[k]; for (let j = 0; j < 3; j++) S[i][j] += f[i] * f[j]; }
  }
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(S);
  const sol = [0, 1, 2].map((c) => det(S.map((row, i) => row.map((v, j) => (j === c ? y[i] : v)))) / (D || 1));
  const [a, b, c] = sol;
  const h = Math.hypot(b, c);
  let ss = 0;
  for (let k = 0; k < n; k++) { const t = 2 * deg[k] * DEG; ss += (I[k] - (a + b * Math.cos(t) + c * Math.sin(t))) ** 2; }
  return { A: 2 * h, axis: ((0.5 * Math.atan2(c, b)) / DEG + 180) % 180, floor: a - h, rms: Math.sqrt(ss / Math.max(1, n)) };
}

/** The incidence where r_p changes sign, by bisection on (0°, 90°): Brewster's angle, found from the
 * amplitudes alone. */
export function brewsterByBisection(n1: number, n2: number): number {
  const rp = (a: number) => fresnel(n1, n2, a).rp[0];
  let lo = 1e-9;
  let hi = Math.PI / 2 - 1e-9;
  if (n1 > n2) hi = Math.min(hi, Math.asin(n2 / n1) - 1e-12);
  for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (Math.sign(rp(m)) === Math.sign(rp(lo))) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

export const polarizationBench: PlateCode = {
  id: 'polarization-bench',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'view', label: 'Show', value: 'bench', rebuild: true,
      options: [
        { value: 'bench', label: 'A bench: polariser, a plate, an analyser' },
        { value: 'interface', label: 'Reflection and refraction at an interface' },
      ],
    },
    {
      kind: 'select', key: 'input', label: 'Light in', value: 'h', rebuild: true,
      options: [
        { value: 'h', label: 'Horizontal' }, { value: 'v', label: 'Vertical' }, { value: 'd', label: 'Diagonal, 45°' },
        { value: 'r', label: 'Circular' }, { value: 'unpolarised', label: 'Unpolarised' },
      ],
      when: { key: 'view', values: ['bench'] },
    },
    { kind: 'range', key: 'theta1', label: 'Polariser axis, °', min: 0, max: 180, step: 1, value: 30, rebuild: true, when: { key: 'view', values: ['bench'] } },
    {
      kind: 'select', key: 'middle', label: 'Between them', value: 'none', rebuild: true,
      options: [
        { value: 'none', label: 'Nothing' }, { value: 'polariser', label: 'A third polariser' },
        { value: 'quarter', label: 'A quarter-wave plate' }, { value: 'half', label: 'A half-wave plate' },
      ],
      when: { key: 'view', values: ['bench'] },
    },
    { kind: 'range', key: 'theta2', label: 'Middle element’s axis, °', min: 0, max: 180, step: 1, value: 45, rebuild: true, when: { key: 'view', values: ['bench'] } },
    { kind: 'range', key: 'theta3', label: 'Analyser axis, °', min: 0, max: 180, step: 1, value: 90, rebuild: true, when: { key: 'view', values: ['bench'] } },
    { kind: 'range', key: 'n1', label: 'Index n₁ (incident side)', min: 1, max: 2.5, step: 0.05, value: 1, rebuild: true, when: { key: 'view', values: ['interface'] } },
    { kind: 'range', key: 'n2', label: 'Index n₂', min: 1, max: 2.5, step: 0.05, value: 1.5, rebuild: true, when: { key: 'view', values: ['interface'] } },
    { kind: 'range', key: 'incidence', label: 'Angle of incidence, °', min: 0, max: 89, step: 1, value: 56, rebuild: true, when: { key: 'view', values: ['interface'] } },
    {
      kind: 'select', key: 'pol', label: 'Photons polarised', value: 's', rebuild: true,
      options: [{ value: 's', label: 's, normal to the plane of incidence' }, { value: 'p', label: 'p, in the plane of incidence' }],
      when: { key: 'view', values: ['interface'] },
    },
    { kind: 'range', key: 'photons', label: 'Photons', min: 100, max: 20000, step: 100, value: 600, rebuild: true },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'photons' },
  create(p, ctx) {
    const params = ctx.params;
    let pacer = new Pacer('replay', 'photons', MAX_PER_FRAME);
    let view: View | 'data' = 'bench';
    let rnd = mulberry32(1);
    let bench: Element[] = [];
    let states: { psi: Jones; w: number }[] = [];
    let predicted = 0;
    let fixed: Stat[] = [];
    let sent = 0;
    let through = 0;
    let total = 0;
    let fates: number[] = [];
    let rows: Stat[] = [];
    let curve: { deg: ArrayLike<number>; I: ArrayLike<number>; fit: ReturnType<typeof fitMalus> } | null = null;

    function benchSetup() {
      const t1 = num(params, 'theta1') * DEG;
      const t2 = num(params, 'theta2') * DEG;
      const t3 = num(params, 'theta3') * DEG;
      const mid = str(params, 'middle');
      bench = [{ kind: 'polariser', theta: t1 }];
      if (mid === 'polariser') bench.push({ kind: 'polariser', theta: t2 });
      if (mid === 'quarter') bench.push({ kind: 'plate', theta: t2, delta: Math.PI / 2 });
      if (mid === 'half') bench.push({ kind: 'plate', theta: t2, delta: Math.PI });
      bench.push({ kind: 'polariser', theta: t3 });
      const kind = str(params, 'input');
      states = inputStates(kind);
      let out: [number, number, number, number] = [0, 0, 0, 0];
      predicted = 0;
      for (const { psi, w } of states) {
        let v = psi;
        for (const e of bench) v = apply(matrixOf(e), v);
        predicted += w * intensity(v);
        const s = stokes(v);
        out = out.map((x, i) => x + w * s[i]) as typeof out;
      }
      fixed = [{ label: 'transmitted intensity, Jones', value: f6(predicted) }];
      // the closed forms: Malus's law through two polarisers, and a half-wave plate mirroring the
      // polarisation about its axis
      const first = firstPass(kind, t1);
      if (mid === 'none') fixed.push({ label: 'Malus, cos²(θ₃ − θ₁) after the first polariser', value: f6(first * Math.cos(t3 - t1) ** 2) });
      if (mid === 'polariser') fixed.push({ label: 'Malus twice, cos²(θ₂ − θ₁) cos²(θ₃ − θ₂)', value: f6(first * Math.cos(t2 - t1) ** 2 * Math.cos(t3 - t2) ** 2) });
      if (mid === 'half') fixed.push({ label: 'the half-wave plate mirrors θ₁ to 2θ₂ − θ₁: cos²(θ₃ − 2θ₂ + θ₁)', value: f6(first * Math.cos(t3 - 2 * t2 + t1) ** 2) });
      const s0 = out[0] || 1;
      fixed.push(
        { label: 'Stokes S₁/S₀, S₂/S₀, S₃/S₀ out', value: out[0] > 1e-12 ? `${f6(out[1] / s0)}, ${f6(out[2] / s0)}, ${f6(out[3] / s0)}` : 'no light' },
        { label: 'largest |J†J − I| of the wave plates (numerics)', value: unitarityDefect(wavePlate(t2, mid === 'half' ? Math.PI : Math.PI / 2)).toExponential(2) },
      );
    }

    function interfaceSetup() {
      const n1 = num(params, 'n1');
      const n2 = num(params, 'n2');
      const a = num(params, 'incidence') * DEG;
      const f = fresnel(n1, n2, a);
      const pol = str(params, 'pol');
      predicted = pol === 'p' ? f.Rp : f.Rs;
      const crit = n1 > n2 ? Math.asin(n2 / n1) / DEG : null;
      fixed = [
        { label: 'transmission angle θt, °', value: f.total ? 'none: totally reflected' : f6(Math.acos(f.cosT[0]) / DEG) },
        { label: 'Rs, Ts', value: `${f6(f.Rs)}, ${f6(f.Ts)}` },
        { label: 'Rp, Tp', value: `${f6(f.Rp)}, ${f6(f.Tp)}` },
        { label: 'Rs + Ts', value: f6(f.Rs + f.Ts) },
        { label: 'Rp + Tp', value: f6(f.Rp + f.Tp) },
        { label: 'normal incidence ((n₁ − n₂)/(n₁ + n₂))²', value: f6(((n1 - n2) / (n1 + n2)) ** 2) },
        { label: 'Brewster’s angle, where r_p changes sign, by bisection, °', value: f6(brewsterByBisection(n1, n2) / DEG) },
        { label: 'atan(n₂/n₁), °', value: f6(Math.atan(n2 / n1) / DEG) },
        { label: 'critical angle asin(n₂/n₁), °', value: crit === null ? 'none: n₂ ≥ n₁' : f6(crit) },
        { label: 'phase of r_s, °', value: f6((Math.atan2(f.rs[1], f.rs[0]) / DEG + 360) % 360) },
      ];
    }

    function measure(): Stat[] {
      if (view === 'data') {
        if (!curve) return [{ label: 'Input', value: 'your data: none attached; attach a table of angle, intensity' }];
        const { fit } = curve;
        return [
          { label: 'Input', value: `your data, ${curve.deg.length} readings of a Malus curve` },
          { label: 'fitted amplitude A of A cos²(θ − θ₀) + B', value: f6(fit.A) },
          { label: 'fitted axis θ₀, °', value: f6(fit.axis) },
          { label: 'fitted floor B', value: f6(fit.floor) },
          { label: 'extinction B/(A + B)', value: f6(fit.floor / Math.max(1e-300, fit.A + fit.floor)) },
          { label: 'rms residual', value: f6(fit.rms) },
        ];
      }
      const se = Math.sqrt(Math.max(1e-300, predicted * (1 - predicted)) / Math.max(1, sent));
      const frac = sent ? through / sent : 0;
      return [
        pacer.row(params),
        { label: 'Input', value: view === 'bench' ? `seeded photons, ${str(params, 'input')} light` : `seeded photons, ${str(params, 'pol')}-polarised` },
        ...fixed,
        { label: view === 'bench' ? 'photons through, of those sent' : 'photons reflected, of those sent', value: `${through} of ${sent}` },
        { label: 'photon fraction minus the prediction, in standard errors', value: sent && predicted > 0 && predicted < 1 ? ((frac - predicted) / se).toFixed(3) : '0' },
      ];
    }

    function send(): void {
      sent++;
      if (view === 'bench') {
        // unpolarised light: each photon is horizontal or vertical, at random
        const pick = states.length > 1 && rnd() < 0.5 ? 1 : 0;
        const fate = photon(states[pick].psi, bench, rnd);
        if (fate === -1) through++;
        fates.push(fate);
      } else {
        const hit = rnd() < predicted;
        if (hit) through++;
        fates.push(hit ? 1 : 0);
      }
      if (fates.length > 60) fates.shift();
    }

    return {
      setup() {
        const raw = str(params, 'view');
        rnd = mulberry32(Math.floor(ctx.rnd() * 0x7fffffff) + 1);
        sent = 0; through = 0; fates = [];
        curve = null;
        if (optionId(raw)) {
          view = 'data';
          const table = ctx.data?.(optionId(raw) ?? '') ?? null;
          if (table) curve = { deg: table.values[0], I: table.values[1], fit: fitMalus(table.values[0], table.values[1]) };
          pacer = new Pacer('replay', 'photons', MAX_PER_FRAME);
          total = 1;
          pacer.start(1);
        } else {
          view = raw as View;
          if (view === 'bench') benchSetup(); else interfaceSetup();
          total = num(params, 'photons');
          pacer = new Pacer('replay', 'photons', MAX_PER_FRAME);
          pacer.start(total);
        }
        rows = measure();
      },
      pace: () => pacer.report(view === 'data' ? sent >= 1 : sent >= total, params),
      draw() {
        if (view === 'data') sent = 1;
        else {
          const take = ctx.thumbnail ? MAX_PER_FRAME : pacer.take(params);
          for (let k = 0; k < take && sent < total; k++) send();
        }
        rows = measure();
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        g.font = '11px monospace';
        if (view === 'bench') {
          // the elements on the beam, each with its axis, and the polarisation ellipse between them
          const y = H * 0.45;
          const xs = bench.map((_, k) => W * (0.2 + (0.6 * (k + 1)) / (bench.length + 1)));
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.4), 1);
          g.beginPath(); g.moveTo(W * 0.05, y); g.lineTo(W * 0.95, y); g.stroke();
          const R = Math.min(H * 0.16, W * 0.07);
          const ellipse = (cx0: number, v: Jones) => {
            g.beginPath();
            for (let k = 0; k <= 64; k++) {
              const ph = (2 * Math.PI * k) / 64;
              const ex = v[0][0] * Math.cos(ph) + v[0][1] * Math.sin(ph);
              const ey = v[1][0] * Math.cos(ph) + v[1][1] * Math.sin(ph);
              const px = cx0 + ex * R * 0.8;
              const py = y - ey * R * 0.8;
              if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
            }
            g.stroke();
          };
          let v = states[0].psi;
          g.strokeStyle = rgba(ramp(pal, 0.85), 1);
          g.lineWidth = 2;
          ellipse(W * 0.12, v);
          bench.forEach((e, k) => {
            g.strokeStyle = rgba(fg, 0.8);
            g.lineWidth = 1.5;
            g.beginPath(); g.arc(xs[k], y, R, 0, 2 * Math.PI); g.stroke();
            g.beginPath();
            g.moveTo(xs[k] - Math.cos(e.theta) * R, y + Math.sin(e.theta) * R);
            g.lineTo(xs[k] + Math.cos(e.theta) * R, y - Math.sin(e.theta) * R);
            g.stroke();
            g.fillStyle = rgba(fg, 0.75);
            g.fillText(e.kind === 'polariser' ? 'polariser' : e.delta === Math.PI ? 'λ/2 plate' : 'λ/4 plate', xs[k] - R, y + R + 16);
            v = apply(matrixOf(e), v);
            const s = Math.sqrt(intensity(v));
            if (s > 1e-9) {
              g.strokeStyle = rgba(ramp(pal, 0.85), 1);
              g.lineWidth = 2;
              const nx = k + 1 < xs.length ? (xs[k] + xs[k + 1]) / 2 : W * 0.9;
              ellipse(nx, v);
            }
          });
          // the last photons: absorbed at an element (dot under it) or through (dot at the detector)
          fates.forEach((f, k) => {
            const x = f === -1 ? W * 0.95 : xs[f];
            g.fillStyle = rgba(f === -1 ? ramp(pal, 0.9) : mix(ctx.bg, fg, 0.5), 1);
            g.fillRect(x - 2, H * 0.75 + (k % 10) * 6, 4, 4);
          });
          g.fillStyle = rgba(fg, 0.75);
          g.fillText('the polarisation along the beam (Jones); the last photons, absorbed or through', W * 0.05, H * 0.08);
        } else if (view === 'interface') {
          // the ray picture on the left, R and T against the angle on the right
          const n1 = num(params, 'n1');
          const n2 = num(params, 'n2');
          const a = num(params, 'incidence') * DEG;
          const f = fresnel(n1, n2, a);
          const ox = W * 0.25;
          const oy = H * 0.5;
          const L = Math.min(W * 0.2, H * 0.4);
          g.fillStyle = rgba(mix(ctx.bg, ramp(pal, 0.3), 0.25 + 0.1 * (n2 - 1)), 1);
          g.fillRect(W * 0.03, oy, W * 0.44, H * 0.45);
          const pol = str(params, 'pol');
          const R = pol === 'p' ? f.Rp : f.Rs;
          const T = pol === 'p' ? f.Tp : f.Ts;
          const ray = (ang: number, len: number, w: number, down: boolean) => {
            g.lineWidth = Math.max(0.5, 6 * w);
            g.beginPath(); g.moveTo(ox, oy);
            g.lineTo(ox + Math.sin(ang) * len, oy + (down ? 1 : -1) * Math.cos(ang) * len);
            g.stroke();
          };
          g.strokeStyle = rgba(ramp(pal, 0.85), 1);
          ray(-a, L, 1, false);
          ray(a, L, R, false);
          if (!f.total) ray(Math.acos(Math.min(1, f.cosT[0])), L, T, true);
          const px = W * 0.55;
          const pw = W * 0.4;
          const top = H * 0.12;
          const ph = H * 0.7;
          g.strokeStyle = rgba(fg, 0.3);
          g.lineWidth = 1;
          g.strokeRect(px, top, pw, ph);
          for (const [which, colour] of [['s', ramp(pal, 0.2)], ['p', ramp(pal, 0.8)]] as const) {
            g.strokeStyle = rgba(colour, 1);
            g.lineWidth = 2;
            g.beginPath();
            for (let k = 0; k <= 180; k++) {
              const th = (k / 180) * 89.9 * DEG;
              const q = fresnel(n1, n2, th);
              const r = which === 's' ? q.Rs : q.Rp;
              const xx = px + (k / 180) * pw;
              const yy = top + ph - r * ph;
              if (k === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
            }
            g.stroke();
          }
          g.strokeStyle = rgba(fg, 0.7);
          g.setLineDash([3, 3]);
          g.beginPath(); g.moveTo(px + (a / DEG / 90) * pw, top); g.lineTo(px + (a / DEG / 90) * pw, top + ph); g.stroke();
          g.setLineDash([]);
          g.fillStyle = rgba(fg, 0.75);
          g.fillText('Rs (dark) and Rp (bright) against the angle of incidence, 0° to 90°', px, top - 8);
        } else if (curve) {
          // the reader's readings and the fitted Malus curve
          const px = W * 0.1;
          const pw = W * 0.8;
          const top = H * 0.12;
          const ph = H * 0.72;
          const peak = Math.max(1e-12, ...Array.from(curve.I), curve.fit.A + curve.fit.floor);
          g.strokeStyle = rgba(fg, 0.3);
          g.strokeRect(px, top, pw, ph);
          g.fillStyle = rgba(ramp(pal, 0.85), 1);
          for (let k = 0; k < curve.deg.length; k++) {
            const xx = px + ((((curve.deg[k] % 360) + 360) % 360) / 360) * pw;
            g.fillRect(xx - 2, top + ph - (curve.I[k] / peak) * ph - 2, 4, 4);
          }
          g.strokeStyle = rgba(fg, 0.85);
          g.beginPath();
          for (let k = 0; k <= 360; k++) {
            const v = curve.fit.A * Math.cos((k - curve.fit.axis) * DEG) ** 2 + curve.fit.floor;
            const xx = px + (k / 360) * pw;
            const yy = top + ph - (v / peak) * ph;
            if (k === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
          }
          g.stroke();
          g.fillStyle = rgba(fg, 0.75);
          g.fillText('your readings and the fitted A cos²(θ − θ₀) + B, θ from 0° to 360°', px, top - 8);
        }
        g.restore();
        ctx.stats(rows);
      },
    };
  },
};

export default polarizationBench;
