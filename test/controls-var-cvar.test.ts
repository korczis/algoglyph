// var-cvar's fixed constants become controls (S4 B1, B2): the jump scenario drew a jump in 2% of
// the runs and the portfolio's Student-t factors had ν = 4; both are now controls, drawing the
// same numbers in the same order at their defaults. Checked: each control exists with the old
// constant as its default, travels in a shared link, and drives what the plate reads against an
// independent oracle: the jump mixture (1 − p)·N(0, 1) + p·(N(0, 1) + 4 + Exp(rate ½)) has a
// closed-form distribution function (an exponentially modified Gaussian), so its value at risk is
// a root and its expected shortfall a one-dimensional integral; the portfolio at ν = 3 has a
// closed-form characteristic function, so its distribution function is a Gil-Pelaez integral.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Params, RangeParam, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel as varCvar, type RiskResult } from '../src/kernels/stochastic/var-cvar';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'var-cvar';
/** The plate's default number of simulated losses. */
const N = 20000;
const k = varCvar as StochasticKernel<RiskResult>;
const defOf = (key: string) => k.params?.find((d) => d.key === key);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number> } });

async function roundTrip(key: string, values: (number | string)[]) {
  const defs = (await loadPlate(ID))!.params;
  const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
  for (const v of values) {
    expect(parse(defs, serialise(defs, { ...d, [key]: v }, 7))).toEqual({ seed: 7, params: { [key]: v } });
  }
}

// --- the oracles, independent of the kernel ------------------------------------------------

const SQ2PI = Math.sqrt(2 * Math.PI);
const dens = (t: number) => Math.exp(-t * t / 2) / SQ2PI;
/** The normal distribution function by Simpson's rule on the density. */
function Phi(x: number): number {
  const m = 4000;
  const a = Math.min(0, x);
  const b = Math.max(0, x);
  const h = (b - a) / m;
  let s = dens(a) + dens(b);
  for (let i = 1; i < m; i++) s += (i % 2 ? 4 : 2) * dens(a + i * h);
  const area = (s * h) / 3;
  return x >= 0 ? 0.5 + area : 0.5 - area;
}
/** The jump: N(0, 1) + 4 + Exp(rate ½), an exponentially modified Gaussian (μ 4, σ 1, λ ½). */
const LAM = 0.5;
const MU = 4;
const jumpPdf = (y: number) => LAM * Math.exp(LAM * (MU - y) + (LAM * LAM) / 2) * Phi(y - MU - LAM);
const jumpCdf = (y: number) => Phi(y - MU) - Math.exp(-LAM * (y - MU) + (LAM * LAM) / 2) * Phi(y - MU - LAM);

/** A distribution's value at risk, expected shortfall and three asymptotic standard errors of
 * each over n runs: √(α(1 − α)/n) / f(VaR) for the quantile, and
 * √((Var(L | L ≥ VaR) + α (ES − VaR)²) / (n (1 − α))) for the tail mean. */
function tail(F: (x: number) => number, f: (x: number) => number, level: number, n = N) {
  let lo = -20;
  let hi = 80;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (F(m) < level) lo = m; else hi = m; }
  const v = (lo + hi) / 2;
  // ∫ x f and ∫ x² f beyond VaR, Simpson's rule out to 60 past it
  const m = 6000;
  const h = 60 / m;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i <= m; i++) {
    const x = v + i * h;
    const w = i === 0 || i === m ? 1 : i % 2 ? 4 : 2;
    s1 += w * x * f(x);
    s2 += w * x * x * f(x);
  }
  const q = 1 - level;
  const es = (s1 * h) / 3 / q;
  const condVar = (s2 * h) / 3 / q - es * es;
  return {
    var: v, es,
    varTol: 3 * Math.sqrt((level * q) / n) / f(v),
    esTol: 3 * Math.sqrt((condVar + level * (es - v) ** 2) / (n * q)),
  };
}
const mixture = (p: number, level: number) =>
  tail((x) => (1 - p) * Phi(x) + p * jumpCdf(x), (x) => (1 - p) * dens(x) + p * jumpPdf(x), level);

