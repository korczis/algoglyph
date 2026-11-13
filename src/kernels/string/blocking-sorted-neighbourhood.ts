import { S, type StringKernel } from '../../engines/string/trace';
import { foldMarks } from './_normalise';

export interface Candidates { pairs: [number, number][]; method: string; window: number; order: number[] }

// Every record gets a key built from its folded name: the first letters of the surname (three
// by default) and the first letter of the given name. Standard blocking compares only records with the same
// key. Sorted neighbourhood sorts by the longer key surname + given name and compares each
// record with the next w − 1 in that order, so a typo late in a name still lands nearby.
export const kernel: StringKernel<'records', Candidates> = {
  input: 'records',
  counters: { compare: 'Key comparisons', pair: 'Candidate pairs' },
  params: [
    { kind: 'select', key: 'method', label: 'Method', value: 'sorted', rebuild: true,
      options: [{ value: 'sorted', label: 'Sorted neighbourhood' }, { value: 'blocking', label: 'Standard blocking' }] },
    { kind: 'range', key: 'window', label: 'Window w', min: 2, max: 12, step: 1, value: 4, rebuild: true },
    { kind: 'range', key: 'prefix', label: 'Surname letters in the key', min: 1, max: 6, step: 1, value: 3, rebuild: true,
      when: { key: 'method', values: ['blocking'] } },
  ],
  run(ops, { records }, params) {
    const method = String(params.method ?? 'sorted') === 'blocking' ? 'blocking' : 'sorted';
    const w = Math.max(2, Number(params.window ?? 4) || 4);
    const prefix = Math.max(1, Number(params.prefix ?? 3) || 3);
    const n = records.length;
    const up = (s: string) => foldMarks(s).toUpperCase().replace(/[^A-Z]/g, '');
    const keys = records.map((r) => (method === 'blocking'
      ? `${up(r.surname).slice(0, prefix)}${up(r.given).slice(0, 1)}`
      : `${up(r.surname)} ${up(r.given)}`));
    const order = records.map((_, i) => i);
    order.sort((x, y) => { ops.tick('compare'); return keys[x] < keys[y] ? -1 : keys[x] > keys[y] ? 1 : x - y; });
    ops.list('rec', order.map((i) => `${keys[i]} · ${records[i].given} ${records[i].surname} ${records[i].year}`), { label: 'Records by key', lines: 7 });
    ops.note(`${n} records sorted by key`);
    const pairs: [number, number][] = [];
    const truth = (i: number, j: number) => records[i].entity === records[j].entity;
    let found = 0;
    const add = (p: number, q: number) => {
      ops.tick('pair');
      const i = order[p]; const j = order[q];
      pairs.push(i < j ? [i, j] : [j, i]);
      if (truth(i, j)) found++;
      ops.mark('rec', q, truth(i, j) ? S.hit : S.alt);
    };
    if (method === 'blocking') {
      let s = 0;
      while (s < n) {
        let e = s + 1;
        while (e < n && ops.eq('compare', keys[order[e]], keys[order[s]])) e++;
        ops.clear('rec');
        for (let p = s; p < e; p++) ops.mark('rec', p, S.focus);
        for (let p = s; p < e; p++) for (let q = p + 1; q < e; q++) add(p, q);
        ops.note(`block ${keys[order[s]]}: ${e - s} records, ${((e - s) * (e - s - 1)) / 2} pairs`);
        s = e;
      }
    } else {
      for (let p = 0; p < n; p++) {
        ops.clear('rec');
        ops.mark('rec', p, S.focus);
        for (let q = p + 1; q < Math.min(n, p + w); q++) add(p, q);
        ops.note(`window at ${p}: compare with the next ${Math.min(n, p + w) - p - 1}`);
      }
    }
    ops.clear('rec');
    let dupes = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (truth(i, j)) dupes++;
    const all = (n * (n - 1)) / 2;
    ops.stat('All pairs', String(all));
    ops.stat('Reduction', all ? `${(100 * (1 - pairs.length / all)).toFixed(1)}% fewer comparisons` : '0');
    ops.stat('True duplicate pairs kept', `${found} of ${dupes}`);
    return { pairs, method, window: w, order };
  },
};
