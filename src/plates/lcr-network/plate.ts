import { optionId } from '../../core/data';
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, type PlateCode, type Stat } from '../../core/plate';
import { rgba } from '../_shared/two-slit/draw';
import {
  crossing, goldenMax, ladder, MAX_STEPS, phasor, SAMPLES, SETTLE, SteadyRun, transient, type Element, type Netlist,
  type Steady,
} from '../_shared/lumped/mna';

type Mode = 'series' | 'rc' | 'ladder' | 'transformer' | 'data';

/** Frequencies of a sweep. */
export const SWEEP = 121;
/**
 * Work a frame gives a transient, in units of (unknowns² + elements) a step (src/plates/_shared/lumped
 * SteadyRun): a series circuit takes a few thousand steps a frame, a reader's 40-unknown netlist a few hundred.
 */
export const WORK_PER_FRAME = 600_000;
const when = (...values: Mode[]) => ({ key: 'mode', values });

const fx = (x: number, d = 10) => (Number.isFinite(x) ? x.toFixed(d) : 'not measured');
const sci = (x: number) => (Number.isFinite(x) ? x.toExponential(3) : 'not measured');
const mag = (re: number, im: number) => Math.hypot(re, im);
const UNIT: Record<string, string> = { R: 'Ω', L: 'H', C: 'F', V: 'V' };

