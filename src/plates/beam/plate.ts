// Beam (src/plates/_shared/elastic/chain.ts): a cantilever as Hencky's bar chain, loaded step by
// step by a force at its tip, by its own weight, or along its axis as a column. Each load step is a
// minimum of the chain's energy found by Newton's method on its tridiagonal Hessian, so the chain
// may bend as far as the load takes it, and buckle once the column's load passes Euler's. The
// deflections are held to the continuous beam (elastica.ts): FL³/3EI and qL⁴/8EI when small, the
// elastica by shooting when large, π²EI/4L² and the post-buckled elastica in elliptic integrals.
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { bucklingLoad, carried, chain, minimise, positions, type Chain } from '../_shared/elastic/chain';
import { elasticaTip, eulerLoad, postBuckled, tipLinear, weightLinear } from '../_shared/elastic/elastica';
import { rgba } from '../_shared/two-slit/draw';

type Load = 'tip' | 'weight' | 'column';

/** Load steps of a run (the paced unit): the load rises linearly to its value over them. */
export const STEPS = 400;
const MAX_PER_FRAME = 30;
/** Points of the continuous beam's load–deflection curve drawn beside the chain's. */
const CURVE = 40;
const when = (...values: string[]) => ({ key: 'load', values });
const fx = (v: number, d = 9) => v.toFixed(d);
const ex = (v: number) => v.toExponential(2);

