import { OP, type GridKernel, type GridOps } from '../../engines/grid/trace';

export interface SieveResult {
  primes: number[];
}

const width = (limit: number) => (limit < 200 ? 10 : limit < 1000 ? 20 : 40);

// The integers 0 .. N laid out in rows. For each p whose square is at most N and which is still
// standing, cross out p^2, p^2 + p, ... ; smaller multiples of p were already crossed by a
// smaller prime. Composites with several small prime factors are crossed more than once.
export const kernel: GridKernel<{ limit: number }, SieveResult> = {
  size: { label: 'Up to N', min: 30, max: 600, step: 10, value: 200 },
  speed: 2,
  colour: 'linear',
  readouts: [
    { name: 'Crossings', of: (t) => t.count(OP.cross) },
    { name: 'Composites crossed out', of: (t) => t.crossedCells },
    { name: 'Crossed again (repeats)', of: (t) => t.count(OP.cross) - t.crossedCells },
    { name: 'Cells tested', of: (t) => t.count(OP.read) },
    { name: 'Primes found', of: (t) => t.count(OP.mark) },
  ],
  chart: { kind: 'scaling', ns: [50, 100, 200, 400, 800, 1600, 3200, 6400], x: 'N', y: 'count',
    logX: true, logY: true, series: [
      { name: 'Crossings', of: (t) => t.count(OP.cross) },
      { name: 'Composites', of: (t) => t.crossedCells },
      { name: 'Primes', of: (t) => t.count(OP.mark) },
    ] },
  instance(limit) {
    const cols = width(limit);
    const rows = Math.ceil((limit + 1) / cols);
    const r = (k: number) => Math.floor(k / cols);
    const c = (k: number) => k % cols;
    return {
      rows,
      cols,
      inactive: (y, x) => y * cols + x < 2 || y * cols + x > limit,
      label: (y, x) => String(y * cols + x),
      input: `integers 2 .. ${limit}`,
      data: { limit },
      *run(g: GridOps) {
        for (let p = 2; p * p <= limit; p++) {
          if (g.crossed(r(p), c(p))) continue;
          for (let m = p * p; m <= limit; m += p) { g.cross(r(m), c(m)); yield; }
        }
        const primes: number[] = [];
        for (let k = 2; k <= limit; k++) {
          if (!g.crossed(r(k), c(k))) { g.mark(r(k), c(k)); primes.push(k); }
          yield;
        }
        return { result: { primes }, summary: `${primes.length} primes up to ${limit}` };
      },
    };
  },
};
