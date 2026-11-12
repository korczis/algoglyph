// The biquad-filters plate: the impulse response's length is a control whose default is the
// constant it replaced (16384 samples). A shorter response leaves a tail out, and the measured
// response then differs from H on the unit circle by at most that tail, which the pole radius
// bounds: Σ_{n≥N} |h[n]| ≤ (|K1| + |K2|)·r^N/(1 − r).
import { describe, expect, it } from 'vitest';
import { defaults, type SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { Meter, MUL, BUTTERFLY, recordAll } from '../src/engines/signal/trace';
import { design, filter, kernel, type Biquad } from '../src/kernels/signal/biquad-filters';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const PLATE = 'biquad-filters';
const probe = (readout: string, params: Record<string, number | string>, expect: Claim['expect']): Claim =>
  ({ id: 'probe', statement: '', readout, expect, setup: { params } });

type C = [number, number];
const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a: C, b: C): C => {
  const d = b[0] ** 2 + b[1] ** 2;
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};

/**
 * The truncation bound, from the poles alone. H(z) = B(z)/((z − p1)(z − p2)) with
 * B(z) = b0 z² + b1 z + b2, so for n ≥ 1 h[n] is the sum of the residues of H(z) z^(n−1):
 * h[n] = K1 p1^n + K2 p2^n with K_i = B(p_i)/(p_i (p_i − p_j)). Then |h[n]| ≤ (|K1| + |K2|) r^n
 * with r the larger pole radius, and the tail from N on sums a geometric series.
 */
function tailBound(f: Biquad, n: number): { r: number; C: number; T: number } {
  const [a1, a2] = [f.a[1], f.a[2]];
  const d = a1 * a1 - 4 * a2;
  const p: C[] = d >= 0
    ? [[(-a1 + Math.sqrt(d)) / 2, 0], [(-a1 - Math.sqrt(d)) / 2, 0]]
    : [[-a1 / 2, Math.sqrt(-d) / 2], [-a1 / 2, -Math.sqrt(-d) / 2]];
  const B = (z: C): C => {
    const z2 = mul(z, z);
    return [f.b[0] * z2[0] + f.b[1] * z[0] + f.b[2], f.b[0] * z2[1] + f.b[1] * z[1]];
  };
  const K = p.map((z, i) => div(B(z), mul(z, [z[0] - p[1 - i][0], z[1] - p[1 - i][1]])));
  const r = Math.max(...p.map((z) => Math.hypot(z[0], z[1])));
  const C = K.reduce((s, k) => s + Math.hypot(k[0], k[1]), 0);
  return { r, C, T: (C * r ** n) / (1 - r) };
}

// a peaking boost never dips below 0 dB (|H| ≥ 1 at every frequency), so a magnitude off by at
// most T is off by at most −20 log10(1 − T) dB, at every bin the readout compares
const PEAK = { type: 'peaking', f0: 200, q: 10, gain: 9 };
const dbBound = (T: number) => -20 * Math.log10(1 - T);

describe('biquad-filters impulse response length', () => {
  it('is a select of 1024, 4096 and 16384 samples whose default is the old constant 16384', async () => {
    const plate = await loadPlate(PLATE);
    const d = plate!.params.find((p) => p.key === 'irLen') as SelectParam | undefined;
    expect(d).toBeDefined();
    expect(d!.kind).toBe('select');
    expect(d!.label).toBe('Impulse response length');
    expect(d!.value).toBe('16384');
    expect(d!.options.map((o) => o.value)).toEqual(['1024', '4096', '16384']);
  });

  it('round-trips through a shared link', async () => {
    const plate = await loadPlate(PLATE);
    for (const irLen of ['1024', '4096']) {
      const want = { ...defaults(plate!), irLen };
      const back = parse(plate!.params, serialise(plate!.params, want, 7));
      expect(back.seed).toBe(7);
      expect(back.params.irLen).toBe(irLen);
    }
  });

  it('bounds the left-out tail by the pole radius', () => {
    const f = design('peaking', PEAK.f0, PEAK.q, PEAK.gain);
    for (const n of [1024, 4096]) {
      const long = filter(f, Object.assign(new Float64Array(8 * n), { 0: 1 }));
      let tail = 0;
      for (let i = n; i < long.length; i++) tail += Math.abs(long[i]);
      const { T } = tailBound(f, n);
      expect(tail).toBeGreaterThan(0);
      expect(tail).toBeLessThanOrEqual(T);
      // and the readout's sample is right: |H| of the peaking boost is at least 1 everywhere
      for (let k = 0; k <= 512; k++) {
        const w = (Math.PI * k) / 512;
        const ev = (c: number[]) => Math.hypot(c[0] + c[1] * Math.cos(w) + c[2] * Math.cos(2 * w), c[1] * Math.sin(w) + c[2] * Math.sin(2 * w));
        expect(ev(f.b) / ev(f.a)).toBeGreaterThanOrEqual(1 - 1e-12);
      }
    }
  });

  for (const irLen of ['1024', '4096']) {
    it(`keeps the measured response within the truncation bound at ${irLen} samples`, async () => {
      const f = design('peaking', PEAK.f0, PEAK.q, PEAK.gain);
      const { T } = tailBound(f, Number(irLen));
      expect(T).toBeLessThan(1);
      const r = await read(PLATE, probe('Measured against evaluated, worst', { ...PEAK, irLen }, { below: dbBound(T) }));
      expect(r.reason).toBeUndefined();
      expect(r.value).toBeLessThan(dbBound(T));
      // the tail is really there: the readout is well above rounding at either length
      expect(r.value).toBeGreaterThan(1e-6);
    }, 120_000);
  }

  // Budget, counted: a shorter response filters fewer samples and transforms a shorter FFT
  it('does less work at every shorter length', () => {
    const counts = (irLen: string) => {
      const views = recordAll(kernel.run({ type: 'peaking', f0: 50, q: 20, gain: 24, irLen }, 1, new Meter()));
      return views[views.length - 1].counts;
    };
    const base = counts('16384');
    expect(base[MUL]).toBe(5 * 16384 + 2 * 16384 * 14);
    for (const n of [1024, 4096]) {
      const c = counts(String(n));
      expect(c[MUL]).toBe(5 * n + 2 * n * Math.log2(n));
      expect(c[BUTTERFLY]).toBe((n / 2) * Math.log2(n));
      expect(c[MUL]).toBeLessThan(base[MUL]);
    }
  });
});
