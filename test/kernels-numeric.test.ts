// Every live numeric kernel of the catalogue, checked by one harness: the run it hands the plate
// is well formed and reproducible for every option, and each kernel's result agrees with an
// independent reference (closed forms, brute force, BigInt, published constants).
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { ParamDef, Params } from '../src/core/plate';
import { gaussian, mulberry32 } from '../src/core/random';
import { logSlope, Meter, type NumericKernel, type NumericRun } from '../src/engines/numeric/trace';

import * as adaptive from '../src/kernels/numeric/adaptive-quadrature';
import * as additive from '../src/kernels/numeric/additive-congruential';
import * as spline from '../src/kernels/numeric/cubic-splines';
import * as euclid from '../src/kernels/numeric/euclid-gcd';
import * as gauss from '../src/kernels/numeric/gaussian-elimination';
import * as horner from '../src/kernels/numeric/horner-evaluation';
import * as hurst from '../src/kernels/numeric/hurst-dfa';
import * as karatsuba from '../src/kernels/numeric/karatsuba';
import * as lsq from '../src/kernels/numeric/least-squares';
import * as lcg from '../src/kernels/numeric/linear-congruential';
import * as lyap from '../src/kernels/numeric/lyapunov-exponent';
import * as pareto from '../src/kernels/numeric/pareto-front';
import * as pca from '../src/kernels/numeric/pca-svd';
import * as poincare from '../src/kernels/numeric/poincare-section';
import * as interp from '../src/kernels/numeric/polynomial-interpolation';
import * as rec from '../src/kernels/numeric/recurrence-plot';
import * as simplex from '../src/kernels/numeric/simplex-method';
import * as simpson from '../src/kernels/numeric/simpson-quadrature';
import * as strassen from '../src/kernels/numeric/strassen';
import * as takens from '../src/kernels/numeric/takens-embedding';
import * as topsis from '../src/kernels/numeric/topsis';
import { falseNeighbours, firstMinimum, mutualInformation } from '../src/kernels/numeric/_embed';
import { INTEGRANDS } from '../src/kernels/numeric/_functions';
import { lstsq, matmul, transpose, vandermonde, type Mat } from '../src/kernels/numeric/_linalg';
import { logisticSeries, lorenzOrbit, noise } from '../src/kernels/numeric/_systems';

const modules = import.meta.glob<NumericKernel>('../src/kernels/numeric/[!_]*.ts', { import: 'kernel', eager: true });
const live = ENTRIES.filter((e) => e.engine === 'numeric' && e.status === 'live');
const kernelOf = (id: string) => modules[`../src/kernels/numeric/${id}.ts`];

const defaults = (defs: ParamDef[] = []): Params => Object.fromEntries(defs.map((d) => [d.key, d.value]));
const close = (a: number, b: number, tol: number) => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(tol);

function wellFormed(run: NumericRun, label: string) {
  expect(run.panels.length, label).toBeGreaterThan(0);
  for (const p of run.panels) {
    for (const r of [p.x, p.y]) {
      expect(Number.isFinite(r[0]) && Number.isFinite(r[1]), `${label} ${p.title} range`).toBe(true);
      expect(r[1], `${label} ${p.title}`).toBeGreaterThan(r[0]);
    }
  }
  expect(run.steps.length, label).toBeGreaterThan(0);
  for (const s of run.steps) {
    expect(s.stats.length, label).toBeGreaterThan(0);
    for (const st of s.stats) {
      expect(st.value, `${label} ${st.label}`).not.toMatch(/NaN|MISMATCH|undefined/);
      expect(st.value.length).toBeGreaterThan(0);
    }
    for (const L of s.layers) expect(L.panel ?? 0, label).toBeLessThan(run.panels.length);
    const chart = s.chart ?? run.chart;
    for (const ser of chart?.series ?? []) {
      for (const [x, y] of ser.points) expect(Number.isFinite(x) && !Number.isNaN(y), `${label} chart ${ser.name}`).toBe(true);
    }
  }
}