export const lcrNetwork: PlateCode = {
  id: 'lcr-network',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    {
      kind: 'select', key: 'mode', label: 'Circuit', value: 'series', rebuild: true,
      options: [
        { value: 'series', label: 'A series RLC driven by an AC source' },
        { value: 'rc', label: 'A capacitor charged through a resistor' },
        { value: 'ladder', label: 'An LC ladder: a filter with a cutoff' },
        { value: 'transformer', label: 'Two coupled coils: a transformer' },
      ],
    },
    { kind: 'range', key: 'Q', label: 'Quality factor Q = (1/R)√(L/C)', min: 1, max: 100, step: 1, value: 10, rebuild: true,
      when: when('series') },
    { kind: 'range', key: 'w', label: 'Drive frequency ω over ω₀ = 1/√(LC)', min: 0.2, max: 3, step: 0.01, value: 0.95,
      rebuild: true, when: when('series', 'transformer') },
    { kind: 'range', key: 'R', label: 'Resistance R (Ω), with C = 1 F', min: 0.1, max: 10, step: 0.1, value: 2,
      rebuild: true, when: when('rc') },
    { kind: 'range', key: 'sections', label: 'Ladder sections N', min: 4, max: 48, step: 1, value: 24, rebuild: true,
      when: when('ladder') },
    { kind: 'range', key: 'ratio', label: 'Drive frequency over the cutoff 2/√(LC)', min: 0.05, max: 2, step: 0.01,
      value: 1.5, rebuild: true, when: when('ladder') },
    { kind: 'range', key: 'turns', label: 'Turns ratio n = √(L₂/L₁)', min: 0.25, max: 4, step: 0.05, value: 2,
      rebuild: true, when: when('transformer') },
    // k = 1 is the perfect coupling of an ideal transformer; above it the inductance matrix is not physical
    { kind: 'range', key: 'k', label: 'Coupling k', min: 0, max: 1, step: 0.01, value: 0.9, rebuild: true,
      when: when('transformer') },
    { kind: 'range', key: 'load', label: 'Load resistance (Ω)', min: 0.1, max: 100, step: 0.1, value: 3, rebuild: true,
      when: when('transformer') },
    { kind: 'range', key: 'resolution', label: 'Time steps per drive period', min: 20, max: 800, step: 10, value: 200,
      rebuild: true },
    paceParam(),
    paletteParam('ember'),
  ],
  pace: { kind: 'replay', unit: 'samples' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'samples', SAMPLES);
    let mode: Mode = 'series';
    let rows: Stat[] = [];
    let net: Netlist = { nodes: 0, elements: [] };
    let trace: [number, number][] = [];
    /** The frequency response: [ω, |H|] on a log grid, the drive's ω, and what H is. */
    let sweep: [number, number][] = [];
    let drive = 1;
    let byHand: number | null = null;
    let bars: number[] = [];
    let shown = 0;
    let title = '';
    let traceLabel = '';
    let warn = '';
    /** A transient still settling, and what to do with its result. */
    let pending: { run: SteadyRun; done: (st: Steady) => void } | null = null;
    /** Rows that wait for the transient: shown as settling until it ends. */
    let waiting: Stat[] = [];
    let phasorBars: { re: number[]; im: number[]; w: number } | null = null;

    const S = () => num(params, 'resolution');

    /** Lines of the netlist as a reader would write it. */
    const listing = () => net.elements.slice(0, 14).map((e) => `${e.kind} ${e.a}–${e.b} ${Number(e.value.toPrecision(4))} ${UNIT[e.kind]}`);

    function buildSweep(lo: number, hi: number, H: (w: number) => number) {
      sweep = [];
      for (let i = 0; i < SWEEP; i++) {
        const w = lo * Math.pow(hi / lo, i / (SWEEP - 1));
        sweep.push([w, H(w)]);
      }
    }

    function seriesSetup() {
      const Q = num(params, 'Q');
      const R = 1 / Q;
      net = { nodes: 3, elements: [{ kind: 'V', a: 1, b: 0, value: 1 }, { kind: 'R', a: 1, b: 2, value: R },
        { kind: 'L', a: 2, b: 3, value: 1 }, { kind: 'C', a: 3, b: 0, value: 1 }] };
      const w = byHand ?? num(params, 'w');
      drive = w;
      const I = (x: number) => { const s = phasor(net, x); return mag(s.ir[1], s.ii[1]); };
      buildSweep(0.2, 3, I);
      const ac = phasor(net, w);
      const h = (2 * Math.PI) / w / S();
      const warped = phasor(net, (2 / h) * Math.tan((w * h) / 2));
      const peak = goldenMax(I, 0.2, 3);
      const top = I(peak);
      const lo = crossing(I, peak, 0.2, top / Math.SQRT2);
      const hi = crossing(I, peak, 3, top / Math.SQRT2);
      title = 'the current (solid) against the source voltage (dashed), steady state';
      traceLabel = 'current';
      rows = [
        { label: 'drive ω over ω₀', value: `${w.toFixed(4)}${byHand ? ' (set on the response curve)' : ''}` },
        { label: 'current amplitude, trapezoidal transient (lock-in)', value: 'settling' },
        { label: 'current amplitude, phasor at the warped frequency (2/h)tan(ωh/2)', value: fx(mag(warped.ir[1], warped.ii[1])) },
        { label: 'current amplitude, phasor solve at ω', value: fx(mag(ac.ir[1], ac.ii[1])) },
        { label: 'current amplitude, closed form V/|R + j(ωL − 1/ωC)|', value: fx(1 / Math.hypot(R, w - 1 / w)) },
        { label: 'phase of the current against the source, transient (rad)', value: 'settling' },
        { label: 'phase of the current, phasor solve (rad)', value: fx(Math.atan2(ac.ii[1], ac.ir[1]), 6) },
        { label: 'peak of |I|, golden-section search on the phasor solve (ω over ω₀)', value: fx(peak) },
        { label: 'resonance 1/√(LC), closed form', value: fx(1) },
        { label: 'Q from the half-power width, ω_peak/(ω₊ − ω₋)', value: fx(peak / (hi - lo), 8) },
        { label: 'Q set, (1/R)√(L/C)', value: fx(Q, 8) },
        { label: 'average power from the source, transient', value: 'settling' },
        { label: 'average power into R, transient', value: 'settling' },
        { label: 'average power into L and C, transient (stored, returned each period)', value: 'settling' },
        { label: 'Kirchhoff current-law residual, largest relative', value: 'settling' },
        { label: 'time steps', value: 'settling' },
      ];
      start(SETTLE * (2 / R), (_v, i) => i[1], w, (st) => [
        ['current amplitude, trapezoidal transient (lock-in)', fx(st.amplitude)],
        ['phase of the current against the source, transient (rad)', fx(-st.phase, 6)],
        // the source's own branch current runs through it from + to −, so it delivers −v·i
        ['average power from the source, transient', fx(-st.power[0], 10)],
        ['average power into R, transient', fx(st.power[1], 10)],
        ['average power into L and C, transient (stored, returned each period)', sci(st.power[2] + st.power[3])],
        ['Kirchhoff current-law residual, largest relative', sci(st.kcl)],
        ['time steps', steps(st)],
      ]);
    }

    function rcSetup() {
      const R = num(params, 'R');
      const C = 1;
      const tau = R * C;
      net = { nodes: 2, elements: [{ kind: 'V', a: 1, b: 0, value: 1 }, { kind: 'R', a: 1, b: 2, value: R },
        { kind: 'C', a: 2, b: 0, value: C }] };
      // a step of 1 V at t = 0, integrated for 25 τ with S() steps per τ
      const h = tau / S();
      const tr = transient(net, h, () => 1);
      const n = 25 * S();
      let Es = 0;
      let ER = 0;
      let ps0 = 0;
      let pr0 = 0;
      const raw: [number, number][] = [];
      for (let k = 0; k < n; k++) {
        tr.step();
        const i = tr.i[1];
        const ps = tr.v[1] * i;
        const pr = i * i * R;
        Es += 0.5 * h * (ps + ps0);
        ER += 0.5 * h * (pr + pr0);
        ps0 = ps;
        pr0 = pr;
        if (k < 6 * S()) raw.push([tr.v[2], i * R]);
      }
      const EC = 0.5 * C * tr.v[2] ** 2;
      trace = [];
      for (let i = 0; i < SAMPLES; i++) trace.push(raw[Math.floor((i * (raw.length - 1)) / (SAMPLES - 1))]);
      // the response to a sinusoid of the same circuit: |V_C/V| = 1/|1 + jωτ|
      buildSweep(0.01 / tau, 100 / tau, (x) => { const s = phasor(net, x); return mag(s.vr[2], s.vi[2]); });
      drive = 1 / tau;
      title = 'charging: the capacitor’s voltage (solid) and the resistor’s (dashed), over 6 τ';
      traceLabel = 'v_C';
      rows = [
        { label: 'time constant τ = RC', value: tau.toFixed(3) },
        { label: 'energy delivered by the source, ∫V i dt', value: fx(Es) },
        { label: 'energy turned to heat in R, ∫i²R dt', value: fx(ER) },
        { label: 'energy stored in C at the end, ½CV²', value: fx(EC) },
        { label: 'fraction of the source’s energy turned to heat in R', value: fx(ER / Es) },
        { label: 'energy balance (E_R + E_C)/E_source − 1', value: sci((ER + EC) / Es - 1) },
      ];
    }

    function ladderSetup() {
      const N = num(params, 'sections');
      const r = byHand ?? num(params, 'ratio');
      const wc = 2;
      const w = r * wc;
      drive = r;
      net = ladder(N);
      const s = phasor(net, w);
      const m = (k: number) => mag(s.vr[k], s.vi[k]);
      bars = [];
      for (let k = 2; k <= N + 1; k++) bars.push(m(k));
      const lo = 2 + Math.floor(N / 4);
      const hi = 2 + Math.floor((3 * N) / 4);
      const att = Math.log(m(lo) / m(hi)) / (hi - lo);
      let phase = 0;
      for (let k = lo; k < hi; k++) {
        let d = Math.atan2(s.vi[k], s.vr[k]) - Math.atan2(s.vi[k + 1], s.vr[k + 1]);
        while (d < 0) d += 2 * Math.PI;
        while (d >= 2 * Math.PI) d -= 2 * Math.PI;
        phase += d;
      }
      buildSweep(0.05, 2, (x) => { const q = phasor(net, x * wc); return mag(q.vr[N + 1], q.vi[N + 1]); });
      // the wave along the ladder, from the phasors: V_k(t) = Re(V_k e^{jωt}), three periods replayed
      phasorBars = { re: [], im: [], w };
      for (let k = 2; k <= N + 1; k++) { phasorBars.re.push(s.vr[k]); phasorBars.im.push(s.vi[k]); }
      trace = [];
      title = r < 1 ? 'the wave along the ladder, V_k(t), three periods' : 'in the stop band: |V_k| along the ladder, log scale';
      traceLabel = 'V_k';
      rows = [
        { label: 'drive over the cutoff ω_c = 2/√(LC)', value: `${r.toFixed(4)}${byHand ? ' (set on the response curve)' : ''}` },
        { label: 'attenuation per section, measured over the middle half (nepers)', value: fx(att, 8) },
        { label: 'attenuation per section 2 acosh(ω/ω_c), the infinite ladder', value: r > 1 ? fx(2 * Math.acosh(r), 8) : '0 below the cutoff' },
        { label: 'phase per section, measured over the middle half (rad)', value: fx(phase / (hi - lo), 6) },
        { label: 'phase per section 2 asin(ω/ω_c), the infinite ladder (rad)', value: r < 1 ? fx(2 * Math.asin(r), 6) : 'π in the stop band' },
        { label: '|V_N/V_source| at the drive, phasor solve', value: sci(m(N + 1)) },
        { label: 'reflection: |V| ripple along the middle half, (max − min)/mean', value: r < 1 ? sci(ripple(bars.slice(lo - 2, hi - 1))) : 'none measurable in the stop band' },
      ];
    }

    function transformerSetup() {
      const n = num(params, 'turns');
      const k = num(params, 'k');
      const RL = num(params, 'load');
      const L1 = 1;
      const L2 = n * n;
      net = { nodes: 2, elements: [{ kind: 'V', a: 1, b: 0, value: 1 }, { kind: 'L', a: 1, b: 0, value: L1 },
        { kind: 'L', a: 2, b: 0, value: L2 }, { kind: 'R', a: 2, b: 0, value: RL }], couplings: [{ l1: 1, l2: 2, k }] };
      const w = byHand ?? num(params, 'w');
      drive = w;
      const V2 = (x: number) => { const s = phasor(net, x); return mag(s.vr[2], s.vi[2]); };
      buildSweep(0.2, 3, V2);
      const M = k * Math.sqrt(L1 * L2);
      // V₂/V₁ = jωM R / (jωL₁R − ω²L₁L₂(1 − k²)), the two loop equations solved by hand
      const closed = (w * M * RL) / Math.hypot(-w * w * L1 * L2 * (1 - k * k), w * L1 * RL);
      title = 'the secondary’s voltage (solid) against the primary’s (dashed)';
      traceLabel = 'V₂';
      rows = [
        { label: 'drive ω (L₁ = 1 H)', value: `${w.toFixed(4)}${byHand ? ' (set on the response curve)' : ''}` },
        { label: '|V₂/V₁|, phasor solve', value: fx(V2(w)) },
        { label: '|V₂/V₁|, closed form ωMR/|jωL₁R − ω²L₁L₂(1 − k²)|', value: fx(closed) },
        { label: 'turns ratio n = √(L₂/L₁), the ideal transformer’s |V₂/V₁|', value: fx(n) },
        { label: '|V₂/V₁|, trapezoidal transient (lock-in)', value: 'settling' },
        { label: 'average power from the source, transient', value: 'settling' },
        { label: 'average power into the load, transient', value: 'settling' },
        { label: 'Kirchhoff current-law residual, largest relative', value: 'settling' },
      ];
      // the secondary's decay time L₂/R, and at least a period
      start(SETTLE * Math.max((2 * Math.PI) / w, L2 / RL), (v) => v[2], w, (st) => {
        if (st.singular) warn = 'the transient matrix is singular at this coupling';
        return [
          ['|V₂/V₁|, trapezoidal transient (lock-in)', fx(st.amplitude, 8)],
          ['average power from the source, transient', fx(-st.power[0])],
          ['average power into the load, transient', fx(st.power[3])],
          ['Kirchhoff current-law residual, largest relative', sci(st.kcl)],
        ];
      });
    }

    function dataSetup() {
      const table = ctx.data?.(optionId(params.mode) ?? '') ?? null;
      if (!table) {
        net = { nodes: 0, elements: [] };
        rows = [{ label: 'Input', value: 'your data: none attached; attach a netlist of kind (1 R, 2 L, 3 C), a, b, value' }];
        trace = [];
        sweep = [];
        return;
      }
      const [K, A, B, V] = table.values;
      const elements: Element[] = [{ kind: 'V', a: 1, b: 0, value: 1 }];
      const refused: string[] = [];
      let nodes = 1;
      for (let r = 0; r < table.rows; r++) {
        const kind = K[r] === 1 ? 'R' : K[r] === 2 ? 'L' : K[r] === 3 ? 'C' : null;
        if (!kind) { refused.push(`row ${r + 1}: kind ${K[r]} is not 1, 2 or 3`); continue; }
        if (!Number.isInteger(A[r]) || !Number.isInteger(B[r]) || A[r] === B[r]) { refused.push(`row ${r + 1}: nodes must be two different whole numbers`); continue; }
        elements.push({ kind, a: A[r], b: B[r], value: V[r] });
        nodes = Math.max(nodes, A[r], B[r]);
      }
      net = { nodes, elements };
      const out = nodes;
      // the sweep spans the circuit's own time scales: every RC, L/R and √(LC) its values make
      const rs = elements.filter((e) => e.kind === 'R').map((e) => e.value);
      const ls = elements.filter((e) => e.kind === 'L').map((e) => e.value);
      const cs = elements.filter((e) => e.kind === 'C').map((e) => e.value);
      const scales: number[] = [];
      for (const r of rs) { for (const c of cs) scales.push(1 / (r * c)); for (const l of ls) scales.push(r / l); }
      for (const l of ls) for (const c of cs) scales.push(1 / Math.sqrt(l * c));
      const lo = scales.length ? Math.min(...scales) / 20 : 0.01;
      const hi = scales.length ? Math.max(...scales) * 20 : 100;
      const H = (x: number) => { const s = phasor(net, x); return s.singular ? Number.NaN : mag(s.vr[out], s.vi[out]); };
      buildSweep(lo, hi, H);
      const singular = phasor(net, Math.sqrt(lo * hi)).singular;
      let best = sweep[0];
      for (const pt of sweep) if (pt[1] > best[1]) best = pt;
      const w = byHand ?? best[0];
      drive = w;
      const h = (2 * Math.PI) / w / S();
      const warped = phasor(net, (2 / h) * Math.tan((w * h) / 2));
      title = `your circuit: node ${out} (solid) against the 1 V source at node 1 (dashed)`;
      traceLabel = `V${out}`;
      rows = [
        { label: 'Input', value: `your data, ${table.rows} elements, nodes 0 to ${nodes}; a 1 V source drives node 1` },
        { label: 'refused rows', value: refused.length ? refused.slice(0, 3).join('; ') + (refused.length > 3 ? `; and ${refused.length - 3} more` : '') : 'none' },
        { label: 'solvable', value: singular ? 'no: a node floats, or a loop has no impedance' : 'yes' },
        { label: 'drive ω', value: `${w.toPrecision(6)}${byHand ? ' (set on the response curve)' : ' (the response curve’s peak)'}` },
        { label: `|V${out}| at the drive, phasor solve`, value: singular ? 'not solvable' : sci(H(w)) },
        { label: `|V${out}|, trapezoidal transient (lock-in)`, value: singular ? 'not solvable' : 'settling' },
        { label: 'transient against the phasor at the warped frequency, relative gap', value: singular ? 'not solvable' : 'settling' },
        { label: 'Kirchhoff current-law residual, largest relative', value: singular ? 'not solvable' : 'settling' },
        { label: 'time steps', value: singular ? '0' : 'settling' },
      ];
      // settled for SETTLE of its slowest decay: a resonance's envelope decays at half its R/L, so twice
      // the slowest time scale
      if (!singular) {
        start((2 * SETTLE) / (scales.length ? Math.min(...scales) : 0.2), (v) => v[out], w, (st) => [
          [`|V${out}|, trapezoidal transient (lock-in)`, sci(st.amplitude)],
          ['transient against the phasor at the warped frequency, relative gap', sci(Math.abs(st.amplitude / mag(warped.vr[out], warped.vi[out]) - 1))],
          ['Kirchhoff current-law residual, largest relative', sci(st.kcl)],
          ['time steps', steps(st)],
        ]);
      }
    }

    function setup() {
      byHand = null;
      compute();
    }

    const steps = (st: Steady) => `${st.steps}${st.bounded ? ` (bounded at ${MAX_STEPS}: the settling was cut short)` : ''}`;
    const ripple = (xs: number[]) => {
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      return (Math.max(...xs) - Math.min(...xs)) / mean;
    };

    /** Start the transient of the current netlist; `fill` turns its result into the rows it fills. */
    function start(settle: number, probe: (v: Float64Array, i: Float64Array) => number, w: number,
      fill: (st: Steady) => [string, string][]) {
      const run = new SteadyRun(net, w, S(), settle, probe);
      pending = {
        run,
        done: (st) => {
          trace = st.trace;
          for (const [label, value] of fill(st)) {
            const row = rows.find((r) => r.label === label);
            if (!row) throw new Error(`lcr-network: no row "${label}" waits for the transient`);
            row.value = value;
          }
        },
      };
    }

    function compute() {
      const raw = String(params.mode);
      mode = optionId(raw) ? 'data' : (raw as Mode);
      warn = '';
      bars = [];
      pending = null;
      phasorBars = null;
      trace = [];
      if (mode === 'series') seriesSetup();
      else if (mode === 'rc') rcSetup();
      else if (mode === 'ladder') ladderSetup();
      else if (mode === 'transformer') transformerSetup();
      else dataSetup();
      shown = ctx.thumbnail ? SAMPLES : 0;
      // a run still settling has no length yet; it is learnt when the transient ends
      const length = pending ? null : trace.length || phasorBars ? SAMPLES : 1;
      pacer.start(length);
      if (pending && ctx.thumbnail) advance(Infinity);
    }

    function advance(work: number) {
      if (!pending) return;
      const at = pending.run.progress;
      if (pending.run.advance(work)) {
        pending.done(pending.run.result!);
        pending = null;
        pacer.known(trace.length ? SAMPLES : 1, 0);
      } else {
        const row = rows.find((r) => r.value === 'settling');
        if (row) waiting = [{ label: 'transient', value: `settling: ${at[0]} of ${at[1]} steps` }];
      }
    }

    const length = () => (trace.length || phasorBars ? SAMPLES : 1);

    // the response panel, where a press sets the drive frequency
    const panel = () => ({ x0: ctx.width * 0.56, w: ctx.width * 0.4, y0: ctx.height * 0.12, h: ctx.height * 0.6 });

    function pressed(x: number, y: number) {
      if (mode === 'rc' || !sweep.length) return;
      const P = panel();
      if (x < P.x0 || x > P.x0 + P.w || y < P.y0 || y > P.y0 + P.h) return;
      const lo = sweep[0][0];
      const hi = sweep[sweep.length - 1][0];
      byHand = lo * Math.pow(hi / lo, (x - P.x0) / P.w);
      compute();
    }

    return {
      setup,
      pace: () => pacer.report(!pending && shown >= length(), params),
      pressed,
      dragged: pressed,
      draw() {
        waiting = [];
        if (pending) advance(WORK_PER_FRAME);
        const take = ctx.thumbnail ? SAMPLES : pacer.take(params);
        if (!pending) shown = Math.min(length(), shown + take);
        render();
        ctx.stats([pacer.row(params), ...waiting, ...rows]);
      },
    };

    function render() {
      const W = ctx.width;
      const H = ctx.height;
      const g = p.drawingContext as CanvasRenderingContext2D;
      const pal = ctx.palette();
      const fg = ctx.fg;
      p.background(...ctx.bg);
      g.save();
      g.font = '11px monospace';
      const box = (x0: number, y0: number, w: number, h: number, label: string) => {
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
        g.strokeRect(x0, y0, w, h);
        g.fillStyle = rgba(fg, 0.75);
        g.fillText(label, x0, y0 - 6);
      };
      // the time trace
      const tx = W * 0.05;
      const tw = W * 0.45;
      const ty = H * 0.12;
      const th = H * 0.6;
      if (trace.length) {
        box(tx, ty, tw, th, title);
        let scale = 1e-30;
        for (const [a] of trace) scale = Math.max(scale, Math.abs(a));
        const lines: [number, string, number[], number][] = [[0, rgba(ramp(pal, 0.8), 1), [], scale], [1, rgba(fg, 0.55), [4, 3], 1]];
        for (const [k, colour, dash, sc] of lines) {
          g.strokeStyle = colour;
          g.setLineDash(dash);
          g.lineWidth = 1.4;
          g.beginPath();
          for (let i = 0; i < Math.min(shown, trace.length); i++) {
            const xx = tx + (i / (trace.length - 1)) * tw;
            const yy = ty + th / 2 - (trace[i][k] / sc) * th * 0.45;
            if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
          }
          g.stroke();
        }
        g.setLineDash([]);
        g.fillStyle = rgba(fg, 0.7);
        g.fillText(`${traceLabel}: peak ${Number(scale.toPrecision(4))}`, tx + 4, ty + 14);
      } else if (phasorBars && drive < 1) {
        box(tx, ty, tw, th, title);
        // V_k(t) = Re(V_k e^{jωt}) at the replayed phase: the wave runs down the ladder
        const phi = (6 * Math.PI * shown) / SAMPLES;
        const n = phasorBars.re.length;
        let peak = 1e-30;
        for (let k = 0; k < n; k++) peak = Math.max(peak, Math.hypot(phasorBars.re[k], phasorBars.im[k]));
        const bw = tw / n;
        g.fillStyle = rgba(ramp(pal, 0.7), 1);
        for (let k = 0; k < n; k++) {
          const val = (phasorBars.re[k] * Math.cos(phi) - phasorBars.im[k] * Math.sin(phi)) / peak;
          const hh = val * th * 0.45;
          g.fillRect(tx + k * bw + 1, ty + th / 2 - Math.max(hh, 0), Math.max(1, bw - 2), Math.abs(hh));
        }
      } else if (bars.length) {
        box(tx, ty, tw, th, title);
        const logs = bars.map((b) => Math.log10(Math.max(b, 1e-300)));
        const top = Math.max(...logs);
        const bottom = Math.min(...logs);
        const bw = tw / bars.length;
        g.fillStyle = rgba(ramp(pal, 0.7), 1);
        logs.forEach((l, k) => {
          const hh = top > bottom ? ((l - bottom) / (top - bottom)) * th * 0.9 + th * 0.05 : th * 0.5;
          g.fillRect(tx + k * bw + 1, ty + th - hh, Math.max(1, bw - 2), hh);
        });
      }
      // the response curve, log-log, with the drive marked
      if (sweep.length) {
        const P = panel();
        box(P.x0, P.y0, P.w, P.h, mode === 'rc' ? '|V_C/V| against ω: a low-pass' : 'the response against ω (press to drive there)');
        const finite = sweep.filter(([, y]) => Number.isFinite(y) && y > 0);
        if (finite.length) {
          const ys = finite.map(([, y]) => Math.log10(y));
          const top = Math.max(...ys);
          const bottom = Math.max(Math.min(...ys), top - 8);
          const lo = Math.log10(sweep[0][0]);
          const hi = Math.log10(sweep[sweep.length - 1][0]);
          const X = (w: number) => P.x0 + ((Math.log10(w) - lo) / (hi - lo)) * P.w;
          const Y = (y: number) => P.y0 + P.h - ((Math.max(Math.log10(y), bottom) - bottom) / Math.max(1e-9, top - bottom)) * P.h * 0.9 - P.h * 0.05;
          g.strokeStyle = rgba(ramp(pal, 0.6), 1);
          g.lineWidth = 1.4;
          g.beginPath();
          finite.forEach(([w, y], i) => { if (i === 0) g.moveTo(X(w), Y(y)); else g.lineTo(X(w), Y(y)); });
          g.stroke();
          const dx = X(drive);
          g.strokeStyle = rgba(fg, 0.6);
          g.setLineDash([3, 3]);
          g.beginPath();
          g.moveTo(dx, P.y0);
          g.lineTo(dx, P.y0 + P.h);
          g.stroke();
          g.setLineDash([]);
        }
      }
      // the netlist, as written
      g.fillStyle = rgba(fg, 0.7);
      const lines = listing();
      const cols = 3;
      lines.forEach((l, i) => g.fillText(l, W * 0.05 + (i % cols) * W * 0.3, H * 0.8 + Math.floor(i / cols) * 14));
      if (warn) g.fillText(warn, W * 0.05, H * 0.97);
      g.restore();
    }
  },
};

export default lcrNetwork;
