import { num } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';

// Workers loop: think, take the ticket lock for a short critical section, then take one of a
// fixed number of slots for heavy work. The ticket lock is two shared counters: a worker
// fetches-and-increments `next` to draw a ticket and spins, polling `serving`, until it equals
// its ticket; release increments `serving`. So the lock is granted in the order tickets were
// drawn. The counting semaphore keeps a count of free slots and a FIFO queue of waiters; a
// release hands its slot straight to the head of the queue if there is one.

export interface Hold { worker: number; ticket?: number; asked: number; granted: number; released: number }
/** `grants`: the ticket of each lock grant, in the order the lock was granted. */
export interface LockResult { lock: Hold[]; slots: Hold[]; k: number; grants: number[] }

const MEMORY = 1.5; // ms for one access to the shared counters

/** The largest number of holds overlapping at one instant (a release before a grant at a tie). */
export function maxOverlap(holds: Hold[]): number {
  const ev: [number, number][] = [];
  for (const h of holds) {
    if (Number.isNaN(h.granted)) continue;
    ev.push([h.granted, 1]);
    if (!Number.isNaN(h.released)) ev.push([h.released, -1]);
  }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0; let max = 0;
  for (const [, d] of ev) { cur += d; max = Math.max(max, cur); }
  return max;
}

export const kernel: SystemsKernel<LockResult> = {
  params: [
    { kind: 'range', key: 'workers', label: 'Workers', min: 2, max: 8, step: 1, value: 5, rebuild: true },
    { kind: 'range', key: 'slots', label: 'Heavy-work slots (semaphore count)', min: 1, max: 4, step: 1, value: 2, rebuild: true },
    { kind: 'range', key: 'poll', label: 'Spin poll interval (ms)', min: 6, max: 30, step: 1, value: 6, rebuild: true },
  ],
  setup: (p) => {
    const w = num(p, 'workers');
    return { lanes: [...Array.from({ length: w }, (_, i) => `worker ${i + 1}`), 'ticket lock', 'slots'], horizon: 6000, net: { delay: [MEMORY, MEMORY] } };
  },
  install(net, p) {
    const W = num(p, 'workers'); const k = num(p, 'slots'); const poll = num(p, 'poll');
    const LOCK = W; const SEM = W + 1;
    const res: LockResult = { lock: [], slots: [], k, grants: [] };
    let next = 0; let serving = 0;
    let free = k;
    const queue: { worker: number; hold: Hold }[] = [];
    let waitingLock = 0;
    const gauges = () => {
      net.sample('waiting for the lock', waitingLock);
      net.sample('waiting for a slot', queue.length);
      net.sample('slots in use', k - free);
    };
    let maxLockWait = 0; let maxSlotWait = 0; let maxHeld = 0;
    const think = (w: number) => {
      net.state(w, '');
      net.after(net.uniform(40, 260), () => lock(w));
    };
    const lock = (w: number) => {
      net.state(w, 'waiting for lock');
      net.send(w, LOCK, 'take', () => {
        const ticket = next++;
        const hold: Hold = { worker: w, ticket, asked: net.now, granted: NaN, released: NaN };
        res.lock.push(hold);
        waitingLock++;
        gauges();
        net.mark(LOCK, `#${ticket}`, 0.5);
        const spin = () => {
          if (serving === ticket) {
            hold.granted = net.now;
            // the grant log: in ticket order, each grant goes to the ticket after the previous one
            const prev = res.grants.length ? res.grants[res.grants.length - 1] : -1;
            res.grants.push(ticket);
            net.count('lock.out_of_order', ticket === prev + 1 ? 0 : 1);
            waitingLock--;
            gauges();
            maxLockWait = Math.max(maxLockWait, hold.granted - hold.asked);
            net.gauge('lock.wait', maxLockWait);
            net.count('lock.acquired');
            net.state(w, 'critical section');
            net.after(net.uniform(15, 50), () => {
              hold.released = net.now;
              net.send(w, LOCK, 'release', () => { serving++; }, { reliable: true });
              slot(w);
            });
            return;
          }
          net.count('spins');
          net.after(poll + MEMORY, spin);
        };
        spin();
      }, { reliable: true });
    };
    const slot = (w: number) => {
      net.state(w, 'waiting for slot');
      net.send(w, SEM, 'acquire', () => {
        const hold: Hold = { worker: w, asked: net.now, granted: NaN, released: NaN };
        res.slots.push(hold);
        if (free > 0) { free--; grant(w, hold); } else { queue.push({ worker: w, hold }); gauges(); }
      }, { reliable: true });
    };
    const grant = (w: number, hold: Hold) => {
      hold.granted = net.now;
      maxSlotWait = Math.max(maxSlotWait, hold.granted - hold.asked);
      net.gauge('slot.wait', maxSlotWait);
      maxHeld = Math.max(maxHeld, k - free);
      net.gauge('slot.max', maxHeld);
      net.count('slot.acquired');
      gauges();
      net.send(SEM, w, 'slot', () => {
        net.state(w, 'heavy work');
        net.after(net.uniform(150, 420), () => {
          net.send(w, SEM, 'release', () => {
            hold.released = net.now;
            const head = queue.shift();
            if (head) grant(head.worker, head.hold); else { free++; gauges(); }
          }, { reliable: true });
          think(w);
        });
      }, { reliable: true });
    };
    for (let w = 0; w < W; w++) net.after(net.uniform(0, 100), () => lock(w));
    net.state(LOCK, '');
    gauges();
    return res;
  },
  readouts: [
    { key: 'lock.acquired', label: 'Lock acquisitions' },
    { key: 'spins', label: 'Polls while spinning' },
    { key: 'lock.out_of_order', label: 'Lock grants out of ticket order' },
    { key: 'lock.wait', kind: 'gauge', label: 'Longest wait for the lock', unit: ' ms', digits: 1 },
    { key: 'slot.acquired', label: 'Slot acquisitions' },
    { key: 'slot.wait', kind: 'gauge', label: 'Longest wait for a slot', unit: ' ms', digits: 1 },
    { key: 'slot.max', kind: 'gauge', label: 'Most slots held at once' },
  ],
  chart: { title: 'Queues and slots in use', y: 'workers', series: ['waiting for the lock', 'waiting for a slot', 'slots in use'] },
  verdict(r) {
    const granted = r.lock.filter((h) => !Number.isNaN(h.granted)).sort((a, b) => a.granted - b.granted);
    const fifo = granted.every((h, i) => h.ticket === i);
    return `${fifo ? 'lock granted in ticket order' : 'lock order broken'}; at most ${maxOverlap(r.slots)} of ${r.k} slots held at once`;
  },
};
