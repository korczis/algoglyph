// Circuits by modified nodal analysis (plan S1): a netlist of resistors, inductors (optionally
// coupled in pairs by a coefficient k), capacitors and voltage sources between numbered nodes,
// node 0 the ground. Two independent solutions of the same netlist:
//   phasor     at one angular frequency ω, the complex MNA system (admittances jωC and 1/R, an
//              inductor's branch equation V_a − V_b = jωL I + jωM I₂) solved by Gaussian
//              elimination with partial pivoting over complex numbers;
//   transient  in time, each inductor and capacitor replaced by its trapezoidal companion (a
//              conductance and a source carried from the last step), the real MNA matrix factored
//              once by LU with partial pivoting and solved at every step.
// The trapezoidal rule is the bilinear transform: its steady state under a drive at ω is the exact
// phasor response at the warped frequency (2/h) tan(ωh/2), and within O((ωh)²) of the response at ω.
// The tests and the plate's claims hold the two solutions to each other and to closed forms.

export type Kind = 'R' | 'L' | 'C' | 'V';

export interface Element {
  kind: Kind;
  /** The element's current flows from node a to node b through it; its voltage is V_a − V_b. */
  a: number;
  b: number;
  /** Ohms, henries, farads; for a source, its amplitude in volts. */
  value: number;
}

/** Two inductors (indices into elements) coupled with mutual inductance M = k√(L₁L₂). */
export interface Coupling { l1: number; l2: number; k: number }

export interface Netlist {
  /** The highest node number; nodes run 0 (ground) to `nodes`. */
  nodes: number;
  elements: Element[];
  couplings?: Coupling[];
}

/** The unknowns: node voltages 1…nodes, then one branch current per inductor and source. */
function layout(net: Netlist): { n: number; branch: number[] } {
  const branch: number[] = [];
  let n = net.nodes;
  for (const e of net.elements) branch.push(e.kind === 'L' || e.kind === 'V' ? n++ : -1);
  return { n, branch };
}

const mutual = (net: Netlist, c: Coupling) => c.k * Math.sqrt(net.elements[c.l1].value * net.elements[c.l2].value);

export interface Phasor {
  /** Node voltages, index 0 the ground (always 0). */
  vr: Float64Array;
  vi: Float64Array;
  /** The current through each element from a to b (resistors and capacitors from their voltages). */
  ir: Float64Array;
  ii: Float64Array;
  /** The pivot was too small for the system: a floating node or a loop of sources. */
  singular: boolean;
}

/** Solve A x = b in place over complex numbers (re, im), with partial pivoting. False when singular. */
export function complexSolve(ar: Float64Array[], ai: Float64Array[], br: Float64Array, bi: Float64Array): boolean {
  const n = br.length;
  let scale = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) scale = Math.max(scale, Math.hypot(ar[r][c], ai[r][c]));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.hypot(ar[r][col], ai[r][col]) > Math.hypot(ar[piv][col], ai[piv][col])) piv = r;
    }
    if (Math.hypot(ar[piv][col], ai[piv][col]) <= 1e-14 * scale) return false;
    [ar[col], ar[piv]] = [ar[piv], ar[col]];
    [ai[col], ai[piv]] = [ai[piv], ai[col]];
    [br[col], br[piv]] = [br[piv], br[col]];
    [bi[col], bi[piv]] = [bi[piv], bi[col]];
    const pr = ar[col][col];
    const pi = ai[col][col];
    const den = pr * pr + pi * pi;
    for (let r = col + 1; r < n; r++) {
      const fr = (ar[r][col] * pr + ai[r][col] * pi) / den;
      const fi = (ai[r][col] * pr - ar[r][col] * pi) / den;
      if (fr === 0 && fi === 0) continue;
      for (let c = col; c < n; c++) {
        const xr = ar[col][c];
        const xi = ai[col][c];
        ar[r][c] -= fr * xr - fi * xi;
        ai[r][c] -= fr * xi + fi * xr;
      }
      const yr = br[col];
      const yi = bi[col];
      br[r] -= fr * yr - fi * yi;
      bi[r] -= fr * yi + fi * yr;
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let sr = br[r];
    let si = bi[r];
    for (let c = r + 1; c < n; c++) {
      sr -= ar[r][c] * br[c] - ai[r][c] * bi[c];
      si -= ar[r][c] * bi[c] + ai[r][c] * br[c];
    }
    const pr = ar[r][r];
    const pi = ai[r][r];
    const den = pr * pr + pi * pi;
    br[r] = (sr * pr + si * pi) / den;
    bi[r] = (si * pr - sr * pi) / den;
  }
  return true;
}

