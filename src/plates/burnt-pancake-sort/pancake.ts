// Burnt pancake sort, step by step: the wasm kernel's algorithm (crates/algoglyph-kernels/src/
// sorting/algorithms/burnt_pancake_sort.rs) through the tracer mirror. Index 0 is the top of the
// stack; bit 31 of a pancake's tag is set while its burnt side faces up. A flip of the top k
// reverses them (swaps) and turns each over (a write that toggles the bit). With no bit set the
// kernel draws each pancake's orientation from its seeded generator, as this mirror does; the
// plate can also start every pancake burnt side up (the kernel's path for marked input) or down
// (a plate-only start that skips the draw).
import { items, Stepper, Tracer, type Algorithm, type Items } from '../_shared/kernel-mirror/tracer';

export const UP = 0x80000000;

export type Orientation = 'random' | 'up' | 'down';

export interface PancakeState {
  flips: number;
  /** The flip in progress (its length), 0 between flips. */
  flipping: number;
  /** Burnt sides up once the orientation is set (after the kernel's draw, when it draws). */
  upAtStart: number;
}

export const isUp = (tag: number): boolean => (tag & UP) !== 0;

function* flip(t: Tracer, a: Items, k: number, st: PancakeState): Generator<void, void, void> {
  st.flips++;
  st.flipping = k;
  t.phase(`flip ${st.flips}: reverse and turn over the top ${k}`);
  t.mark(0, k, 'flip');
  for (let i = 0, j = k - 1; i < j; i++, j--) {
    t.swap(a, i, j);
    yield;
  }
  for (let i = 0; i < k; i++) {
    t.set(a, i, a.key[i], (a.tag[i] ^ UP) >>> 0);
    yield;
  }
  st.flipping = 0;
}

export function* burntPancakeSort(t: Tracer, a: Items, st: PancakeState, draw = true): Algorithm {
  const n = a.key.length;
  if (n === 0) return 'sorted';
  if (draw && !a.tag.some(isUp)) {
    t.phase('random initial orientation (bit 31 of the tag = burnt side up)');
    for (let i = 0; i < n; i++) {
      if (t.rng.below(2) === 1) {
        t.set(a, i, a.key[i], (a.tag[i] | UP) >>> 0);
        yield;
      }
    }
  }
  st.upAtStart = countUp(a);
  for (let size = n; size >= 1; size--) {
    if (!t.ok()) return 'truncated';
    let best = 0;
    for (let i = 1; i < size; i++) {
      const c = t.cmp(a, i, best);
      yield;
      if (c >= 0) best = i;
    }
    if (best === size - 1 && !isUp(a.tag[best])) continue;
    if (best !== 0) yield* flip(t, a, best + 1, st);
    if (!isUp(a.tag[0])) yield* flip(t, a, 1, st);
    yield* flip(t, a, size, st);
  }
  return 'sorted';
}

export interface PancakeRun {
  a: Items;
  stepper: Stepper;
  state: PancakeState;
}

export function pancakeRun(keys: readonly number[], seed: number, orient: Orientation = 'random',
  maxSteps = Infinity): PancakeRun {
  const a = items(keys);
  if (orient === 'up') a.tag = a.tag.map((x) => (x | UP) >>> 0);
  const t = new Tracer(seed, maxSteps);
  const state: PancakeState = { flips: 0, flipping: 0, upAtStart: countUp(a) };
  return { a, stepper: new Stepper(burntPancakeSort(t, a, state, orient !== 'down'), t), state };
}

export function countUp(a: Items): number {
  let u = 0;
  for (const tag of a.tag) if (isUp(tag)) u++;
  return u;
}