describe('numeric kernels', () => {
  it('every live numeric entry has its kernel and every kernel its entry', () => {
    const files = Object.keys(modules).map((f) => f.replace(/^.*\/(.*)\.ts$/, '$1')).sort();
    expect(files).toEqual(live.map((e) => e.id).sort());
  });

  it('every live numeric entry has an independent reference check', () => {
    for (const e of live) expect(Object.keys(REFERENCES), e.id).toContain(e.id);
  });

  for (const e of live) {
    const kernel = kernelOf(e.id);
    describe(e.id, () => {
      it('hands the plate a well-formed, reproducible run for every option', () => {
        const base = defaults(kernel.params);
        const variants: Params[] = [base];
        for (const d of kernel.params ?? []) {
          if (d.kind === 'select') for (const o of d.options) if (o.value !== d.value) variants.push({ ...base, [d.key]: o.value });
          if (d.kind === 'range') variants.push({ ...base, [d.key]: d.min }, { ...base, [d.key]: d.max });
          if (d.kind === 'toggle') variants.push({ ...base, [d.key]: !d.value });
        }
        for (const params of variants) {
          const label = `${e.id} ${JSON.stringify(params)}`;
          const a = kernel.run({ seed: 17, params });
          wellFormed(a, label);
          const b = kernel.run({ seed: 17, params });
          expect(b.steps[b.steps.length - 1].stats, label).toEqual(a.steps[a.steps.length - 1].stats);
        }
        if (kernel.probe) {
          for (const s of kernel.probe.measure({ seed: 3, params: base })) {
            expect(s.points.length).toBeGreaterThan(1);
            for (const [x, y] of s.points) expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
          }
        }
      });

      it('agrees with an independent reference', () => {
        REFERENCES[e.id]?.();
      });
    });
  }
});

// --- independent references -------------------------------------------------------------------

/** Determinant by the Leibniz permutation sum. */
function leibniz(A: Mat): number {
  const n = A.length;
  let total = 0;
  const perm = (p: number[], rest: number[]) => {
    if (!rest.length) {
      let inv = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (p[i] > p[j]) inv++;
      total += (inv % 2 ? -1 : 1) * p.reduce((s, c, r) => s * A[r][c], 1);
      return;
    }
    rest.forEach((c, k) => perm([...p, c], [...rest.slice(0, k), ...rest.slice(k + 1)]));
  };
  perm([], A.map((_, i) => i));
  return total;
}

/** Solve by Cramer's rule with Leibniz determinants. */
function cramer(A: Mat, b: number[]): number[] {
  const d = leibniz(A);
  return A.map((_, j) => leibniz(A.map((r, i) => r.map((v, k) => (k === j ? b[i] : v)))) / d);
}

function randomMat(rnd: () => number, r: number, c: number): Mat {
  return Array.from({ length: r }, () => Array.from({ length: c }, () => 2 * rnd() - 1));
}

/** Orthonormal columns by modified Gram–Schmidt. */
function orthonormal(A: Mat): Mat {
  const cols = transpose(A);
  const out: number[][] = [];
  for (const c of cols) {
    let v = c.slice();
    for (const q of out) { const d = v.reduce((s, x, i) => s + x * q[i], 0); v = v.map((x, i) => x - d * q[i]); }
    const n = Math.hypot(...v);
    out.push(v.map((x) => x / n));
  }
  return transpose(out);
}

