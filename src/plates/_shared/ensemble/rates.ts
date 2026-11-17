// Rate processes (plan S7c): a population of discrete things whose changes happen at rates, run
// exactly by Gillespie's direct method. Each step draws the waiting time to the next change from
// an exponential of the total rate and picks which change by its share of that rate, so the run
// is a sample of the continuous-time Markov chain itself, with no time step. The history is kept
// as piecewise-constant states, and the time integrals of every count and of its square are
// accumulated exactly, so time averages and variances need no sampling grid.
//
// The plates' processes are written as reactions on a vector of counts; the closed forms they are
// compared with (Bateman's chain, Planck's occupancy, the Bose–Einstein, Fermi–Dirac and Boltzmann
// means) are never consulted here.

/** One kind of change: its rate in the current state, and what it does to the counts. */
export interface Reaction {
  rate(x: Int32Array): number;
  apply(x: Int32Array): void;
}

export interface Run {
  /** Event times (the first is 0) and the state after each, `width` counts per row. */
  times: Float64Array;
  states: Int32Array;
  width: number;
  events: number;
  /** The end of the run (T, or the time the process stopped with no rate left). */
  end: number;
  /** ∫ x_i dt and ∫ x_i² dt over [from, end], per count. */
  integral: Float64Array;
  integralSq: Float64Array;
  /** The time integrals start here: an initial stretch is left out of the averages. */
  from: number;
}

/**
 * Gillespie's direct method from x0 until time T (or `maxEvents` changes, or no rate left). The
 * history keeps at most `keep` events (the rest still enter the integrals); `from` starts the
 * integrals after a burn-in.
 */
export function gillespie(x0: ArrayLike<number>, reactions: Reaction[], T: number, rnd: () => number,
  opts: { maxEvents?: number; keep?: number; from?: number } = {}): Run {
  const width = x0.length;
  const maxEvents = opts.maxEvents ?? 1_000_000;
  const keep = Math.min(opts.keep ?? maxEvents, maxEvents);
  const from = opts.from ?? 0;
  const x = Int32Array.from(x0);
  const times = new Float64Array(keep + 1);
  const states = new Int32Array((keep + 1) * width);
  states.set(x, 0);
  const integral = new Float64Array(width);
  const integralSq = new Float64Array(width);
  const rates = new Float64Array(reactions.length);
  let t = 0;
  let events = 0;
  const accrue = (t0: number, t1: number) => {
    const a = Math.max(t0, from);
    if (t1 <= a) return;
    for (let i = 0; i < width; i++) { integral[i] += x[i] * (t1 - a); integralSq[i] += x[i] * x[i] * (t1 - a); }
  };
  while (events < maxEvents) {
    let total = 0;
    for (let r = 0; r < reactions.length; r++) { rates[r] = Math.max(0, reactions[r].rate(x)); total += rates[r]; }
    if (total <= 0) { accrue(t, T); t = T; break; }
    // the waiting time: −ln(1 − u)/total, u in [0, 1), so never infinite
    const dt = -Math.log(1 - rnd()) / total;
    if (t + dt >= T) { accrue(t, T); t = T; break; }
    accrue(t, t + dt);
    t += dt;
    let pick = rnd() * total;
    let r = 0;
    while (r < reactions.length - 1 && pick >= rates[r]) { pick -= rates[r]; r++; }
    reactions[r].apply(x);
    events++;
    if (events <= keep) { times[events] = t; states.set(x, events * width); }
  }
  const kept = Math.min(events, keep);
  return {
    times: times.subarray(0, kept + 1), states: states.subarray(0, (kept + 1) * width), width, events,
    end: t, integral, integralSq, from,
  };
}

/** The state at time t of a run's kept history (the last change at or before t). */
export function stateAt(run: Run, t: number, out: Int32Array = new Int32Array(run.width)): Int32Array {
  const { times, states, width } = run;
  let lo = 0;
  let hi = times.length - 1;
  if (t >= times[hi]) lo = hi;
  else {
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
  }
  for (let i = 0; i < width; i++) out[i] = states[lo * width + i];
  return out;
}

/** The time average and variance of count i over [from, end]. */
export function timeStats(run: Run, i: number): { mean: number; variance: number } {
  const span = run.end - run.from;
  const mean = run.integral[i] / span;
  return { mean, variance: run.integralSq[i] / span - mean * mean };
}

/** A decay chain A → B → C at rates λ₁ (A) and λ₂ (B), counts [A, B, C]. */
export function decayChain(l1: number, l2: number): Reaction[] {
  return [
    { rate: (x) => l1 * x[0], apply: (x) => { x[0]--; x[1]++; } },
    { rate: (x) => l2 * x[1], apply: (x) => { x[1]--; x[2]++; } },
  ];
}

/**
 * Einstein's two-level atoms and one mode of radiation, counts [photons n, excited atoms e] of N
 * atoms: absorption at B·n per ground atom, emission at B·(n + 1) per excited atom (stimulated and
 * spontaneous, A = B for one mode), and collisions with a gas at temperature T that excite at
 * γe^(−x) and de-excite at γ, x = hν/kT. Nothing in it names Planck's law.
 */
export function einsteinAtoms(N: number, B: number, gamma: number, x: number): Reaction[] {
  const up = gamma * Math.exp(-x);
  return [
    { rate: (s) => B * s[0] * (N - s[1]), apply: (s) => { s[0]--; s[1]++; } },
    { rate: (s) => B * (s[0] + 1) * s[1], apply: (s) => { s[0]++; s[1]--; } },
    { rate: (s) => up * (N - s[1]), apply: (s) => { s[1]++; } },
    { rate: (s) => gamma * s[1], apply: (s) => { s[1]--; } },
  ];
}

export type Statistics = 'bose' | 'fermi' | 'boltzmann';

/**
 * One level exchanging particles with a reservoir at x = (ε − μ)/kT, count [n]: a particle leaves
 * at rate n, and one arrives at e^(−x) times (n + 1) for bosons, (1 − n) for fermions (never a
 * second), or 1 for distinguishable particles.
 */
export function levelExchange(stats: Statistics, x: number): Reaction[] {
  const w = Math.exp(-x);
  const arrive = stats === 'bose' ? (s: Int32Array) => w * (s[0] + 1) : stats === 'fermi' ? (s: Int32Array) => w * (1 - s[0]) : () => w;
  return [
    { rate: arrive, apply: (s) => { s[0]++; } },
    { rate: (s) => s[0], apply: (s) => { s[0]--; } },
  ];
}
