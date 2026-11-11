import { num } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';

// A client calls a dependency through a breaker. Closed, calls pass and consecutive failures
// are counted; at the threshold the breaker opens and refuses calls at once. After a cooldown
// it is half-open: one trial call goes through (others are refused while it is out); success
// closes the breaker, failure opens it again for another cooldown. The dependency degrades for
// a stretch of the run (it fails almost every call), then recovers.

export type BreakerState = 'closed' | 'open' | 'half-open';
export type Input = 'success' | 'failure' | 'cooldown';

export interface Transition { t: number; from: BreakerState; input: Input; failures: number; to: BreakerState }
export interface BreakerResult { transitions: Transition[]; threshold: number }

/** The breaker's state machine: the next state, and the consecutive-failure count after it. */
export function step(s: BreakerState, input: Input, failures: number, threshold: number): [BreakerState, number] {
  if (s === 'closed') {
    if (input === 'success') return ['closed', 0];
    if (input === 'failure') return failures + 1 >= threshold ? ['open', 0] : ['closed', failures + 1];
    return ['closed', failures];
  }
  if (s === 'open') return input === 'cooldown' ? ['half-open', 0] : ['open', 0];
  if (input === 'success') return ['closed', 0];
  if (input === 'failure') return ['open', 0];
  return ['half-open', 0];
}

export const kernel: SystemsKernel<BreakerResult> = {
  params: [
    { kind: 'range', key: 'threshold', label: 'Failures to trip', min: 1, max: 12, step: 1, value: 4, rebuild: true },
    { kind: 'range', key: 'cooldown', label: 'Cooldown (ms)', min: 100, max: 2000, step: 50, value: 500, rebuild: true },
  ],
  setup: () => ({ lanes: ['client', 'breaker', 'dependency'], horizon: 7000, net: { delay: [2, 10] } }),
  machine: { states: ['closed', 'open', 'half-open'], lanes: [1] },
  install(net, p) {
    const threshold = num(p, 'threshold'); const cooldown = num(p, 'cooldown');
    const res: BreakerResult = { transitions: [], threshold };
    const degraded: [number, number] = [1500, 4200];
    let state: BreakerState = 'closed';
    let failures = 0;
    let trialOut = false;
    const feed = (input: Input) => {
      const [to, f] = step(state, input, failures, threshold);
      res.transitions.push({ t: net.now, from: state, input, failures, to });
      if (to !== state) {
        if (to === 'open') { net.count('trips'); net.after(cooldown, () => feed('cooldown')); }
        if (to === 'closed') net.count('recoveries');
        net.state(1, to);
        net.mark(1, to, to === 'open' ? 0.05 : to === 'closed' ? 0.85 : 0.5);
      }
      state = to; failures = f;
    };
    const call = () => {
      net.after(net.uniform(25, 60), call);
      net.count('calls');
      net.send(0, 1, '', () => {
        const pass = state === 'closed' || (state === 'half-open' && !trialOut);
        if (!pass) {
          net.count('fast');
          net.sample('refused by the breaker', 1);
          net.send(1, 0, 'refused', () => {}, { reliable: true });
          return;
        }
        const trial = state === 'half-open';
        if (trial) trialOut = true;
        net.count('forwarded');
        net.sample('calls reaching the dependency', 1);
        net.send(1, 2, 'call', () => {
          const bad = net.now >= degraded[0] && net.now < degraded[1];
          const ok = net.rnd() >= (bad ? 0.95 : 0.03);
          net.after(net.uniform(5, 30), () => {
            net.send(2, 1, ok ? 'ok' : 'error', () => {
              if (!ok) { net.count('failures'); net.sample('failed calls', 1); }
              // a late answer to a call made while closed counts only if still closed
              if (trial) { trialOut = false; feed(ok ? 'success' : 'failure'); } else if (state === 'closed') feed(ok ? 'success' : 'failure');
              net.send(1, 0, ok ? 'ok' : 'error', () => {}, { reliable: true });
            }, { reliable: true });
          });
        }, { reliable: true });
      }, { reliable: true });
    };
    net.state(1, 'closed');
    net.state(2, '');
    net.at(degraded[0], () => { net.state(2, 'degraded'); });
    net.at(degraded[1], () => { net.state(2, ''); });
    net.after(0, call);
    return res;
  },
  readouts: [
    { key: 'calls', label: 'Calls' },
    { key: 'forwarded', label: 'Reached the dependency' },
    { key: 'fast', label: 'Refused at once' },
    { key: 'failures', label: 'Failed at the dependency' },
    { key: 'trips', label: 'Trips (to open)' },
    { key: 'recoveries', label: 'Recoveries (to closed)' },
  ],
  chart: {
    title: 'Calls per 200 ms',
    y: 'calls',
    series: ['calls reaching the dependency', 'failed calls', 'refused by the breaker'],
    bin: 200,
  },
  verdict(r) {
    let bad = 0;
    for (const x of r.transitions) if (step(x.from, x.input, x.failures, r.threshold)[0] !== x.to) bad++;
    return bad ? `${bad} transitions off the table` : `${r.transitions.filter((x) => x.from !== x.to).length} state changes, all by the table`;
  },
};
