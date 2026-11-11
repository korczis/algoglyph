import { S, type StringKernel } from '../../engines/string/trace';
import { foldMarks } from './_normalise';

const FIELDS = ['given', 'surname', 'year', 'town'] as const;
const clamp = (x: number) => Math.min(1 - 1e-6, Math.max(1e-6, x));

export interface FsResult { m: number[]; u: number[]; p: number; loglik: number[]; scores: number[]; pairs: [number, number][]; threshold: number }

// Every pair of records becomes an agreement vector over the fields (folded, case-blind
// equality). Under conditional independence the vectors are a mixture of matches, which agree
// on field k with probability m_k, and non-matches, with u_k; EM estimates m, u and the match
// share p from the unlabelled vectors. A field then adds log2(m/u) when it agrees and
// log2((1 − m)/(1 − u)) when it does not, and a pair is a match when its total weight exceeds
// log2((1 − p)/p), the point where the posterior passes one half.
export const kernel: StringKernel<'records', FsResult> = {
  input: 'records',
  counters: { compare: 'Field comparisons', em: 'EM pair updates' },
  speed: 40,
  chart: { title: 'Match weights of all pairs', x: 'total weight (bits)', y: 'pairs' },
  // a generator: a few hundred pairs, then each EM iteration, per step (recorded across frames)
  *run(ops, { records }) {
    const n = records.length;
    // every field folded once per record, not once per comparison
    const vals = records.map((r) => FIELDS.map((f) => foldMarks(String(r[f])).toLowerCase()));
    const pairs: [number, number][] = [];
    const gamma: number[][] = [];
    ops.table('w', FIELDS.length, 4, { label: 'Fields', rowHead: [...FIELDS], colHead: ['m', 'u', 'agree', 'disagree'] });
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.push([i, j]);
        gamma.push(FIELDS.map((_, k) => (ops.eq('compare', vals[i][k], vals[j][k]) ? 1 : 0)));
      }
      if (i % 8 === 7) yield null;
    }
    ops.note(`${pairs.length} pairs compared on ${FIELDS.length} fields`);
    let m = FIELDS.map(() => 0.9); let u = FIELDS.map(() => 0.1); let p = 0.1;
    const loglik: number[] = [];
    const show = () => FIELDS.forEach((_, k) => {
      ops.put('w', k, 0, m[k].toFixed(2)); ops.put('w', k, 1, u[k].toFixed(3));
      ops.put('w', k, 2, Math.log2(m[k] / u[k]).toFixed(1), S.hit);
      ops.put('w', k, 3, Math.log2((1 - m[k]) / (1 - u[k])).toFixed(1), S.miss);
    });
    show();
    for (let it = 0; it < 60; it++) {
      let sg = 0; const sm = FIELDS.map(() => 0); const su = FIELDS.map(() => 0); let ll = 0;
      for (const g of gamma) {
        ops.tick('em');
        let a = p; let b = 1 - p;
        g.forEach((x, k) => { a *= x ? m[k] : 1 - m[k]; b *= x ? u[k] : 1 - u[k]; });
        ll += Math.log(a + b);
        const post = a / (a + b);
        sg += post;
        g.forEach((x, k) => { sm[k] += post * x; su[k] += (1 - post) * x; });
      }
      loglik.push(ll);
      const N = gamma.length;
      m = sm.map((x) => clamp(x / Math.max(1e-12, sg)));
      u = su.map((x) => clamp(x / Math.max(1e-12, N - sg)));
      p = clamp(sg / N);
      show();
      ops.note(`EM iteration ${it + 1}: log-likelihood ${ll.toFixed(2)}, match share ${p.toFixed(4)}`);
      yield null;
      if (it > 0 && Math.abs(loglik[it] - loglik[it - 1]) < 1e-7) break;
    }
    const wa = m.map((x, k) => Math.log2(x / u[k]));
    const wd = m.map((x, k) => Math.log2((1 - x) / (1 - u[k])));
    const scores = gamma.map((g) => g.reduce((s, x, k) => s + (x ? wa[k] : wd[k]), 0));
    const threshold = Math.log2((1 - p) / p);
    let tp = 0; let fp = 0; let fn = 0;
    const bins = new Map<string, number[]>();
    scores.forEach((s, q) => {
      const [i, j] = pairs[q];
      const same = records[i].entity === records[j].entity;
      const call = s > threshold;
      if (call && same) tp++; else if (call) fp++; else if (same) fn++;
      const b = Math.round(s);
      const c = bins.get(String(b)) ?? [0, 0];
      c[same ? 0 : 1]++;
      bins.set(String(b), c);
    });
    const keys = [...bins.keys()].map(Number).sort((a, b) => a - b);
    for (let b = keys[0]; b <= keys[keys.length - 1]; b++) {
      const c = bins.get(String(b)) ?? [0, 0];
      ops.plot('Same person', b, c[0]);
      ops.plot('Different people', b, c[1]);
    }
    ops.note(`threshold ${threshold.toFixed(2)} bits: posterior one half`);
    ops.stat('Pairs', String(pairs.length));
    ops.stat('Threshold', `${threshold.toFixed(2)} bits`);
    ops.stat('Precision', tp + fp ? (tp / (tp + fp)).toFixed(3) : 'no matches called');
    ops.stat('Recall', tp + fn ? (tp / (tp + fn)).toFixed(3) : 'no true pairs');
    return { m, u, p, loglik, scores, pairs, threshold };
  },
};
