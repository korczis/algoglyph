import { optionId } from '../../core/data';
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, type PlateCode, type Stat } from '../../core/plate';
import { rgba } from '../_shared/two-slit/draw';
import {
  circulation, ellipticKE, field, fluxThroughDisc, helix, loop, moment, motionalEmf, neumann, type V3, type Wire,
} from '../_shared/fields/biot-savart';

type Mode = 'loop' | 'solenoid' | 'ampere' | 'mutual' | 'induction' | 'data';

/** The field map: COLS × ROWS points in the x–z plane over ±HALF, filled a counted budget a frame. */
export const COLS = 48;
export const ROWS = 30;
const HALF = 2.4;
/** Segment evaluations a frame: a row of the map for the longest helix takes a few frames. */
export const WORK_PER_FRAME = 250_000;
const when = (...values: Mode[]) => ({ key: 'mode', values });
const fx = (x: number, d = 7) => (Number.isFinite(x) ? x.toFixed(d) : 'not measured');
const sci = (x: number) => (Number.isFinite(x) ? x.toExponential(3) : 'not measured');

/** The radius of the loops, the solenoid's radius and length, and the second loop's radius. */
export const R = 1;
export const SOLENOID = { R: 0.5, L: 4 };
export const R2 = 0.7;

export const currentsAndMagneticFields: PlateCode = {
  id: 'currents-and-magnetic-fields',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'mode', label: 'Currents', value: 'loop', rebuild: true,
      options: [
        { value: 'loop', label: 'A circular loop' },
        { value: 'solenoid', label: 'A solenoid: a helix of many turns' },
        { value: 'ampere', label: 'A long straight wire, and a circuit around it (Ampère)' },
        { value: 'mutual', label: 'Two coaxial loops: their mutual inductance' },
        { value: 'induction', label: 'A loop moving through a loop’s field: induction' },
      ],
    },
    { kind: 'range', key: 'sides', label: 'Straight segments per turn', min: 16, max: 512, step: 16, value: 256, rebuild: true },
    { kind: 'range', key: 'z', label: 'Probe height z on the axis', min: 0, max: 2, step: 0.05, value: 0.5, rebuild: true,
      when: when('loop') },
    { kind: 'range', key: 'turns', label: 'Turns of the solenoid', min: 4, max: 60, step: 1, value: 20, rebuild: true,
      when: when('solenoid') },
    { kind: 'range', key: 'offset', label: 'Circuit’s centre from the wire', min: 0, max: 2, step: 0.05, value: 0.3, rebuild: true,
      when: when('ampere') },
    { kind: 'range', key: 'gap', label: 'Distance between the loops', min: 0.1, max: 2, step: 0.05, value: 0.4, rebuild: true,
      when: when('mutual', 'induction') },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'rows' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'rows', ROWS);
    let mode: Mode = 'loop';
    let wires: Wire[] = [];
    let others: Wire[] = [];
    let rows: Stat[] = [];
    /** The map: |B| and the direction (Bx, Bz) at each point, filled row by row. */
    let map: Float64Array = new Float64Array(COLS * ROWS * 3);
    let filled = 0;
    let credit = 0;
    let scale = 1;

    const segments = () => wires.reduce((s, w) => s + w.points.length - 1, 0);

    function setup() {
      const raw = String(params.mode);
      mode = optionId(raw) ? 'data' : (raw as Mode);
      const n = num(params, 'sides');
      others = [];
      if (mode === 'loop') {
        wires = [loop(R, 0, n, 1)];
        const z = num(params, 'z');
        rows = [
          { label: 'B on the axis at height z, Biot–Savart over the polygon', value: fx(field(wires, [0, 0, z])[2]) },
          { label: 'B on the axis μ₀IR²/2(R² + z²)^(3/2), the circle’s closed form', value: fx((R * R) / (2 * (R * R + z * z) ** 1.5)) },
          { label: 'B at the centre, Biot–Savart', value: fx(field(wires, [0, 0, 0])[2]) },
          { label: 'magnetic moment (I/2)∮r × dl, z component, against πR²I', value: `${fx(moment(wires[0])[2], 6)} against ${fx(Math.PI * R * R, 6)}` },
        ];
      } else if (mode === 'solenoid') {
        const t = num(params, 'turns');
        wires = [helix(SOLENOID.R, SOLENOID.L, t, Math.max(16, Math.round(n / 4)), 1)];
        const nI = t / SOLENOID.L;
        const half = SOLENOID.L / 2;
        rows = [
          { label: 'B at the centre, Biot–Savart over the helix', value: fx(field(wires, [0, 0, 0])[2], 6) },
          { label: 'B at the centre of a finite current sheet μ₀nI(L/2)/√((L/2)² + R²)', value: fx((nI * half) / Math.sqrt(half * half + SOLENOID.R ** 2), 6) },
          { label: 'the long solenoid’s μ₀nI', value: fx(nI, 6) },
          { label: 'B at the end of the coil, over B at the centre (about ½)', value: fx(field(wires, [0, 0, half])[2] / field(wires, [0, 0, 0])[2], 4) },
          { label: '|B| just outside the middle, over B inside', value: sci(Math.hypot(...field(wires, [2 * SOLENOID.R, 0, 0])) / field(wires, [0, 0, 0])[2]) },
        ];
      } else if (mode === 'ampere') {
        wires = [{ points: [[0, 0, -1000], [0, 0, 1000]], current: 1 }];
        const off = num(params, 'offset');
        // a circuit of radius 1 about (off, 0) in the plane z = 0: it encloses the wire while off < 1
        const c = circulation(wires, [off, 0, 0], 1, n);
        others = [loop(1, 0, n, 0, [off, 0])];
        rows = [
          { label: '∮B·dl around the circuit, trapezoid over its points', value: fx(c, 7) },
          { label: 'μ₀ times the current it encloses', value: off < 1 ? '1.0000000' : '0.0000000' },
          { label: 'encloses the wire', value: off < 1 ? 'yes' : 'no' },
          { label: 'B at distance 1 from the wire, Biot–Savart, against μ₀I/2πr', value: `${fx(Math.hypot(...field(wires, [1, 0, 0])), 7)} against ${fx(1 / (2 * Math.PI), 7)}` },
        ];
      } else if (mode === 'mutual' || mode === 'induction') {
        const d = num(params, 'gap');
        wires = [loop(R, 0, n, 1)];
        const second = loop(R2, d, n, mode === 'mutual' ? 1 : 0);
        others = [second];
        if (mode === 'mutual') {
          const k = Math.sqrt((4 * R * R2) / ((R + R2) ** 2 + d * d));
          const { K, E } = ellipticKE(k);
          rows = [
            { label: 'mutual inductance, Neumann’s double integral ∮∮dl₁·dl₂/4π|r₁ − r₂|', value: fx(neumann(wires[0], second)) },
            { label: 'mutual inductance, the flux through the second loop over I', value: fx(fluxThroughDisc(wires, R2, d, 32, 64)) },
            { label: 'mutual inductance μ₀√(R₁R₂)((2/k − k)K − (2/k)E), elliptic integrals by the AGM', value: fx(Math.sqrt(R * R2) * ((2 / k - k) * K - (2 / k) * E)) },
          ];
        } else {
          const v = 0.3;
          const dt = 1e-3;
          const phi = (z: number) => fluxThroughDisc(wires, R2, z, 32, 64);
          const fromFlux = -(phi(d + v * dt) - phi(d - v * dt)) / (2 * dt);
          rows = [
            { label: 'loop moving away along the axis at speed', value: v.toFixed(2) },
            { label: 'EMF −dΦ/dt, the flux through it differentiated in time', value: fx(fromFlux) },
            { label: 'EMF ∮(v × B)·dl, the force on its charges', value: fx(motionalEmf(wires, second, [0, 0, v])) },
          ];
        }
      } else {
        const t = ctx.data?.(optionId(params.mode) ?? '') ?? null;
        wires = [];
        if (t && t.rows >= 2) {
          const pts: V3[] = [];
          for (let k = 0; k < t.rows; k++) pts.push([t.values[0][k], t.values[1][k], t.values[2][k]]);
          wires = [{ points: pts, current: 1 }];
        }
        const w = wires[0];
        let len = 0;
        if (w) for (let k = 0; k + 1 < w.points.length; k++) len += Math.hypot(...(w.points[k + 1].map((x, j) => x - w.points[k][j]) as V3));
        const m = w ? moment(w) : ([0, 0, 0] as V3);
        const closed = !!w && w.points[0].every((x, j) => x === w.points[w.points.length - 1][j]);
        rows = [
          { label: 'Input', value: t ? `your data, a wire of ${t.rows} points carrying 1 unit of current` : 'your data: none attached; attach x, y, z points of a wire' },
          { label: 'length of the wire', value: fx(len, 4) },
          { label: 'closed', value: closed ? 'yes: a circuit' : 'no: the ends are open, and Biot–Savart alone is not a real circuit' },
          { label: 'B at the origin', value: w ? field(wires, [0, 0, 0]).map((x) => x.toExponential(4)).join(', ') : 'no wire' },
          { label: 'magnetic moment (I/2)∮r × dl', value: m.map((x) => x.toExponential(4)).join(', ') },
        ];
      }
      map = new Float64Array(COLS * ROWS * 3);
      filled = 0;
      credit = 0;
      scale = 1e-300;
      pacer.start(ROWS);
      if (ctx.thumbnail) { credit = ROWS; fill(Infinity); }
    }

    function fill(work: number) {
      const perRow = Math.max(1, COLS * segments());
      let budget = work;
      while (filled < ROWS && credit >= 1 && (budget >= perRow || budget === work)) {
        const z = -HALF * 0.625 + (filled / (ROWS - 1)) * 2 * HALF * 0.625;
        for (let i = 0; i < COLS; i++) {
          const x = -HALF + (i / (COLS - 1)) * 2 * HALF;
          const B = field(wires, [x, 0, z]);
          const k = 3 * (filled * COLS + i);
          map[k] = Math.hypot(B[0], B[2]);
          map[k + 1] = B[0];
          map[k + 2] = B[2];
          if (Number.isFinite(map[k])) scale = Math.max(scale, map[k]);
        }
        filled++;
        credit--;
        budget -= perRow;
      }
    }

    return {
      setup,
      pace: () => pacer.report(filled >= ROWS, params),
      draw() {
        credit += ctx.thumbnail ? 0 : pacer.take(params);
        fill(WORK_PER_FRAME);
        render();
        ctx.stats([pacer.row(params), { label: 'field map', value: `${filled} of ${ROWS} rows, ${segments()} straight segments` }, ...rows]);
      },
    };

    function render() {
      const W = ctx.width;
      const H = ctx.height;
      const g = p.drawingContext as CanvasRenderingContext2D;
      const pal = ctx.palette();
      p.background(...ctx.bg);
      g.save();
      const cw = W / COLS;
      const ch = H / ROWS;
      // |B| on a log scale, three decades below the largest, and the direction of B in the plane
      for (let j = 0; j < filled; j++) {
        for (let i = 0; i < COLS; i++) {
          const k = 3 * (j * COLS + i);
          const t = Math.max(0, 1 + Math.log10(Math.max(map[k], 1e-300) / scale) / 3);
          const x = i * cw;
          const y = H - (j + 1) * ch;
          g.fillStyle = rgba(ramp(pal, 0.15 + 0.8 * t), 0.9);
          g.fillRect(x, y, cw + 0.5, ch + 0.5);
          const m = map[k] || 1;
          g.strokeStyle = rgba(ctx.bg, 0.6);
          g.beginPath();
          g.moveTo(x + cw / 2 - (map[k + 1] / m) * cw * 0.35, y + ch / 2 + (map[k + 2] / m) * ch * 0.35);
          g.lineTo(x + cw / 2 + (map[k + 1] / m) * cw * 0.35, y + ch / 2 - (map[k + 2] / m) * ch * 0.35);
          g.stroke();
        }
      }
      // the wires, seen from the side (x against z)
      const X = (x: number) => ((x + HALF) / (2 * HALF)) * W;
      const Z = (z: number) => H - ((z + HALF * 0.625) / (2 * HALF * 0.625)) * H;
      g.lineWidth = 2;
      for (const [list, colour] of [[wires, ctx.fg], [others, mix(ctx.fg, ctx.bg, 0.4)]] as const) {
        for (const w of list) {
          g.strokeStyle = rgba(colour, 0.9);
          g.beginPath();
          w.points.forEach((pt, i) => { const zz = Math.max(-50, Math.min(50, pt[2])); if (i === 0) g.moveTo(X(pt[0]), Z(zz)); else g.lineTo(X(pt[0]), Z(zz)); });
          g.stroke();
        }
      }
      g.restore();
    }
  },
};

export default currentsAndMagneticFields;
