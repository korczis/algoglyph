import { S, type StringKernel, type StringOps } from '../../engines/string/trace';

// Partition the strings on their d-th character into less, equal and greater (a string that has
// ended counts as smaller than any character); sort the less and greater parts on the same
// character, the equal part on the next one.
export const kernel: StringKernel<'words', string[]> = {
  input: 'words',
  counters: { compare: 'Character comparisons', swap: 'Swaps' },
  run(ops: StringOps, { words }) {
    const a = words.slice();
    const w = Math.max(1, ...a.map((s) => s.length));
    ops.table('t', a.length, w, { label: 'Strings' });
    a.forEach((s, r) => { for (let c = 0; c < s.length; c++) ops.put('t', r, c, s[c]); });
    const at = (s: string, d: number) => (d < s.length ? s.charCodeAt(d) : -1);
    const swap = (i: number, j: number) => {
      if (i === j) return;
      ops.tick('swap');
      [a[i], a[j]] = [a[j], a[i]];
      ops.swapRows('t', i, j);
    };
    const stack: [number, number, number][] = [[0, a.length - 1, 0]];
    while (stack.length) {
      const [lo, hi, d] = stack.pop() as [number, number, number];
      if (hi <= lo) continue;
      ops.clear('t');
      for (let r = lo; r <= hi; r++) if (d < w) ops.markCell('t', r, d, S.alt);
      ops.note(`partition rows ${lo}..${hi} on character ${d}`);
      let lt = lo; let gt = hi; let i = lo + 1;
      const v = at(a[lo], d);
      while (i <= gt) {
        const t = at(a[i], d);
        ops.tick('compare');
        if (d < w) ops.markCell('t', i, d, S.focus);
        if (t < v) swap(lt++, i++);
        else if (t > v) swap(i, gt--);
        else i++;
      }
      for (let r = lt; r <= gt; r++) if (d < w) ops.markCell('t', r, d, S.hit);
      stack.push([gt + 1, hi, d]);
      if (v >= 0) stack.push([lt, gt, d + 1]);
      stack.push([lo, lt - 1, d]);
    }
    ops.clear('t', true);
    ops.note('sorted');
    return a;
  },
};
