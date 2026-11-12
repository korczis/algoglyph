import { E, type GraphKernel } from '../../engines/graph/trace';
import { UnionFind } from './_uf';

export interface MergeResult { comp: number[]; precision: number; recall: number }

// Candidate pairs of records come with the trigram Jaccard similarity of their names. Pairs are
// taken from the most similar down; each pair at or above the threshold is a match, and a match
// becomes a union of the two records' clusters (weighted quick-union with path compression).
// The clusters are the resolved entities. Precision and recall compare the record pairs placed
// together with the pairs that truly belong to one entity (the coloured rings).
export const kernel: GraphKernel<MergeResult> = {
  goal: 'merge',
  inputs: ['records'],
  n: { min: 4, max: 160, value: 36 },
  params: [{ kind: 'range', key: 'threshold', label: 'Match threshold', min: 0.2, max: 0.9, step: 0.01, value: 0.45, rebuild: true }],
  view: { colour: 'group', truth: true, names: true },
  names: { groups: 'Clusters', tree: 'Merging matches' },
  readouts: ['scans', 'tree', 'groups'],
  chart: { title: 'Clusters as matches are merged', y: 'count', series: ['groups', 'tree'] },
  *steps(ops, { p }) {
    const g = ops.g;
    const th = Number(p.threshold);
    const uf = new UnionFind(g.n);
    for (let v = 0; v < g.n; v++) ops.group(v, v);
    const order = Array.from({ length: g.m }, (_, e) => e).sort((a, b) => g.w[b] - g.w[a] || a - b);
    for (const e of order) {
      ops.scan(e);
      yield;
      if (g.w[e] < th) { ops.edge(e, E.drop); continue; }
      const r = uf.union(g.eu[e], g.ev[e]);
      if (!r) { ops.edge(e, E.seen); continue; }
      ops.edge(e, E.tree);
      for (const v of r[1]) ops.group(v, r[0]);
    }
    const comp = Array.from({ length: g.n }, (_, v) => uf.find(v));
    let tp = 0; let fp = 0; let fn = 0;
    for (let a = 0; a < g.n; a++) {
      for (let b = a + 1; b < g.n; b++) {
        const same = comp[a] === comp[b]; const truly = g.truth[a] === g.truth[b];
        if (same && truly) tp++; else if (same) fp++; else if (truly) fn++;
      }
    }
    return { comp, precision: tp + fp ? tp / (tp + fp) : 1, recall: tp + fn ? tp / (tp + fn) : 1 };
  },
  report(r) {
    return [
      { label: 'Resolved entities', value: String(new Set(r.comp).size) },
      { label: 'Pairwise precision, recall', value: `${r.precision.toFixed(2)}, ${r.recall.toFixed(2)}` },
    ];
  },
};
