// euler-tour's own work (wave 7b). D5: after each pop the kernel asked `stack.includes(v)` to
// learn whether v was still on the stack (and so not yet exhausted). The stack grows with every
// edge walked, so that test read O(E^2) stack slots in all, uncounted, where the complexity line
// says O(V + E). The kernel now keeps a count of each vertex's places on the stack. Two proofs, both
// within one run: the event sequence and the result equal those of a reference Hierholzer that
// still asks `includes`, written out here; and the kernel reads no stack entry to answer the
// question, where the reference reads 1 + m(m - 1)/2 of them on a single cycle of m edges.
import { describe, expect, it } from 'vitest';
import { build, makeGraph, other, type Graph } from '../src/engines/graph/graph';
import { E, trace, type GraphKernel } from '../src/engines/graph/trace';
import { kernel, type EulerResult } from '../src/kernels/graph/euler-tour';

const W = 5;

/** Hierholzer's algorithm as euler-tour ran it before D5, with the membership test by scan. */
const reference: GraphKernel<EulerResult> = {
  ...kernel,
  *steps(ops, { s }) {
    const g = ops.g;
    const used = new Array<boolean>(g.m).fill(false);
    const next = new Array<number>(g.n).fill(0);
    const stack = [s]; const via = [-1];
    const tour: number[] = []; const edges: number[] = [];
    ops.discover(s);
    while (stack.length) {
      const v = stack[stack.length - 1];
      let e = -1;
      while (next[v] < g.out[v].length) {
        const f = g.out[v][next[v]++];
        ops.scan(f);
        if (!used[f]) { e = f; break; }
      }
      if (e >= 0) {
        used[e] = true;
        ops.edge(e, E.tree);
        const w = other(g, e, v);
        stack.push(w); via.push(e);
        ops.discover(w);
      } else {
        stack.pop();
        const f = via.pop() as number;
        tour.push(v);
        if (f >= 0) { edges.push(f); ops.edge(f, E.mark); }
        if (!stack.includes(v)) ops.settle(v);
        yield;
      }
    }
    tour.reverse(); edges.reverse();
    return { tour, edges };
  },
};

const run = (k: GraphKernel<EulerResult>, g: Graph) => trace(k, g, { s: g.s, t: g.t, p: {} });

/** Array entries read by includes, indexOf and lastIndexOf while `f` runs: a scan for a value
 * reads up to the first match, or the whole array when there is none. */
function entriesScanned(f: () => void): number {
  const proto = Array.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = ['includes', 'indexOf', 'lastIndexOf'] as const;
  const saved = names.map((name) => proto[name]);
  const indexOf = saved[1];
  let reads = 0;
  names.forEach((name, i) => {
    proto[name] = function (this: unknown[], ...args: unknown[]) {
      const at = indexOf.apply(this, args) as number;
      reads += name === 'lastIndexOf' ? this.length - Math.max(at, 0)
        : at < 0 ? this.length : at + 1;
      return saved[i].apply(this, args);
    };
  });
  try { f(); } finally { names.forEach((name, i) => { proto[name] = saved[i]; }); }
  return reads;
}

/** A single cycle 0 - 1 - ... - (m - 1) - 0 of m edges. */
function cycle(m: number): Graph {
  const x = Array.from({ length: m }, (_, i) => Math.cos((2 * Math.PI * i) / m));
  const y = Array.from({ length: m }, (_, i) => Math.sin((2 * Math.PI * i) / m));
  const edges = Array.from({ length: m }, (_, i) => [i, (i + 1) % m, 1] as [number, number, number]);
  return build('eulerian', x, y, edges, false);
}

describe('euler-tour keeps an on-stack count, not a scan of the stack (D5)', () => {
  const inputs: [string, Graph][] = [];
  for (const n of [6, 50, 200]) for (const seed of [4242, 7, 1, 99]) {
    inputs.push([`eulerian n ${n}, seed ${seed}`, makeGraph('eulerian', n, seed, 16 / 9)]);
  }
  inputs.push(['a cycle of 300 edges', cycle(300)]);

  for (const [what, g] of inputs) {
    it(`replays the reference's events and tour exactly: ${what}`, () => {
      const a = run(kernel, g);
      const b = run(reference, g);
      expect(a.truncated || b.truncated).toBe(false);
      expect(a.length).toBe(b.length);
      expect(Array.from(a.events.subarray(0, W * a.length)))
        .toEqual(Array.from(b.events.subarray(0, W * b.length)));
      expect(a.result).toEqual(b.result);
      expect(a.counts).toEqual(b.counts);
      expect(a.result?.edges.length).toBe(g.m);
    });
  }

  it('reads no stack entry for the membership test; the reference reads 1 + m(m - 1)/2', () => {
    for (const m of [10, 100, 1000]) {
      const g = cycle(m);
      expect(entriesScanned(() => run(reference, g)), `reference, m ${m}`)
        .toBe(1 + (m * (m - 1)) / 2);
      expect(entriesScanned(() => run(kernel, g)), `kernel, m ${m}`).toBe(0);
    }
    for (const seed of [4242, 7]) {
      const g = makeGraph('eulerian', 200, seed, 16 / 9);
      expect(entriesScanned(() => run(reference, g))).toBeGreaterThan(0);
      expect(entriesScanned(() => run(kernel, g)), `eulerian n 200, seed ${seed}`).toBe(0);
    }
  });
});
