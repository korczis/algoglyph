import { optionId } from '../../core/data';
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, type PlateCode, type Stat } from '../../core/plate';
import { rgba } from '../_shared/two-slit/draw';
import { boxSeries, chargeOn, conductor, fieldAt, fieldEnergy, makeGrid, Solve, type Grid } from '../_shared/fields/grid';

type Mode = 'charge' | 'coax' | 'cage' | 'cylinder' | 'data';

/** Node-iterations of conjugate gradients a frame: about 70 iterations of the default 129² grid. */
export const WORK_PER_FRAME = 1_200_000;
/** The solve stops at this relative residual. */
export const TOL = 1e-10;
/** The picture keeps each iteration's potential at DISPLAY² points, to replay the solve converging. */
export const DISPLAY = 48;
const when = (...values: Mode[]) => ({ key: 'mode', values });
const fx = (x: number, d = 7) => (Number.isFinite(x) ? x.toFixed(d) : 'not measured');
const sci = (x: number) => (Number.isFinite(x) ? x.toExponential(3) : 'not measured');

/** The coaxial pair, the ring of the cage and the dielectric cylinder, in units of the box. */
export const COAX = { a: 0.08, b: 0.4 };
export const RING = { inner: 0.25, outer: 0.28, V: 0.5, q: { x: 0.85, y: 0.5 } };
export const CYLINDER = 0.15;

/** The grid of a mode: its sources, conductors and permittivity; the walls grounded unless noted. */
export function build(mode: Exclude<Mode, 'data'>, cells: number, eps2: number): Grid {
  const g = makeGrid(cells + 1);
  const { n, h } = g;
  const node = (x: number, y: number) => Math.round(y / h) * n + Math.round(x / h);
  const r = (x: number, y: number) => Math.hypot(x - 0.5, y - 0.5);
  if (mode === 'charge') g.rho[node(0.5, 0.5)] = 1 / (h * h);
  else if (mode === 'coax') {
    conductor(g, 2, 1, (x, y) => r(x, y) <= COAX.a);
    conductor(g, 3, 0, (x, y) => r(x, y) >= COAX.b);
  } else if (mode === 'cage') {
    conductor(g, 2, RING.V, (x, y) => r(x, y) >= RING.inner && r(x, y) <= RING.outer);
    g.rho[node(RING.q.x, RING.q.y)] = 1 / (h * h);
  } else {
    // a uniform field E₀ = 1 along x, the walls held at the exact potential outside the cylinder:
    // φ = −x′(1 − β a²/r²), β = (ε − 1)/(ε + 1), x′ = x − ½
    const beta = (eps2 - 1) / (eps2 + 1);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = i * h;
        const y = j * h;
        const rr = r(x, y);
        if (rr <= CYLINDER) g.eps[j * n + i] = eps2;
        if (g.fixed[j * n + i] === 1) g.phi[j * n + i] = -(x - 0.5) * (1 - (beta * CYLINDER * CYLINDER) / (rr * rr));
      }
    }
  }
  return g;
}

