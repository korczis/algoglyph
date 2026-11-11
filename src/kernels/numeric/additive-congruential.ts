// The additive (lagged Fibonacci) generator x_n = (x_{n-24} + x_{n-55}) mod 2^30, kept in a
// circular table of 55 words. Its lowest bits form a linear feedback shift register over the
// trinomial x^55 + x^24 + 1, which the plate checks bit by bit.
import { mulberry32 } from '../../core/random';
import { fmt, int, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';
import { chiSquare, serialCorrelation } from './_random';

export const SHORT = 24;
export const LONG = 55;
export const MOD = 2 ** 30;

/** A generator over lags (short, long) and modulus m, seeded with `init` (length = long). */
export function additive(init: number[], short = SHORT, long = LONG, m = MOD) {
  const t = init.slice(0, long);
  let j = 0; // t[j] is x_{n-long}; t[(j + long - short) % long] is x_{n-short}
  return {
    table: t,
    get head() { return j; },
    next(): number {
      const v = (t[j] + t[(j + long - short) % long]) % m;
      t[j] = v;
      j = (j + 1) % long;
      return v;
    },
  };
}

export function seedTable(seed: number): number[] {
  const rnd = mulberry32(seed);
  const t = Array.from({ length: LONG }, () => Math.floor(rnd() * MOD));
  t[0] |= 1; // an odd word keeps the lowest-bit register out of its all-zero state
  return t;
}

const TOTAL = 4096;

export const kernel: NumericKernel = {
  rate: 6,
  palette: 'spectral',
  run({ seed }) {
    const init = seedTable(seed);
    const g = additive(init);
    const xs: number[] = [...init];
    const tables: { t: number[]; head: number }[] = [];
    for (let i = 0; i < TOTAL; i++) {
      xs.push(g.next());
      if (i % 16 === 15) tables.push({ t: g.table.slice(), head: g.head });
    }
    const out = xs.slice(LONG);
    const u = out.map((x) => x / MOD);
    const pairs: XY[] = u.slice(0, -1).map((v, i) => [v, u[i + 1]]);
    let held = 0; let checked = 0;
    const bits: number[] = [];
    for (let n = LONG; n < xs.length; n++) {
      const b = xs[n] & 1;
      bits.push(b);
      checked++;
      if (b === ((xs[n - SHORT] ^ xs[n - LONG]) & 1)) held++;
    }
    const steps = [];
    const corr: XY[] = [];
    const cols = 64;
    for (let k = 1; k <= TOTAL / 64; k++) {
      const n = 64 * k;
      const head = u.slice(0, n);
      const tab = tables[Math.min(tables.length - 1, Math.floor(n / 16) - 1)];
      const sc = serialCorrelation(head);
      corr.push([n, Math.abs(sc)]);
      const cells = tab.t.map((v) => v / MOD);
      const hr = Math.floor(tab.head / 11); const hc = tab.head % 11;
      const s = (tab.head + LONG - SHORT) % LONG;
      const layers: Layer[] = [
        { kind: 'grid', rows: 5, cols: 11, values: cells, lo: 0, hi: 1 },
        { kind: 'rects', rects: [[hc, 4 - hr, 1, 1, -1], [s % 11, 4 - Math.floor(s / 11), 1, 1, -1]], outline: true },
        { kind: 'points', panel: 1, pts: pairs, n, size: 2, tone: 0.75 },
        { kind: 'grid', panel: 2, rows: Math.ceil(n / cols), cols, values: bits.slice(0, n).map((b) => 0.15 * b), lo: 0, hi: 1, clear: 0, box: [0, 64 - Math.ceil(n / cols), 64, 64] },
      ];
      steps.push({
        layers,
        stats: [
          { label: 'Numbers drawn', value: int(n) },
          { label: 'χ² over 16 bins (15 dof)', value: fmt(chiSquare(head)) },
          { label: 'Serial correlation', value: fmt(sc) },
          { label: 'Lowest bit = XOR of its two taps', value: `${int(held)} of ${int(checked)} outputs` },
          { label: 'Table', value: `${LONG} words, taps at lags ${SHORT} and ${LONG}` },
        ],
        chart: {
          title: 'Serial correlation as numbers are drawn', x: { label: 'numbers drawn', log: true }, y: { label: '|lag-one correlation|', log: true },
          series: [{ name: 'Measured', points: corr.slice() }, { name: '1 / √n', points: corr.map(([q]) => [q, 1 / Math.sqrt(q)] as XY) }],
        },
      });
    }
    return {
      panels: [
        { title: 'The table (outlined: the two taps)', x: [0, 11], y: [0, 5], equal: true, weight: 1.1 },
        { title: 'Each number against the next', x: [0, 1], y: [0, 1], equal: true },
        { title: 'Lowest bits, row by row', x: [0, 64], y: [0, 64], equal: true },
      ],
      steps,
    };
  },
};
