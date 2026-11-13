import { S, type StringKernel } from '../../engines/string/trace';
import { jaroWinklerSteps } from './_normalise';

// Two characters match when they are equal and no further apart than half the longer string
// less one; each character matches at most once. Of the m matches, t is half the number that
// appear in a different order. Jaro = (m/|a| + m/|b| + (m − t)/m) / 3, and Winkler adds
// p × (shared prefix, up to 4) × (1 − Jaro) when Jaro exceeds the boost threshold (Winkler's
// p = 0.1 and 0.7 by default). p stops at 1/4: with a prefix of at most 4 the bonus then never
// carries JW past 1.
export const kernel: StringKernel<'pair', { jaro: number; jw: number }> = {
  input: 'pair',
  counters: { compare: 'Character comparisons' },
  params: [
    { kind: 'range', key: 'p', label: 'Prefix scale', min: 0, max: 0.25, step: 0.01, value: 0.1, rebuild: true },
    { kind: 'range', key: 'boost', label: 'Boost above', min: 0, max: 1, step: 0.05, value: 0.7, rebuild: true },
  ],
  *run(ops, { a, b }, params) {
    const p = Number(params.p ?? 0.1); const above = Number(params.boost ?? 0.7);
    const winkler = { scale: Number.isFinite(p) ? p : 0.1, boost: Number.isFinite(above) ? above : 0.7 };
    ops.row('a', [...a], { label: 'First' });
    ops.row('b', [...b], { label: 'Second', align: 'a' });
    const win = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
    let row = -1;
    const r = yield* jaroWinklerSteps(a, b, (i, j) => {
      if (row !== i) {
        ops.clear('a'); ops.clear('b');
        row = i;
        ops.mark('a', i, S.focus);
        for (let k = Math.max(0, i - win); k <= Math.min(b.length - 1, i + win); k++) ops.mark('b', k, S.alt);
        ops.note(`'${a[i]}' at ${i}: look within ±${win} of it`);
      }
      const ok = ops.eq('compare', a[i], b[j]);
      ops.mark('b', j, ok ? S.hit : S.miss);
      if (ok) ops.link('a', i, 'b', j, S.hit);
      return ok;
    }, winkler);
    ops.clear('a'); ops.clear('b');
    const ia = r.matchA.map((j, i) => (j >= 0 ? i : -1)).filter((i) => i >= 0);
    ia.forEach((i, k) => {
      const out = a[i] !== b[r.matchB[k]];
      ops.mark('a', i, out ? S.miss : S.hit);
      ops.mark('b', r.matchB[k], out ? S.miss : S.hit);
    });
    for (let k = 0; k < r.prefix; k++) { ops.mark('a', k, S.done); ops.mark('b', k, S.done); }
    ops.note(`m = ${r.m}, t = ${r.t}, prefix ${r.prefix}`);
    ops.stat('Matches m', String(r.m));
    ops.stat('Transpositions t', String(r.t));
    ops.stat('Jaro', r.jaro.toFixed(4));
    ops.stat('Jaro–Winkler', r.jw.toFixed(4));
    return { jaro: r.jaro, jw: r.jw };
  },
};