describe('var-cvar: jump probability', () => {
  const KEY = 'jumpP';

  it('is a range control with the old constant as its default, shown for the jump scenario', () => {
    expect(defOf(KEY)).toMatchObject({
      kind: 'range', label: 'Jump probability', min: 0.005, max: 0.1, step: 0.005, value: 0.02, rebuild: true,
      when: { key: 'scenario', values: ['jumps'] },
    });
  });

  it('round-trips through a shared link', async () => {
    await roundTrip(KEY, [0.005, 0.035, 0.1]);
  });

  it('the oracle reproduces the claims stated at the old constant', () => {
    const at90 = mixture(0.02, 0.9);
    expect(at90.var).toBeCloseTo(1.394, 3);
    expect(at90.varTol).toBeCloseTo(0.043, 3);
    expect(at90.es).toBeCloseTo(2.679, 3);
    expect(at90.esTol).toBeCloseTo(0.155, 2);
    const at99 = mixture(0.02, 0.99);
    expect(at99.var).toBeCloseTo(5.577, 3);
    expect(at99.varTol).toBeCloseTo(0.477, 3);
  });

  it('draws a jump in a share p of the runs', () => {
    for (const p of [0.005, 0.1]) {
      const r = trace(k, { scenario: 'jumps', [KEY]: p, n: 50000 }, 11).result!;
      // a jump adds at least 4, so the losses beyond 3 are almost all jumps (a normal loss
      // passes 3 in 0.13% of runs, a jump falls short of 3 in Φ(−1) ≈ 16% at most)
      const beyond = Array.from(r.losses).filter((x) => x > 3).length / r.losses.length;
      const want = (1 - p) * (1 - Phi(3)) + p * (1 - jumpCdf(3));
      expect(Math.abs(beyond - want), `p=${p}`).toBeLessThan(4 * Math.sqrt((want * (1 - want)) / r.losses.length));
    }
  });

  it('drives the readouts: value at risk and shortfall follow the mixture across the range', async () => {
    for (const [p, level] of [[0.005, 0.99], [0.05, 0.9], [0.05, 0.99], [0.1, 0.99]] as const) {
      const o = mixture(p, level);
      const params = { scenario: 'jumps', [KEY]: p, level: String(level) };
      const v = await read(ID, claim(`Value at risk ${(100 * level).toFixed(1)}%`, params));
      expect(v.reason).toBeUndefined();
      expect(Math.abs(v.value! - o.var), `VaR p=${p} level=${level}: ${v.text} against ${o.var}`).toBeLessThanOrEqual(o.varTol);
      const e = await read(ID, claim('Expected shortfall', params));
      expect(e.reason).toBeUndefined();
      expect(Math.abs(e.value! - o.es), `ES p=${p} level=${level}: ${e.text} against ${o.es}`).toBeLessThanOrEqual(o.esTol);
    }
  });
});

/** The Student-t characteristic function at ν = 3, (1 + √3 |s|) e^(−√3 |s|). */
const t3 = (s: number) => (1 + Math.sqrt(3) * Math.abs(s)) * Math.exp(-Math.sqrt(3) * Math.abs(s));
/** The portfolio's loss 0.6 c + 0.16 Σ t_i (five positions 0.2 (0.6 c + 0.8 t_i)) at ν = 3: its
 * characteristic function, and its distribution and density by Gil-Pelaez inversion. */
const cf3 = (s: number) => t3(0.6 * s) * t3(0.16 * s) ** 5;
function inversion(x: number): { F: number; f: number } {
  const m = 20000;
  const top = 60;
  const h = top / m;
  let sf = 0;
  let sF = 0;
  for (let i = 0; i <= m; i++) {
    const s = i * h;
    const w = i === 0 || i === m ? 1 : i % 2 ? 4 : 2;
    const c = cf3(s);
    sf += w * Math.cos(s * x) * c;
    sF += w * (s === 0 ? x : Math.sin(s * x) / s) * c;
  }
  return { F: 0.5 + (sF * h) / 3 / Math.PI, f: (sf * h) / 3 / Math.PI };
}

