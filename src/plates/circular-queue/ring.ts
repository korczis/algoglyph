// A first-in first-out queue in a fixed array: `head` is the next slot to read, `tail` the next
// slot to write, both advance modulo the capacity. `size` tells a full ring from an empty one.

export class RingQueue {
  readonly slots: Int32Array;
  head = 0;
  tail = 0;
  size = 0;

  constructor(readonly capacity: number) {
    this.slots = new Int32Array(capacity).fill(-1);
  }

  /** False, and nothing written, when the ring is full. */
  enqueue(value: number): boolean {
    if (this.size === this.capacity) return false;
    this.slots[this.tail] = value;
    this.tail = (this.tail + 1) % this.capacity;
    this.size++;
    return true;
  }

  /** The oldest value, or undefined when the ring is empty. */
  dequeue(): number | undefined {
    if (this.size === 0) return undefined;
    const value = this.slots[this.head];
    this.slots[this.head] = -1;
    this.head = (this.head + 1) % this.capacity;
    this.size--;
    return value;
  }

  /** The queue's contents from oldest to newest. */
  toArray(): number[] {
    const out: number[] = [];
    for (let k = 0; k < this.size; k++) out.push(this.slots[(this.head + k) % this.capacity]);
    return out;
  }
}

export interface Traffic {
  queue: RingQueue;
  ticks: number;
  next: number;
  enqueued: number;
  dequeued: number;
  rejected: number;
  idle: number;
  wraps: number;
}

export function traffic(capacity: number): Traffic {
  return { queue: new RingQueue(capacity), ticks: 0, next: 0, enqueued: 0, dequeued: 0,
    rejected: 0, idle: 0, wraps: 0 };
}

/** Offer one arrival; counts a rejection when the ring is full. */
export function arrive(t: Traffic): boolean {
  if (!t.queue.enqueue(t.next)) {
    t.rejected++;
    return false;
  }
  if (t.queue.tail === 0) t.wraps++; // the tail just wrapped past the array's end
  t.next++;
  t.enqueued++;
  return true;
}

/** Serve one item; counts an idle poll when the ring is empty. */
export function serve(t: Traffic): number | undefined {
  const v = t.queue.dequeue();
  if (v === undefined) t.idle++;
  else t.dequeued++;
  return v;
}

/** One tick: an arrival with probability `pIn`, then a service with probability `pOut`. */
export function tick(t: Traffic, rnd: () => number, pIn: number, pOut: number): void {
  t.ticks++;
  if (rnd() < pIn) arrive(t);
  if (rnd() < pOut) serve(t);
}
