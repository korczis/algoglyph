// A skip list: a sorted linked list in which each node also joins higher lists with probability
// p per level, so a search runs along the top list and drops a level whenever the next key
// would overshoot. Node 0 is the head sentinel; −1 ends a list. Key comparisons are counted.

export class SkipList {
  readonly key: number[] = [-Infinity];
  /** forward[node][level]. */
  readonly forward: number[][];
  level = 1;
  size = 0;
  comparisons = 0;
  private free: number[] = [];

  constructor(readonly maxLevel: number, readonly p: number, private readonly rnd: () => number) {
    this.forward = [new Array(maxLevel).fill(-1)];
  }

  private randomLevel(): number {
    let lv = 1;
    while (lv < this.maxLevel && this.rnd() < this.p) lv++;
    return lv;
  }

  /** Walk towards `key`; the last node before it on every level, and the nodes visited. */
  private walk(key: number): { update: number[]; path: [number, number][]; cmp: number } {
    const update = new Array(this.maxLevel).fill(0);
    const path: [number, number][] = [];
    let cmp = 0;
    let x = 0;
    for (let lv = this.level - 1; lv >= 0; lv--) {
      path.push([x, lv]);
      for (;;) {
        const nx = this.forward[x][lv];
        if (nx < 0) break;
        cmp++;
        if (!(this.key[nx] < key)) break;
        x = nx;
        path.push([x, lv]);
      }
      update[lv] = x;
    }
    this.comparisons += cmp;
    return { update, path, cmp };
  }

  search(key: number): { found: boolean; node: number; path: [number, number][]; cmp: number } {
    const { update, path, cmp } = this.walk(key);
    const nx = this.forward[update[0]][0];
    const found = nx >= 0 && this.key[nx] === key;
    return { found, node: found ? nx : -1, path, cmp };
  }

  /** False when the key is already present. */
  insert(key: number): { inserted: boolean; node: number; height: number; cmp: number } {
    const { update, cmp } = this.walk(key);
    const nx = this.forward[update[0]][0];
    if (nx >= 0 && this.key[nx] === key) return { inserted: false, node: nx, height: 0, cmp };
    const lv = this.randomLevel();
    for (let l = this.level; l < lv; l++) update[l] = 0;
    if (lv > this.level) this.level = lv;
    const node = this.free.pop() ?? this.key.length;
    this.key[node] = key;
    this.forward[node] = new Array(lv).fill(-1);
    for (let l = 0; l < lv; l++) {
      this.forward[node][l] = this.forward[update[l]][l];
      this.forward[update[l]][l] = node;
    }
    this.size++;
    return { inserted: true, node, height: lv, cmp };
  }

  /** False when the key is absent. */
  remove(key: number): boolean {
    const { update } = this.walk(key);
    const x = this.forward[update[0]][0];
    if (x < 0 || this.key[x] !== key) return false;
    for (let l = 0; l < this.forward[x].length; l++) {
      if (this.forward[update[l]][l] === x) this.forward[update[l]][l] = this.forward[x][l];
    }
    while (this.level > 1 && this.forward[0][this.level - 1] < 0) this.level--;
    this.forward[x] = [];
    this.free.push(x);
    this.size--;
    return true;
  }

  height(node: number): number {
    return this.forward[node].length;
  }

  /** Nodes of one level, in order. */
  lane(level: number): number[] {
    const out: number[] = [];
    for (let x = this.forward[0][level]; x >= 0; x = this.forward[x][level]) out.push(x);
    return out;
  }

  keys(): number[] {
    return this.lane(0).map((x) => this.key[x]);
  }
}
