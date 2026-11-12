// An indexed binary min-heap over vertex ids with decrease-key: the priority queue of
// Dijkstra and Prim. It is bookkeeping, not graph work, so it records nothing itself.
export class IndexHeap {
  private heap: number[] = [];
  private pos: Int32Array;
  readonly key: Float64Array;
  constructor(n: number) {
    this.pos = new Int32Array(n).fill(-1);
    this.key = new Float64Array(n).fill(Infinity);
  }
  get size(): number { return this.heap.length; }
  has(v: number): boolean { return this.pos[v] >= 0; }
  /** Insert v, or lower its key; ties break by vertex id so runs are reproducible. */
  push(v: number, k: number): void {
    if (this.pos[v] < 0) {
      this.key[v] = k;
      this.pos[v] = this.heap.length;
      this.heap.push(v);
      this.up(this.pos[v]);
    } else if (k < this.key[v]) {
      this.key[v] = k;
      this.up(this.pos[v]);
    }
  }
  pop(): number {
    const top = this.heap[0];
    const last = this.heap.pop() as number;
    this.pos[top] = -1;
    if (this.heap.length) {
      this.heap[0] = last;
      this.pos[last] = 0;
      this.down(0);
    }
    return top;
  }
  private less(a: number, b: number): boolean {
    const x = this.heap[a]; const y = this.heap[b];
    return this.key[x] < this.key[y] || (this.key[x] === this.key[y] && x < y);
  }
  private swap(a: number, b: number): void {
    const x = this.heap[a]; const y = this.heap[b];
    this.heap[a] = y; this.heap[b] = x;
    this.pos[y] = a; this.pos[x] = b;
  }
  private up(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  private down(i: number): void {
    for (;;) {
      const l = 2 * i + 1; const r = l + 1;
      let m = i;
      if (l < this.heap.length && this.less(l, m)) m = l;
      if (r < this.heap.length && this.less(r, m)) m = r;
      if (m === i) return;
      this.swap(i, m);
      i = m;
    }
  }
}
