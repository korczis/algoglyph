import { dots, rect, type Box, type GeometryKernel, type Mark } from '../../engines/geometry/trace';
import { inBox, queryMarks, RANGE_PARAMS, type RangeResult } from './_range';

// The field is cut into square cells sized so that each holds about two points on average, and
// every point is dropped into its cell. A rectangle query visits only the cells it overlaps and
// tests only their points; the cells wholly outside are never touched.
export const kernel: GeometryKernel = {
  task: 'range',
  input: 'points',
  n: { min: 1, max: 1500, value: 200, step: 1 },
  params: RANGE_PARAMS,
  counters: [['test', 'Points tested'], ['cell', 'Cells visited'], ['bucket', 'Points bucketed']],
  scaling: [64, 128, 256, 512, 1024, 2048, 4096],
  run(g) {
    const pts = g.input.points;
    const B = g.input.box;
    const side = Math.sqrt(((B.x1 - B.x0) * (B.y1 - B.y0) * 2) / Math.max(1, pts.length));
    const nx = Math.max(1, Math.ceil((B.x1 - B.x0) / side));
    const ny = Math.max(1, Math.ceil((B.y1 - B.y0) / side));
    const cells: number[][] = Array.from({ length: nx * ny }, () => []);
    const cx = (x: number) => Math.min(nx - 1, Math.max(0, Math.floor((x - B.x0) / side)));
    const cy = (y: number) => Math.min(ny - 1, Math.max(0, Math.floor((y - B.y0) / side)));
    const cellBox = (i: number, j: number): Box => ({ x0: B.x0 + i * side, y0: B.y0 + j * side, x1: B.x0 + (i + 1) * side, y1: B.y0 + (j + 1) * side });
    const grid: Mark[] = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) grid.push(rect(cellBox(i, j), { a: 40, w: 0.8 }));
    g.base([...grid, ...dots(pts, { a: 140, r: 2 })]);
    pts.forEach((p, k) => {
      g.count('bucket');
      cells[cy(p.y) * nx + cx(p.x)].push(k);
    });
    const R = g.input.rect;
    const inside: number[] = [];
    const visited: Box[] = [];
    for (let j = cy(R.y0); j <= cy(R.y1); j++) {
      for (let i = cx(R.x0); i <= cx(R.x1); i++) {
        g.count('cell');
        visited.push(cellBox(i, j));
        for (const k of cells[j * nx + i]) {
          g.count('test');
          if (inBox(pts[k], R)) inside.push(k);
        }
        g.frame(() => [...visited.map((b) => rect(b, { fill: true, c: 0.6, a: 40 })), ...queryMarks(R, inside.map((k) => pts[k]))], 'visit an overlapping cell');
      }
    }
    const result: RangeResult = { inside };
    g.last(() => [...visited.map((b) => rect(b, { fill: true, c: 0.6, a: 40 })), ...queryMarks(R, inside.map((k) => pts[k]))], 'query answered');
    return {
      result,
      rows: [
        { label: 'Points in the rectangle', value: String(inside.length) },
        { label: 'Grid', value: `${nx} × ${ny} cells of side ${side.toFixed(0)}` },
      ],
    };
  },
};
