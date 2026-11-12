// Towers of Hanoi: to move n discs from one peg to another, move n − 1 to the spare peg, the
// largest to the target, and the n − 1 back on top of it. Discs are numbered 1 (smallest) … n.

export interface Move {
  disc: number;
  from: number;
  to: number;
  /** Recursion depth of the call that made the move. */
  depth: number;
}

export function* hanoi(n: number, from = 0, to = 2, via = 1, depth = 0): Generator<Move> {
  if (n === 0) return;
  yield* hanoi(n - 1, from, via, to, depth + 1);
  yield { disc: n, from, to, depth };
  yield* hanoi(n - 1, via, to, from, depth + 1);
}

/** Pegs as stacks, bottom first, with all n discs on peg 0. */
export function pegs(n: number): number[][] {
  return [Array.from({ length: n }, (_, i) => n - i), [], []];
}

/** Apply a move; throws when it is illegal (empty peg, wrong disc, larger on smaller). */
export function apply(state: number[][], m: Move): void {
  const src = state[m.from];
  const dst = state[m.to];
  const top = src[src.length - 1];
  if (top !== m.disc) throw new Error(`disc ${m.disc} is not on top of peg ${m.from}`);
  if (dst.length && dst[dst.length - 1] < m.disc) {
    throw new Error(`disc ${m.disc} onto smaller disc ${dst[dst.length - 1]}`);
  }
  dst.push(src.pop()!);
}