/** The phasor solution at angular frequency w; each source's phasor is its real amplitude. */
export function phasor(net: Netlist, w: number): Phasor {
  const { n, branch } = layout(net);
  const ar = Array.from({ length: n }, () => new Float64Array(n));
  const ai = Array.from({ length: n }, () => new Float64Array(n));
  const br = new Float64Array(n);
  const bi = new Float64Array(n);
  const node = (k: number) => k - 1;
  const admit = (a: number, b: number, gr: number, gi: number) => {
    if (a > 0) { ar[node(a)][node(a)] += gr; ai[node(a)][node(a)] += gi; }
    if (b > 0) { ar[node(b)][node(b)] += gr; ai[node(b)][node(b)] += gi; }
    if (a > 0 && b > 0) {
      ar[node(a)][node(b)] -= gr; ai[node(a)][node(b)] -= gi;
      ar[node(b)][node(a)] -= gr; ai[node(b)][node(a)] -= gi;
    }
  };
  net.elements.forEach((e, k) => {
    if (e.kind === 'R') admit(e.a, e.b, 1 / e.value, 0);
    else if (e.kind === 'C') admit(e.a, e.b, 0, w * e.value);
    else {
      const m = branch[k];
      // KCL: the branch current leaves a and enters b
      if (e.a > 0) ar[node(e.a)][m] += 1;
      if (e.b > 0) ar[node(e.b)][m] -= 1;
      // branch equation: V_a − V_b − (jωL I) = 0, or = E for a source
      if (e.a > 0) ar[m][node(e.a)] += 1;
      if (e.b > 0) ar[m][node(e.b)] -= 1;
      if (e.kind === 'L') ai[m][m] -= w * e.value;
      else br[m] = e.value;
    }
  });
  for (const c of net.couplings ?? []) {
    const M = mutual(net, c);
    ai[branch[c.l1]][branch[c.l2]] -= w * M;
    ai[branch[c.l2]][branch[c.l1]] -= w * M;
  }
  const ok = complexSolve(ar, ai, br, bi);
  const vr = new Float64Array(net.nodes + 1);
  const vi = new Float64Array(net.nodes + 1);
  for (let k = 1; k <= net.nodes; k++) { vr[k] = br[k - 1]; vi[k] = bi[k - 1]; }
  const ir = new Float64Array(net.elements.length);
  const ii = new Float64Array(net.elements.length);
  net.elements.forEach((e, k) => {
    const dr = vr[e.a] - vr[e.b];
    const di = vi[e.a] - vi[e.b];
    if (e.kind === 'R') { ir[k] = dr / e.value; ii[k] = di / e.value; }
    else if (e.kind === 'C') { ir[k] = -w * e.value * di; ii[k] = w * e.value * dr; }
    else { ir[k] = br[branch[k]]; ii[k] = bi[branch[k]]; }
  });
  return { vr, vi, ir, ii, singular: !ok };
}

/** LU factorisation with partial pivoting of a dense real matrix, in place; null when singular. */
export function luFactor(a: Float64Array[]): Int32Array | null {
  const n = a.length;
  const perm = new Int32Array(n);
  let scale = 0;
  for (let r = 0; r < n; r++) { perm[r] = r; for (let c = 0; c < n; c++) scale = Math.max(scale, Math.abs(a[r][c])); }
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    if (Math.abs(a[piv][col]) <= 1e-14 * scale) return null;
    if (piv !== col) {
      [a[col], a[piv]] = [a[piv], a[col]];
      [perm[col], perm[piv]] = [perm[piv], perm[col]];
    }
    for (let r = col + 1; r < n; r++) {
      const f = a[r][col] / a[col][col];
      a[r][col] = f;
      if (f === 0) continue;
      for (let c = col + 1; c < n; c++) a[r][c] -= f * a[col][c];
    }
  }
  return perm;
}

