export type Edit = ['=' | '-' | '+', string];

export interface MyersHooks {
  eq(x: number, y: number): boolean;
  /** A furthest-reaching path on diagonal k after d edits reaches (x, y). */
  reach?(d: number, k: number, x: number, y: number): void;
  /** One step along a snake (a run of equal tokens). */
  snake?(x: number, y: number): void;
}

/**
 * Myers' greedy shortest edit script: for d = 0, 1, … the furthest-reaching d-path on every
 * diagonal k = x − y, extended along equal tokens; the first d that reaches (N, M) is the
 * distance. The V arrays of each round are kept, and the script is read backwards from them.
 */
export function myers(a: string[], b: string[], h: MyersHooks): { d: number; script: Edit[] } {
  const N = a.length; const M = b.length; const max = N + M; const off = max + 1;
  const v = new Array<number>(2 * max + 3).fill(0);
  const trace: number[][] = [];
  let D = -1;
  for (let d = 0; d <= max && D < 0; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      h.reach?.(d, k, x, y);
      while (x < N && y < M && h.eq(x, y)) { x++; y++; h.snake?.(x, y); }
      v[off + k] = x;
      if (x >= N && y >= M) { D = d; break; }
    }
  }
  const script: Edit[] = [];
  let x = N; let y = M;
  for (let d = D; d >= 0; d--) {
    const vv = trace[d];
    const k = x - y;
    const pk = k === -d || (k !== d && vv[off + k - 1] < vv[off + k + 1]) ? k + 1 : k - 1;
    const px = vv[off + pk]; const py = px - pk;
    while (x > px && y > py) { script.push(['=', a[x - 1]]); x--; y--; }
    if (d > 0) {
      if (x === px) script.push(['+', b[py]]); else script.push(['-', a[px]]);
    }
    x = px; y = py;
  }
  script.reverse();
  return { d: Math.max(0, D), script };
}
