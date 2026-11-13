// Modified nodal analysis (src/plates/_shared/lumped/mna.ts) held to what it does not compute: the
// impedances of a series circuit and the two loop equations of a transformer written out by hand,
// the bilinear-transform identity of the trapezoidal rule and its measured second order against
// the phasor at ω, the half of the energy lost in charging a capacitor, the infinite ladder's
// attenuation, Kirchhoff's current law, and a refusal for a floating node.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  complexSolve, kclResidual, ladder, luFactor, luSolve, phasor, steadyState, transient, type Netlist,
} from '../src/plates/_shared/lumped/mna';

const series = (R: number, L = 1, C = 1): Netlist => ({
  nodes: 3, elements: [{ kind: 'V', a: 1, b: 0, value: 1 }, { kind: 'R', a: 1, b: 2, value: R },
    { kind: 'L', a: 2, b: 3, value: L }, { kind: 'C', a: 3, b: 0, value: C }],
});

describe('mna: the linear algebra', () => {
  it('complex elimination solves a system whose solution is known', () => {
    // a random system built from a known solution
    const rnd = mulberry32(5);
    const n = 6;
    const xr = Array.from({ length: n }, () => rnd() - 0.5);
    const xi = Array.from({ length: n }, () => rnd() - 0.5);
    const ar = Array.from({ length: n }, () => Float64Array.from({ length: n }, () => rnd() - 0.5));
    const ai = Array.from({ length: n }, () => Float64Array.from({ length: n }, () => rnd() - 0.5));
    const br = new Float64Array(n);
    const bi = new Float64Array(n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      br[r] += ar[r][c] * xr[c] - ai[r][c] * xi[c];
      bi[r] += ar[r][c] * xi[c] + ai[r][c] * xr[c];
    }
    expect(complexSolve(ar.map((r) => r.slice()), ai.map((r) => r.slice()), br, bi)).toBe(true);
    for (let k = 0; k < n; k++) {
      expect(Math.abs(br[k] - xr[k])).toBeLessThan(1e-12);
      expect(Math.abs(bi[k] - xi[k])).toBeLessThan(1e-12);
    }
  });

  it('LU with partial pivoting solves a real system, including one that needs a row swap', () => {
    const A = [Float64Array.from([0, 2, 1]), Float64Array.from([1, 1, 0]), Float64Array.from([3, 0, 1])];
    const x = [1, -2, 3];
    const b = Float64Array.from(A.map((r) => r[0] * x[0] + r[1] * x[1] + r[2] * x[2]));
    const lu = A.map((r) => r.slice());
    const perm = luFactor(lu)!;
    luSolve(lu, perm, b, new Float64Array(3));
    x.forEach((v, k) => expect(Math.abs(b[k] - v)).toBeLessThan(1e-14));
  });

  it('refuses a node that floats', () => {
    const net: Netlist = { nodes: 3, elements: [{ kind: 'V', a: 1, b: 0, value: 1 }, { kind: 'R', a: 1, b: 0, value: 1 },
      { kind: 'C', a: 2, b: 3, value: 1 }] };
    expect(phasor(net, 1).singular).toBe(true);
    expect(transient(net, 0.01, () => 1).singular).toBe(true);
  });
});

