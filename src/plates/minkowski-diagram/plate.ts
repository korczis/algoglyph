// A Minkowski diagram (c = 1): the axes of a frame S, the axes of a frame S′ moving at v along x,
// the light cone, and a scene of events and worldlines read in both frames. Nothing moves: the
// picture is a function of the controls, and every readout is computed from the scene, with the
// identities of src/plates/_shared/lorentz checked over every boost the velocity slider allows.
import { paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type RangeParam, type Stat } from '../../core/plate';
import {
  addVelocities, boost, boostMatrix, gammaOf, hyperbolic, hyperbolicTau, interval, multiply,
  properTime, rapidityOf, twin, twinTau, type Event, type Worldline,
} from '../_shared/lorentz/lorentz';

const BETA: RangeParam = { kind: 'range', key: 'beta', label: 'Velocity of S′, v/c', min: -0.95, max: 0.95, step: 0.01, value: 0.5 };

/** Every velocity the slider can be set to: the boosts the invariance readout is taken over. */
export function sliderVelocities(d: RangeParam = BETA): number[] {
  const n = Math.round((d.max - d.min) / d.step);
  return Array.from({ length: n + 1 }, (_, i) => Number((d.min + i * d.step).toFixed(10)));
}

/** The events of a scene, in S. */
export function sceneEvents(scene: string, a: number, T: number): Event[] {
  if (scene === 'rod') return [{ t: 0, x: 1 }, { t: 0, x: 3 }, { t: 2, x: 1 }, { t: 2, x: 3 }];
  if (scene === 'twins') {
    const w = twin(a, T);
    return [{ t: 0, x: 0 }, { t: T / 2, x: w.x(T / 2) }, { t: T, x: 0 }];
  }
  // simultaneity: three events at one time in S, flashes at the ends and the middle of a train
  return [{ t: 1, x: -2 }, { t: 1, x: 0 }, { t: 1, x: 2 }, { t: 3, x: 1 }];
}

/**
 * The largest change of s² between events, relative to the largest |s²| of the scene, over every
 * boost the slider allows: zero up to rounding, because the boost preserves the interval.
 */
export function intervalDrift(events: Event[], velocities: number[]): number {
  let scale = 1e-300;
  let worst = 0;
  const pairs: [Event, Event][] = [];
  for (let i = 0; i < events.length; i++) for (let j = i + 1; j < events.length; j++) pairs.push([events[i], events[j]]);
  for (const [a, b] of pairs) scale = Math.max(scale, Math.abs(interval(a, b)));
  for (const v of velocities) {
    const phi = rapidityOf(v);
    for (const [a, b] of pairs) worst = Math.max(worst, Math.abs(interval(boost(a, phi), boost(b, phi)) - interval(a, b)));
  }
  return worst / scale;
}

/** The largest element of the difference between boosting by φ₁ then φ₂ and by φ₁ + φ₂ at once. */
export function compositionDefect(u: number, v: number): number {
  const two = multiply(boostMatrix(rapidityOf(v)), boostMatrix(rapidityOf(u)));
  const one = boostMatrix(rapidityOf(u) + rapidityOf(v));
  let d = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) d = Math.max(d, Math.abs(two[i][j] - one[i][j]));
  return d;
}

/** The rod of the rod scene, at rest in S between x = 1 and 3, measured in S′ at one t′: the
 * distance between where its two ends cross t′ = 0, solved on each end's worldline. */
export function rodInPrime(v: number): number {
  const phi = rapidityOf(v);
  // an end at rest at x0 in S is the worldline (t, x0); t′ = 0 there when t = v x0
  const at = (x0: number) => boost({ t: v * x0, x: x0 }, phi).x;
  return at(3) - at(1);
}

