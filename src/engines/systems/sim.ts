// The systems engine's measurable core: a seeded discrete-event simulator. A kernel installs a
// protocol on a Net (lanes, timers, messages with random delay and loss, partitions that open
// and heal) and the Net records everything that happens as a time-ordered trace. Nothing here
// draws; every readout and chart point is counted from the trace (ADR 0004 §4).
import { mulberry32 } from '../../core/random';
import type { ParamDef, Params } from '../../core/plate';

/** Network conditions, in simulated milliseconds. */
export interface NetConfig {
  /** Uniform one-way delay range of a message. */
  delay: [number, number];
  /** Probability that a message is lost. */
  loss: number;
  /** A window in which messages between lanes on different sides are dropped (it opens at 0.3
   * of the run and heals at the `heal` control's share of it). */
  partition: { from: number; to: number; side: number[] } | null;
}

/** A message, recorded when sent: delivered at t1, or lost (1) or cut by a partition (2). */
export interface MsgEv {
  k: 'msg'; from: number; to: number; t0: number; t1: number; label: string; fate: 0 | 1 | 2;
  /** Background traffic (heartbeats, empty answers), drawn faintly. */
  quiet?: boolean;
}
/** A point event on a lane. `tone` picks the palette position (0..1). */
export interface MarkEv { k: 'mark'; lane: number; t: number; label: string; tone: number }
/** A lane enters a state (drawn as a band until its next state). */
export interface StateEv { k: 'state'; lane: number; t: number; state: string }
export interface CountEv { k: 'count'; t: number; key: string; by: number }
export interface GaugeEv { k: 'gauge'; t: number; key: string; value: number }
export interface SampleEv { k: 'sample'; t: number; series: string; value: number }
export type Ev = MsgEv | MarkEv | StateEv | CountEv | GaugeEv | SampleEv;

interface Timer { t: number; seq: number; fn: () => void; dead: boolean }

/** Events a run may record; the largest scenarios stay well inside it. */
export const EVENT_CAP = 200_000;