describe('var-cvar: degrees of freedom', () => {
  const KEY = 'nu';

  it('is a select control with the old constant as its default, shown for the portfolio', () => {
    const d = defOf(KEY) as SelectParam | undefined;
    expect(d).toMatchObject({ kind: 'select', label: 'Degrees of freedom', value: '4', rebuild: true, when: { key: 'scenario', values: ['portfolio'] } });
    expect(d!.options.map((o) => o.value)).toEqual(['3', '4', '6', '10', '30']);
  });

  it('round-trips through a shared link', async () => {
    await roundTrip(KEY, ['3', '30']);
  });

  it('sets the tails: the losses\' variance is 0.488 ν / (ν − 2)', () => {
    for (const nu of [6, 10, 30]) {
      const r = trace(k, { scenario: 'portfolio', [KEY]: String(nu), n: 50000 }, 5).result!;
      const xs = Array.from(r.losses);
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const s2 = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
      // Var(0.6 c + 0.16 Σ t_i) = (0.36 + 5 × 0.0256) ν/(ν − 2); the sample variance's standard
      // error from the fourth cumulant, κ4 = (0.6⁴ + 5 × 0.16⁴) × 6/(ν − 4) × (ν/(ν − 2))²
      const v = (0.488 * nu) / (nu - 2);
      const k4 = (0.6 ** 4 + 5 * 0.16 ** 4) * (6 / (nu - 4)) * (nu / (nu - 2)) ** 2;
      expect(Math.abs(s2 - v), `ν=${nu}`).toBeLessThan(4 * Math.sqrt((k4 + 2 * v * v) / xs.length));
    }
  });

  it('drives the readouts: at ν = 3 value at risk is the root of the inverted distribution', async () => {
    expect(inversion(0).F).toBeCloseTo(0.5, 9);
    let lo = 0;
    let hi = 10;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (inversion(m).F < 0.99) lo = m; else hi = m; }
    const v = (lo + hi) / 2;
    const tol = 3 * Math.sqrt((0.99 * 0.01) / N) / inversion(v).f;
    const r = await read(ID, claim('Value at risk 99.0%', { [KEY]: '3' }));
    expect(r.reason).toBeUndefined();
    expect(Math.abs(r.value! - v), `${r.text} against ${v} ± ${tol}`).toBeLessThanOrEqual(tol);
    const four = await read(ID, claim('Value at risk 99.0%', {}));
    expect(Math.abs(r.value! - four.value!), 'ν = 3 moves value at risk').toBeGreaterThan(0);
  });
});

describe('var-cvar at its defaults is what it was before the controls', () => {
  // readout texts (strings), recorded on the code before the controls existed (5f091c7)
  const READOUTS = '739c125ba5e43e3b';

  it('every scenario reads the same at its default', async () => {
    const out: (string | undefined)[] = [];
    for (const scenario of ['portfolio', 'jumps', 'normal']) {
      for (const readout of ['Value at risk 99.0%', 'Expected shortfall', 'Standard errors', 'Simulated losses', 'Largest loss']) {
        out.push((await read(ID, claim(readout, { scenario }))).text);
      }
    }
    expect(hash(out), JSON.stringify(out)).toBe(READOUTS);
  });

  it('passing the defaults explicitly draws the same losses', () => {
    const extra = Object.fromEntries((k.params ?? []).filter((d) => !['scenario', 'level', 'n'].includes(d.key))
      .map((d) => [d.key, (d as RangeParam | SelectParam).value]));
    for (const scenario of ['portfolio', 'jumps', 'normal']) {
      const a = trace(k, { scenario, n: 5000 }, 3).result!;
      const b = trace(k, { scenario, n: 5000, ...extra }, 3).result!;
      expect(Array.from(b.losses), scenario).toEqual(Array.from(a.losses));
    }
  });
});
