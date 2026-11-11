// Sorting algorithms as generators: each yields the pair of indices it just compared or wrote,
// so a caller can advance any number of operations per frame and count them exactly.

export interface Counter {
  cmp: number;
  wr: number;
}

export type Touch = [number, number];
export type SortAlgorithm = (a: number[], c: Counter) => Generator<Touch, void, unknown>;

function swap(a: number[], i: number, j: number, c: Counter): void {
  const t = a[i];
  a[i] = a[j];
  a[j] = t;
  c.wr += 2;
}

function* bubble(a: number[], c: Counter): Generator<Touch> {
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      c.cmp++;
      if (a[j] > a[j + 1]) {
        swap(a, j, j + 1, c);
        swapped = true;
      }
      yield [j, j + 1];
    }
    if (!swapped) return;
  }
}

function* cocktail(a: number[], c: Counter): Generator<Touch> {
  let lo = 0;
  let hi = a.length - 1;
  let swapped = true;
  while (swapped && lo < hi) {
    swapped = false;
    for (let j = lo; j < hi; j++) {
      c.cmp++;
      if (a[j] > a[j + 1]) {
        swap(a, j, j + 1, c);
        swapped = true;
      }
      yield [j, j + 1];
    }
    hi--;
    for (let j = hi; j > lo; j--) {
      c.cmp++;
      if (a[j - 1] > a[j]) {
        swap(a, j - 1, j, c);
        swapped = true;
      }
      yield [j - 1, j];
    }
    lo++;
  }
}

function* insertion(a: number[], c: Counter): Generator<Touch> {
  for (let i = 1; i < a.length; i++) {
    for (let j = i; j > 0; j--) {
      c.cmp++;
      if (a[j - 1] <= a[j]) {
        yield [j - 1, j];
        break;
      }
      swap(a, j - 1, j, c);
      yield [j - 1, j];
    }
  }
}

function* selection(a: number[], c: Counter): Generator<Touch> {
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {
    let m = i;
    for (let j = i + 1; j < n; j++) {
      c.cmp++;
      if (a[j] < a[m]) m = j;
      yield [m, j];
    }
    if (m !== i) swap(a, i, m, c);
    yield [i, m];
  }
}

const CIURA = [701, 301, 132, 57, 23, 10, 4, 1];

function* shell(a: number[], c: Counter): Generator<Touch> {
  for (const gap of CIURA) {
    if (gap >= a.length) continue;
    for (let i = gap; i < a.length; i++) {
      for (let j = i; j >= gap; j -= gap) {
        c.cmp++;
        if (a[j - gap] <= a[j]) {
          yield [j - gap, j];
          break;
        }
        swap(a, j - gap, j, c);
        yield [j - gap, j];
      }
    }
  }
}

function* comb(a: number[], c: Counter): Generator<Touch> {
  let gap = a.length;
  let sorted = false;
  while (!sorted) {
    gap = Math.floor(gap / 1.3);
    if (gap <= 1) {
      gap = 1;
      sorted = true;
    }
    for (let i = 0; i + gap < a.length; i++) {
      c.cmp++;
      if (a[i] > a[i + gap]) {
        swap(a, i, i + gap, c);
        sorted = false;
      }
      yield [i, i + gap];
    }
  }
}

function* quick(a: number[], c: Counter): Generator<Touch> {
  // Lomuto partition with an explicit stack, so deep inputs cannot overflow the call stack.
  const stack: [number, number][] = [[0, a.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop() as [number, number];
    if (lo >= hi) continue;
    const pivot = a[hi];
    let i = lo;
    for (let j = lo; j < hi; j++) {
      c.cmp++;
      if (a[j] < pivot) {
        if (i !== j) swap(a, i, j, c);
        i++;
      }
      yield [j, hi];
    }
    if (i !== hi) swap(a, i, hi, c);
    yield [i, hi];
    stack.push([i + 1, hi], [lo, i - 1]);
  }
}

function* heap(a: number[], c: Counter): Generator<Touch> {
  const n = a.length;
  function* sift(start: number, end: number): Generator<Touch> {
    let root = start;
    while (2 * root + 1 <= end) {
      const child = 2 * root + 1;
      let top = root;
      c.cmp++;
      if (a[top] < a[child]) top = child;
      if (child + 1 <= end) {
        c.cmp++;
        if (a[top] < a[child + 1]) top = child + 1;
      }
      if (top === root) return;
      swap(a, root, top, c);
      yield [root, top];
      root = top;
    }
  }
  for (let s = Math.floor((n - 2) / 2); s >= 0; s--) yield* sift(s, n - 1);
  for (let end = n - 1; end > 0; end--) {
    swap(a, 0, end, c);
    yield [0, end];
    yield* sift(0, end - 1);
  }
}

function* merge(a: number[], c: Counter): Generator<Touch> {
  const n = a.length;
  const aux = a.slice();
  for (let w = 1; w < n; w *= 2) {
    for (let lo = 0; lo < n - w; lo += 2 * w) {
      const mid = lo + w - 1;
      const hi = Math.min(lo + 2 * w - 1, n - 1);
      for (let k = lo; k <= hi; k++) aux[k] = a[k];
      let i = lo;
      let j = mid + 1;
      for (let k = lo; k <= hi; k++) {
        if (i > mid) a[k] = aux[j++];
        else if (j > hi) a[k] = aux[i++];
        else {
          c.cmp++;
          a[k] = aux[j] < aux[i] ? aux[j++] : aux[i++];
        }
        c.wr++;
        yield [k, k];
      }
    }
  }
}

function* radix(a: number[], c: Counter): Generator<Touch> {
  // LSD radix sort, base 4: no comparisons at all, only writes.
  const base = 4;
  let max = 0;
  for (const v of a) if (v > max) max = v;
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= base) {
    const buckets: number[][] = Array.from({ length: base }, () => []);
    for (const v of a) buckets[Math.floor(v / exp) % base].push(v);
    let k = 0;
    for (const b of buckets) {
      for (const v of b) {
        a[k] = v;
        c.wr++;
        yield [k, k];
        k++;
      }
    }
  }
}

export const ALGORITHMS: Record<string, { label: string; cost: string; run: SortAlgorithm }> = {
  bubble: { label: 'Bubble', cost: 'O(n²)', run: bubble },
  cocktail: { label: 'Cocktail shaker', cost: 'O(n²)', run: cocktail },
  insertion: { label: 'Insertion', cost: 'O(n²)', run: insertion },
  selection: { label: 'Selection', cost: 'O(n²)', run: selection },
  shell: { label: 'Shell (Ciura gaps)', cost: '≈O(n^1.3)', run: shell },
  comb: { label: 'Comb', cost: 'O(n²) worst', run: comb },
  quick: { label: 'Quicksort (Lomuto)', cost: 'O(n log n) avg', run: quick },
  heap: { label: 'Heapsort', cost: 'O(n log n)', run: heap },
  merge: { label: 'Merge (bottom-up)', cost: 'O(n log n)', run: merge },
  radix: { label: 'Radix LSD, base 4', cost: 'O(n·k)', run: radix },
};

export function isSorted(a: number[]): boolean {
  for (let i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return false;
  return true;
}
