// Indexed sequential access: keys in sorted primary pages of a fixed capacity, loaded to a fill
// factor, with an index holding the first key of each page. A search binary-searches the index,
// reads the primary page and, when the key is not there, the chain of overflow pages behind it.
// The index never changes after the load (the static scheme), so inserts that do not fit their
// primary page go to its overflow chain, and searches into crowded pages slow down.

export interface Lookup {
  found: boolean;
  page: number;
  /** Index entries compared. */
  indexProbes: number;
  /** Pages read: the primary page plus every overflow page scanned. */
  pageReads: number;
}

export class Isam {
  readonly pages: number[][] = [];
  readonly overflow: number[][][] = [];
  readonly index: number[] = [];
  size = 0;

  constructor(sorted: number[], readonly pageSize: number, fill: number) {
    const per = Math.max(1, Math.min(pageSize, Math.round(pageSize * fill)));
    for (let i = 0; i < sorted.length; i += per) {
      const page = sorted.slice(i, i + per);
      this.pages.push(page);
      this.overflow.push([]);
      this.index.push(page[0]);
    }
    if (!this.pages.length) {
      this.pages.push([]);
      this.overflow.push([]);
      this.index.push(-Infinity);
    }
    this.size = sorted.length;
  }

  /** The page whose range holds `key`: the last one whose first key is ≤ key (page 0 below). */
  locate(key: number): { page: number; probes: number } {
    let lo = 0;
    let hi = this.index.length - 1;
    let probes = 0;
    let page = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      probes++;
      if (this.index[mid] <= key) {
        page = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return { page, probes };
  }

  search(key: number): Lookup {
    const { page, probes } = this.locate(key);
    let reads = 1;
    if (this.pages[page].includes(key)) return { found: true, page, indexProbes: probes, pageReads: reads };
    for (const o of this.overflow[page]) {
      reads++;
      if (o.includes(key)) return { found: true, page, indexProbes: probes, pageReads: reads };
    }
    return { found: false, page, indexProbes: probes, pageReads: reads };
  }

  /** False when the key is already stored. */
  insert(key: number): boolean {
    if (this.search(key).found) return false;
    const { page } = this.locate(key);
    const primary = this.pages[page];
    if (primary.length < this.pageSize) {
      let i = primary.length;
      while (i > 0 && primary[i - 1] > key) i--;
      primary.splice(i, 0, key);
    } else {
      const chain = this.overflow[page];
      if (!chain.length || chain[chain.length - 1].length >= this.pageSize) chain.push([]);
      chain[chain.length - 1].push(key);
    }
    this.size++;
    return true;
  }

  overflowPages(): number {
    return this.overflow.reduce((s, c) => s + c.length, 0);
  }

  longestChain(): number {
    return this.overflow.reduce((m, c) => Math.max(m, c.length), 0);
  }

  /** Every stored key in ascending order. */
  keys(): number[] {
    return this.pages.flatMap((pg, i) => [...pg, ...this.overflow[i].flat()].sort((a, b) => a - b));
  }
}
