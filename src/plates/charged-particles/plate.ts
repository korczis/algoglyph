// Charged particles in fields (src/plates/_shared/particles/charged.ts), pushed by the Boris method:
// a gyrating charge against its radius mv/qB and period 2πm/qB, the drift across crossed fields
// against E/B, a Wien filter's undeflected speed against E/B, and a magnetic mirror's loss cone
// against the adiabatic invariant's prediction. A reader's table of velocities fills the mirror.
import { optionId } from '../../core/data';
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import { gyrate, push, trapped, uniformField, type State } from '../_shared/particles/charged';
import { rgba } from '../_shared/two-slit/draw';

/** Orbit points revealed over a run, and the most a frame reveals. */
export const SAMPLES = 600;
export const MAX_PER_FRAME = 20;
/** The mirror's particles a frame pushes at most (each a whole orbit). */
export const MIRROR_PER_FRAME = 4;
/** The Boris step of every orbit. */
export const H = 2e-3;
/** The mirror: B₀ = 1 at the centre, scale length L, walls where it escapes. */
export const L = 4;

type Scenario = 'gyration' | 'drift' | 'wien' | 'mirror';
const f6 = (v: number) => v.toFixed(6);

export const chargedParticles: PlateCode = {
  id: 'charged-particles',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'scenario', label: 'Experiment', value: 'gyration', rebuild: true,
      options: [
        { value: 'gyration', label: 'Gyration in a uniform B' },
        { value: 'drift', label: 'Drift across crossed E and B' },
        { value: 'wien', label: 'A Wien velocity filter' },
        { value: 'mirror', label: 'A magnetic mirror and its loss cone' },
      ],
    },
    { kind: 'range', key: 'qm', label: 'Charge over mass q/m', min: -3, max: 3, step: 0.25, value: 1, rebuild: true },
    { kind: 'range', key: 'B', label: 'Magnetic field B', min: 0.5, max: 4, step: 0.25, value: 2, rebuild: true, when: { key: 'scenario', values: ['gyration', 'drift', 'wien'] } },
    { kind: 'range', key: 'E', label: 'Electric field E (across B)', min: 0, max: 2, step: 0.1, value: 0.5, rebuild: true, when: { key: 'scenario', values: ['drift', 'wien'] } },
    { kind: 'range', key: 'v', label: 'Speed v', min: 0.1, max: 2, step: 0.1, value: 0.5, rebuild: true, when: { key: 'scenario', values: ['gyration', 'drift', 'mirror'] } },
    // the walls end at 3L, where B is ten times B₀ and the loss cone's edge is 18°
    { kind: 'range', key: 'wall', label: 'Mirror walls at |z| (units of L)', min: 0.5, max: 3, step: 0.25, value: 1.5, rebuild: true, when: { key: 'scenario', values: ['mirror'] } },
    { kind: 'range', key: 'particles', label: 'Particles in the mirror', min: 50, max: 2000, step: 50, value: 300, rebuild: true, when: { key: 'scenario', values: ['mirror'] } },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'samples' },
  create(p, ctx) {
    const params = ctx.params;
    let pacer = new Pacer('replay', 'samples', MAX_PER_FRAME);
    let scenario: Scenario | 'data' = 'gyration';
    let orbit: [number, number][] = [];
    let shown = 0;
    let fixed: Stat[] = [];
    let rows: Stat[] = [];
    let input = '';
    // the mirror's particles: their velocities, and which have been pushed and kept
    let launch: [number, number, number][] = [];
    let done = 0;
    let kept = 0;
    let fates: boolean[] = [];

    const qm = () => num(params, 'qm') || 0.25;

    function orbitSetup() {
      const B = num(params, 'B');
      const E = scenario === 'gyration' ? 0 : num(params, 'E');
      const q = qm();
      const w = Math.abs(q) * B;
      const T = (2 * Math.PI) / w;
      fixed = [];
      if (scenario === 'gyration') {
        const v = num(params, 'v');
        const g = gyrate({ qm: q, B, v, h: T / 4000, turns: 3 });
        fixed.push(
          { label: 'gyroradius, measured from the orbit', value: f6(g.radius) },
          { label: 'closed form m v/(|q| B)', value: f6(v / w) },
          { label: 'period, measured from the turning velocity', value: f6(g.period) },
          { label: 'closed form 2πm/(|q| B)', value: f6(T) },
        );
      }
      if (scenario === 'drift') {
        // ten whole gyrations: the guiding centre moves E×B/B² = (E/B) x̂ meanwhile
        const s: State = { x: new Float64Array(3), v: new Float64Array([0, num(params, 'v'), 0]) };
        const f = uniformField([0, E, 0], [0, 0, B]);
        const n = 2000;
        for (let k = 0; k < 10 * n; k++) push(s, T / n, q, f);
        fixed.push(
          { label: 'drift speed, measured over ten gyrations', value: f6(s.x[0] / (10 * T)) },
          { label: 'closed form E/B, whatever the charge', value: f6(E / B) },
        );
      }
      if (scenario === 'wien') {
        // a beam along x through a filter of length 4 with E along y and B along z: the speed that
        // leaves undeflected, by bisection on the exit offset
        const exitY = (v: number) => {
          const s: State = { x: new Float64Array([0, 0, 0]), v: new Float64Array([v, 0, 0]) };
          const f = uniformField([0, E, 0], [0, 0, B]);
          const h = 1e-3 / Math.max(1, v);
          while (s.x[0] < 4 && s.x[0] > -1) push(s, h, q, f);
          return s.x[1];
        };
        let lo = 0.01;
        let hi = 3;
        const sLo = Math.sign(exitY(lo));
        for (let k = 0; k < 50; k++) { const m = 0.5 * (lo + hi); if (Math.sign(exitY(m)) === sLo) lo = m; else hi = m; }
        fixed.push(
          { label: 'undeflected speed, by bisection on the exit offset', value: E > 0 ? f6(0.5 * (lo + hi)) : 'none: no E to balance' },
          { label: 'closed form E/B', value: f6(E / B) },
        );
      }
      // the orbit drawn: three gyrations (or the drift's ten) in the plane across B
      const s: State = { x: new Float64Array(3), v: new Float64Array(scenario === 'drift' ? [0, num(params, 'v'), 0] : scenario === 'wien' ? [E / B, 0, 0] : [num(params, 'v'), 0, 0]) };
      const f = uniformField([0, E, 0], [0, 0, B]);
      const span = scenario === 'drift' ? 10 * T : scenario === 'wien' ? 4 / Math.max(1e-6, E / B || 1) : 3 * T;
      orbit = [];
      for (let k = 0; k <= SAMPLES; k++) {
        orbit.push([s.x[0], s.x[1]]);
        for (let j = 0; j < 10; j++) push(s, span / SAMPLES / 10, q, f);
      }
      pacer = new Pacer('replay', 'samples', MAX_PER_FRAME);
      pacer.start(SAMPLES);
    }

    function mirrorSetup(table: { vx: ArrayLike<number>; vy: ArrayLike<number>; vz: ArrayLike<number> } | null) {
      launch = [];
      if (table) {
        for (let i = 0; i < table.vx.length; i++) launch.push([table.vx[i], table.vy[i], table.vz[i]]);
      } else {
        const rnd = mulberry32(Math.floor(ctx.rnd() * 0x7fffffff) + 1);
        const v = num(params, 'v');
        for (let i = 0; i < num(params, 'particles'); i++) {
          // isotropic directions at the centre
          const mu = 2 * rnd() - 1;
          const ph = 2 * Math.PI * rnd();
          const st = Math.sqrt(1 - mu * mu);
          launch.push([v * st * Math.cos(ph), v * st * Math.sin(ph), v * mu]);
        }
      }
      done = 0; kept = 0; fates = [];
      const zMax = (scenario === 'data' ? 1.5 : num(params, 'wall')) * L;
      const ratio = 1 + (zMax * zMax) / (L * L);
      fixed = [
        { label: 'mirror ratio B_max/B₀ at the walls', value: f6(ratio) },
        { label: 'adiabatic loss cone sin²α_c = B₀/B_max, escaping share 1 − √(1 − B₀/B_max)', value: f6(1 - Math.sqrt(1 - 1 / ratio)) },
      ];
      pacer = new Pacer('replay', 'samples', MIRROR_PER_FRAME);
      pacer.start(Math.max(1, launch.length));
    }

    function measure(): Stat[] {
      const out: Stat[] = [pacer.row(params), { label: 'Input', value: input }, ...fixed];
      if (scenario === 'mirror' || scenario === 'data') {
        out.push(
          { label: 'particles pushed', value: `${done} of ${launch.length}` },
          { label: 'escaping share, measured', value: done ? f6((done - kept) / done) : 'after the first particle' },
        );
      }
      return out;
    }

    return {
      setup() {
        const raw = str(params, 'scenario');
        shown = 0;
        orbit = [];
        if (optionId(raw)) {
          scenario = 'data';
          const table = ctx.data?.(optionId(raw) ?? '') ?? null;
          input = table ? `your data, ${table.rows} particles at the mirror’s centre` : 'your data: none attached; attach a table of vx, vy, vz';
          mirrorSetup(table ? { vx: table.values[0], vy: table.values[1], vz: table.values[2] } : { vx: [], vy: [], vz: [] });
        } else {
          scenario = raw as Scenario;
          input = `seeded: ${raw}`;
          if (scenario === 'mirror') mirrorSetup(null); else orbitSetup();
        }
        rows = measure();
      },
      pace: () => pacer.report(scenario === 'mirror' || scenario === 'data' ? done >= launch.length : shown >= SAMPLES, params),
      draw() {
        const take = ctx.thumbnail ? MAX_PER_FRAME : pacer.take(params);
        if (scenario === 'mirror' || scenario === 'data') {
          const zMax = (scenario === 'data' ? 1.5 : num(params, 'wall')) * L;
          for (let k = 0; k < Math.min(take, MIRROR_PER_FRAME) && done < launch.length; k++) {
            const [vx, vy, vz] = launch[done];
            const v = Math.hypot(vx, vy, vz) || 1e-9;
            const alpha = Math.acos(Math.max(-1, Math.min(1, vz / v)));
            // long enough for a few bounces of the slowest trapped particle
            const keep = trapped(1, L, zMax, v, alpha, Math.atan2(vy, vx), qm(), H, (6 * zMax) / v);
            fates.push(keep);
            if (keep) kept++;
            done++;
          }
        } else shown = Math.min(SAMPLES, shown + take);
        rows = measure();
        const W = ctx.width;
        const Hh = ctx.height;
        const g = p.drawingContext as CanvasRenderingContext2D;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        g.save();
        g.font = '11px monospace';
        if (orbit.length) {
          let xmin = Infinity; let xmax = -Infinity; let ymin = Infinity; let ymax = -Infinity;
          for (const [x, y] of orbit) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
          const sc = Math.min((W * 0.8) / Math.max(1e-9, xmax - xmin), (Hh * 0.7) / Math.max(1e-9, ymax - ymin));
          const X = (x: number) => W / 2 + (x - (xmin + xmax) / 2) * sc;
          const Y = (y: number) => Hh / 2 - (y - (ymin + ymax) / 2) * sc;
          g.strokeStyle = rgba(ramp(pal, 0.85), 1);
          g.lineWidth = 2;
          g.beginPath();
          for (let k = 0; k <= shown; k++) { const [x, y] = orbit[k]; if (k === 0) g.moveTo(X(x), Y(y)); else g.lineTo(X(x), Y(y)); }
          g.stroke();
          const [cx, cy] = orbit[shown];
          g.fillStyle = rgba(fg, 1);
          g.beginPath(); g.arc(X(cx), Y(cy), 4, 0, 2 * Math.PI); g.fill();
          g.fillStyle = rgba(fg, 0.75);
          g.fillText('the orbit across B (B out of the page), drawn as it is pushed', 10, 16);
        } else {
          // the mirror: field lines' squeeze and each particle's pitch angle, kept or lost
          const zMax = (scenario === 'data' ? 1.5 : num(params, 'wall')) * L;
          const ratio = 1 + (zMax * zMax) / (L * L);
          const crit = Math.asin(Math.sqrt(1 / ratio));
          const cx = W * 0.3; const cy = Hh * 0.55; const R = Math.min(W * 0.22, Hh * 0.4);
          g.strokeStyle = rgba(mix(ctx.bg, fg, 0.4), 1);
          g.beginPath(); g.arc(cx, cy, R, Math.PI, 2 * Math.PI); g.stroke();
          g.fillStyle = rgba(mix(ctx.bg, ramp(pal, 0.2), 0.5), 1);
          g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, -Math.PI / 2 - crit, -Math.PI / 2 + crit); g.closePath(); g.fill();
          fates.forEach((keep, i) => {
            const [vx, vy, vz] = launch[i];
            const v = Math.hypot(vx, vy, vz) || 1e-9;
            const a = Math.acos(Math.abs(vz) / v);
            const rr = R * (0.3 + 0.7 * ((i * 0.618) % 1));
            g.fillStyle = rgba(keep ? ramp(pal, 0.85) : fg, keep ? 0.9 : 0.5);
            g.fillRect(cx + Math.sin(a) * rr - 1.5, cy - Math.cos(a) * rr - 1.5, 3, 3);
          });
          g.fillStyle = rgba(fg, 0.75);
          g.fillText('pitch angle from the axis (up): kept (bright) or lost; the loss cone shaded', 10, 16);
        }
        g.restore();
        ctx.stats(rows);
      },
    };
  },
};

export default chargedParticles;
