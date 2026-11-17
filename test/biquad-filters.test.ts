// biquad-filters beyond the entry's claims (catalogue/entries/biquad-filters.md). The new claims
// read the gain at f0 measured from the impulse response, and the −3 dB points measured between
// bins, against the analogue prototype, which never sees the digital coefficients. Here: the
// prototype's closed forms against a direct evaluation of each analogue H(jΩ) and the warp; the
// measurement's own error at f0 values other than the claims'; a planted slip in the design
// (fs taken as the impulse length) failing every new claim, and one in the measurement (h[0] lost
// to the FFT) failing the older ones through the instrument; and the default run recording
// exactly what the kernel before the pass recorded (test/fixtures/biquad-filters-before), a
// planted change of one unit in the last place shown to break that comparison.
import { describe, expect, it, vi } from 'vitest';
import type { Params } from '../src/core/plate';
import { Meter, type SignalKernel, type View } from '../src/engines/signal/trace';
import {
  design, gainAt, halfPowerPoints, IR, kernel as kernelNew, measuredResponse, prototype, type Kind,
} from '../src/kernels/signal/biquad-filters';
import { kernel as kernelOld } from './fixtures/biquad-filters-before/biquad-filters';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { holds, nthNumber, type Claim } from './support/claims';

const ID = 'biquad-filters';
const FS = 16000;
const GAIN = 'Gain at f0 (measured from h)';
const HALF = '−3 dB points (measured)';
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === ID)!.claims;
const NEW = claims.filter((c) => c.readout === GAIN || c.readout === HALF);
const OLD = claims.filter((c) => !NEW.includes(c));
const DEFAULTS: Params = Object.fromEntries((kernelNew.params ?? []).map((d) => [d.key, d.value]));
const dB = (v: number) => 20 * Math.log10(Math.max(1e-9, v));

/** The analogue prototype's |H(jΩ)|, evaluated as written. */
function analogue(kind: Kind, o: number, q: number, gainDb: number): number {
  const A = 10 ** (gainDb / 40);
  const den = (re: number, im: number) => Math.hypot(re, im);
  const d = den(1 - o * o, o / q);
  switch (kind) {
    case 'lowpass': return 1 / d;
    case 'highpass': return (o * o) / d;
    case 'bandpass': return o / q / d;
    case 'notch': return Math.abs(1 - o * o) / d;
    default: return den(1 - o * o, (o * A) / q) / den(1 - o * o, o / (A * q));
  }
}

/** A claim's two readings, computed from a section directly: the gain at f0 and the −3 dB points. */
function readings(f: ReturnType<typeof design>, kind: Kind, f0: number): { gain: string; half: string } {
  const { ir, mag } = measuredResponse(f, undefined, IR);
  const cross = halfPowerPoints(mag, kind, FS / IR);
  return { gain: `${dB(gainAt(ir, f0)).toFixed(6)} dB`, half: cross.map((c) => `${c.toFixed(1)} Hz`).join(', ') || 'none' };
}

/** What a claim reads from a section of the claim's setup, designed with the sample rate `fs`. */
function read(c: Claim, fs: number): number | null {
  const p = { ...DEFAULTS, ...(c.setup?.params ?? {}) };
  const kind = String(p.type) as Kind;
  const f0 = Number(p.f0);
  const r = readings(design(kind, f0, Number(p.q), Number(p.gain), fs), kind, f0);
  return nthNumber(c.readout === GAIN ? r.gain : r.half, c.expect.number ?? 1);
}

describe('biquad-filters: the prototype\'s closed forms', () => {
  it('give the gain at Ω = 1 and |H(jΩ)|² = ½ at the half-power points, for every section', () => {
    for (const q of [0.3, 0.7, 2, 9.7, 20]) {
      for (const kind of ['lowpass', 'highpass', 'bandpass', 'notch', 'peaking'] as Kind[]) {
        const p = prototype(kind, 1000, q, 9);
        expect(analogue(kind, 1, q, 9)).toBeCloseTo(p.gain, 12);
        // half of the reference power: the low-pass's at DC, the high-pass's at infinity, the
        // band-pass's peak, each exactly 1
        for (const f of p.half) {
          const o = Math.tan((Math.PI * f) / FS) / Math.tan((Math.PI * 1000) / FS);
          expect(analogue(kind, o, q, 9) ** 2).toBeCloseTo(0.5, 12);
        }
      }
    }
  });

  it('match the claims\' expected values', () => {
    for (const c of NEW) {
      if (c.expect.value === undefined) continue;
      const p = { ...DEFAULTS, ...(c.setup?.params ?? {}) };
      const proto = prototype(String(p.type) as Kind, Number(p.f0), Number(p.q), Number(p.gain));
      const want = c.readout === GAIN ? dB(proto.gain) : proto.half[(c.expect.number ?? 1) - 1];
      expect(Math.abs((c.expect.value as number) - want), c.id).toBeLessThan(5e-4);
    }
  });
});

