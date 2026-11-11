// State-based CRDTs: a PN-counter and an observed-remove set (add wins over a concurrent
// remove). A replica's state only grows, and merge is a join (union and entrywise maximum), so
// merging is commutative, associative and idempotent and any delivery order converges.

export interface Replica {
  /** Increments and decrements per replica: the PN-counter. */
  p: number[];
  n: number[];
  /** element -> the unique tags of the adds that put it in */
  adds: Map<string, Set<string>>;
  /** Tags removed (tombstones): a remove deletes the add tags it has observed. */
  removed: Set<string>;
  /**
   * add tag -> the tombstones of its element its replica had observed when it added it: the
   * causal context that tells a concurrent add from one made after the remove. Fixed per tag,
   * so it does not take part in the state's identity.
   */
  ctx: Map<string, Set<string>>;
}

export function empty(r: number): Replica {
  return {
    p: new Array(r).fill(0), n: new Array(r).fill(0),
    adds: new Map(), removed: new Set(), ctx: new Map(),
  };
}

export function clone(s: Replica): Replica {
  return {
    p: s.p.slice(), n: s.n.slice(),
    adds: new Map([...s.adds].map(([k, v]) => [k, new Set(v)])),
    removed: new Set(s.removed),
    ctx: new Map([...s.ctx].map(([k, v]) => [k, new Set(v)])),
  };
}

export function increment(s: Replica, i: number, by: number) {
  if (by >= 0) s.p[i] += by; else s.n[i] -= by;
}

function tombstonesOf(s: Replica, element: string): string[] {
  return [...(s.adds.get(element) ?? [])].filter((t) => s.removed.has(t));
}

function insert(s: Replica, element: string, tag: string) {
  let set = s.adds.get(element);
  if (!set) { set = new Set(); s.adds.set(element, set); }
  set.add(tag);
}

export function add(s: Replica, element: string, tag: string) {
  s.ctx.set(tag, new Set(tombstonesOf(s, element)));
  insert(s, element, tag);
}

/** Remove what this replica has observed of `element`; returns the tags tombstoned. */
export function remove(s: Replica, element: string): string[] {
  const tags = [...(s.adds.get(element) ?? [])].filter((t) => !s.removed.has(t));
  for (const t of tags) s.removed.add(t);
  return tags;
}

export function value(s: Replica): number {
  let v = 0;
  for (let i = 0; i < s.p.length; i++) v += s.p[i] - s.n[i];
  return v;
}

export function elements(s: Replica): string[] {
  const out: string[] = [];
  for (const [e, tags] of s.adds) if ([...tags].some((t) => !s.removed.has(t))) out.push(e);
  return out.sort();
}

/**
 * Join `other` into `s`; returns the elements that came back because of an add concurrent with
 * a remove this replica had observed: an add whose replica had not seen that remove. An add made
 * after its replica learnt of the remove is a new add, not a conflict.
 */
export function merge(s: Replica, other: Replica): string[] {
  const before = new Set(elements(s));
  const stones = new Map<string, string[]>();
  for (const e of s.adds.keys()) {
    const t = tombstonesOf(s, e);
    if (t.length) stones.set(e, t);
  }
  const fresh = new Map<string, string[]>();
  for (let i = 0; i < s.p.length; i++) {
    s.p[i] = Math.max(s.p[i], other.p[i]);
    s.n[i] = Math.max(s.n[i], other.n[i]);
  }
  for (const [e, tags] of other.adds) for (const t of tags) {
    if (!s.adds.get(e)?.has(t)) fresh.set(e, [...(fresh.get(e) ?? []), t]);
    insert(s, e, t);
  }
  for (const [t, c] of other.ctx) if (!s.ctx.has(t)) s.ctx.set(t, new Set(c));
  for (const t of other.removed) s.removed.add(t);
  return elements(s).filter((e) => !before.has(e) && stones.has(e) && (fresh.get(e) ?? []).some(
    (t) => !s.removed.has(t) && stones.get(e)!.some((r) => !s.ctx.get(t)?.has(r))));
}

/** A canonical encoding: equal states encode equally. */
export function encode(s: Replica): string {
  const adds = [...s.adds].map(([e, t]) => `${e}:${[...t].sort().join(',')}`).sort().join(';');
  return `${s.p.join(',')}|${s.n.join(',')}|${adds}|${[...s.removed].sort().join(',')}`;
}