export const minkowskiDiagram: PlateCode = {
  id: 'minkowski-diagram',
  mode: '2d',
  aspect: 1,
  thumbnailFrames: 2,
  params: [
    {
      kind: 'select', key: 'scene', label: 'Scene', value: 'simultaneity',
      options: [
        { value: 'simultaneity', label: 'Simultaneity: flashes along a train' },
        { value: 'rod', label: 'A rod at rest in S, measured in S′' },
        { value: 'twins', label: 'The twins: out and back at proper acceleration a' },
      ],
    },
    BETA,
    { kind: 'range', key: 'u', label: 'A second velocity u, for composition', min: -0.95, max: 0.95, step: 0.01, value: 0.6 },
    { kind: 'range', key: 'accel', label: 'Proper acceleration a (1/time)', min: 0.1, max: 4, step: 0.1, value: 1,
      when: { key: 'scene', values: ['twins'] } },
    { kind: 'range', key: 'T', label: 'Trip in S, coordinate time T', min: 1, max: 12, step: 0.5, value: 8,
      when: { key: 'scene', values: ['twins'] } },
    paletteParam('spectral'),
  ],
  pace: { kind: 'still', why: 'a diagram of the controls: it is redrawn as they change and nothing in it moves' },
  create(p, ctx) {
    const params = ctx.params;
    return {
      setup() {},
      draw() {
        const scene = str(params, 'scene');
        const v = num(params, 'beta');
        const u = num(params, 'u');
        const a = num(params, 'accel');
        const T = num(params, 'T');
        const phi = rapidityOf(v);
        const events = sceneEvents(scene, a, T);
        const W = ctx.width; const H = ctx.height;
        const twins = scene === 'twins';
        const span = twins ? Math.max(T, 4) * 1.1 : 4.4;
        // the twins' trip runs upward from the bottom edge; the other scenes are centred
        const s = twins ? (0.9 * H) / span : Math.min(W, H) / (2 * span);
        const ox = W / 2; const oy = twins ? H * 0.95 : H / 2;
        const X = (x: number) => ox + x * s;
        const Y = (t: number) => oy - t * s;
        const pal = ctx.palette();
        const fg = ctx.fg;
        // lines run past the canvas on every side
        const reach = Math.max(W, H) / s;
        p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
        p.strokeWeight(1);
        // the light cone through the origin
        p.stroke(...ramp(pal, 0.15), 200);
        p.line(X(-reach), Y(-reach), X(reach), Y(reach));
        p.line(X(-reach), Y(reach), X(reach), Y(-reach));
        // S: t and x axes
        p.stroke(fg[0], fg[1], fg[2], 160);
        p.line(X(-reach), Y(0), X(reach), Y(0));
        p.line(X(0), Y(-reach), X(0), Y(reach));
        // S′: t′ axis is x = v t, x′ axis is t = v x; its grid of lines of constant t′ and x′
        const prime = ramp(pal, 0.85);
        const g = gammaOf(v);
        for (let k = -6; k <= 6; k++) {
          // t′ = k is the line t = v x + k/γ, and x′ = k the line x = v t + k/γ
          p.stroke(prime[0], prime[1], prime[2], k === 0 ? 230 : 55);
          const c = k / g;
          p.line(X(-reach), Y(v * -reach + c), X(reach), Y(v * reach + c));
          p.line(X(v * -reach + c), Y(-reach), X(v * reach + c), Y(reach));
        }
        // axis names, where each axis leaves the picture
        p.noStroke();
        p.textSize(Math.max(12, Math.min(16, W * 0.02)));
        p.fill(fg[0], fg[1], fg[2], 210);
        p.text('t', X(0) + 6, 18);
        p.text('x', W - 16, Y(0) - 6);
        p.fill(prime[0], prime[1], prime[2]);
        const top = (oy - 18) / s;
        p.text('t′', Math.min(W - 20, X(v * top) + 6), 18);
        p.text('x′', W - 22, Math.max(14, Y(v * ((W - 16 - ox) / s)) - 6));
        // the scene
        const ev = ramp(pal, 0.55);
        if (scene === 'twins') {
          const w: Worldline = twin(a, T);
          p.noFill();
          p.stroke(ev[0], ev[1], ev[2], 230);
          p.strokeWeight(2);
          p.beginShape();
          for (let i = 0; i <= 200; i++) { const t = (T * i) / 200; p.vertex(X(w.x(t)), Y(t)); }
          p.endShape();
          p.stroke(fg[0], fg[1], fg[2], 200);
          p.line(X(0), Y(0), X(0), Y(T));
        }
        if (scene === 'rod') {
          p.noStroke();
          p.fill(ev[0], ev[1], ev[2], 60);
          p.quad(X(1), Y(-reach), X(3), Y(-reach), X(3), Y(reach), X(1), Y(reach));
        }
        p.noStroke();
        p.fill(ev[0], ev[1], ev[2]);
        for (const e of events) p.circle(X(e.x), Y(e.t), Math.max(6, s * 0.12));

        const velocities = sliderVelocities();
        const drift = intervalDrift(events, velocities);
        const rows: Stat[] = [
          { label: 'S′ moves at', value: `v = ${v.toFixed(2)} c, γ = ${g.toFixed(4)}, rapidity φ = ${phi.toFixed(4)}` },
          { label: 'events in S′ (t′, x′)', value: events.map((e) => { const q = boost(e, phi); return `(${q.t.toFixed(2)}, ${q.x.toFixed(2)})`; }).join(' ') },
          { label: 'largest relative change of s² over every boost the slider allows', value: drift.toExponential(2) },
          { label: '(u + v)/(1 + uv)', value: addVelocities(u, v).toFixed(15) },
          { label: 'tanh(φᵤ + φᵥ)', value: Math.tanh(rapidityOf(u) + rapidityOf(v)).toFixed(15) },
          { label: 'boost by φᵤ then φᵥ, against one by φᵤ + φᵥ', value: compositionDefect(u, v).toExponential(2) },
        ];
        if (scene === 'simultaneity') {
          const tp = events.slice(0, 3).map((e) => boost(e, phi).t);
          rows.push({ label: 'spread of t′ over the three flashes simultaneous in S', value: (Math.max(...tp) - Math.min(...tp)).toFixed(4) });
          rows.push({ label: 'the same spread in closed form, γ v Δx', value: (g * Math.abs(v) * 4).toFixed(4) });
        }
        if (scene === 'rod') {
          rows.push({ label: 'rod length in S′ at one t′', value: rodInPrime(v).toFixed(12) });
          rows.push({ label: 'rest length / γ', value: (2 / g).toFixed(12) });
        }
        if (scene === 'twins') {
          const traveller = properTime(twin(a, T));
          const out = properTime(hyperbolic(a, T / 4));
          rows.push({ label: 'traveller ages, by quadrature', value: traveller.tau.toFixed(12) });
          rows.push({ label: 'traveller ages, 4 asinh(aT/4)/a', value: twinTau(a, T).toFixed(12) });
          rows.push({ label: 'the twin at home ages', value: T.toFixed(12) });
          rows.push({ label: 'first leg, by quadrature', value: out.tau.toFixed(12) });
          rows.push({ label: 'first leg, asinh(aT)/a of hyperbolic motion', value: hyperbolicTau(a, T / 4).toFixed(12) });
          rows.push({ label: 'evaluations of √(1 − v²)', value: traveller.evals.toLocaleString('en') });
        }
        ctx.stats(rows);
      },
    };
  },
};

export default minkowskiDiagram;