export const beam: PlateCode = {
  id: 'beam',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'load', label: 'Load', value: 'tip', rebuild: true,
      options: [
        { value: 'tip', label: 'A force at the tip (a cantilever)' },
        { value: 'weight', label: 'Its own weight, spread evenly' },
        { value: 'column', label: 'Along its axis (a column)' },
      ],
    },
    { kind: 'range', key: 'force', label: 'Tip force FL²/EI', min: 0.01, max: 20, step: 0.01, value: 2, log: true, rebuild: true, when: when('tip'),
      hint: 'Up to 20, where the tip points nearly straight down.' },
    { kind: 'range', key: 'weight', label: 'Weight qL³/EI', min: 0.01, max: 40, step: 0.01, value: 4, log: true, rebuild: true, when: when('weight'),
      hint: 'Up to 40, where the tip has fallen nine tenths of the beam’s length.' },
    { kind: 'range', key: 'ratio', label: 'Axial load over Euler’s, P/P_E', min: 0.1, max: 4, step: 0.01, value: 1.5, rebuild: true, when: when('column'),
      hint: 'At 4 the tip has leaned past 150°: the elastica is nearly a loop.' },
    { kind: 'range', key: 'imperfection', label: 'Sideways nudge at the tip, over P', min: 0.000001, max: 0.01, step: 0.000001, value: 0.00001, log: true,
      rebuild: true, when: when('column'), hint: 'A straight column under P above Euler’s load is in equilibrium but not stable; the nudge picks the side it falls to. Beyond a hundredth of P it is a sideways load, not a nudge.' },
    // 8 cells is the coarsest chain that still bends smoothly; at 400 the chain's error, 1/(4N²) of the
    // deflection, is 1.6e−6, a hundredth of a pixel at the widest canvas: more cells show nothing new
    { kind: 'range', key: 'cells', label: 'Cells of the chain', min: 8, max: 400, step: 1, value: 40, rebuild: true },
    paceParam(),
    paletteParam('ember'),
  ],
  pace: { kind: 'replay', unit: 'load steps' },
  create(p, ctx) {
    const params = ctx.params;
    let pacer = new Pacer('replay', 'load steps', MAX_PER_FRAME);
    let load: Load = 'tip';
    let c: Chain = chain(8);
    let th = new Float64Array(9);
    let fxs = new Float64Array(10);
    let fys = new Float64Array(10);
    let value = 0;
    let shown = 0;
    let iterations = 0;
    let residual = 0;
    let fixed: Stat[] = [];
    let input = '';
    let path: [number, number][] = [];
    let curve: [number, number][] = [];
    let pE = eulerLoad();
    let pChain = 0;

    /** The forces at the joints and the tip at a fraction s of the full load. */
    function loads(s: number) {
      const n = c.n;
      fxs = new Float64Array(n + 2);
      fys = new Float64Array(n + 2);
      if (load === 'tip') fys[n + 1] = -s * value;
      else if (load === 'weight') {
        // each cell's weight q·Δs at its joint, the midpoint of the cell
        for (let j = 1; j <= n; j++) fys[j] = (-s * value) / n;
      } else {
        fxs[n + 1] = -s * value * pE;
        fys[n + 1] = s * value * pE * num(params, 'imperfection');
      }
      return carried(c, fxs, fys);
    }

    /** The measured deflection the load–deflection panel plots: down for a beam, sideways for a column. */
    function deflection(): number {
      const r = positions(c, th);
      return load === 'column' ? r.y[c.n + 1] : -r.y[c.n + 1];
    }

    function setup() {
      load = str(params, 'load') as Load;
      const n = num(params, 'cells');
      c = chain(n);
      th = new Float64Array(n + 1);
      shown = 0;
      iterations = 0;
      residual = 0;
      path = [[0, 0]];
      pE = eulerLoad();
      pChain = bucklingLoad(c);
      value = num(params, load === 'tip' ? 'force' : load === 'weight' ? 'weight' : 'ratio');
      curve = [];
      if (load === 'tip') {
        const e = elasticaTip(-value);
        fixed = [
          { label: 'tip deflection of the linear beam FL³/3EI (L)', value: fx(tipLinear(value), 12) },
          { label: 'tip of the elastica by shooting, across (L)', value: fx(e.x, 12) },
          { label: 'tip of the elastica by shooting, down (L)', value: fx(-e.y, 12) },
        ];
        curve = e.path.map((r) => [r.F / -value, -r.y]);
        input = `seeded: a cantilever of ${n} cells, a tip force FL²/EI = ${value}`;
      } else if (load === 'weight') {
        fixed = [{ label: 'tip deflection of the linear beam qL⁴/8EI (L)', value: fx(weightLinear(value), 12) }];
        for (let i = 1; i <= CURVE; i++) curve.push([i / CURVE, weightLinear((value * i) / CURVE)]);
        input = `seeded: a cantilever of ${n} cells under its weight qL³/EI = ${value}`;
      } else {
        const pb = postBuckled(value * pE);
        fixed = [
          { label: 'Euler’s load π²EI/(2L)² of the column (EI/L²)', value: fx(pE, 12) },
          { label: 'sideways tip of the post-buckled elastica 2k/λ (L)', value: pb === null ? 'none: below Euler’s load the column stays straight' : fx(pb.side, 12) },
          { label: 'height of the post-buckled elastica 2E(k)/λ − L (L)', value: pb === null ? 'none: below Euler’s load' : fx(pb.height, 12) },
        ];
        for (let i = 1; i <= CURVE; i++) curve.push([i / CURVE, postBuckled((value * pE * i) / CURVE)?.side ?? 0]);
        input = `seeded: a column of ${n} cells under P = ${value} P_E, nudged sideways by ${num(params, 'imperfection')} P`;
      }
      pacer = new Pacer('replay', 'load steps', MAX_PER_FRAME);
      pacer.start(STEPS);
    }

    function advance() {
      shown++;
      const { gx, gy } = loads(shown / STEPS);
      const r = minimise(c, th, gx, gy);
      iterations += r.iterations;
      residual = r.residual;
      path.push([shown / STEPS, deflection()]);
    }

    function stats(): Stat[] {
      const done = shown >= STEPS;
      const late = (v: string) => (done ? v : 'after the run');
      const rows: Stat[] = [pacer.row(params), { label: 'Input', value: input },
        { label: 'load steps', value: `${shown} of ${STEPS}` },
        { label: 'Newton iterations, all steps', value: `${iterations}` }, ...fixed];
      const r = positions(c, th);
      const tx = r.x[c.n + 1];
      const ty = r.y[c.n + 1];
      if (load === 'tip') {
        rows.push(
          { label: 'tip deflection, measured (L)', value: late(fx(-ty, 12)) },
          { label: 'tip across, measured (L)', value: late(fx(tx, 12)) },
        );
      } else if (load === 'weight') {
        rows.push({ label: 'tip deflection, measured (L)', value: late(fx(-ty, 12)) });
      } else {
        rows.push(
          { label: 'Euler’s load of the chain, by bisection on its Hessian’s pivots (EI/L²)', value: fx(pChain, 12) },
          { label: 'sideways tip, measured (L)', value: late(fx(ty, 12)) },
          { label: 'height of the tip, measured (L)', value: late(fx(tx, 12)) },
        );
      }
      rows.push({ label: 'largest |∂Π/∂θ| over κ at the last step, numerics', value: ex(residual) });
      return rows;
    }

    return {
      setup,
      pace: () => pacer.report(shown >= STEPS, params),
      draw() {
        const take = ctx.thumbnail ? pacer.maxPerFrame : pacer.take(params);
        for (let i = 0; i < take && shown < STEPS; i++) advance();
        const W = ctx.width;
        const H = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        g.font = '11px monospace';
        // the beam: horizontal from a wall on the left, or a column standing on the ground
        const col = load === 'column';
        const sc = Math.min(W * 0.4, H * (col ? 0.42 : 0.6));
        const ox = col ? W * 0.3 : W * 0.08;
        const oy = col ? H * 0.88 : H * 0.25;
        const X = (x: number, y: number) => (col ? ox - y * sc : ox + x * sc);
        const Y = (x: number, y: number) => (col ? oy - x * sc : oy - y * sc);
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.5), 1);
        g.lineWidth = 3;
        g.beginPath();
        if (col) { g.moveTo(ox - 0.15 * sc, oy); g.lineTo(ox + 0.15 * sc, oy); } else { g.moveTo(ox, oy - 0.15 * sc); g.lineTo(ox, oy + 0.15 * sc); }
        g.stroke();
        g.lineWidth = 1;
        g.setLineDash([4, 4]);
        g.beginPath();
        g.moveTo(X(0, 0), Y(0, 0));
        g.lineTo(X(1, 0), Y(1, 0));
        g.stroke();
        g.setLineDash([]);
        const r = positions(c, th);
        g.strokeStyle = rgba(ramp(pal, 0.8), 1);
        g.lineWidth = Math.max(2, sc * 0.012);
        g.beginPath();
        for (let i = 0; i <= c.n + 1; i++) {
          if (i === 0) g.moveTo(X(r.x[i], r.y[i]), Y(r.x[i], r.y[i])); else g.lineTo(X(r.x[i], r.y[i]), Y(r.x[i], r.y[i]));
        }
        g.stroke();
        g.fillStyle = rgba(ramp(pal, 0.55), 1);
        const dot = Math.max(1.5, Math.min(3, (sc / c.n) * 0.3));
        for (let i = 1; i <= c.n; i++) g.fillRect(X(r.x[i], r.y[i]) - dot, Y(r.x[i], r.y[i]) - dot, 2 * dot, 2 * dot);
        g.lineWidth = 1;
        g.fillStyle = rgba(fg, 0.75);
        g.fillText(col ? 'the column, clamped at the ground; dashed: straight' : 'the cantilever, clamped at the wall; dots: the joints', W * 0.03, H * 0.07);
        // the panel: load against deflection, the chain's path and the continuous beam's
        const x0 = W * 0.6;
        const w = W * 0.36;
        const y0 = H * 0.14;
        const hh = H * 0.72;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
        g.strokeRect(x0, y0, w, hh);
        let top = 1e-12;
        for (const [, d] of curve) top = Math.max(top, Math.abs(d));
        for (const [, d] of path) top = Math.max(top, Math.abs(d));
        const PX = (d: number) => x0 + (Math.abs(d) / top) * w * 0.95;
        const PY = (s: number) => y0 + hh - s * hh * 0.95;
        g.setLineDash([4, 4]);
        g.strokeStyle = rgba(fg, 0.55);
        g.beginPath();
        g.moveTo(PX(0), PY(0));
        for (const [s, d] of curve) g.lineTo(PX(d), PY(s));
        g.stroke();
        g.setLineDash([]);
        g.strokeStyle = rgba(ramp(pal, 0.8), 1);
        g.beginPath();
        path.forEach(([s, d], i) => (i === 0 ? g.moveTo(PX(d), PY(s)) : g.lineTo(PX(d), PY(s))));
        g.stroke();
        g.fillStyle = rgba(fg, 0.75);
        g.fillText(col ? 'load (up) against the tip’s sideways move' : 'load (up) against the tip’s deflection', x0, y0 - 6);
        g.fillText(col ? 'dashed: the post-buckled elastica' : load === 'tip' ? 'dashed: the elastica, by shooting' : 'dashed: qL⁴/8EI, the linear beam', x0, y0 + hh + 14);
        g.restore();
        ctx.stats(stats());
      },
    };
  },
};

export default beam;
