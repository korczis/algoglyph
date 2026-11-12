import { num } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';

// A lock service grants one lease at a time, for a fixed time to live, with a fencing token
// that grows by one per grant. A worker measures its lease from the moment it asked (so its
// own view never outlives the service's), checks it before each write and sends the token
// with the write. Workers sometimes stall (a long pause) between that check and the write, so
// the write can arrive after the lease has expired and another worker holds a newer one. The
// storage remembers the largest token it has accepted and rejects anything smaller.

export interface Grant { token: number; worker: number; t: number; expires: number[] }
export interface Write { t: number; worker: number; token: number; accepted: boolean }
export interface LeaseResult { grants: Grant[]; writes: Write[] }

const TTL = 500;

export const kernel: SystemsKernel<LeaseResult> = {
  params: [
    { kind: 'range', key: 'workers', label: 'Workers', min: 2, max: 5, step: 1, value: 3, rebuild: true },
    { kind: 'range', key: 'pause', label: 'Chance of a long pause per write (%)', min: 0, max: 50, step: 1, value: 15, rebuild: true },
    { kind: 'toggle', key: 'fencing', label: 'Storage checks fencing tokens', value: true, rebuild: true },
  ],
  setup: (p) => {
    const w = num(p, 'workers');
    return {
      lanes: ['lock service', ...Array.from({ length: w }, (_, i) => `worker ${i + 1}`), 'storage'],
      horizon: 6000,
      window: 2500,
      net: { delay: [5, 30] },
    };
  },
  install(net, p) {
    const W = num(p, 'workers');
    const pause = num(p, 'pause') / 100;
    const fencing = p.fencing !== false;
    const storage = W + 1;
    const res: LeaseResult = { grants: [], writes: [] };
    let token = 0;
    let holder = -1; let expiry = -Infinity;
    let maxAccepted = 0;

    const acquire = (w: number) => {
      const asked = net.now;
      net.send(w + 1, 0, 'acquire', () => {
        let granted = 0;
        if (holder === w && net.now < expiry) { granted = token; expiry = net.now + TTL; res.grants[res.grants.length - 1].expires.push(expiry); net.count('renewals'); } else if (net.now >= expiry) {
          token++;
          holder = w;
          expiry = net.now + TTL;
          granted = token;
          res.grants.push({ token, worker: w, t: net.now, expires: [expiry] });
          net.count('grants');
          net.gauge('token', token);
          net.sample('token issued', token);
          net.mark(0, `#${token}`, 0.6);
        }
        net.send(0, w + 1, granted ? `lease #${granted}` : 'busy', () => {
          if (!granted) { net.after(net.uniform(100, 300), () => acquire(w)); return; }
          hold(w, granted, asked + TTL, 2 + Math.floor(net.rnd() * 5));
        });
      });
    };
    // do `left` writes under lease `tok`, believed valid until `deadline`
    const hold = (w: number, tok: number, deadline: number, left: number) => {
      net.state(w + 1, 'holds lease');
      const work = net.uniform(60, 140);
      net.after(work, () => {
        if (net.now + 40 >= deadline || left <= 0) {
          net.state(w + 1, '');
          if (left > 0) acquire(w); else net.after(net.uniform(200, 600), () => acquire(w));
          return;
        }
        const stall = net.rnd() < pause ? net.uniform(450, 900) : 0;
        if (stall) { net.state(w + 1, 'paused'); net.count('pauses'); }
        net.after(stall, () => {
          net.state(w + 1, stall ? 'writes late' : 'holds lease');
          net.send(w + 1, storage, `write #${tok}`, () => {
            const ok = !fencing || tok >= maxAccepted;
            const stale = tok < maxAccepted;
            if (ok) maxAccepted = Math.max(maxAccepted, tok);
            res.writes.push({ t: net.now, worker: w, token: tok, accepted: ok });
            if (ok) {
              net.count('accepted');
              if (stale) net.count('corrupting');
              net.sample('largest token accepted', maxAccepted);
            } else net.count('rejected');
            net.mark(storage, ok ? `#${tok}` : `✕#${tok}`, ok ? (stale ? 0.05 : 0.85) : 0.25);
            net.send(storage, w + 1, ok ? 'ok' : 'stale', () => {
              if (!ok) { net.state(w + 1, ''); net.after(net.uniform(100, 300), () => acquire(w)); return; }
              // a late writer re-checks its lease and gives up when it has run out
              if (stall) { net.state(w + 1, ''); acquire(w); return; }
              hold(w, tok, deadline, left - 1);
            });
          });
        });
      });
    };
    for (let w = 0; w < W; w++) net.after(net.uniform(0, 200), () => acquire(w));
    return res;
  },
  readouts: [
    { key: 'grants', label: 'Leases granted' },
    { key: 'renewals', label: 'Leases renewed' },
    { key: 'accepted', label: 'Writes accepted' },
    { key: 'rejected', label: 'Stale writes rejected' },
    { key: 'corrupting', label: 'Stale writes accepted (fencing off)' },
    { key: 'pauses', label: 'Long pauses' },
    { key: 'token', kind: 'gauge', label: 'Latest token' },
  ],
  chart: { title: 'Fencing tokens', y: 'token' },
  verdict(r) {
    let max = 0; let bad = 0;
    for (const w of r.writes) { if (w.accepted) { if (w.token < max) bad++; max = Math.max(max, w.token); } }
    return bad ? `${bad} stale writes landed` : `every accepted write carried the newest token seen (${r.writes.filter((w) => !w.accepted).length} refused)`;
  },
};
