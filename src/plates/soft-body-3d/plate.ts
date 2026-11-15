import { bounded } from '../../core/budget';
import { mix, paletteParam, ramp, scale, type RGB } from '../../core/palette';
import { bool, num, str, type PlateCode, type Stat } from '../../core/plate';
import { runsParam, StreamStop } from '../_shared/settle/settle';
import {
  EnergyBaseline, STRUCTURAL, angularMomentum, centroid, energy, forces, framePlan, preset,
  rayleigh, stableStep, step, strain, totalMass, volume, worldKey,
  type Preset, type SoftBody, type World,
} from './softbody';

/** A run of the stop control is one simulated second, counted in nanoseconds. */
const NS_PER_S = 1e9;

/** Simulated seconds per frame: two-thirds speed at 60 frames per second. */
export const FRAME_TIME = 1 / 90;
/** A body slower than this (J of kinetic energy) for SETTLE_TIME seconds is dropped again. */
export const SETTLE_KE = 2e-3;
const SETTLE_TIME = 1.2;
/**
 * Spring evaluations one frame may spend. Every default experiment fits it at full speed, at
 * every resolution; a fine lattice at high stiffness, damping or steps runs in slow motion.
 */
export const WORK_PER_FRAME = 200_000;
/** Strain that saturates the colour ramp at either end. */
const STRAIN_COLOUR = 0.06;
const LIGHT = (() => {
  const l = [0.4, 0.85, 0.35];
  const n = Math.hypot(l[0], l[1], l[2]);
  return l.map((c) => c / n);
})();

