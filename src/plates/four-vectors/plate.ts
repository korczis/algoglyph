// Four-vectors and the field tensor (c = 1): what an observer moving at v along x measures of an
// electromagnetic field, of a collision's energy and momentum, and of the force a current exerts
// on a moving charge. A still diagram of the controls; every readout is computed, and each
// identity is read two independent ways (src/plates/_shared/lorentz).
import { paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type RangeParam, type Stat } from '../../core/plate';
import {
  add, boostFields, boostMomentum, boostTensor, fieldsOf, fieldTensor, gammaOf, invariants, mass,
  rapidityOf, type FourMomentum, type V3,
} from '../_shared/lorentz/lorentz';

const BETA: RangeParam = { kind: 'range', key: 'beta', label: 'Observer velocity v/c along x', min: -0.99, max: 0.99, step: 0.01, value: 0.6 };

export function sliderVelocities(d: RangeParam = BETA): number[] {
  const n = Math.round((d.max - d.min) / d.step);
  return Array.from({ length: n + 1 }, (_, i) => Number((d.min + i * d.step).toFixed(10)));
}

/** The field of a preset, in the lab. */
export function preset(name: string, e0: number, b0: number): { E: V3; B: V3 } {
  if (name === 'b') return { E: [0, 0, 0], B: [0, 0, b0] };
  if (name === 'crossed') return { E: [0, e0, 0], B: [0, 0, b0] };
  if (name === 'parallel') return { E: [0, e0, 0], B: [0, b0, 0] };
  if (name === 'oblique') return { E: [0.3 * e0, e0, 0.2 * e0], B: [0.4 * b0, -0.1 * b0, b0] };
  return { E: [0, e0, 0], B: [0, 0, 0] };
}

/** Largest change of E·B and of E² − B², relative to the field's scale, over every slider boost. */
export function invariantDrift(E: V3, B: V3, velocities: number[]): [number, number] {
  const [i1, i2] = invariants(E, B);
  const scale = Math.max(1e-300, E.reduce((s, x) => s + x * x, 0) + B.reduce((s, x) => s + x * x, 0));
  let d1 = 0; let d2 = 0;
  for (const v of velocities) {
    const f = boostFields(E, B, v);
    const [j1, j2] = invariants(f.E, f.B);
    d1 = Math.max(d1, Math.abs(j1 - i1)); d2 = Math.max(d2, Math.abs(j2 - i2));
  }
  return [d1 / scale, d2 / scale];
}

/** The field transformation two ways: the component formulas against F′ = Λ F Λᵀ. */
export function transformDefect(E: V3, B: V3, v: number): number {
  const a = boostFields(E, B, v);
  const b = fieldsOf(boostTensor(fieldTensor(E, B), rapidityOf(v)));
  let d = 0;
  for (let i = 0; i < 3; i++) d = Math.max(d, Math.abs(a.E[i] - b.E[i]), Math.abs(a.B[i] - b.B[i]));
  return d;
}

/** A beam of energy E (units of m) on a target of mass m at rest: the total four-momentum. */
export function fixedTarget(e: number): FourMomentum {
  const beam: FourMomentum = { e, p: [Math.sqrt(Math.max(0, e * e - 1)), 0, 0] };
  return add(beam, { e: 1, p: [0, 0, 0] });
}

/**
 * A neutral wire along x (c = 1, ε₀ = 1, so μ₀ = 1): ions at rest with line density +λ, electrons
 * drifting at w with −λ, current I = λ w. A charge q at distance r moving at u parallel to the wire.
 * In the lab the force is magnetic, q u λ w / (2π r) radially (away from the wire when u and w
 * share a sign: the charge's current then opposes the wire's). In the charge's own frame the
 * densities transform (γ factors of each species' velocity there), the wire is charged and the
 * force is electric, q λ′ / (2π r); a transverse force is γᵤ times larger there. Both ways, here.
 */
export function wireForces(lambda: number, w: number, u: number, r: number, q = 1): { lab: number; fromRest: number } {
  const lab = (q * u * lambda * w) / (2 * Math.PI * r);
  const gu = gammaOf(u);
  // velocities in the charge's frame: ions at −u, electrons at (w − u)/(1 − w u)
  const we = (w - u) / (1 - w * u);
  // a species' proper density λ₀ = λ / γ(its lab velocity), and λ′ = γ(its velocity in the frame) λ₀
  const ions = gu * lambda;
  const electrons = -gammaOf(we) * (lambda / gammaOf(w));
  const net = ions + electrons;
  // radial, positive away from the wire, in both frames
  const restForce = (q * net) / (2 * Math.PI * r);
  return { lab, fromRest: restForce / gu };
}

