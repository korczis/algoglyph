// Seeded key streams and the workload every hash kernel runs: insert the keys, measuring searches
// at checkpoints along the way, then delete some of them, measuring again. The workload knows
// which keys are present from its own bookkeeping, never from a kernel.
import type { ParamDef } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import { GOLDEN, inverse32, KIND, type Step } from './table';

export const STREAMS = ['uniform', 'clustered', 'adversarial'] as const;
export type Stream = (typeof STREAMS)[number];
export const STREAM_LABELS: Record<Stream, string> = {
  uniform: 'Uniform random keys',
  clustered: 'Clustered keys (runs of consecutive ids)',
  adversarial: 'Adversarial for h1 (one narrow hash band)',
};

const KEY_LIMIT = 2 ** 31;
const RUN = 16;
/** Leading hash bits every adversarial key shares, by default. */
export const ADVERSARIAL_BITS = 6;

/**
 * The control every hash plate shares, so they stay in step: the adversarial keys' h1 values
 * share their leading b bits, a band of 2^(32 − b) hash values. It stops at the old 6, the
 * heaviest the plates were: one bit more and the chained table at its top load and n (n/4
 * chains, a power of two) crowds every key into one chain instead of two, twice the counted
 * work; the probing tables already hold about one cluster at 6, and extendible hashing would
 * meet its depth cap sooner.
 */
export const adversarialParam = (): ParamDef => ({
  kind: 'range', key: 'band', label: 'Adversarial shared bits', min: 1, max: ADVERSARIAL_BITS,
  step: 1, value: ADVERSARIAL_BITS, rebuild: true, when: { key: 'stream', values: ['adversarial'] },
  hint: 'Every adversarial key hashes into one band of 2^(32 − b) values: 1/2^b of the table.',
});
const INVERSE = inverse32(GOLDEN);

/**
 * 2·count distinct keys in [0, 2^31): the first half is inserted, the second half is the pool
 * of keys searched for and not found. Both halves follow the same distribution.
 */
export function keys(stream: Stream, count: number, seed: number, bits = ADVERSARIAL_BITS):
  { inserted: number[]; absent: number[] } {
  const rnd = mulberry32(seed);
  const seen = new Set<number>();
  const out: number[] = [];
  const add = (k: number) => {
    if (k < 0 || k >= KEY_LIMIT || seen.has(k)) return false;
    seen.add(k);
    out.push(k);
    return true;
  };
  if (stream === 'uniform') {
    while (out.length < 2 * count) add(Math.floor(rnd() * KEY_LIMIT));
    return { inserted: out.slice(0, count), absent: out.slice(count) };
  }
  if (stream === 'clustered') {
    // runs of consecutive ids; alternate runs go to the inserted keys and to the absent pool
    const ins: number[] = [];
    const abs: number[] = [];
    let r = 0;
    while (ins.length < count || abs.length < count) {
      const base = Math.floor(rnd() * (KEY_LIMIT - RUN));
      const to = r++ % 2 === 0 ? ins : abs;
      for (let j = 0; j < RUN && to.length < count; j++) if (add(base + j)) to.push(base + j);
    }
    return { inserted: ins, absent: abs };
  }
  // adversarial: keys whose h1 values all share their leading bits, built by inverting h1
  const band = Math.floor(rnd() * 2 ** bits) * 2 ** (32 - bits);
  const width = 2 ** (32 - bits);
  while (out.length < 2 * count) {
    const h = (band + Math.floor(rnd() * width)) >>> 0;
    add(Math.imul(h, INVERSE) >>> 0);
  }
  return { inserted: out.slice(0, count), absent: out.slice(count) };
}

const CHECKPOINTS = 12;
const DELETE_CHECKPOINTS = 3;
const SAMPLE = 48;

/** The steps of one run: inserts, measured searches at checkpoints, deletes, searches again. */
export function workload(stream: Stream, n: number, deletePercent: number, seed: number,
  bits = ADVERSARIAL_BITS): Step[] {
  const rnd = mulberry32(seed ^ 0x5bd1e995);
  const { inserted, absent } = keys(stream, n, seed, bits);
  const present: number[] = [];
  const steps: Step[] = [];
  let missAt = 0;
  const batch = (deleting: boolean) => {
    steps.push({ kind: 'check', open: true, deleting });
    const pool = present.slice();
    for (let s = 0; s < Math.min(SAMPLE, pool.length); s++) {
      const j = s + Math.floor(rnd() * (pool.length - s));
      [pool[s], pool[j]] = [pool[j], pool[s]];
      steps.push({ kind: KIND.search, key: pool[s] });
    }
    for (let s = 0; s < SAMPLE && absent.length; s++) {
      steps.push({ kind: KIND.search, key: absent[missAt++ % absent.length] });
    }
    steps.push({ kind: 'check', open: false, deleting });
  };
  const every = Math.max(1, Math.ceil(n / CHECKPOINTS));
  inserted.forEach((k, i) => {
    steps.push({ kind: KIND.insert, key: k });
    present.push(k);
    if ((i + 1) % every === 0 || i + 1 === n) batch(false);
  });
  const del = Math.round((n * Math.min(100, Math.max(0, deletePercent))) / 100);
  if (del > 0) {
    const order = present.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const gone = new Set<number>();
    const chunk = Math.max(1, Math.ceil(del / DELETE_CHECKPOINTS));
    for (let i = 0; i < del; i++) {
      steps.push({ kind: KIND.remove, key: order[i] });
      gone.add(order[i]);
      if ((i + 1) % chunk === 0 || i + 1 === del) {
        const left = present.filter((k) => !gone.has(k));
        present.length = 0;
        present.push(...left);
        batch(true);
      }
    }
  }
  return steps;
}

/** The lab's scaling run: insert n keys, search each once, search n absent keys, delete half. */
export function scalingWorkload(stream: Stream, n: number, seed: number): Step[] {
  const { inserted, absent } = keys(stream, n, seed);
  return [
    ...inserted.map((key) => ({ kind: KIND.insert, key }) as Step),
    ...inserted.map((key) => ({ kind: KIND.search, key }) as Step),
    ...absent.map((key) => ({ kind: KIND.search, key }) as Step),
    ...inserted.slice(0, Math.floor(n / 2)).map((key) => ({ kind: KIND.remove, key }) as Step),
  ];
}