class Heap {
  private a: Timer[] = [];
  get size() { return this.a.length; }
  private less(i: number, j: number) {
    const x = this.a[i]; const y = this.a[j];
    return x.t < y.t || (x.t === y.t && x.seq < y.seq);
  }
  push(x: Timer) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): Timer | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1; const r = l + 1;
        let m = i;
        if (l < a.length && this.less(l, m)) m = l;
        if (r < a.length && this.less(r, m)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export class Net {
  now = 0;
  readonly events: Ev[] = [];
  /** The simulated time each event was recorded at (non-decreasing; a replay cursor follows it). */
  readonly stamps: number[] = [];
  readonly rnd: () => number;
  /** True when the run stopped at the event cap rather than at its horizon. */
  truncated = false;
  private q = new Heap();
  private seq = 0;
  private stopped = false;

  constructor(readonly lanes: string[], readonly cfg: NetConfig, seed: number,
    readonly horizon: number) {
    this.rnd = mulberry32(seed);
  }

  private rec(e: Ev) {
    if (this.events.length >= EVENT_CAP) { this.truncated = true; this.stopped = true; return; }
    this.events.push(e);
    this.stamps.push(this.now);
  }

  /** Run `fn` at simulated time t (never earlier than now). */
  at(t: number, fn: () => void): Timer {
    const x: Timer = { t: Math.max(t, this.now), seq: this.seq++, fn, dead: false };
    this.q.push(x);
    return x;
  }

  after(dt: number, fn: () => void): Timer { return this.at(this.now + dt, fn); }

  cancel(x: Timer | null | undefined) { if (x) x.dead = true; }

  /** Uniform in [a, b). */
  uniform(a: number, b: number): number { return a + (b - a) * this.rnd(); }

  /** Whether lanes a and b are on different sides of a partition open at time t. */
  cut(a: number, b: number, t: number): boolean {
    const p = this.cfg.partition;
    if (!p || t < p.from || t >= p.to) return false;
    const sa = p.side[a] ?? -1; const sb = p.side[b] ?? -1;
    return sa >= 0 && sb >= 0 && sa !== sb;
  }

  /** Whether a partition is open at time t. */
  partitionOpen(t = this.now): boolean {
    const p = this.cfg.partition;
    return Boolean(p && t >= p.from && t < p.to);
  }

  /**
   * Send a message from lane `from` to lane `to`; `deliver` runs on arrival. The delay is drawn
   * from the network's range unless given; the message is lost with the network's probability
   * (unless `reliable`) and dropped when a partition separates the lanes at send or arrival.
   * Returns whether it will arrive.
   */
  send(from: number, to: number, label: string, deliver: () => void,
    opts: { delay?: number; reliable?: boolean; quiet?: boolean } = {}): boolean {
    const [d0, d1] = this.cfg.delay;
    const d = opts.delay ?? this.uniform(d0, d1);
    const t1 = this.now + d;
    let fate: 0 | 1 | 2 = 0;
    if (this.cut(from, to, this.now) || this.cut(from, to, t1)) fate = 2;
    else if (!opts.reliable && this.rnd() < this.cfg.loss) fate = 1;
    this.rec({ k: 'msg', from, to, t0: this.now, t1, label, fate, ...(opts.quiet ? { quiet: true } : {}) });
    this.count(fate === 0 ? 'net.delivered' : 'net.dropped');
    this.count('net.sent');
    if (fate === 0) this.at(t1, deliver);
    return fate === 0;
  }

  /** Record an arrow between lanes over [t0, t1] that is not a network message. */
  link(from: number, to: number, t0: number, t1: number, label: string) {
    this.rec({ k: 'msg', from, to, t0, t1, label, fate: 0 });
  }

  mark(lane: number, label: string, tone = 0) { this.rec({ k: 'mark', lane, t: this.now, label, tone }); }
  state(lane: number, state: string) { this.rec({ k: 'state', lane, t: this.now, state }); }
  count(key: string, by = 1) { this.rec({ k: 'count', t: this.now, key, by }); }
  gauge(key: string, value: number) { this.rec({ k: 'gauge', t: this.now, key, value }); }
  sample(series: string, value: number) { this.rec({ k: 'sample', t: this.now, series, value }); }

  /** End the run after the current event. */
  stop() { this.stopped = true; }

  /** Process events in time order until the horizon, the queue empties or stop(). */
  run(): void {
    while (!this.stopped) {
      const x = this.q.pop();
      if (!x) break;
      if (x.dead) continue;
      if (x.t > this.horizon) break;
      this.now = x.t;
      x.fn();
    }
  }
}

/** A readout the engine counts from the trace: a counter's sum, or a gauge's latest value. */
export interface Readout {
  key: string;
  label: string;
  kind?: 'count' | 'gauge';
  /** Appended to the value, e.g. ' ms'. */
  unit?: string;
  digits?: number;
}

/** A small state machine the engine draws beside the lanes, counting observed transitions. */
export interface Machine {
  states: string[];
  /** Lanes whose states belong to the machine; default all. */
  lanes?: number[];
}

/** What a kernel declares about its run before it is installed. */
export interface Setup {
  lanes: string[];
  horizon: number;
  /** Partition side of each lane (-1: unaffected); default: lanes split in two halves. */
  side?: number[];
  /** The width of the diagram's sliding time window in ms (default: the run, at most 1500). */
  window?: number;
  /** End the diagram where the run stopped (a kernel that calls stop()) instead of at the horizon. */
  fit?: boolean;
  /** Network defaults this kernel runs on when it does not expose the network controls. */
  net?: Partial<NetConfig>;
}

export interface SystemsKernel<R = unknown> {
  /** Extra controls; one that changes the scenario sets `rebuild: true`. */
  params?: ParamDef[];
  /** Expose the shared network controls (delay, loss, partition). */
  network?: boolean;
  setup(p: Params): Setup;
  /** Install the protocol and its workload on the net; the result is filled in as it runs. */
  install(net: Net, p: Params): R;
  readouts: Readout[];
  /** Samples plotted against time; `series` fixes their order (default: first appearance), and
   * `bin` sums them per bin of that many ms (a rate) instead of plotting each sample. */
  chart?: { title: string; y: string; series?: string[]; bin?: number };
  machine?: Machine;
  /** A one-line result computed from the finished run (an invariant checked, a time measured). */
  verdict?(r: R, net: Net): string;
}

export const NET_PARAMS: ParamDef[] = [
  { kind: 'range', key: 'delay', label: 'Max message delay (ms)', min: 5, max: 120, step: 5, value: 40, rebuild: true },
  { kind: 'range', key: 'loss', label: 'Message loss (%)', min: 0, max: 40, step: 1, value: 5, rebuild: true },
  { kind: 'toggle', key: 'partition', label: 'Partition mid-run', value: true, rebuild: true },
  { kind: 'range', key: 'heal', label: 'Partition heals at (% of run)', min: 40, max: 90, step: 5, value: 60, rebuild: true },
];

/** The network a kernel runs on: its defaults, overridden by the shared controls if exposed. */
export function netConfig(k: SystemsKernel, s: Setup, p: Params): NetConfig {
  const base: NetConfig = { delay: [5, 40], loss: 0, partition: null, ...s.net };
  if (!k.network) return base;
  const dmax = Number(p.delay ?? 40);
  const half = Math.floor(s.lanes.length / 2);
  const side = s.side ?? s.lanes.map((_, i) => (i < half ? 0 : 1));
  return {
    delay: [Math.max(1, dmax / 8), dmax],
    loss: Number(p.loss ?? 0) / 100,
    partition: p.partition === true
      ? { from: Math.round(s.horizon * 0.3), to: Math.round((s.horizon * Number(p.heal ?? 60)) / 100), side } : null,
  };
}

/** Every parameter's default value for a kernel, with the network controls if it uses them. */
export function defaultParams(k: SystemsKernel, over: Params = {}): Params {
  const out: Params = {};
  for (const d of [...(k.network ? NET_PARAMS : []), ...(k.params ?? [])]) out[d.key] = d.value;
  return { ...out, ...over };
}

export interface Run<R = unknown> {
  net: Net;
  result: R;
  setup: Setup;
  /** The simulated time the diagram spans. */
  span: number;
}

/** Build, install and run a kernel's scenario to its horizon. */
export function simulate<R>(k: SystemsKernel<R>, p: Params, seed: number): Run<R> {
  const s = k.setup(p);
  const net = new Net(s.lanes, netConfig(k, s, p), seed, s.horizon);
  const result = k.install(net, p);
  net.run();
  const span = s.fit ? Math.max(1, Math.min(net.now, s.horizon)) : s.horizon;
  return { net, result, setup: s, span };
}

/** A counter's total over the whole run (tests and verdicts). */
export function total(net: Net, key: string): number {
  let s = 0;
  for (const e of net.events) if (e.k === 'count' && e.key === key) s += e.by;
  return s;
}