/** Solve with a factorisation from luFactor: b (in original row order) becomes x, using `tmp`. */
export function luSolve(lu: Float64Array[], perm: Int32Array, b: Float64Array, tmp: Float64Array): void {
  const n = b.length;
  for (let r = 0; r < n; r++) tmp[r] = b[perm[r]];
  for (let r = 0; r < n; r++) {
    let s = tmp[r];
    for (let c = 0; c < r; c++) s -= lu[r][c] * tmp[c];
    tmp[r] = s;
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = tmp[r];
    for (let c = r + 1; c < n; c++) s -= lu[r][c] * tmp[c];
    tmp[r] = s / lu[r][r];
  }
  b.set(tmp);
}

/** A time-domain run: the drive, and the state after each step. */
export interface Transient {
  /** Advance one step of h; the sources take `drive(t)` times their amplitude at the new time. */
  step(): void;
  t: number;
  /** Node voltages (index 0 ground) and element currents at the current time. */
  v: Float64Array;
  i: Float64Array;
  singular: boolean;
  /** Unknowns of the MNA system: a step costs about their square. */
  unknowns: number;
}

/**
 * A trapezoidal transient from rest (every voltage and current zero at t = 0, the sources at
 * drive(0)·amplitude from then on). Each capacitor becomes a conductance 2C/h in parallel with a
 * source carrying its last voltage and current; each inductor's branch equation becomes
 * v⁺ + v = (2L/h)(i⁺ − i) + (2M/h)(i₂⁺ − i₂).
 */
export function transient(net: Netlist, h: number, drive: (t: number) => number): Transient {
  const { n, branch } = layout(net);
  const A = Array.from({ length: n }, () => new Float64Array(n));
  const node = (k: number) => k - 1;
  const stamp = (a: number, b: number, g: number) => {
    if (a > 0) A[node(a)][node(a)] += g;
    if (b > 0) A[node(b)][node(b)] += g;
    if (a > 0 && b > 0) { A[node(a)][node(b)] -= g; A[node(b)][node(a)] -= g; }
  };
  const M = new Map<number, { other: number; m: number }[]>();
  for (const c of net.couplings ?? []) {
    const m = mutual(net, c);
    M.set(c.l1, [...(M.get(c.l1) ?? []), { other: c.l2, m }]);
    M.set(c.l2, [...(M.get(c.l2) ?? []), { other: c.l1, m }]);
  }
  net.elements.forEach((e, k) => {
    if (e.kind === 'R') stamp(e.a, e.b, 1 / e.value);
    else if (e.kind === 'C') stamp(e.a, e.b, (2 * e.value) / h);
    else {
      const m = branch[k];
      if (e.a > 0) { A[node(e.a)][m] += 1; A[m][node(e.a)] += 1; }
      if (e.b > 0) { A[node(e.b)][m] -= 1; A[m][node(e.b)] -= 1; }
      if (e.kind === 'L') {
        A[m][m] -= (2 * e.value) / h;
        for (const o of M.get(k) ?? []) A[m][branch[o.other]] -= (2 * o.m) / h;
      }
    }
  });
  const perm = luFactor(A);
  const v = new Float64Array(net.nodes + 1);
  const vOld = new Float64Array(net.nodes + 1);
  const i = new Float64Array(net.elements.length);
  const rhs = new Float64Array(n);
  const tmp = new Float64Array(n);
  // the elements as flat arrays, so a step allocates nothing
  const E = net.elements.length;
  const kind = net.elements.map((e) => e.kind);
  const ea = Int32Array.from(net.elements, (e) => e.a);
  const eb = Int32Array.from(net.elements, (e) => e.b);
  const g2 = Float64Array.from(net.elements, (e) => (e.kind === 'C' || e.kind === 'L' ? (2 * e.value) / h : 0));
  const val = Float64Array.from(net.elements, (e) => e.value);
  const br = Int32Array.from(branch);
  const partners = net.elements.map((_, k) => (M.get(k) ?? []).map((o) => ({ other: o.other, g: (2 * o.m) / h })));
  const run: Transient = {
    t: 0, v, i, singular: perm === null, unknowns: n,
    step() {
      if (!perm) return;
      const t = run.t + h;
      rhs.fill(0);
      for (let k = 0; k < E; k++) {
        const vk = v[ea[k]] - v[eb[k]];
        const kk = kind[k];
        if (kk === 'C') {
          // the companion source: (2C/h) v + i, entering a
          const J = g2[k] * vk + i[k];
          if (ea[k] > 0) rhs[ea[k] - 1] += J;
          if (eb[k] > 0) rhs[eb[k] - 1] -= J;
        } else if (kk === 'L') {
          let s2 = -g2[k] * i[k] - vk;
          for (const o of partners[k]) s2 -= o.g * i[o.other];
          rhs[br[k]] = s2;
        } else if (kk === 'V') rhs[br[k]] = val[k] * drive(t);
      }
      luSolve(A, perm, rhs, tmp);
      vOld.set(v);
      for (let k = 1; k <= net.nodes; k++) v[k] = rhs[k - 1];
      for (let k = 0; k < E; k++) {
        const vk = v[ea[k]] - v[eb[k]];
        const kk = kind[k];
        if (kk === 'R') i[k] = vk / val[k];
        else if (kk === 'C') i[k] = g2[k] * (vk - (vOld[ea[k]] - vOld[eb[k]])) - i[k];
        else i[k] = rhs[br[k]];
      }
      run.t = t;
    },
  };
  return run;
}