const REFERENCES: Record<string, () => void> = {
  'simpson-quadrature': () => {
    close(simpson.trapezoid((x) => 3 * x + 1, 0, 2, 3), 8, 1e-12);
    close(simpson.simpson((x) => x ** 3 - 2 * x, 0, 1, 2), 0.25 - 1, 1e-12);
    for (const [key, g] of Object.entries(INTEGRANDS)) {
      close(simpson.simpson(g.f, g.a, g.b, 2048), g.exact, key === 'sqrt' ? 1e-5 : 1e-7);
    }
    // the order of each rule: error against the number of panels, before rounding sets in
    const ns = [8, 16, 32, 64, 128];
    const order = (rule: typeof simpson.trapezoid) => logSlope(ns.map((n) => [n, Math.abs(rule(Math.sin, 0, Math.PI, n) - 2)] as [number, number]));
    close(order(simpson.trapezoid), -2, 0.02);
    close(order(simpson.simpson), -4, 0.05);
    const { trap, simp } = simpson.convergence('sine');
    trap.forEach(([e], i) => { expect(e).toBe(2 ** (i + 1) + 1); expect(simp[i][0]).toBe(e); });
  },

  'adaptive-quadrature': () => {
    for (const [key, g] of Object.entries(INTEGRANDS)) {
      const r = adaptive.adaptiveSimpson(g.f, g.a, g.b, 1e-9);
      close(r.value, g.exact, 1e-7);
      // every node is evaluated once: three to start, two per examined interval
      expect(r.evals, key).toBe(3 + 2 * r.pieces.length);
      expect(new Set(r.nodes.map((q) => q[0])).size, key).toBe(r.nodes.length);
      const accepted = r.pieces.filter((q) => q.accepted);
      close(accepted.reduce((s, q) => s + (q.b - q.a), 0), g.b - g.a, 1e-12);
    }
    // on a sharp peak, adaptivity reaches an error with fewer evaluations than uniform panels
    const g = INTEGRANDS.peak;
    const r = adaptive.adaptiveSimpson(g.f, g.a, g.b, 1e-8);
    const err = Math.abs(r.value - g.exact);
    let n = 2;
    while (Math.abs(simpson.simpson(g.f, g.a, g.b, n) - g.exact) > err) n += 2;
    expect(r.evals).toBeLessThan(n + 1);
  },

  'polynomial-interpolation': () => {
    const rnd = mulberry32(5);
    const xs = [-0.9, -0.3, 0.2, 0.5, 0.95];
    const ys = xs.map(() => rnd());
    const c = interp.dividedDifferences(xs, ys);
    xs.forEach((x, i) => close(interp.newtonEval(xs, c, x), ys[i], 1e-12));
    // Lagrange's form of the same polynomial, written out independently
    const lagrange = (x: number) => ys.reduce((s, y, i) => s + y * xs.reduce((p, xj, j) => (j === i ? p : (p * (x - xj)) / (xs[i] - xj)), 1), 0);
    for (let k = 0; k < 20; k++) { const x = 2 * rnd() - 1; close(interp.newtonEval(xs, c, x), lagrange(x), 1e-10); }
    // a cubic is reproduced exactly by four or more nodes
    const cubic = (x: number) => 2 * x ** 3 - x + 0.5;
    const p = interp.interpolant(cubic, 'equal', 6);
    for (let k = 0; k <= 10; k++) close(p(-1 + k / 5), cubic(-1 + k / 5), 1e-12);
    // Runge: equal spacing diverges, Chebyshev converges
    const eq = interp.errors('runge', 'equal'); const ch = interp.errors('runge', 'chebyshev');
    const at = (s: [number, number][], n: number) => s.find((q) => q[0] === n)![1];
    expect(at(eq, 21)).toBeGreaterThan(at(eq, 11));
    expect(at(ch, 21)).toBeLessThan(at(ch, 11));
    expect(at(ch, 21)).toBeLessThan(0.02);
  },

  'cubic-splines': () => {
    const xs = [0, 0.3, 0.45, 1, 1.6];
    const lin = spline.naturalSpline(xs, xs.map((x) => 2 * x - 1));
    for (let k = 0; k <= 16; k++) close(lin.at(k / 10), (2 * k) / 10 - 1, 1e-12);
    const rnd = mulberry32(9);
    const ys = xs.map(() => rnd());
    const s = spline.naturalSpline(xs, ys);
    xs.forEach((x, i) => close(s.at(x), ys[i], 1e-12));
    close(s.curvature(xs[0]), 0, 1e-12);
    close(s.curvature(xs[xs.length - 1]), 0, 1e-12);
    expect(spline.slopeJump(s)).toBeLessThan(1e-5);
    // the tridiagonal solve against Cramer's rule
    const a = [0, 1, 2, 1]; const b = [4, 5, 6, 4]; const c = [1, 2, 1, 0]; const d = [1, 2, 3, 4];
    const T: Mat = b.map((v, i) => b.map((_, j) => (j === i ? v : j === i - 1 ? a[i] : j === i + 1 ? c[i] : 0)));
    spline.tridiagonal(a, b, c, d).forEach((v, i) => close(v, cramer(T, d)[i], 1e-12));
    // fourth-order convergence for sin πx on [0, 1], whose ends have zero curvature
    const err = (n: number) => {
      const k = Array.from({ length: n }, (_, i) => i / (n - 1));
      const sp = spline.naturalSpline(k, k.map((x) => Math.sin(Math.PI * x)));
      return Math.max(...Array.from({ length: 401 }, (_, i) => Math.abs(sp.at(i / 400) - Math.sin((Math.PI * i) / 400))));
    };
    expect(err(11) / err(21)).toBeGreaterThan(12);
  },

  'least-squares': () => {
    const rnd = mulberry32(21);
    const X = randomMat(rnd, 30, 4); const y = Array.from({ length: 30 }, () => rnd());
    const { beta, residual } = lstsq(X, y);
    // the normal equations XᵀX b = Xᵀy, solved by Cramer's rule
    const Xt = transpose(X);
    const ref = cramer(matmul(Xt, X), Xt.map((r) => r.reduce((s, v, i) => s + v * y[i], 0)));
    beta.forEach((v, i) => close(v, ref[i], 1e-10));
    for (const r of Xt) close(r.reduce((s, v, i) => s + v * residual[i], 0), 0, 1e-12);
    // a noiseless cubic is recovered exactly
    const xs = Array.from({ length: 20 }, (_, i) => -1 + i / 10);
    const fit = lstsq(vandermonde(xs, 3), xs.map((x) => 1 - 2 * x + 0.5 * x ** 3));
    [1, -2, 0, 0.5].forEach((v, i) => close(fit.beta[i], v, 1e-10));
    // a straight line: slope = cov / var
    const ly = xs.map((x) => 3 * x + 0.1 * gaussian(rnd));
    const mx = xs.reduce((s, v) => s + v, 0) / xs.length; const my = ly.reduce((s, v) => s + v, 0) / ly.length;
    const slope = xs.reduce((s, x, i) => s + (x - mx) * (ly[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    close(lstsq(vandermonde(xs, 1), ly).beta[1], slope, 1e-10);
    expect(lsq.kernel.run({ seed: 1, params: { target: 'sine', samples: 24, noise: 0.05 } }).steps.length).toBeGreaterThan(5);
  },

  'horner-evaluation': () => {
    const rnd = mulberry32(2);
    for (let d = 1; d <= 12; d++) {
      const a = Array.from({ length: d + 1 }, () => Math.floor(rnd() * 19) - 9);
      const x = Math.floor(rnd() * 7) - 3;
      const big = a.reduce((s, c, k) => s + BigInt(c) * BigInt(x) ** BigInt(k), 0n);
      const m = new Meter();
      expect(BigInt(horner.horner(a, x, m))).toBe(big);
      expect(m.get('mul')).toBe(d);
      expect(m.get('add')).toBe(d);
      const mn = new Meter(); const mr = new Meter();
      expect(BigInt(horner.naive(a, x, mn))).toBe(big);
      expect(BigInt(horner.runningPowers(a, x, mr))).toBe(big);
      expect(mn.get('mul')).toBe((d * (d + 1)) / 2);
      expect(mr.get('mul')).toBe(2 * d - 1);
    }
  },

  karatsuba: () => {
    const rnd = mulberry32(3);
    for (let t = 0; t < 40; t++) {
      const a = Array.from({ length: 1 + Math.floor(rnd() * 40) }, () => Math.floor(rnd() * 21) - 10);
      const b = Array.from({ length: 1 + Math.floor(rnd() * 40) }, () => Math.floor(rnd() * 21) - 10);
      expect(karatsuba.karatsuba(a, b)).toEqual(karatsuba.schoolbook(a, b));
    }
    for (let k = 0; k <= 7; k++) {
      const n = 2 ** k;
      const m = new Meter();
      karatsuba.karatsuba(new Array(n).fill(1), new Array(n).fill(1), m);
      expect(m.get('mul')).toBe(3 ** k);
    }
    const digits = Array.from({ length: 30 }, () => Math.floor(rnd() * 10));
    const other = Array.from({ length: 30 }, () => Math.floor(rnd() * 10));
    digits[29] ||= 1; other[29] ||= 1;
    const A = BigInt(digits.slice().reverse().join('')); const B = BigInt(other.slice().reverse().join(''));
    expect(karatsuba.carry(karatsuba.karatsuba(digits, other))).toBe((A * B).toString());
  },

  strassen: () => {
    const rnd = mulberry32(4);
    for (const n of [1, 2, 4, 8, 16]) {
      const A = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.floor(rnd() * 21) - 10));
      const B = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.floor(rnd() * 21) - 10));
      const m = new Meter();
      expect(strassen.strassen(A, B, m)).toEqual(matmul(A, B));
      expect(m.get('mul')).toBe(7 ** Math.log2(n));
    }
  },

  'gaussian-elimination': () => {
    const rnd = mulberry32(6);
    for (const n of [2, 3, 4, 5]) {
      const A = randomMat(rnd, n, n); const b = Array.from({ length: n }, () => rnd());
      const s = gauss.gauss(A, b);
      cramer(A, b).forEach((v, i) => close(s.x[i], v, 1e-9));
      close(s.det, leibniz(A), 1e-10);
      expect(gauss.residual(A, s.x, b)).toBeLessThan(1e-12);
    }
    // a tiny first pivot ruins elimination without pivoting and not with it
    const q = gauss.system('tiny-pivot', 6, 8);
    const with_ = gauss.gauss(q.A, q.b, true); const without = gauss.gauss(q.A, q.b, false);
    const err = (x: number[]) => Math.max(...x.map((v, i) => Math.abs(v - q.x[i])));
    expect(err(with_.x)).toBeLessThan(1e-10);
    expect(err(without.x)).toBeGreaterThan(1e-6);
  },

  'pca-svd': () => {
    const rnd = mulberry32(7);
    // X = Q1 diag(s) Q2ᵀ with known singular values
    const s = [5, 2, 1, 0.25];
    const Q1 = orthonormal(randomMat(rnd, 40, 4)); const Q2 = orthonormal(randomMat(rnd, 4, 4));
    const X = matmul(Q1.map((r) => r.map((v, j) => v * s[j])), transpose(Q2));
    const svd = pca.jacobiSVD(X);
    svd.s.forEach((v, i) => close(v, s[i], 1e-10));
    const back = matmul(svd.U.map((r) => r.map((v, j) => v * svd.s[j])), transpose(svd.V));
    back.forEach((r, i) => r.forEach((v, j) => close(v, X[i][j], 1e-10)));
    const I = (M: Mat) => matmul(transpose(M), M).forEach((r, i) => r.forEach((v, j) => close(v, i === j ? 1 : 0, 1e-10)));
    I(svd.U); I(svd.V);
    // 2 × 2: singular values from the closed-form eigenvalues of XᵀX
    const Y = randomMat(rnd, 2, 2);
    const G = matmul(transpose(Y), Y);
    const tr = G[0][0] + G[1][1]; const det = G[0][0] * G[1][1] - G[0][1] * G[1][0];
    const l1 = tr / 2 + Math.sqrt(tr * tr / 4 - det); const l2 = tr / 2 - Math.sqrt(tr * tr / 4 - det);
    const y = pca.jacobiSVD(Y);
    close(y.s[0], Math.sqrt(l1), 1e-10);
    close(y.s[1], Math.sqrt(Math.max(0, l2)), 1e-10);
  },

  'linear-congruential': () => {
    for (const g of Object.values(lcg.GENERATORS)) {
      const xs = lcg.stream(g, 12345 % g.m | 1, 200);
      let x = BigInt(12345 % g.m | 1);
      for (const v of xs) { x = (BigInt(g.a) * x + BigInt(g.c)) % BigInt(g.m); expect(v).toBe(Number(x)); }
    }
    // full period (Hull–Dobell) for the toy generator, and Brent against a table of first visits
    const toy = lcg.GENERATORS.toy;
    expect(lcg.period(toy, 5)).toBe(256);
    const small = { a: 21, c: 0, m: 1000, label: '' };
    const seen = new Map<number, number>();
    let v = 7; let i = 0;
    while (!seen.has(v)) { seen.set(v, i++); v = lcg.step(small, v); }
    expect(lcg.period(small, 7)).toBe(i - seen.get(v)!);
    // ν₂ against a brute-force search of the dual lattice
    for (const g of [toy, lcg.GENERATORS.small]) {
      let best = Infinity;
      const B = 400;
      for (let u2 = 0; u2 <= B; u2++) for (let u1 = -B; u1 <= B; u1++) {
        if (!u1 && !u2) continue;
        if ((((u1 + g.a * u2) % g.m) + g.m) % g.m === 0) best = Math.min(best, Math.hypot(u1, u2));
      }
      close(lcg.spectral2(g), best, 1e-9);
    }
    // RANDU's triples lie on planes 9x − 6y + z = const (since a = 2^16 + 3)
    const r = lcg.spectral3(lcg.GENERATORS.randu);
    close(r.nu, Math.sqrt(118), 1e-12);
    const randu = lcg.stream(lcg.GENERATORS.randu, 1, 300);
    for (let k = 0; k + 2 < randu.length; k++) expect(((9 * randu[k] - 6 * randu[k + 1] + randu[k + 2]) % 2 ** 31 + 2 ** 31) % 2 ** 31).toBe(0);
  },

  'additive-congruential': () => {
    const init = additive.seedTable(11);
    const g = additive.additive(init);
    const x = init.slice();
    for (let n = 55; n < 3000; n++) x.push((x[n - 24] + x[n - 55]) % 2 ** 30);
    for (let n = 55; n < 3000; n++) expect(g.next()).toBe(x[n]);
    for (let n = 55; n < 3000; n++) expect(x[n] & 1).toBe((x[n - 24] ^ x[n - 55]) & 1);
    // lags (1, 2) mod 10 is the Fibonacci sequence mod 10, whose period (Pisano) is 60
    const fib = additive.additive([0, 1], 1, 2, 10);
    const out = [0, 1];
    for (let k = 0; k < 130; k++) out.push(fib.next());
    let p = 1;
    while (!(out[p] === 0 && out[p + 1] === 1)) p++;
    expect(p).toBe(60);
  },

  'euclid-gcd': () => {
    const rnd = mulberry32(12);
    for (let t = 0; t < 200; t++) {
      const a = 1 + Math.floor(rnd() * 5000); const b = 1 + Math.floor(rnd() * 5000);
      let brute = 1;
      for (let d = Math.min(a, b); d >= 1; d--) if (a % d === 0 && b % d === 0) { brute = d; break; }
      expect(euclid.gcd(a, b)).toBe(brute);
      const [g, x, y] = euclid.extended(a, b);
      expect(g).toBe(brute);
      expect(a * x + b * y).toBe(g);
      expect(euclid.divisions(Math.max(a, b), Math.min(a, b)).length).toBeLessThanOrEqual(5 * String(Math.min(a, b)).length);
    }
    for (let k = 3; k < 30; k++) expect(euclid.divisions(euclid.fibonacci(k), euclid.fibonacci(k - 1)).length).toBe(k - 2);
  },

  'simplex-method': () => {
    const rnd = mulberry32(13);
    for (let t = 0; t < 40; t++) {
      const n = 2 + (t % 2); const m = 3 + Math.floor(rnd() * 4);
      const A = Array.from({ length: m }, () => Array.from({ length: n }, () => 0.1 + rnd()));
      const b = Array.from({ length: m }, () => 0.5 + rnd());
      const c = Array.from({ length: n }, () => rnd());
      // vertex enumeration: every choice of n tight constraints among A x <= b and x >= 0
      const rows = [...A.map((r, i) => [...r, b[i]]), ...Array.from({ length: n }, (_, j) => [...Array.from({ length: n }, (_, k) => (k === j ? 1 : 0)), 0])];
      let best = -Infinity;
      const choose = (start: number, pick: number[]) => {
        if (pick.length === n) {
          const M = pick.map((i) => rows[i].slice(0, n));
          if (Math.abs(leibniz(M)) < 1e-12) return;
          const x = cramer(M, pick.map((i) => rows[i][n]));
          if (x.some((v) => v < -1e-9) || A.some((r, i) => r.reduce((s, v, j) => s + v * x[j], 0) > b[i] + 1e-9)) return;
          best = Math.max(best, c.reduce((s, v, j) => s + v * x[j], 0));
          return;
        }
        for (let i = start; i < rows.length; i++) choose(i + 1, [...pick, i]);
      };
      choose(0, []);
      for (const rule of ['bland', 'dantzig'] as const) {
        const r = simplex.simplex(A, b, c, rule);
        expect(r.status).toBe('optimal');
        close(r.value, best, 1e-9);
      }
    }
    expect(simplex.simplex([[-1, 1]], [1], [1, 0]).status).toBe('unbounded');
  },

  'pareto-front': () => {
    const rnd = mulberry32(14);
    for (let t = 0; t < 30; t++) {
      // a coarse grid forces ties and duplicates
      const pts = Array.from({ length: 5 + Math.floor(rnd() * 60) }, () => [Math.floor(rnd() * 8), Math.floor(rnd() * 8)] as [number, number]);
      const brute = pts.map((_, i) => i).filter((i) => !pts.some((q, j) => j !== i && pareto.dominates(q, pts[i])));
      expect(pareto.front2(pts).sort((a, b) => a - b)).toEqual(brute);
      const rank = pareto.layers(pts);
      let rest = pts.map((_, i) => i);
      for (let r = 0; rest.length; r++) {
        const f = rest.filter((i) => !rest.some((j) => j !== i && pareto.dominates(pts[j], pts[i])));
        for (const i of f) expect(rank[i]).toBe(r);
        rest = rest.filter((i) => !f.includes(i));
      }
    }
  },

  topsis: () => {
    // a hand-worked case: two options, two benefit criteria, equal weights
    const t = topsis.topsis([[3, 4], [4, 3]], [0.5, 0.5], [true, true]);
    close(t.normal[0][0], 0.6, 1e-12);
    close(t.closeness[0], 0.5, 1e-12);
    close(t.closeness[1], 0.5, 1e-12);
    const rnd = mulberry32(15);
    const X = Array.from({ length: 8 }, () => [1 + rnd(), 1 + rnd(), 1 + rnd(), 1 + rnd()]);
    const benefit = [true, true, false, false];
    const w = [0.4, 0.2, 0.2, 0.2];
    // an option at the ideal on every criterion has closeness 1, one at the anti-ideal 0
    const best = [3, 3, 0.5, 0.5]; const worst = [0.9, 0.9, 3, 3];
    const r = topsis.topsis([...X, best, worst], w, benefit);
    close(r.closeness[8], 1, 1e-12);
    close(r.closeness[9], 0, 1e-12);
    // a dominating option never ranks below the option it dominates
    const better = X[0].map((v, j) => (benefit[j] ? v + 0.1 : v - 0.1));
    const d = topsis.topsis([...X, better], w, benefit);
    expect(d.closeness[8]).toBeGreaterThanOrEqual(d.closeness[0]);
    // vector normalisation makes the result independent of each criterion's unit
    const scaled = topsis.topsis(X.map((row) => row.map((v, j) => v * (j + 1) * 10)), w, benefit);
    scaled.closeness.forEach((v, i) => close(v, topsis.topsis(X, w, benefit).closeness[i], 1e-12));
  },

  'lyapunov-exponent': () => {
    close(lyap.mapExponent('logistic', 1).lambda, Math.log(2), 0.02);
    close(lyap.mapExponent('henon', 1).lambda, 0.419, 0.02);
    close(lyap.lorenzExponent(1).lambda, 0.906, 0.08);
    // r = 3.5: the exponent of the attracting 4-cycle is ln |Π r(1 − 2x)| / 4
    let x = 0.3;
    for (let i = 0; i < 5000; i++) x = 3.5 * x * (1 - x);
    let prod = 1;
    for (let i = 0; i < 4; i++) { prod *= Math.abs(3.5 * (1 - 2 * x)); x = 3.5 * x * (1 - x); }
    close(lyap.mapExponent('logistic-periodic', 1).lambda, Math.log(prod) / 4, 2e-3);
  },

  'poincare-section': () => {
    // without coupling the y motion is a harmonic oscillator: y² + py² is fixed on every orbit
    for (const [y, py] of [[0.1, 0.2], [-0.3, 0.05], [0.25, -0.3]]) {
      const s = poincare.start(y, py, 0.1, 0)!;
      const o = poincare.orbit(s, 0, 30);
      for (const [a, b] of o.section) close(a * a + b * b, y * y + py * py, 2e-3);
    }
    const s = poincare.start(0.1, 0.1, 0.12, 1)!;
    const o = poincare.orbit(s, 1, 80);
    expect(o.drift).toBeLessThan(1e-3);
    for (const [y, py] of o.section) expect(0.5 * py * py + poincare.potential(0, y, 1)).toBeLessThanOrEqual(0.12 + 1e-3);
  },

  'takens-embedding': () => {
    // a sine of period 40: the mutual information first bottoms out near a quarter period (± a tenth)
    const sine = Array.from({ length: 2000 }, (_, i) => Math.sin(0.157 * i)); // period ≈ 40, never exactly repeating
    const tau = firstMinimum(Array.from({ length: 30 }, (_, lag) => mutualInformation(sine, lag)));
    expect(Math.abs(tau - 10)).toBeLessThanOrEqual(4);
    expect(falseNeighbours(sine.slice(0, 800), 2, tau)).toBeLessThan(0.01);
    const x = lorenzOrbit(2, 900, 0.01, 4).map((v) => v[0]);
    const lt = Math.max(1, firstMinimum(Array.from({ length: 41 }, (_, lag) => mutualInformation(x, lag))));
    const f1 = falseNeighbours(x, 1, lt); const f3 = falseNeighbours(x, 3, lt);
    expect(f1).toBeGreaterThan(0.2);
    expect(f3).toBeLessThan(0.05);
    expect(falseNeighbours(noise(900, 2), 3, 1)).toBeGreaterThan(f3);
    expect(takens.signal('lorenz', 1).s.length).toBeGreaterThan(1000);
  },

  'recurrence-plot': () => {
    // a sequence of period 7 with distinct values recurs exactly when 7 divides i − j
    const p = 7; const n = 140;
    const states = Array.from({ length: n }, (_, i) => [i % p]);
    const R = rec.recurrence(states, 0.1);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) expect(R[i * n + j]).toBe((i - j) % p === 0 ? 1 : 0);
    let pairs = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && (i - j) % p === 0) pairs++;
    const q = rec.rqa(R, n);
    close(q.rr, pairs / (n * (n - 1)), 1e-12);
    close(q.det, 1, 1e-12);
    // a sine is far more deterministic than noise at the same recurrence rate
    const at = (s: number[]) => {
      const st = s.slice(0, 200).map((v, i) => [v, s[i + 1]]);
      return rec.rqa(rec.recurrence(st, rec.thresholdFor(st, 0.08)), 200);
    };
    const sine = at(Array.from({ length: 201 }, (_, i) => Math.sin(i / 3)));
    const white = at(noise(201, 3));
    expect(sine.det).toBeGreaterThan(0.85);
    expect(white.det).toBeLessThan(sine.det - 0.3);
    close(white.rr, 0.08, 0.01);
    expect(logisticSeries(4, 10, 1).every((v) => v >= 0 && v <= 1)).toBe(true);
  },

  'hurst-dfa': () => {
    const alpha = (x: number[]) => {
      const y = hurst.profile(x);
      return logSlope(hurst.boxSizes(x.length).map((n) => [n, hurst.fluctuation(y, n).F] as [number, number]));
    };
    const rnd = mulberry32(16);
    const white = Array.from({ length: 4096 }, () => gaussian(rnd));
    close(alpha(white), 0.5, 0.08);
    let s = 0;
    close(alpha(white.map((v) => (s += v))), 1.5, 0.12);
    // fractional Gaussian noise: lag-one autocorrelation 2^(2H−1) − 1, then α ≈ H
    const H = 0.8;
    const f = hurst.fgn(2048, H, 5);
    const m = f.reduce((a, v) => a + v, 0) / f.length;
    const c0 = f.reduce((a, v) => a + (v - m) ** 2, 0); const c1 = f.slice(1).reduce((a, v, i) => a + (v - m) * (f[i] - m), 0);
    close(c1 / c0, 2 ** (2 * H - 1) - 1, 0.06);
    close(alpha(f), H, 0.12);
    // and the rescaled range of white noise grows like √n
    close(logSlope(hurst.boxSizes(4096).map((n) => [n, hurst.rescaledRange(white, n)] as [number, number])), 0.5, 0.12);
  },
};
