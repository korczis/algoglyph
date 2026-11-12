// Bowyer-Watson Delaunay triangulation: insert points one at a time, remove every triangle
// whose circumcircle holds the new point, and fan the hole's boundary to it. O(n^2) here,
// which is plenty for a plate. Returns the triangulation's edges as point pairs i < j; yields
// after each insertion with the number of triangles it tested.
export function* delaunayEdges(x: number[], y: number[]): Generator<number, [number, number][], void> {
  const n = x.length;
  if (n < 2) return [];
  if (n === 2) return [[0, 1]];
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, x[i]); maxX = Math.max(maxX, x[i]);
    minY = Math.min(minY, y[i]); maxY = Math.max(maxY, y[i]);
  }
  const d = Math.max(maxX - minX, maxY - minY) * 20 + 1;
  const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
  const px = [...x, cx - d, cx, cx + d];
  const py = [...y, cy - d, cy + d, cy - d];
  type Tri = [number, number, number, number, number, number];
  const circum = (a: number, b: number, c: number): Tri => {
    const ax = px[a]; const ay = py[a]; const bx = px[b]; const by = py[b]; const cxp = px[c]; const cyp = py[c];
    const D = 2 * (ax * (by - cyp) + bx * (cyp - ay) + cxp * (ay - by));
    const ux = ((ax * ax + ay * ay) * (by - cyp) + (bx * bx + by * by) * (cyp - ay) + (cxp * cxp + cyp * cyp) * (ay - by)) / D;
    const uy = ((ax * ax + ay * ay) * (cxp - bx) + (bx * bx + by * by) * (ax - cxp) + (cxp * cxp + cyp * cyp) * (bx - ax)) / D;
    return [a, b, c, ux, uy, (ax - ux) ** 2 + (ay - uy) ** 2];
  };
  let tris: Tri[] = [circum(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const bad: Tri[] = []; const keep: Tri[] = [];
    for (const t of tris) ((px[i] - t[3]) ** 2 + (py[i] - t[4]) ** 2 < t[5] ? bad : keep).push(t);
    const count = new Map<string, [number, number, number]>();
    for (const t of bad) {
      for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const k = a < b ? `${a},${b}` : `${b},${a}`;
        const c = count.get(k);
        if (c) c[2]++; else count.set(k, [a, b, 1]);
      }
    }
    for (const [a, b, c] of count.values()) if (c === 1) keep.push(circum(a, b, i));
    tris = keep;
    // one insertion tests every triangle's circumcircle
    yield tris.length;
  }
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const t of tris) {
    for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
      if (a >= n || b >= n) continue;
      const lo = Math.min(a, b); const hi = Math.max(a, b);
      const k = `${lo},${hi}`;
      if (!seen.has(k)) { seen.add(k); out.push([lo, hi]); }
    }
  }
  return out;
}