export const softBody: PlateCode = {
  id: 'soft-body-3d',
  mode: 'webgl',
  aspect: 16 / 10,
  thumbnailFrames: 120,
  params: [
    {
      kind: 'select', key: 'preset', label: 'Experiment', value: 'cube', rebuild: true,
      options: [
        { value: 'cube', label: 'Drop a jelly cube' },
        { value: 'ball', label: 'Drop a ball with pressure' },
        { value: 'column', label: 'Wobbling column (pinned base)' },
      ],
    },
    { kind: 'range', key: 'res', label: 'Resolution (masses per side)', min: 3, max: 10, step: 1,
      value: 7, rebuild: true },
    { kind: 'range', key: 'stiffness', label: 'Stiffness', min: 40, max: 400, step: 10,
      value: 100 },
    { kind: 'range', key: 'damping', label: 'Damping (of critical)', min: 0, max: 0.5,
      step: 0.01, value: 0.1 },
    { kind: 'range', key: 'gravity', label: 'Gravity (m/s²)', min: 0, max: 20, step: 0.1,
      value: 9.8 },
    { kind: 'range', key: 'pressure', label: 'Gas pressure (ball)', min: 0, max: 40, step: 1,
      value: 20 },
    { kind: 'range', key: 'restitution', label: 'Restitution', min: 0, max: 1, step: 0.05,
      value: 0.3 },
    { kind: 'range', key: 'friction', label: 'Friction', min: 0, max: 1.5, step: 0.05,
      value: 0.6 },
    { kind: 'range', key: 'substeps', label: 'Steps per frame (minimum)', min: 2, max: 40,
      step: 1, value: 8 },
    // a stop costs nothing, so its top is not a budget's: past 1000 s a reader lets it run on (0)
    runsParam({ unit: 'simulated s', max: 1000,
      note: 'A step that would pass the k-th second is cut to the time left, so it stops on it; '
        + 'while it is set, a body at rest is not dropped again.' }),
    { kind: 'toggle', key: 'wire', label: 'Springs (tension wireframe)', value: false },
    { kind: 'toggle', key: 'spin', label: 'Auto-rotate', value: true },
    paletteParam('ember'),
  ],
  pace: { kind: 'stream', emergent: 'an integrator: its steps per frame set simulated time per frame, not counted events' },
  create(p, ctx) {
    const params = ctx.params;
    let b: SoftBody;
    let name: Preset = 'cube';
    let nodeStrain: Float64Array;
    let degree: Float64Array;
    let normals: Float64Array;
    let springStrain: Float64Array;
    const baseline = new EnergyBaseline();
    let t = 0;
    let quiet = 0;
    let drops = 0;
    let angle = 0;
    let contacts = 0;
    let history: [number, number, number, number, number][] = [];
    // the stable step depends only on the body and the world: recompute it when either changes
    let stable = { key: '', dt: 0 };
    const stop = new StreamStop(params, NS_PER_S);
    // free flight since the release: nothing pinned and no mass has touched the ground yet
    let flying = false;
    let launchedAt = 0;
    let l0: [number, number, number] = [0, 0, 0];
    let p0 = 0;
    let mass = 1;
    let lDrift = 0;
    let pDrift = 0;
    // the energy's largest change since the release or a control change, and Verlet's bound on it
    let worst = 0;
    let quotient = 0;
    let bound: number | null = null;

    // the bound is linear theory about an undeformed equilibrium: a pinned body that cannot
    // turn rigidly, no gravity to sag it, no damping to drain it, and no gas stiffness unread
    const applies = (w: World) => name === 'column' && w.gravity === 0 && w.damping === 0;

    const world = (): World => ({
      gravity: num(params, 'gravity'),
      ground: true,
      restitution: num(params, 'restitution'),
      friction: num(params, 'friction'),
      stiffness: num(params, 'stiffness'),
      damping: num(params, 'damping'),
      pressure: name === 'ball' ? num(params, 'pressure') : 0,
    });

    const launch = () => {
      b = preset(name, num(params, 'res'), ctx.rnd);
      nodeStrain = new Float64Array(b.n);
      degree = new Float64Array(b.n);
      normals = new Float64Array(b.n * 3);
      springStrain = new Float64Array(b.springs);
      for (let s = 0; s < b.springs; s++) {
        if (b.kind[s] !== STRUCTURAL) continue;
        degree[b.sa[s]]++;
        degree[b.sb[s]]++;
      }
      const w = world();
      forces(b, w);
      baseline.reset(w, energy(b, w).total, t);
      flying = !b.pinned.some((q) => q);
      launchedAt = t;
      l0 = angularMomentum(b);
      mass = totalMass(b);
      p0 = 0;
      for (let i = 0; i < b.n; i++) p0 += b.m[i] * b.v[i * 3 + 1];
      lDrift = 0;
      pDrift = 0;
      worst = 0;
      quotient = rayleigh(b, w);
      bound = null;
      stable = { key: '', dt: 0 };
      history = [];
      quiet = 0;
      drops++;
    };

    const measureStrain = () => {
      nodeStrain.fill(0);
      let sum = 0;
      let max = 0;
      for (let s = 0; s < b.springs; s++) {
        const e = strain(b, s);
        springStrain[s] = e;
        sum += Math.abs(e);
        if (Math.abs(e) > max) max = Math.abs(e);
        if (b.kind[s] !== STRUCTURAL) continue;
        nodeStrain[b.sa[s]] += e;
        nodeStrain[b.sb[s]] += e;
      }
      for (let i = 0; i < b.n; i++) if (degree[i]) nodeStrain[i] /= degree[i];
      return { mean: sum / b.springs, max };
    };

    const computeNormals = () => {
      normals.fill(0);
      const { x, faces } = b;
      for (let f = 0; f < faces.length; f += 3) {
        const a = faces[f] * 3;
        const c = faces[f + 1] * 3;
        const d = faces[f + 2] * 3;
        const ux = x[c] - x[a];
        const uy = x[c + 1] - x[a + 1];
        const uz = x[c + 2] - x[a + 2];
        const vx = x[d] - x[a];
        const vy = x[d + 1] - x[a + 1];
        const vz = x[d + 2] - x[a + 2];
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        normals[a] += nx;
        normals[a + 1] += ny;
        normals[a + 2] += nz;
        normals[c] += nx;
        normals[c + 1] += ny;
        normals[c + 2] += nz;
        normals[d] += nx;
        normals[d + 1] += ny;
        normals[d + 2] += nz;
      }
    };

    const strainColour = (e: number): RGB =>
      ramp(ctx.palette(), 0.5 + (0.5 * Math.max(-1, Math.min(1, e / STRAIN_COLOUR))));

    const drawFloor = (S: number) => {
      const R = 2.2;
      p.push();
      p.rotateX(Math.PI / 2);
      p.noStroke();
      p.fill(...mix(ctx.bg, ctx.fg, ctx.theme === 'dark' ? 0.045 : 0.035));
      p.circle(0, 0, 2 * R * S);
      p.pop();
      // grid fading out with distance from the centre
      const g = mix(ctx.bg, ctx.fg, 0.32);
      const fade = (u: number, v: number) => 90 * Math.max(0, 1 - Math.hypot(u, v) / R);
      p.strokeWeight(1);
      p.beginShape(p.LINES);
      const cell = 0.25;
      for (let a = -R; a <= R + 1e-9; a += cell) {
        for (let c = -R; c < R - 1e-9; c += cell) {
          p.stroke(g[0], g[1], g[2], fade(a, c));
          p.vertex(a * S, -0.5, c * S);
          p.stroke(g[0], g[1], g[2], fade(a, c + cell));
          p.vertex(a * S, -0.5, (c + cell) * S);
          p.stroke(g[0], g[1], g[2], fade(c, a));
          p.vertex(c * S, -0.5, a * S);
          p.stroke(g[0], g[1], g[2], fade(c + cell, a));
          p.vertex((c + cell) * S, -0.5, a * S);
        }
      }
      p.endShape();
    };

    const drawShadow = (S: number) => {
      const c = centroid(b);
      let x0 = Infinity;
      let x1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      for (let i = 0; i < b.n; i++) {
        x0 = Math.min(x0, b.x[i * 3]);
        x1 = Math.max(x1, b.x[i * 3]);
        z0 = Math.min(z0, b.x[i * 3 + 2]);
        z1 = Math.max(z1, b.x[i * 3 + 2]);
      }
      // a shadow under light from above: it widens and fades as the body rises
      const lift = Math.max(0, c[1]);
      const k = 1 / (1 + 1.4 * lift);
      const shade: RGB = ctx.theme === 'dark' ? [0, 0, 0] : scale(ctx.fg, 0.4);
      p.noStroke();
      for (let ring = 0; ring < 7; ring++) {
        const r = (1.45 - ring * 0.12) * (1 + 0.35 * lift);
        p.push();
        p.translate(((x0 + x1) / 2) * S, -1 - ring * 0.3, ((z0 + z1) / 2) * S);
        p.rotateX(Math.PI / 2);
        p.fill(shade[0], shade[1], shade[2], (ctx.theme === 'dark' ? 46 : 30) * k);
        p.ellipse(0, 0, (x1 - x0) * S * r, (z1 - z0) * S * r);
        p.pop();
      }
    };

    const drawBody = (S: number) => {
      const { x, faces } = b;
      computeNormals();
      p.noStroke();
      p.beginShape(p.TRIANGLES);
      for (let f = 0; f < faces.length; f++) {
        const q = faces[f];
        const o = q * 3;
        const len = Math.hypot(normals[o], normals[o + 1], normals[o + 2]) || 1;
        const lambert = Math.max(0, (normals[o] * LIGHT[0] + normals[o + 1] * LIGHT[1]
          + normals[o + 2] * LIGHT[2]) / len);
        const col = scale(strainColour(nodeStrain[q]), 0.32 + 0.78 * lambert);
        p.fill(col[0], col[1], col[2]);
        p.vertex(x[o] * S, -x[o + 1] * S, x[o + 2] * S);
      }
      p.endShape();
    };

    const drawSprings = (S: number) => {
      const { x } = b;
      p.strokeWeight(ctx.thumbnail ? 1 : 1.3);
      p.beginShape(p.LINES);
      for (let s = 0; s < b.springs; s++) {
        if (b.kind[s] !== STRUCTURAL) continue;
        const col = strainColour(springStrain[s]);
        p.stroke(col[0], col[1], col[2], 230);
        const a = b.sa[s] * 3;
        const c = b.sb[s] * 3;
        p.vertex(x[a] * S, -x[a + 1] * S, x[a + 2] * S);
        p.vertex(x[c] * S, -x[c + 1] * S, x[c + 2] * S);
      }
      p.endShape();
    };

    return {
      setup() {
        name = str(params, 'preset') as Preset;
        drops = 0;
        t = 0;
        angle = 0.7;
        stop.reset();
        launch();
      },
      draw() {
        const w = world();
        // step keeps the forces current; only a changed control makes them stale
        const key = worldKey(w);
        if (stable.key !== key) {
          forces(b, w);
          stable = { key, dt: stableStep(b, w) };
        }
        const rebased = baseline.track(w, () => energy(b, w).total, t);
        if (rebased) {
          history = [];
          // the bound is about a release from rest geometry; a changed world starts elsewhere
          worst = 0;
          quotient = 0;
        }
        const plan = framePlan(b, w, FRAME_TIME, num(params, 'substeps'), WORK_PER_FRAME,
          stable.dt);
        const { steps, dt } = plan;
        if (bound === null && quotient > 0) bound = (dt * dt * quotient) / 4;
        if (rebased) bound = null;
        const tick = Math.round(dt * NS_PER_S);
        let ran = 0;
        let whole = true;
        for (let s = 0; s < steps; s++) {
          // the stop: a step that would pass the k-th second is cut to the time left
          const left = stop.allow(tick);
          if (left <= 0) {
            whole = false;
            break;
          }
          const h = left === tick ? dt : left / NS_PER_S;
          if (h !== dt) whole = false;
          contacts = step(b, w, h);
          if (contacts) flying = false;
          ran += h;
          stop.advance(left);
        }
        // the plan's own time when the frame ran whole, so the default run is the same bit for bit
        const simulated = whole ? plan.simulated : ran;
        t += simulated;
        const e = energy(b, w);
        if (!Number.isFinite(e.total)) launch();
        worst = Math.max(worst, Math.abs(baseline.drift(e.total)));
        if (flying) {
          const l = angularMomentum(b);
          const size = Math.hypot(l0[0], l0[1], l0[2]);
          if (size > 0) lDrift = Math.max(lDrift, Math.hypot(l[0] - l0[0], l[1] - l0[1], l[2] - l0[2]) / size);
          let py = 0;
          for (let i = 0; i < b.n; i++) py += b.m[i] * b.v[i * 3 + 1];
          const fall = mass * w.gravity * (t - launchedAt);
          if (fall > 0) pDrift = Math.max(pDrift, Math.abs(py - p0 + fall) / fall);
        }
        quiet = e.kinetic < SETTLE_KE ? quiet + simulated : 0;
        if (quiet > SETTLE_TIME && !ctx.thumbnail && !stop.limit) launch();
        const st = measureStrain();

        p.background(...ctx.bg);
        if (!ctx.thumbnail) p.orbitControl(1, 1, 0.3);
        if (bool(params, 'spin')) angle += 0.003;
        const S = Math.min(ctx.width, ctx.height) * 0.4;
        p.rotateX(-0.38);
        p.rotateY(angle);
        p.translate(0, 0.75 * S, 0);
        drawFloor(S);
        drawShadow(S);
        if (bool(params, 'wire')) drawSprings(S);
        else drawBody(S);

        const drift = 100 * baseline.drift(e.total);
        const rows = [
          { label: 'total energy', value: `${e.total.toFixed(4)} J` },
          { label: 'energy change since release or last control change',
            value: `${drift.toFixed(3)} %` },
          { label: 'mean | max strain', value: `${(st.mean * 100).toFixed(2)} % | `
            + `${(st.max * 100).toFixed(1)} %` },
          { label: 'ground contacts', value: `${contacts} of ${b.n} masses` },
          { label: 'simulated time', value: `${t.toFixed(2)} s (drop ${drops})` },
          { label: 'steps per frame', value: `${bounded(steps, plan.need)}, dt `
            + `${(dt * 1000).toFixed(3)} ms` },
          { label: 'simulated per frame', value: `${(plan.simulated * 1000).toFixed(2)} ms`
            + (steps < plan.need ? `: slow motion, ${(100 * steps / plan.need).toFixed(0)} % `
              + 'of full speed (frame budget)' : '') },
        ];
        if (name === 'ball') {
          const ratio = volume(b) / b.restVolume;
          rows.push({ label: 'volume / rest volume', value: ratio.toFixed(3) });
        }
        const pinned = name === 'column';
        const phase = flying ? ' (in flight)' : ' (until it landed)';
        const extra: Stat[] = [
          { label: 'angular momentum about the mass centre, change in free flight',
            value: pinned ? '– (the base is pinned)' : `${lDrift.toExponential(2)}${phase}` },
          { label: 'momentum against −M·g·t, change in free flight',
            value: pinned ? '– (the base is pinned)' : w.gravity > 0
              ? `${pDrift.toExponential(2)}${phase}` : '– (no gravity)' },
          { label: 'largest energy change since release or last control change',
            value: `${(100 * worst).toExponential(2)} %` },
          { label: 'Verlet bound at release (dt²/4)·vᵀKv/vᵀMv',
            value: !applies(w) ? '– (the undamped column in zero gravity only)'
              : bound === null ? '– (a control changed since the release)'
                : `${(100 * bound).toExponential(2)} %` },
          ...stop.rows(),
        ];
        ctx.stats([...rows, ...extra]);
        if (!ctx.thumbnail) {
          history.push([t - baseline.since, e.kinetic, e.gravity, e.elastic + e.gas, e.total]);
          if (history.length > 600) history.shift();
          const series = (name: string, k: number) => ({
            name, points: history.filter((_, i) => i % 3 === 0).map((q) => [q[0], q[k]] as
              [number, number]),
          });
          ctx.chart({
            title: 'Energy since release or last control change',
            x: { label: 'simulated time (s)' },
            y: { label: 'energy (J)' },
            series: [series('Kinetic', 1), series('Gravitational', 2),
              series('Springs and gas', 3), series('Total', 4)],
          });
        }
      },
    };
  },
};

export default softBody;
