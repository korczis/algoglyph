import { num } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';

// A limiter in front of a backend. Tokens accrue continuously at `rate` per second up to the
// bucket's capacity `burst`; a request that finds at least one token spends it and passes, one
// that finds none is refused at once. Over any interval of length t the limiter therefore
// admits at most rate * t + burst requests, however the clients bunch their arrivals.

export interface Arrival { t: number; client: number; admitted: boolean; tokensBefore: number }
export interface BucketResult { arrivals: Arrival[]; rate: number; burst: number }

const CLIENTS = 3;

export const kernel: SystemsKernel<BucketResult> = {
  params: [
    { kind: 'range', key: 'rate', label: 'Refill rate (tokens per second)', min: 2, max: 60, step: 1, value: 12, rebuild: true },
    { kind: 'range', key: 'burst', label: 'Bucket size (burst)', min: 1, max: 40, step: 1, value: 8, rebuild: true },
    { kind: 'range', key: 'load', label: 'Offered load (requests per second)', min: 2, max: 120, step: 1, value: 30, rebuild: true },
    { kind: 'range', key: 'duration', label: 'Run length (s)', min: 2, max: 12, step: 1, value: 6, rebuild: true },
  ],
  setup: (p) => ({
    lanes: [...Array.from({ length: CLIENTS }, (_, i) => `client ${String.fromCharCode(65 + i)}`), 'limiter', 'backend'],
    horizon: num(p, 'duration') * 1000,
    net: { delay: [2, 12] },
  }),
  install(net, p) {
    const rate = num(p, 'rate'); const burst = num(p, 'burst');
    const load = num(p, 'load');
    const L = CLIENTS; const B = CLIENTS + 1;
    const res: BucketResult = { arrivals: [], rate, burst };
    let tokens = burst; let at = 0;
    const refill = () => { tokens = Math.min(burst, tokens + (rate * (net.now - at)) / 1000); at = net.now; };
    // each client alternates quiet spells with bursts, so the offered load arrives bunched
    const client = (c: number, hot: boolean, until: number) => {
      if (net.now >= until) {
        const next = !hot;
        net.state(c, next ? 'bursting' : '');
        client(c, next, net.now + (next ? net.uniform(300, 900) : net.uniform(400, 1400)));
        return;
      }
      const perClient = load / CLIENTS;
      const lambda = (hot ? perClient * 2.5 : perClient * 0.4) / 1000;
      const gap = -Math.log(1 - net.rnd()) / lambda;
      net.after(Math.min(gap, Math.max(1, until - net.now)), () => {
        if (net.now < until) {
          net.count('requests');
          net.sample('offered', 1);
          net.send(c, L, 'req', () => {
            refill();
            const before = tokens;
            const ok = tokens >= 1;
            if (ok) tokens -= 1;
            res.arrivals.push({ t: net.now, client: c, admitted: ok, tokensBefore: before });
            net.gauge('tokens', tokens);
            if (ok) {
              net.count('admitted');
              net.sample('admitted', 1);
              net.send(L, B, 'pass', () => net.count('served'), { reliable: true });
            } else {
              net.count('rejected');
              net.mark(L, '', 0.05);
              net.send(L, c, '429', () => {}, { reliable: true });
            }
          }, { reliable: true });
        }
        client(c, hot, until);
      });
    };
    for (let c = 0; c < CLIENTS; c++) client(c, false, net.uniform(0, 800));
    net.state(L, 'limiter');
    return res;
  },
  readouts: [
    { key: 'requests', label: 'Requests sent' },
    { key: 'admitted', label: 'Admitted' },
    { key: 'rejected', label: 'Refused (no token)' },
    { key: 'tokens', kind: 'gauge', label: 'Tokens in the bucket', digits: 1 },
  ],
  chart: { title: 'Requests per 250 ms', y: 'requests', series: ['offered', 'admitted'], bin: 250 },
  verdict(r) {
    const a = r.arrivals.filter((x) => x.admitted).map((x) => x.t);
    let worst = 0;
    for (let i = 0; i < a.length; i++) {
      for (let j = i; j < a.length; j++) worst = Math.max(worst, j - i + 1 - (r.rate * (a[j] - a[i])) / 1000);
    }
    return `largest excess over rate × t: ${worst.toFixed(2)} ≤ burst ${r.burst}`;
  },
};
