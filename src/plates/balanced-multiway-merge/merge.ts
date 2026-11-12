// Balanced P-way external merging on 2P tapes, one record moved per step so a plate can watch
// it. Distribution reads M records at a time into memory, sorts them and writes each sorted run
// to the next of the first P tapes in turn. Each merge pass then merges one run from every
// input tape into one longer run on an output tape, cycling through the outputs, until one run
// is left; inputs and outputs swap roles between passes. The merge picks the smallest of up to
// P front records with a binary heap, and every key comparison is counted.

export type Phase = 'distribute' | 'merge' | 'done';

export interface Machine {
  readonly p: number;
  readonly m: number;
  readonly input: number[];
  /** 2P tapes, each a list of runs, each run a list of keys. */
  tapes: number[][][];
  phase: Phase;
  /** Merge passes completed. */
  pass: number;
  /** Records read from the unsorted input so far. */
  read: number;
  /** The sorted block in memory during distribution. */
  memory: number[];
  memoryAt: number;
  runIndex: number;
  /** The first tape of the current input group (0 or P). */
  from: number;
  /** Output tape currently being written (index within the output group). */
  out: number;
  /** Read positions in the front run of each input tape. */
  pos: number[];
  heap: number[];
  merging: boolean;
  comparisons: number;
  writes: number;
  /** Runs on the tapes after distribution and after each pass. */
  runsAfter: number[];
  /** The last tape written, for drawing. */
  lastTape: number;
}

export function machine(input: number[], m: number, p: number): Machine {
  // one-way "merging" never shortens the run count, so the passes would never end
  if (!Number.isInteger(p) || p < 2) throw new RangeError(`a balanced merge needs P ≥ 2 ways, got ${p}`);
  if (!Number.isInteger(m) || m < 1) throw new RangeError(`memory must hold M ≥ 1 records, got ${m}`);
  return {
    p, m, input, tapes: Array.from({ length: 2 * p }, () => []), phase: input.length ? 'distribute' : 'done',
    pass: 0, read: 0, memory: [], memoryAt: 0, runIndex: 0, from: 0, out: 0, pos: [], heap: [],
    merging: false, comparisons: 0, writes: 0, runsAfter: [], lastTape: -1,
  };
}

export function runs(s: Machine): number {
  return s.tapes.reduce((sum, t) => sum + t.length, 0);
}

function less(s: Machine, a: number, b: number): boolean {
  s.comparisons++;
  return a < b;
}

/** Heap entries are input tape offsets 0 … P − 1, keyed by their front record. */
function front(s: Machine, k: number): number {
  return s.tapes[s.from + k][0][s.pos[k]];
}

function siftUp(s: Machine, i: number): void {
  const h = s.heap;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (!less(s, front(s, h[i]), front(s, h[parent]))) break;
    [h[i], h[parent]] = [h[parent], h[i]];
    i = parent;
  }
}

function siftDown(s: Machine, i: number): void {
  const h = s.heap;
  for (;;) {
    const l = 2 * i + 1;
    if (l >= h.length) return;
    let c = l;
    if (l + 1 < h.length && less(s, front(s, h[l + 1]), front(s, h[l]))) c = l + 1;
    if (!less(s, front(s, h[c]), front(s, h[i]))) return;
    [h[i], h[c]] = [h[c], h[i]];
    i = c;
  }
}

function outTape(s: Machine): number {
  return (s.from === 0 ? s.p : 0) + s.out;
}

/** Move one record; false once the file is one sorted run. */
export function step(s: Machine): boolean {
  if (s.phase === 'done') return false;
  if (s.phase === 'distribute') {
    if (s.memoryAt >= s.memory.length) {
      const block = s.input.slice(s.read, s.read + s.m);
      s.read += block.length;
      // sorting in memory is not the subject here; its comparisons are counted all the same
      s.memory = block.sort((a, b) => (s.comparisons++, a - b));
      s.memoryAt = 0;
      s.tapes[s.runIndex % s.p].push([]);
    }
    const tape = s.runIndex % s.p;
    const run = s.tapes[tape][s.tapes[tape].length - 1];
    run.push(s.memory[s.memoryAt++]);
    s.writes++;
    s.lastTape = tape;
    if (s.memoryAt >= s.memory.length) {
      s.runIndex++;
      if (s.read >= s.input.length) {
        s.runsAfter.push(runs(s));
        s.phase = runs(s) <= 1 ? 'done' : 'merge';
        s.from = 0;
        s.out = 0;
      }
    }
    return s.phase !== 'done';
  }
  if (!s.merging) {
    s.pos = new Array(s.p).fill(0);
    s.heap = [];
    for (let k = 0; k < s.p; k++) {
      if (!s.tapes[s.from + k].length) continue;
      s.heap.push(k);
      siftUp(s, s.heap.length - 1);
    }
    s.tapes[outTape(s)].push([]);
    s.merging = true;
  }
  const k = s.heap[0];
  const t = outTape(s);
  s.tapes[t][s.tapes[t].length - 1].push(front(s, k));
  s.writes++;
  s.lastTape = t;
  s.pos[k]++;
  if (s.pos[k] >= s.tapes[s.from + k][0].length) {
    s.heap[0] = s.heap[s.heap.length - 1];
    s.heap.pop();
  }
  if (s.heap.length) {
    siftDown(s, 0);
    return true;
  }
  // the merged run is complete: drop the consumed front runs
  for (let q = 0; q < s.p; q++) if (s.tapes[s.from + q].length) s.tapes[s.from + q].shift();
  s.merging = false;
  s.out = (s.out + 1) % s.p;
  const inputsLeft = s.tapes.slice(s.from, s.from + s.p).some((tp) => tp.length);
  if (!inputsLeft) {
    s.pass++;
    s.runsAfter.push(runs(s));
    s.from = s.from === 0 ? s.p : 0;
    s.out = 0;
    if (runs(s) <= 1) s.phase = 'done';
  }
  return s.phase !== 'done';
}

/** Run to the end and return the sorted file. */
export function sortExternally(input: number[], m: number, p: number): { output: number[]; s: Machine } {
  const s = machine(input, m, p);
  while (step(s));
  const output = s.tapes.flatMap((t) => t.flat());
  return { output, s };
}