const exp = (v: number) => v.toExponential(2);

export const fourVectors: PlateCode = {
  id: 'four-vectors',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 2,
  params: [
    {
      kind: 'select', key: 'view', label: 'Show', value: 'fields',
      options: [
        { value: 'fields', label: 'An electromagnetic field seen from a moving frame' },
        { value: 'collision', label: 'A collision: invariant mass and threshold' },
        { value: 'wire', label: 'A current and a moving charge: magnetism from relativity' },
      ],
    },
    BETA,
    {
      kind: 'select', key: 'field', label: 'Field in the lab', value: 'e',
      options: [
        { value: 'e', label: 'E along y only' },
        { value: 'b', label: 'B along z only' },
        { value: 'crossed', label: 'Crossed E ⊥ B' },
        { value: 'parallel', label: 'E ∥ B' },
        { value: 'oblique', label: 'Oblique E and B' },
      ],
      when: { key: 'view', values: ['fields'] },
    },
    { kind: 'range', key: 'e0', label: 'E magnitude', min: 0, max: 2, step: 0.05, value: 1, when: { key: 'view', values: ['fields'] } },
    { kind: 'range', key: 'b0', label: 'B magnitude', min: 0, max: 2, step: 0.05, value: 0.5, when: { key: 'view', values: ['fields'] } },
    { kind: 'range', key: 'energy', label: 'Beam energy E, in units of m', min: 1, max: 20, step: 0.1, value: 7, when: { key: 'view', values: ['collision'] } },
    { kind: 'range', key: 'drift', label: 'Electron drift w/c', min: 0.01, max: 0.9, step: 0.01, value: 0.1, when: { key: 'view', values: ['wire'] } },
    { kind: 'range', key: 'u', label: 'Charge velocity u/c', min: -0.95, max: 0.95, step: 0.01, value: 0.5, when: { key: 'view', values: ['wire'] } },
    paletteParam('spectral'),
  ],
  pace: { kind: 'still', why: 'a diagram of the controls: it is redrawn as they change and nothing in it moves' },
  create(p, ctx) {
    const params = ctx.params;
    const arrow = (x: number, y: number, dx: number, dy: number, c: [number, number, number]) => {
      p.stroke(c[0], c[1], c[2]); p.strokeWeight(2.5);
      p.line(x, y, x + dx, y + dy);
      const a = Math.atan2(dy, dx); const h = 8;
      if (Math.hypot(dx, dy) < 2) return;
      p.line(x + dx, y + dy, x + dx - h * Math.cos(a - 0.4), y + dy - h * Math.sin(a - 0.4));
      p.line(x + dx, y + dy, x + dx - h * Math.cos(a + 0.4), y + dy - h * Math.sin(a + 0.4));
    };
    return {
      setup() {},
      draw() {
        const view = str(params, 'view');
        const v = num(params, 'beta');
        const g = gammaOf(v);
        const W = ctx.width; const H = ctx.height;
        const pal = ctx.palette();
        const fg = ctx.fg;
        const cE = ramp(pal, 0.2); const cB = ramp(pal, 0.8);
        p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
        p.textSize(Math.max(11, Math.min(15, W * 0.018)));
        const rows: Stat[] = [{ label: 'observer', value: `v = ${v.toFixed(2)} c, γ = ${g.toFixed(4)}` }];
        if (view === 'fields') {
          const { E, B } = preset(str(params, 'field'), num(params, 'e0'), num(params, 'b0'));
          const f = boostFields(E, B, v);
          const k = Math.min(W, H) * 0.12;
          // the y–z components drawn in two panels: lab, and the moving observer
          for (const [i, F] of [[0, { E, B }], [1, f]] as const) {
            const cx = W * (0.27 + 0.46 * i); const cy = H * 0.5;
            p.noStroke(); p.fill(fg[0], fg[1], fg[2], 200); p.textAlign(p.CENTER, p.TOP);
            p.text(i === 0 ? 'lab' : `observer at ${v.toFixed(2)} c`, cx, H * 0.08);
            p.stroke(fg[0], fg[1], fg[2], 60); p.strokeWeight(1);
            p.line(cx - k * 2, cy, cx + k * 2, cy); p.line(cx, cy - k * 2, cx, cy + k * 2);
            arrow(cx, cy, F.E[1] * k, -F.E[2] * k, cE);
            arrow(cx, cy, F.B[1] * k, -F.B[2] * k, cB);
            p.noStroke(); p.textAlign(p.LEFT, p.CENTER);
            p.fill(...cE); p.text(`E (${F.E[0].toFixed(2)} along x)`, cx - k * 2, cy + k * 2.3);
            p.fill(...cB); p.text(`B (${F.B[0].toFixed(2)} along x)`, cx - k * 2, cy + k * 2.3 + 20);
          }
          p.noStroke(); p.fill(fg[0], fg[1], fg[2], 170); p.textAlign(p.CENTER, p.BOTTOM);
          p.text('y to the right, z up; the boost is along x, out of the page', W / 2, H - 8);
          const vs = sliderVelocities();
          const [d1, d2] = invariantDrift(E, B, vs);
          const fmtV = (x: V3) => `(${x.map((c) => c.toFixed(3)).join(', ')})`;
          const [i1, i2] = invariants(E, B);
          const [j1, j2] = invariants(f.E, f.B);
          rows.push(
            { label: 'E in the lab, E′ seen', value: `${fmtV(E)} → ${fmtV(f.E)}` },
            { label: 'B in the lab, B′ seen', value: `${fmtV(B)} → ${fmtV(f.B)}` },
            { label: 'E·B, lab and moving', value: `${i1.toFixed(6)}, ${j1.toFixed(6)}` },
            { label: 'E² − B², lab and moving', value: `${i2.toFixed(6)}, ${j2.toFixed(6)}` },
            { label: 'largest relative change of E·B over every boost the slider allows', value: exp(d1) },
            { label: 'largest relative change of E² − B² over every boost the slider allows', value: exp(d2) },
            { label: 'field formulas against F′ = Λ F Λᵀ', value: exp(transformDefect(E, B, v)) },
          );
        } else if (view === 'collision') {
          const e = num(params, 'energy');
          const total = fixedTarget(e);
          const phi = rapidityOf(v);
          const seen = boostMomentum(total, phi);
          // the frame where the total momentum vanishes: v_cm = p / E
          const cm = boostMomentum(total, rapidityOf(total.p[0] / total.e));
          const sx = W * 0.8 / Math.max(total.e, 1) / 2;
          const ox = W * 0.1; const oy = H * 0.85;
          // energy against momentum: the hyperbola E² − p² = M², and the total in three frames
          p.noFill(); p.stroke(fg[0], fg[1], fg[2], 70); p.strokeWeight(1);
          const M = mass(total);
          p.beginShape();
          for (let i = -40; i <= 40; i++) { const px = (i / 40) * total.e * 1.5; p.vertex(ox + W * 0.4 + px * sx, oy - Math.sqrt(M * M + px * px) * sx * 0.4); }
          p.endShape();
          for (const [k4, c] of [[total, cE], [seen, cB], [cm, ramp(pal, 0.5)]] as const) {
            arrow(ox + W * 0.4, oy, k4.p[0] * sx, -k4.e * sx * 0.4, c as [number, number, number]);
          }
          rows.push(
            { label: 'invariant mass √s in the lab, units of m', value: M.toFixed(12) },
            { label: 'invariant mass √s seen by the observer', value: mass(seen).toFixed(12) },
            { label: 'energy in the centre-of-momentum frame', value: cm.e.toFixed(12) },
            { label: 'momentum left in that frame', value: exp(Math.abs(cm.p[0])) },
            { label: 'p p → p p p p̄ is open (√s ≥ 4m)', value: M >= 4 - 1e-12 ? 'yes' : 'no' },
          );
        } else {
          const w = num(params, 'drift'); const u = num(params, 'u');
          const r = 1; const lambda = 1;
          const fz = wireForces(lambda, w, u, r);
          // the wire, its ions and electrons, and the charge
          const y0 = H * 0.45;
          p.stroke(fg[0], fg[1], fg[2], 120); p.strokeWeight(6); p.line(W * 0.05, y0, W * 0.95, y0);
          p.noStroke();
          for (let i = 0; i < 20; i++) {
            p.fill(...cE); p.circle(W * (0.07 + i * 0.045), y0 - 8, 7);
            p.fill(...cB); p.circle(W * (0.09 + i * 0.045), y0 + 8, 7);
          }
          p.fill(...ramp(pal, 0.5)); p.circle(W * 0.5, H * 0.75, 16);
          arrow(W * 0.5, H * 0.75, 0, -Math.sign(fz.lab) * 50, ramp(pal, 0.5) as [number, number, number]);
          rows.push(
            { label: 'force in the lab, magnetic q u B', value: fz.lab.toExponential(9) },
            { label: 'force from the charge’s frame, electric, transformed back', value: fz.fromRest.toExponential(9) },
            { label: 'the two, relative difference', value: exp(Math.abs(fz.lab - fz.fromRest) / Math.max(1e-300, Math.abs(fz.lab))) },
          );
        }
        ctx.stats(rows);
      },
    };
  },
};

export default fourVectors;
