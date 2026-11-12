import { S, type State, type StringKernel, type StringOps } from '../../engines/string/trace';
import { myers } from './_myers';

export interface Chunk { kind: 'stable' | 'ours' | 'theirs' | 'both' | 'conflict'; base: string[]; ours: string[]; theirs: string[] }
export interface MergeResult { merged: string[]; conflicts: number; chunks: Chunk[] }

/** For each base line, the index of the line it is matched to by the shortest edit script, or −1. */
function matches(ops: StringOps, base: string[], other: string[]): number[] {
  const out = new Array<number>(base.length).fill(-1);
  let i = 0; let j = 0;
  for (const [op] of myers(base, other, { eq: (x, y) => ops.eq('compare', base[x], other[y]) }).script) {
    if (op === '=') out[i++] = j++;
    else if (op === '-') i++;
    else j++;
  }
  return out;
}

const same = (x: string[], y: string[]) => x.length === y.length && x.every((s, i) => s === y[i]);

// Diff the ancestor against each side (Myers). A base line matched in both is stable; between
// stable lines lie unstable chunks. A chunk only one side changed takes that side's lines, a
// chunk both sides changed identically takes them once, and a chunk both changed differently is
// a conflict, written out between markers with both versions.
export const kernel: StringKernel<'merge', MergeResult> = {
  input: 'merge',
  counters: { compare: 'Line comparisons', chunk: 'Chunks resolved' },
  run(ops, { base, ours, theirs }) {
    ops.list('base', base, { label: 'Ancestor', lines: 3 });
    ops.list('ours', ours, { label: 'Ours', lines: 3 });
    ops.list('theirs', theirs, { label: 'Theirs', lines: 3 });
    ops.list('out', [], { label: 'Merged', lines: 4 });
    const mo = matches(ops, base, ours);
    ops.note('ancestor against ours');
    const mt = matches(ops, base, theirs);
    ops.note('ancestor against theirs');
    const chunks: Chunk[] = [];
    const merged: string[] = [];
    let i = 0; let j = 0; let k = 0;
    let conflicts = 0;
    const emit = (lines: string[], s: State) => { for (const l of lines) { merged.push(l); ops.push('out', l, s); } };
    const mark = (part: string, lo: number, hi: number, s: State) => { for (let x = lo; x < hi; x++) ops.mark(part, x, s); };
    while (i < base.length || j < ours.length || k < theirs.length) {
      ops.tick('chunk');
      if (i < base.length && mo[i] === j && mt[i] === k) {
        chunks.push({ kind: 'stable', base: [base[i]], ours: [ours[j]], theirs: [theirs[k]] });
        mark('base', i, i + 1, S.done); mark('ours', j, j + 1, S.done); mark('theirs', k, k + 1, S.done);
        emit([base[i]], S.none);
        i++; j++; k++;
        continue;
      }
      let e = i;
      while (e < base.length && !(mo[e] >= j && mt[e] >= k)) e++;
      const je = e < base.length ? mo[e] : ours.length;
      const ke = e < base.length ? mt[e] : theirs.length;
      const c: Chunk = { kind: 'conflict', base: base.slice(i, e), ours: ours.slice(j, je), theirs: theirs.slice(k, ke) };
      if (same(c.ours, c.base)) { c.kind = 'theirs'; emit(c.theirs, S.alt); } else if (same(c.theirs, c.base)) { c.kind = 'ours'; emit(c.ours, S.alt); } else if (same(c.ours, c.theirs)) { c.kind = 'both'; emit(c.ours, S.alt); } else {
        conflicts++;
        emit(['<<<<<<< ours'], S.miss); emit(c.ours, S.miss); emit(['======='], S.miss); emit(c.theirs, S.miss); emit(['>>>>>>> theirs'], S.miss);
      }
      const s = c.kind === 'conflict' ? S.miss : S.alt;
      mark('base', i, e, s); mark('ours', j, je, s); mark('theirs', k, ke, s);
      ops.note(c.kind === 'conflict' ? 'both sides changed these lines differently: conflict'
        : c.kind === 'both' ? 'both sides made the same change' : `only ${c.kind} changed these lines: take ${c.kind}`);
      chunks.push(c);
      i = e; j = je; k = ke;
    }
    ops.stat('Changed chunks', String(chunks.filter((c) => c.kind !== 'stable').length));
    ops.stat('Conflicts', String(conflicts));
    return { merged, conflicts, chunks };
  },
};