/** The largest Kirchhoff current-law residual over the nodes, relative to the largest current. */
export function kclResidual(net: Netlist, i: Float64Array): number {
  const sum = new Float64Array(net.nodes + 1);
  let big = 0;
  net.elements.forEach((e, k) => {
    sum[e.a] -= i[k];
    sum[e.b] += i[k];
    big = Math.max(big, Math.abs(i[k]));
  });
  let worst = 0;
  for (let k = 1; k <= net.nodes; k++) worst = Math.max(worst, Math.abs(sum[k]));
  return big > 0 ? worst / big : 0;
}

/** Samples kept of the last drive periods, and periods the lock-in reads. */
export const SAMPLES = 600;
export const LOCK_PERIODS = 20;
/** A transient is driven from rest for this many of its slowest time scales before it is measured. */
export const SETTLE = 30;
/** Steps a transient may take at most; beyond it the readout says it was bounded. */
export const MAX_STEPS = 200_000;

/** The steady state of a trapezoidal transient under cos ωt, read by a lock-in over whole periods. */
export interface Steady {
  /** Amplitude and phase of the probe, and the average powers over the window. */
  amplitude: number;
  phase: number;
  /** Mean over the window of each element's v·i (index by element). */
  power: Float64Array;
  kcl: number;
  steps: number;
  bounded: boolean;
  /** The last LOCK_PERIODS periods of the probe and the drive, decimated to SAMPLES. */
  trace: [number, number][];
  singular: boolean;
}

/**
 * A steady-state measurement in progress: `net` driven from rest by cos(ωt) at `perPeriod` steps a
 * period, settled for `settle` time (at most MAX_STEPS in all), then read by a lock-in over
 * LOCK_PERIODS whole periods. `advance(work)` takes as many steps as `work` allows at a cost of
 * (unknowns² + elements) a step, so a plate spreads it over frames; `result` is set when it ends.
 */
export class SteadyRun {
  result: Steady | null = null;
  readonly cost: number;
  private readonly tr: Transient;
  private readonly settleSteps: number;
  private readonly lock: number;
  private readonly want: number;
  private k = 0;
  private c = 0;
  private s = 0;
  private kcl = 0;
  private readonly power: Float64Array;
  private readonly raw: [number, number][] = [];

