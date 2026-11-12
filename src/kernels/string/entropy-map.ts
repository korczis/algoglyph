import { S, type StringKernel } from '../../engines/string/trace';

const f = (c: number) => (c > 0 ? c * Math.log2(c) : 0);

// A window of w bytes slides over the file in steps of w/8. A 256-bin histogram is kept up to
// date byte by byte (one decrement leaving, one increment entering), and with it the sum
// S = Σ c·log2 c, so that the window's Shannon entropy H = log2 w − S/w costs no pass over
// the bins. Padding reads near 0 bits per byte, text and code in between, and random or
// compressed data near log2 w, the most a window of w bytes can show (8 bits only from w = 256).
export const kernel: StringKernel<'binary', { offsets: number[]; entropy: number[] }> = {
  input: 'binary',
  counters: { update: 'Histogram updates', window: 'Windows measured' },
  speed: 12,
  aspect: 16 / 9,
  chart: { title: 'Entropy along the file', x: 'byte offset', y: 'bits per byte' },
  params: [{
    kind: 'select', key: 'window', label: 'Window', value: '128', rebuild: true,
    options: ['64', '128', '256'].map((v) => ({ value: v, label: `${v} bytes` })),
  }],
  *run(ops, { bytes, sections }, params) {
    const w = Math.min(bytes.length, Number(params.window ?? 128) || 128);
    const step = Math.max(1, w / 8);
    const nWin = Math.floor((bytes.length - w) / step) + 1;
    ops.row('bytes', bytes.map(() => ''), { label: 'Bytes' }, true);
    for (let i = 0; i < bytes.length; i++) {
      ops.heat('bytes', i, bytes[i] / 255);
      if (i % 1024 === 1023) yield null;
    }
    ops.row('H', new Array<string>(nWin).fill(''), { label: 'Entropy' }, true);
    ops.list('sections', sections.map((s) => `${s.start}: ${s.kind}`), { label: 'Sections', lines: 2 });
    const hist = new Array<number>(256).fill(0);
    let sum = 0;
    const add = (b: number, d: number) => {
      ops.tick('update');
      sum += f(hist[b] + d) - f(hist[b]);
      hist[b] += d;
    };
    for (let i = 0; i < w; i++) add(bytes[i], 1);
    const offsets: number[] = []; const entropy: number[] = [];
    const bySection = sections.map(() => ({ s: 0, n: 0 }));
    for (let k = 0; k < nWin; k++) {
      yield null;
      const at = k * step;
      if (k > 0) for (let i = at - step; i < at; i++) { add(bytes[i], -1); add(bytes[i + w], 1); }
      ops.tick('window');
      const h = Math.max(0, Math.log2(w) - sum / w);
      offsets.push(at); entropy.push(h);
      ops.heat('H', k, h / 8);
      ops.clear('H');
      ops.mark('H', k, S.focus);
      ops.plot('Entropy', at, h);
      const si = sections.findIndex((s) => at >= s.start && at + w <= s.end);
      if (si >= 0) {
        bySection[si].s += h; bySection[si].n++;
        ops.clear('sections');
        ops.mark('sections', si, S.hit);
      }
      ops.note(`bytes ${at}..${at + w - 1}: ${h.toFixed(2)} bits per byte`);
    }
    const kinds = [...new Set(sections.map((s) => s.kind))];
    for (const kind of kinds) {
      let s = 0; let n = 0;
      sections.forEach((sec, i) => { if (sec.kind === kind) { s += bySection[i].s; n += bySection[i].n; } });
      if (n) ops.stat(`Mean entropy, ${kind}`, `${(s / n).toFixed(2)} bits per byte`);
    }
    return { offsets, entropy };
  },
};
