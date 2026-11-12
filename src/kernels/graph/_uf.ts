// Weighted quick-union with path compression, keeping each set's members so a plate can
// recolour the smaller side of a union. Bookkeeping only; the kernels record the unions.
export class UnionFind {
  readonly parent: Int32Array;
  readonly members: number[][];
  constructor(n: number) {
    this.parent = Int32Array.from({ length: n }, (_, i) => i);
    this.members = Array.from({ length: n }, (_, i) => [i]);
  }
  find(a: number): number {
    let r = a;
    while (this.parent[r] !== r) r = this.parent[r];
    while (this.parent[a] !== r) { const next = this.parent[a]; this.parent[a] = r; a = next; }
    return r;
  }
  /** Join the sets of a and b; returns [new root, the members that moved], or null if already one. */
  union(a: number, b: number): [number, number[]] | null {
    let ra = this.find(a); let rb = this.find(b);
    if (ra === rb) return null;
    if (this.members[ra].length < this.members[rb].length) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    const moved = this.members[rb];
    for (const v of moved) this.members[ra].push(v);
    this.members[rb] = [];
    return [ra, moved];
  }
}
