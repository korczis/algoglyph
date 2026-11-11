// Linear congruential generators x <- (a x + c) mod m. Consecutive tuples lie on a lattice; the
// spectral test measures how far apart its lines (pairs) and planes (triples) are, from the
// shortest vector of the dual lattice. The period is measured by cycle detection.
import { fmt, int, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';
import { chiSquare, serialCorrelation } from './_random';

export interface LCG { a: number; c: number; m: number; label: string }

// every product a·x stays below 2^53, so the arithmetic is exact in doubles
export const GENERATORS: Record<string, LCG> = {
  toy: { a: 137, c: 187, m: 256, label: 'a = 137, c = 187, m = 256' },
  small: { a: 1365, c: 1, m: 2 ** 16, label: 'a = 1365, c = 1, m = 2^16' },
  randu: { a: 65539, c: 0, m: 2 ** 31, label: 'RANDU: a = 65539, c = 0, m = 2^31' },
  minstd: { a: 16807, c: 0, m: 2 ** 31 - 1, label: 'Minimal standard: a = 16807, m = 2^31 − 1' },
};

export const step = (g: LCG, x: number) => (g.a * x + g.c) % g.m;

export function stream(g: LCG, x0: number, n: number): number[] {
  const out: number[] = [];
  let x = x0;
  for (let i = 0; i < n; i++) { x = step(g, x); out.push(x); }
  return out;
}

/** The period of the cycle x0 falls into, by Brent's method; NaN past `cap` steps. */
export function period(g: LCG, x0: number, cap = 2 ** 20): number {
  let power = 1; let lam = 1;
  let tortoise = x0; let hare = step(g, x0);
  let steps = 0;
  while (tortoise !== hare) {
    if (power === lam) { tortoise = hare; power *= 2; lam = 0; }
    hare = step(g, hare);
    lam++;
    if (++steps > cap) return NaN;
  }
  return lam;
}

/**
 * The modulus the spectral test works with. A multiplicative generator (c = 0) with m = 2^e
 * visits only the odd numbers of one residue class and has period m/4 at best; Knuth applies
 * the test to it with m/4 in place of m (TAOCP vol. 2, §3.3.4), and so does this.
 */
export function testModulus(g: LCG): number {
  const pow2 = Number.isInteger(Math.log2(g.m));
  return g.c === 0 && pow2 && g.m >= 8 ? g.m / 4 : g.m;
}

/** ν₂: length of the shortest nonzero (u1, u2) with u1 + a u2 ≡ 0 (mod m), by Gauss reduction. */
export function spectral2(g: LCG): number {
  const m = testModulus(g);
  let u: [number, number] = [m, 0];
  let v: [number, number] = [-(g.a % m), 1];
  const n2 = (w: [number, number]) => w[0] * w[0] + w[1] * w[1];
  if (n2(u) < n2(v)) [u, v] = [v, u];
  for (;;) {
    const mu = Math.round((u[0] * v[0] + u[1] * v[1]) / n2(v));
    const w: [number, number] = [u[0] - mu * v[0], u[1] - mu * v[1]];
    if (n2(w) >= n2(v)) return Math.sqrt(n2(v));
    u = v; v = w;
  }
}

/** ν₃ and its vector, searching |ui| <= bound; NaN when every such vector is longer. */
export function spectral3(g: LCG, bound = 40): { nu: number; u: [number, number, number] } {
  const m = testModulus(g);
  const a2 = (g.a * g.a) % m;
  let best = Infinity; let u: [number, number, number] = [0, 0, 1];
  for (let u3 = 0; u3 <= bound; u3++) {
    for (let u2 = -bound; u2 <= bound; u2++) {
      if (u3 === 0 && u2 < 0) continue;
      const r = (((g.a * u2 + a2 * u3) % m) + m) % m;
      // u1 must be ≡ -r (mod m) and within the bound
      for (const u1 of [-r, m - r]) {
        if (Math.abs(u1) > bound || (u1 === 0 && u2 === 0 && u3 === 0)) continue;
        const n = Math.hypot(u1, u2, u3);
        if (n < best) { best = n; u = [u1, u2, u3]; }
      }
    }
  }
  return { nu: best <= bound ? best : NaN, u };
}

const TOTAL = 4096;

export const kernel: NumericKernel = {
  params: [{ kind: 'select', key: 'generator', label: 'Generator', value: 'randu', rebuild: true,
    options: Object.entries(GENERATORS).map(([value, g]) => ({ value, label: g.label })) }],
  rate: 6,
  run({ seed, params }) {
    const g = GENERATORS[String(params.generator)] ?? GENERATORS.randu;
    let x0 = seed % g.m;
    if (g.c === 0) x0 = x0 | 1 || 1;
    const xs = stream(g, x0, TOTAL + 2);
    const u = xs.map((x) => x / g.m);
    const pairs: XY[] = u.slice(0, TOTAL).map((v, i) => [v, u[i + 1]]);
    const nu2 = spectral2(g);
    const s3 = spectral3(g);
    const per = period(g, x0);
    // triples seen edge-on to the plane family of the shortest dual vector
    const [a, b, c] = s3.u;
    const un = Math.hypot(a, b, c);
    const e = Math.abs(a) <= Math.abs(b) && Math.abs(a) <= Math.abs(c) ? [1, 0, 0] : Math.abs(b) <= Math.abs(c) ? [0, 1, 0] : [0, 0, 1];
    let w = [b * e[2] - c * e[1], c * e[0] - a * e[2], a * e[1] - b * e[0]];
    const wn = Math.hypot(w[0], w[1], w[2]) || 1;
    w = w.map((t) => t / wn);
    const edge: XY[] = u.slice(0, TOTAL).map((v, i) => [w[0] * v + w[1] * u[i + 1] + w[2] * u[i + 2], (a * v + b * u[i + 1] + c * u[i + 2]) / un]);
    const ex = edge.map((q) => q[0]); const ey = edge.map((q) => q[1]);
    const corr: XY[] = [];
    const steps = [];
    for (let k = 64; k <= TOTAL; k *= 1.25) {
      const n = Math.round(k);
      const head = u.slice(0, n);
      const sc = serialCorrelation(head);
      corr.push([n, Math.abs(sc)]);
      const layers: Layer[] = [
        { kind: 'points', pts: pairs, n, size: 2.5, tone: 0.15 },
        { kind: 'points', panel: 1, pts: edge, n, size: 2.5, tone: 0.8 },
      ];
      steps.push({
        layers,
        stats: [
          { label: 'Numbers drawn', value: int(n) },
          { label: 'Period from the seed', value: Number.isFinite(per) ? int(per) : `longer than ${int(2 ** 20)} steps (not exhausted)` },
          { label: 'Spectral test, pairs', value: `ν₂ = ${fmt(nu2)}: lines ${fmt(1 / nu2)} apart` },
          { label: 'Spectral test, triples', value: Number.isFinite(s3.nu) ? `ν₃ = ${fmt(s3.nu)}: planes ${fmt(1 / s3.nu)} apart, normal (${s3.u.join(', ')})` : 'ν₃ > 40 (search bound)' },
          { label: 'χ² over 16 bins (15 dof)', value: fmt(chiSquare(head)) },
          { label: 'Serial correlation', value: fmt(sc) },
        ],
        chart: {
          title: 'Serial correlation as numbers are drawn', x: { label: 'numbers drawn', log: true }, y: { label: '|lag-one correlation|', log: true },
          series: [{ name: 'Measured', points: corr.slice() }, { name: '1 / √n', points: corr.map(([q]) => [q, 1 / Math.sqrt(q)] as XY) }],
        },
      });
    }
    const ext = (v: number[]) => [Math.min(...v), Math.max(...v)] as [number, number];
    return {
      panels: [
        { title: 'Each number against the next', x: [0, 1], y: [0, 1], equal: true },
        { title: Number.isFinite(s3.nu) ? 'Triples, viewed along the planes' : 'Triples, projected', x: ext(ex), y: ext(ey), equal: true },
      ],
      steps,
    };
  },
};