describe('mna: phasors against impedances written out', () => {
  it('the series circuit carries V/|R + j(ωL − 1/ωC)| at the phase −atan((ωL − 1/ωC)/R)', () => {
    for (const w of [0.3, 0.9, 1, 1.7, 4]) {
      const s = phasor(series(0.2, 2, 0.5), w);
      const X = 2 * w - 1 / (0.5 * w);
      expect(Math.abs(Math.hypot(s.ir[1], s.ii[1]) - 1 / Math.hypot(0.2, X)), `ω ${w}`).toBeLessThan(1e-12);
      expect(Math.abs(Math.atan2(s.ii[1], s.ir[1]) + Math.atan2(X, 0.2)), `ω ${w}`).toBeLessThan(1e-12);
    }
  });

  it('a transformer’s ratio is jωMR/(jωL₁R − ω²L₁L₂(1 − k²)), and the turns ratio at k = 1', () => {
    for (const [k, n, R] of [[0.9, 2, 3], [0.5, 0.5, 1], [1, 3, 0.2]]) {
      const L2 = n * n;
      const net: Netlist = { nodes: 2, elements: [{ kind: 'V', a: 1, b: 0, value: 1 }, { kind: 'L', a: 1, b: 0, value: 1 },
        { kind: 'L', a: 2, b: 0, value: L2 }, { kind: 'R', a: 2, b: 0, value: R }], couplings: [{ l1: 1, l2: 2, k }] };
      const s = phasor(net, 1.3);
      const M = k * n;
      const want = (1.3 * M * R) / Math.hypot(-1.69 * L2 * (1 - k * k), 1.3 * R);
      expect(Math.abs(Math.hypot(s.vr[2], s.vi[2]) - want), `k ${k}`).toBeLessThan(1e-12);
      if (k === 1) expect(Math.abs(Math.hypot(s.vr[2], s.vi[2]) - n)).toBeLessThan(1e-12);
    }
  });

  it('the infinite ladder’s stop band: 2 acosh(ω/ω_c) nepers a section in the middle of a long one', () => {
    for (const r of [1.1, 1.5, 3]) {
      const N = 32;
      const s = phasor(ladder(N), 2 * r);
      const m = (k: number) => Math.hypot(s.vr[k], s.vi[k]);
      expect(Math.abs(Math.log(m(10) / m(26)) / 16 - 2 * Math.acosh(r)), `ratio ${r}`).toBeLessThan(1e-6);
    }
  });
});

describe('mna: the trapezoidal transient', () => {
  const lock = (net: Netlist, w: number, S: number) => steadyState(net, w, S, 30 * 20, (_v, i) => i[1]);

  it('its steady state is the phasor at the warped frequency (2/h)tan(ωh/2): the bilinear transform', () => {
    for (const w of [0.7, 1, 1.4]) {
      const net = series(0.1);
      const h = (2 * Math.PI) / w / 100;
      const s = phasor(net, (2 / h) * Math.tan((w * h) / 2));
      expect(Math.abs(lock(net, w, 100).amplitude / Math.hypot(s.ir[1], s.ii[1]) - 1), `ω ${w}`).toBeLessThan(1e-9);
    }
  });

  it('and its gap from the phasor at ω is second order in the step', () => {
    const net = series(0.1);
    const ac = phasor(net, 0.95);
    const gap = (S: number) => Math.abs(lock(net, 0.95, S).amplitude / Math.hypot(ac.ir[1], ac.ii[1]) - 1);
    expect(Math.abs(Math.log2(gap(100) / gap(200)) - 2)).toBeLessThan(0.2);
  });

  it('charging a capacitor from a step turns half the source’s energy into heat, for any R', () => {
    for (const R of [0.1, 1, 10]) {
      const net: Netlist = { nodes: 2, elements: [{ kind: 'V', a: 1, b: 0, value: 1 }, { kind: 'R', a: 1, b: 2, value: R },
        { kind: 'C', a: 2, b: 0, value: 1 }] };
      const h = R / 200;
      const tr = transient(net, h, () => 1);
      let ER = 0;
      let last = 0;
      for (let k = 0; k < 25 * 200; k++) {
        tr.step();
        // Kirchhoff at one time constant, while the current is still of order V/R
        if (k === 200) expect(kclResidual(net, tr.i)).toBeLessThan(1e-9);
        const p = tr.i[1] ** 2 * R;
        ER += 0.5 * h * (p + last);
        last = p;
      }
      // the source delivered CV² = 1: half of it is heat
      expect(Math.abs(ER - 0.5), `R ${R}`).toBeLessThan(1e-6);
    }
  });
});