describe('biquad-filters: the measurement at f0 values other than the claims\'', () => {
  it('is the prototype\'s gain within 1e−7 dB, and its −3 dB points within 0.01 Hz, wherever the ringing has died', () => {
    let gainErr = 0;
    let halfErr = 0;
    for (const f0 of [310, 777, 1530, 2470, 4100]) {
      for (const [kind, q] of [['lowpass', 0.7], ['highpass', 2], ['bandpass', 2], ['peaking', 3]] as [Kind, number][]) {
        const f = design(kind, f0, q, 9);
        const { ir, mag } = measuredResponse(f, undefined, IR);
        const p = prototype(kind, f0, q, 9);
        gainErr = Math.max(gainErr, Math.abs(dB(gainAt(ir, f0)) - dB(p.gain)));
        const cross = halfPowerPoints(mag, kind, FS / IR);
        if (kind !== 'peaking') {
          expect(cross.length, `${kind} at ${f0}`).toBe(p.half.length);
          cross.forEach((c, i) => { halfErr = Math.max(halfErr, Math.abs(c - p.half[i])); });
        }
      }
    }
    expect(gainErr).toBeLessThan(1e-7);
    expect(halfErr).toBeLessThan(0.01);
  });
});

describe('biquad-filters: planted slips fail every claim', () => {
  it('the direct readings are the plate\'s: each new claim holds when the design is right', () => {
    for (const c of NEW) expect(holds(c, read(c, FS)!), c.id).toBe(true);
  });

  it('the design taking fs as the impulse length (16384) moves every new claim out of its band', () => {
    const held = NEW.filter((c) => { const v = read(c, IR); return v !== null && holds(c, v); }).map((c) => c.id);
    expect(held, 'claims the planted slip did not fail').toEqual([]);
  });

  it('the FFT losing h[0] fails every older claim through the instrument', async () => {
    type Fft = typeof import('../src/kernels/signal/_fft');
    vi.resetModules();
    vi.doMock('../src/kernels/signal/_fft', async (orig) => {
      const m = await orig<Fft>();
      return { ...m, fft: (re: Float64Array, im: Float64Array, meter?: Meter, inverse = false) => {
        if (!inverse) re[0] = 0;
        return m.fft(re, im, meter, inverse);
      } };
    });
    const planted = await import('./support/claims');
    const held: string[] = [];
    for (const c of OLD) {
      const f = await planted.failures(ID, c);
      if (f.length === 0) held.push(c.id);
      for (const msg of f) expect(msg, c.id).toMatch(/" read .* expected /);
    }
    vi.doUnmock('../src/kernels/signal/_fft');
    vi.resetModules();
    expect(held, 'claims the planted slip did not fail').toEqual([]);
  });
});

/** A run as the plate shows it, without the rows the pass added. */
const ADDED = new Set([GAIN, '−3 dB points of the analogue prototype, warped']);
function shown(k: SignalKernel, over: Params = {}): View[] {
  const out: View[] = [];
  for (const v of k.run({ ...DEFAULTS, ...over }, 4242, new Meter())) if (v) out.push({ ...v, stats: v.stats.filter((s) => !ADDED.has(s.label)) });
  return out;
}

describe('biquad-filters: the default run is unchanged by the pass', () => {
  it('records exactly the views, readouts, counts and charts the kernel before the pass recorded', () => {
    expect(shown(kernelNew)).toEqual(shown(kernelOld));
  });

  it('the comparison sees a planted change of one unit in the last place of the corner', () => {
    expect(shown(kernelNew, { f0: 1000 * (1 + Number.EPSILON) })).not.toEqual(shown(kernelOld));
  });
});
