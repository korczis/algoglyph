// The Josephus problem on a circular singly linked list kept in an array: `next[i]` is the
// person after i. A cursor sits on the predecessor of the person being counted, so removing
// the M-th one is a single relink.

export interface Circle {
  n: number;
  m: number;
  next: Int32Array;
  alive: Uint8Array;
  /** The node before the one counted next. */
  cursor: number;
  /** Links followed in the current count, 0 … m − 1. */
  counted: number;
  left: number;
  /** Removal order, 0-based people. */
  order: number[];
  links: number;
}

export function circle(n: number, m: number): Circle {
  const next = new Int32Array(n);
  for (let i = 0; i < n; i++) next[i] = (i + 1) % n;
  return { n, m, next, alive: new Uint8Array(n).fill(1), cursor: n - 1, counted: 0, left: n,
    order: [], links: 0 };
}

export type Event = 'walk' | 'remove' | 'done';

/** Follow one link, or remove the M-th person once M − 1 links have been followed. */
export function tick(c: Circle): Event {
  if (c.left <= 1) return 'done';
  if (c.counted < c.m - 1) {
    c.cursor = c.next[c.cursor];
    c.counted++;
    c.links++;
    return 'walk';
  }
  const victim = c.next[c.cursor];
  c.next[c.cursor] = c.next[victim];
  c.alive[victim] = 0;
  c.order.push(victim);
  c.left--;
  c.counted = 0;
  return 'remove';
}

/** The one person left once the circle is done, or −1 before. */
export function survivor(c: Circle): number {
  return c.left === 1 ? c.cursor : -1;
}

/** Run to the end: the removal order and the survivor, both 0-based. */
export function josephus(n: number, m: number): { order: number[]; survivor: number; links: number } {
  const c = circle(n, m);
  while (tick(c) !== 'done');
  return { order: c.order, survivor: survivor(c), links: c.links };
}
