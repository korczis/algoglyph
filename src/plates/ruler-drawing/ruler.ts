// Drawing the marks of a ruler of 2ⁿ units. The recursive versions mark the middle of an
// interval at height h and recurse on both halves at h − 1; they differ only in when the mark
// is made. The bottom-up version draws every mark of height 1, then 2, and so on, with no
// recursion at all.

export type Order = 'inorder' | 'preorder' | 'bottom-up';

export interface Mark {
  /** Position, 1 … 2ⁿ − 1. */
  x: number;
  /** Height, 1 … n. */
  h: number;
  /** Recursion depth when the mark was made (0 for the bottom-up version). */
  depth: number;
  /** Calls to the recursive routine made so far; always 0 for the bottom-up version, which
   * makes none. */
  calls: number;
}

export function recursive(order: Order): boolean {
  return order !== 'bottom-up';
}

/** Yields every mark; its return value is the number of recursive calls made in all. */
export function* ruler(n: number, order: Order): Generator<Mark, number> {
  if (!recursive(order)) {
    for (let h = 1, len = 2; h <= n; h++, len *= 2) {
      for (let x = len / 2; x < 2 ** n; x += len) yield { x, h, depth: 0, calls: 0 };
    }
    return 0;
  }
  const state = { calls: 0 };
  yield* rule(0, 2 ** n, n, 0, order === 'preorder', state);
  return state.calls;
}

function* rule(l: number, r: number, h: number, depth: number, pre: boolean,
  state: { calls: number }): Generator<Mark> {
  state.calls++;
  if (h === 0) return;
  const m = (l + r) / 2;
  if (pre) yield { x: m, h, depth, calls: state.calls };
  yield* rule(l, m, h - 1, depth + 1, pre, state);
  if (!pre) yield { x: m, h, depth, calls: state.calls };
  yield* rule(m, r, h - 1, depth + 1, pre, state);
}
