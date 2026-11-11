import { dots, poly, type GeometryKernel, type Mark, type Pt } from '../../engines/geometry/trace';

const SQ3 = Math.sqrt(3);

/** The pointy-top hexagon cell of radius s holding p, in axial coordinates, by cube rounding. */
export function hexCell(p: Pt, s: number): [number, number] {
  const fq = ((SQ3 / 3) * p.x - p.y / 3) / s;
  const fr = ((2 / 3) * p.y) / s;
  const fs = -fq - fr;
  let q = Math.round(fq); let r = Math.round(fr); const t = Math.round(fs);
  const dq = Math.abs(q - fq); const dr = Math.abs(r - fr); const ds = Math.abs(t - fs);
  if (dq > dr && dq > ds) q = -r - t; else if (dr > ds) r = -q - t;
  return [q, r];
}

export const hexCentre = (q: number, r: number, s: number): Pt => ({ x: s * SQ3 * (q + r / 2), y: s * 1.5 * r });

const hexagon = (c: Pt, s: number): Pt[] =>
  Array.from({ length: 6 }, (_, k) => ({ x: c.x + s * Math.cos(Math.PI / 6 + (k * Math.PI) / 3), y: c.y + s * Math.sin(Math.PI / 6 + (k * Math.PI) / 3) }));

// Points are binned into pointy-top hexagons of radius s on the plane: axial coordinates from
// a linear map, then rounding in cube coordinates (q + r + s = 0) to the nearest cell centre.
// Squares of the same area bin the same points beside them, for comparison.
export const kernel: GeometryKernel = {
  task: 'hexbin',
  input: 'points',
  shapes: ['clustered', 'uniform', 'disk'],
  n: { min: 10, max: 4000, value: 900, step: 10 },
  params: [{ kind: 'range', key: 'size', label: 'Hexagon radius', min: 12, max: 120, step: 1, value: 42 }],
  counters: [['bin', 'Points binned'], ['dist', 'Distance computations']],
  *run(g) {
    const pts = g.input.points;
    const s = Number(g.params.size ?? 42);
    const side = Math.sqrt(((3 * SQ3) / 2) * s * s); // the square of equal area
    g.base(dots(pts, { a: 90, r: 1.4 }));
    const hex = new Map<string, number>();
    const sq = new Map<string, number>();
    const cells: [number, number][] = [];
    let hexD = 0; let sqD = 0;
    const draw = (): Mark[] => {
      const max = Math.max(1, ...hex.values());
      const out: Mark[] = [];
      for (const [k, v] of hex) {
        const [q, r] = k.split(',').map(Number);
        out.push(poly(hexagon(hexCentre(q, r, s), s), { fill: true, c: v / max, a: 200 }));
      }
      return out;
    };
    for (const [i, p] of pts.entries()) {
      g.count('bin');
      const [q, r] = hexCell(p, s);
      cells.push([q, r]);
      hex.set(`${q},${r}`, (hex.get(`${q},${r}`) ?? 0) + 1);
      const i0 = Math.floor(p.x / side); const j0 = Math.floor(p.y / side);
      sq.set(`${i0},${j0}`, (sq.get(`${i0},${j0}`) ?? 0) + 1);
      hexD += g.dist(p, hexCentre(q, r, s));
      sqD += g.dist(p, { x: (i0 + 0.5) * side, y: (j0 + 0.5) * side });
      if (i % 8 === 0) { g.frame(draw, 'bin into the nearest hexagon centre'); yield; }
    }
    g.last(draw, 'every point binned');
    const hist = (m: Map<string, number>) => {
      const h = new Map<number, number>();
      for (const v of m.values()) h.set(v, (h.get(v) ?? 0) + 1);
      return [...h.entries()].sort((a, b) => a[0] - b[0]) as [number, number][];
    };
    const n = Math.max(1, pts.length);
    return {
      result: { cells, size: s },
      rows: [
        { label: 'Occupied hexagons / squares', value: `${hex.size} / ${sq.size}` },
        { label: 'Fullest hexagon / square', value: `${Math.max(0, ...hex.values())} / ${Math.max(0, ...sq.values())}` },
        { label: 'Mean distance to cell centre, hexagons', value: (hexD / n).toFixed(2) },
        { label: 'Mean distance to cell centre, squares', value: (sqD / n).toFixed(2) },
      ],
      chart: {
        title: 'Cells by the number of points they hold',
        x: { label: 'points in the cell' },
        y: { label: 'cells' },
        series: [{ name: 'Hexagons', points: hist(hex) }, { name: 'Squares of equal area', points: hist(sq) }],
      },
    };
  },
};