export const poissonGrid: PlateCode = {
  id: 'poisson-grid',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'mode', label: 'Inside the grounded box', value: 'charge', rebuild: true,
      options: [
        { value: 'charge', label: 'A line charge' },
        { value: 'coax', label: 'A coaxial cable: two round conductors' },
        { value: 'cage', label: 'A charge outside a conducting ring: the cage' },
        { value: 'cylinder', label: 'A dielectric cylinder in a uniform field' },
      ],
    },
    { kind: 'range', key: 'cells', label: 'Grid cells across the box', min: 32, max: 256, step: 32, value: 128, rebuild: true },
    { kind: 'range', key: 'eps2', label: 'Cylinder’s permittivity ε over ε₀', min: 1, max: 20, step: 0.5, value: 4, rebuild: true,
      when: when('cylinder') },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'iterations' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'iterations', 200);
    let mode: Mode = 'charge';
    let g: Grid = makeGrid(9);
    let solve: Solve | null = null;
    let solved = false;
    /** Each iteration's potential sampled at DISPLAY² points, and its residual, for the replay. */
    let frames: Float32Array[] = [];
    let residuals: number[] = [];
    let shown = 0;
    let rows: Stat[] = [];
    let lo = 0;
    let hi = 1;
    let electrodes: { x0: number; y0: number; x1: number; y1: number; V: number }[] = [];

    function snapshot() {
      const f = new Float32Array(DISPLAY * DISPLAY);
      for (let j = 0; j < DISPLAY; j++) {
        for (let i = 0; i < DISPLAY; i++) {
          const gi = Math.round(((i + 0.5) / DISPLAY) * (g.n - 1));
          const gj = Math.round(((j + 0.5) / DISPLAY) * (g.n - 1));
          f[j * DISPLAY + i] = g.phi[gj * g.n + gi];
        }
      }
      frames.push(f);
      residuals.push(solve?.residual ?? 1);
    }

    function setup() {
      const raw = String(params.mode);
      mode = optionId(raw) ? 'data' : (raw as Mode);
      const cells = num(params, 'cells');
      electrodes = [];
      if (mode === 'data') {
        g = makeGrid(cells + 1);
        const t = ctx.data?.(optionId(params.mode) ?? '') ?? null;
        if (t) {
          const [X0, Y0, X1, Y1, V] = t.values;
          for (let k = 0; k < t.rows; k++) {
            const e = { x0: Math.min(X0[k], X1[k]), y0: Math.min(Y0[k], Y1[k]), x1: Math.max(X0[k], X1[k]), y1: Math.max(Y0[k], Y1[k]), V: V[k] };
            electrodes.push(e);
            conductor(g, 2 + k, e.V, (x, y) => x >= e.x0 && x <= e.x1 && y >= e.y0 && y <= e.y1);
          }
        }
      } else g = build(mode, cells, num(params, 'eps2'));
      solve = new Solve(g);
      solved = solve.advance(0, TOL);
      frames = [];
      residuals = [];
      snapshot();
      shown = 0;
      pacer.start(null);
      rows = [{ label: 'conjugate-gradient iterations', value: 'solving' }];
      if (ctx.thumbnail) { while (!solved) step(Infinity); }
    }

    function step(work: number) {
      if (!solve || solved) return;
      const per = Math.max(1, Math.floor(work / (g.n * g.n)));
      for (let k = 0; k < per && !solved; k++) {
        solved = solve.advance(1, TOL) || solve.iterations >= 4 * g.n * 4;
        snapshot();
      }
      if (solved) {
        // the range of the picture's colours: the final potential's
        lo = Infinity;
        hi = -Infinity;
        for (const v of g.phi) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        rows = measure();
        pacer.known(frames.length - 1, 0);
      }
    }

    function measure(): Stat[] {
      const { n, h } = g;
      const node = (x: number, y: number) => Math.round(y / h) * n + Math.round(x / h);
      const head: Stat[] = [
        { label: 'grid', value: `${n} × ${n} nodes, h = ${h.toPrecision(4)}` },
        { label: 'conjugate-gradient iterations', value: String(solve!.iterations) },
        { label: 'relative residual ‖ρ − Aφ‖/‖b‖', value: sci(solve!.residual) },
      ];
      // the energy two ways, where the walls are grounded: over the field and over the sources
      let sources = 0;
      for (let k = 0; k < n * n; k++) sources += g.rho[k] * g.phi[k] * h * h;
      const ids = new Set<number>();
      for (const id of g.fixed) if (id > 1) ids.add(id);
      const V = new Map<number, number>();
      for (let k = 0; k < n * n; k++) if (g.fixed[k] > 1) V.set(g.fixed[k], g.phi[k]);
      for (const id of ids) sources += chargeOn(g, id) * (V.get(id) ?? 0);
      const energy: Stat[] = mode === 'cylinder' ? [] : [
        { label: 'energy ½Σε|∇φ|² over the grid’s faces', value: fx(fieldEnergy(g), 10) },
        { label: 'energy ½(Σρφh² + ΣQV) over the sources', value: fx(0.5 * sources, 10) },
      ];
      if (mode === 'charge') {
        return [...head,
          { label: 'φ at (0.5, 0.75), grid', value: fx(g.phi[node(0.5, 0.75)]) },
          { label: 'φ at (0.5, 0.75), the grounded box’s sine series', value: fx(boxSeries(1, 0.5, 0.5, 0.5, 0.75)) },
          { label: 'φ at (0.25, 0.625), grid', value: fx(g.phi[node(0.25, 0.625)]) },
          { label: 'φ at (0.25, 0.625), the sine series', value: fx(boxSeries(1, 0.5, 0.5, 0.25, 0.625)) },
          ...energy];
      }
      if (mode === 'coax') {
        const Q = chargeOn(g, 2);
        return [...head,
          { label: 'charge on the inner conductor at V = 1, Gauss on the grid', value: fx(Q, 6) },
          { label: 'capacitance per length C = Q/V, measured (ε₀ = 1)', value: fx(Q, 6) },
          { label: 'capacitance 2πε/ln(b/a), the round coaxial pair', value: fx((2 * Math.PI) / Math.log(COAX.b / COAX.a), 6) },
          { label: 'charge on the outer conductor, Gauss on the grid', value: fx(chargeOn(g, 3), 6) },
          { label: 'total charge on the two conductors', value: sci(Q + chargeOn(g, 3)) },
          ...energy];
      }
      if (mode === 'cage') {
        let inside = 0;
        let outside = 0;
        for (let j = 1; j < n - 1; j++) {
          for (let i = 1; i < n - 1; i++) {
            const k = j * n + i;
            if (g.fixed[k] || g.fixed[k - 1] || g.fixed[k + 1] || g.fixed[k - n] || g.fixed[k + n]) continue;
            const r = Math.hypot(i * h - 0.5, j * h - 0.5);
            const e = Math.hypot(...fieldAt(g, i, j));
            if (r < RING.inner) inside = Math.max(inside, e); else if (r > RING.outer) outside = Math.max(outside, e);
          }
        }
        return [...head,
          { label: 'largest |E| inside the ring', value: sci(inside) },
          { label: 'largest |E| outside it', value: sci(outside) },
          { label: 'largest |E| inside over outside', value: sci(inside / outside) },
          { label: 'φ at the centre (the ring is held at 0.5)', value: fx(g.phi[node(0.5, 0.5)]) },
          { label: 'charge induced on the ring, Gauss on the grid', value: fx(chargeOn(g, 2), 6) },
          ...energy];
      }
      if (mode === 'cylinder') {
        let ex = 0;
        let ey = 0;
        let count = 0;
        for (let j = 1; j < n - 1; j++) {
          for (let i = 1; i < n - 1; i++) {
            if (Math.hypot(i * h - 0.5, j * h - 0.5) > CYLINDER / 2) continue;
            const [a, b] = fieldAt(g, i, j);
            ex += a;
            ey += b;
            count++;
          }
        }
        const eps2 = num(params, 'eps2');
        return [...head,
          { label: 'E inside the cylinder (mean over its inner half), measured', value: fx(ex / count, 6) },
          { label: 'E inside 2E₀/(1 + ε/ε₀), the closed form', value: fx(2 / (1 + eps2), 6) },
          { label: 'E across the field inside, measured (zero by symmetry)', value: sci(ey / count) },
        ];
      }
      const out: Stat[] = [{ label: 'Input', value: `your data, ${electrodes.length} electrodes in the grounded box` }, ...head];
      [...ids].sort((a, b) => a - b).slice(0, 8).forEach((id) => out.push({ label: `charge on electrode ${id - 1} at V = ${Number((V.get(id) ?? 0).toPrecision(4))}, Gauss`, value: fx(chargeOn(g, id), 6) }));
      return [...out, ...energy];
    }

    return {
      setup,
      pace: () => pacer.report(solved && shown >= frames.length - 1, params),
      draw() {
        step(WORK_PER_FRAME);
        if (solved) {
          const take = ctx.thumbnail ? frames.length : pacer.take(params);
          shown = Math.min(frames.length - 1, shown + take);
        }
        render();
        const replay: Stat = solved
          ? { label: 'replayed iteration', value: `${shown} of ${frames.length - 1}, residual ${sci(residuals[shown])}` }
          : { label: 'replayed iteration', value: `solving: ${solve?.iterations ?? 0} iterations, residual ${sci(solve?.residual ?? 1)}` };
        ctx.stats([pacer.row(params), replay, ...rows]);
      },
    };

    function render() {
      const W = ctx.width;
      const H = ctx.height;
      const gc = p.drawingContext as CanvasRenderingContext2D;
      const pal = ctx.palette();
      p.background(...ctx.bg);
      gc.save();
      const side = Math.min(W * 0.62, H * 0.9);
      const x0 = W * 0.04;
      const y0 = (H - side) / 2;
      const f = frames[solved ? shown : frames.length - 1];
      const span = hi > lo ? hi - lo : 1;
      const cell = side / DISPLAY;
      for (let j = 0; j < DISPLAY; j++) {
        for (let i = 0; i < DISPLAY; i++) {
          const v = (f[j * DISPLAY + i] - lo) / span;
          // banded: twelve colours, so the boundaries between them are equipotentials
          const band = Math.max(0, Math.min(11, Math.floor(v * 12)));
          gc.fillStyle = rgba(ramp(pal, (band + 0.5) / 12), 1);
          gc.fillRect(x0 + i * cell, y0 + side - (j + 1) * cell, cell + 0.5, cell + 0.5);
        }
      }
      gc.strokeStyle = rgba(ctx.fg, 0.8);
      gc.lineWidth = 1.5;
      gc.strokeRect(x0, y0, side, side);
      const X = (x: number) => x0 + x * side;
      const Y = (y: number) => y0 + side - y * side;
      if (mode === 'coax' || mode === 'cage' || mode === 'cylinder') {
        const radii = mode === 'coax' ? [COAX.a, COAX.b] : mode === 'cage' ? [RING.inner, RING.outer] : [CYLINDER];
        for (const r of radii) { gc.beginPath(); gc.arc(X(0.5), Y(0.5), r * side, 0, 2 * Math.PI); gc.stroke(); }
      }
      for (const e of electrodes) gc.strokeRect(X(e.x0), Y(e.y1), (e.x1 - e.x0) * side, (e.y1 - e.y0) * side);
      // the residual against the iterations, log scale
      const px = W * 0.7;
      const pw = W * 0.26;
      const py = H * 0.15;
      const ph = H * 0.5;
      gc.strokeStyle = rgba(mix(ctx.bg, ctx.fg, 0.3), 1);
      gc.lineWidth = 1;
      gc.strokeRect(px, py, pw, ph);
      gc.fillStyle = rgba(ctx.fg, 0.75);
      gc.font = '11px monospace';
      gc.fillText('residual against iteration (log)', px, py - 6);
      const last = solved ? shown : residuals.length - 1;
      const total = Math.max(1, residuals.length - 1);
      gc.strokeStyle = rgba(ramp(pal, 0.8), 1);
      gc.beginPath();
      for (let k = 0; k <= last; k++) {
        const xx = px + (k / total) * pw;
        const yy = py + ph * Math.min(1, -Math.log10(Math.max(residuals[k], 1e-12)) / 12);
        if (k === 0) gc.moveTo(xx, yy); else gc.lineTo(xx, yy);
      }
      gc.stroke();
      gc.restore();
    }
  },
};

export default poissonGrid;