  constructor(private readonly net: Netlist, private readonly w: number, perPeriod: number, settle: number,
    private readonly probe: (v: Float64Array, i: Float64Array) => number) {
    const T = (2 * Math.PI) / w;
    this.tr = transient(net, T / perPeriod, (t) => Math.cos(w * t));
    this.want = Math.ceil(settle / T) * perPeriod;
    this.lock = LOCK_PERIODS * perPeriod;
    this.settleSteps = Math.max(0, Math.min(this.want, MAX_STEPS - this.lock));
    this.power = new Float64Array(net.elements.length);
    this.cost = this.tr.unknowns * this.tr.unknowns + net.elements.length;
    if (this.tr.singular) this.finish();
  }

  /** Steps done and asked, for a readout while it runs. */
  get progress(): [number, number] { return [this.k, this.settleSteps + this.lock]; }

  /** Advance by up to `work` units; true once the measurement is complete. */
  advance(work: number): boolean {
    if (this.result) return true;
    const { tr, net, w } = this;
    let budget = Math.max(1, Math.floor(work / this.cost));
    for (; budget > 0 && this.k < this.settleSteps + this.lock; budget--, this.k++) {
      tr.step();
      if (this.k < this.settleSteps) continue;
      const x = this.probe(tr.v, tr.i);
      this.c += x * Math.cos(w * tr.t);
      this.s += x * Math.sin(w * tr.t);
      for (let j = 0; j < net.elements.length; j++) {
        const e = net.elements[j];
        this.power[j] += (tr.v[e.a] - tr.v[e.b]) * tr.i[j];
      }
      this.kcl = Math.max(this.kcl, kclResidual(net, tr.i));
      this.raw.push([x, Math.cos(w * tr.t)]);
    }
    if (this.k >= this.settleSteps + this.lock) this.finish();
    return this.result !== null;
  }

  private finish(): void {
    const { lock, raw } = this;
    const power = Float64Array.from(this.power, (x) => x / lock);
    const trace: [number, number][] = [];
    if (raw.length) for (let i = 0; i < SAMPLES; i++) trace.push(raw[Math.floor((i * (raw.length - 1)) / (SAMPLES - 1))]);
    this.result = {
      amplitude: (2 / lock) * Math.hypot(this.c, this.s), phase: Math.atan2(this.s, this.c), power, kcl: this.kcl,
      steps: this.k, bounded: this.settleSteps < this.want, trace, singular: this.tr.singular,
    };
  }
}

/** The whole measurement at once (for tests and small circuits). */
export function steadyState(net: Netlist, w: number, perPeriod: number, settle: number,
  probe: (v: Float64Array, i: Float64Array) => number): Steady {
  const run = new SteadyRun(net, w, perPeriod, settle, probe);
  while (!run.advance(1e9));
  return run.result!;
}

/** The maximum of a unimodal f on [lo, hi] by golden-section search on ln ω. */
export function goldenMax(f: (w: number) => number, lo: number, hi: number): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = Math.log(lo);
  let b = Math.log(hi);
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  let fc = f(Math.exp(c));
  let fd = f(Math.exp(d));
  for (let i = 0; i < 120 && b - a > 1e-13; i++) {
    if (fc > fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(Math.exp(c)); } else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(Math.exp(d)); }
  }
  return Math.exp((a + b) / 2);
}

/** Where f falls to `level` between a (above it) and b (below it), by bisection. */
export function crossing(f: (w: number) => number, a: number, b: number, level: number): number {
  for (let i = 0; i < 200; i++) {
    const m = Math.sqrt(a * b);
    if (f(m) > level) a = m; else b = m;
  }
  return Math.sqrt(a * b);
}

/** The N-section ladder: a source through R_s = √(L/C) into node 2, L between nodes, C to ground, R_L at the end. */
export function ladder(N: number): Netlist {
  const el: Element[] = [{ kind: 'V', a: 1, b: 0, value: 1 }, { kind: 'R', a: 1, b: 2, value: 1 }];
  for (let k = 0; k < N; k++) {
    el.push({ kind: 'C', a: 2 + k, b: 0, value: 1 });
    if (k < N - 1) el.push({ kind: 'L', a: 2 + k, b: 3 + k, value: 1 });
  }
  el.push({ kind: 'R', a: N + 1, b: 0, value: 1 });
  return { nodes: N + 1, elements: el };
}

