// The fourier-epicycles plate: the number of samples of the path is a control whose default is
// the constant it replaced (256). The plate's DFT is X_k = (1/N) Σ z_n e^{−2πikn/N}, so the
// samples are z_n = Σ_k X_k e^{2πikn/N} and Parseval reads (1/N) Σ |z_n|² = Σ |X_k|²: the RMS
// error of the series cut to its largest terms is √(Σ |X_k|² over the dropped terms), and the
// curve's size, its RMS radius, is √(Σ |X_k|²) over all of them.
import { describe, expect, it, vi } from 'vitest';
import { defaults, type SelectParam } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { DEFAULT_SEED } from '../src/core/claims';
import { parse, serialise } from '../src/core/share';
import { dft } from '../src/plates/fourier-epicycles/dft';
import { shape } from '../src/plates/fourier-epicycles/plate';
import { loadPlate } from '../src/registry';
import { nthNumber, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const PLATE = 'fourier-epicycles';
const probe = (readout: string, params: Record<string, number | string>, expect: Claim['expect']): Claim =>
  ({ id: 'probe', statement: '', readout, expect, setup: { params } });

/** |X_k|² of every coefficient, by the definition, largest first: the test's own transform. */
function power(xs: Float64Array, ys: Float64Array): number[] {
  const n = xs.length;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    let re = 0;
    let im = 0;
    for (let j = 0; j < n; j++) {
      const a = (-2 * Math.PI * k * j) / n;
      re += xs[j] * Math.cos(a) - ys[j] * Math.sin(a);
      im += xs[j] * Math.sin(a) + ys[j] * Math.cos(a);
    }
    out.push((re / n) ** 2 + (im / n) ** 2);
  }
  return out.sort((a, b) => b - a);
}

/** Parseval: the RMS error of the largest `count` terms over the curve's RMS size, in percent. */
function parseval(p: number[], count: number): number {
  const all = p.reduce((s, v) => s + v, 0);
  const dropped = p.slice(count).reduce((s, v) => s + v, 0);
  return 100 * Math.sqrt(dropped / all);
}

/**
 * The heart, x = 16 sin³a/17 and y = −(13 cos a − 5 cos 2a − 2 cos 3a − cos 4a)/17, is a
 * trigonometric polynomial of degree 4: x = (12 sin a − 4 sin 3a)/17, and with z = x + iy the
 * coefficient of e^{ima} is i(B_m − A_m)/2 and of e^{−ima} is i(A_m + B_m)/2 (A_m of sin ma in x,
 * B_m of cos ma in −y·(−1)). In 34ths: 25 and 1 at ±1, 5 and 5 at ±2, 6 and 2 at ±3, 1 and 1 at
 * ±4; Σ = 718/34². Any N above 8 samples it without aliasing, so its spectrum is the same at 64,
 * 128 and 256 samples.
 */
const HEART = [25, 6, 5, 5, 2, 1, 1, 1];
const heart = (count: number) => 100 * Math.sqrt(HEART.slice(count).reduce((s, v) => s + v * v, 0) / 718);

describe('fourier-epicycles samples of the path', () => {
  it('is a select of 64, 128 and 256 whose default is the old constant 256, and rebuilds', async () => {
    const plate = await loadPlate(PLATE);
    const d = plate!.params.find((p) => p.key === 'samples') as SelectParam | undefined;
    expect(d).toBeDefined();
    expect(d!.kind).toBe('select');
    expect(d!.label).toBe('Samples of the path');
    expect(d!.value).toBe('256');
    expect(d!.rebuild).toBe(true);
    expect(d!.options.map((o) => o.value)).toEqual(['64', '128', '256']);
    // the pacing contract stays: speed scales simulated time, declared emergent (ADR 0008)
    expect(plate!.pace?.kind).toBe('stream');
  });

  it('round-trips through a shared link', async () => {
    const plate = await loadPlate(PLATE);
    for (const samples of ['64', '128']) {
      const want = { ...defaults(plate!), samples };
      const back = parse(plate!.params, serialise(plate!.params, want, 7));
      expect(back.seed).toBe(7);
      expect(back.params.samples).toBe(samples);
    }
  });

  it('samples the path at the chosen count, drawing the same random numbers', () => {
    for (const id of ['heart', 'square', 'star', 'trefoil', 'blob']) {
      for (const n of [64, 128]) {
        const r256 = mulberry32(DEFAULT_SEED);
        const [x256] = shape(id, r256);
        expect(x256.length).toBe(256);
        const r = mulberry32(DEFAULT_SEED);
        const [xs, ys] = shape(id, r, n);
        expect(xs.length).toBe(n);
        expect(ys.length).toBe(n);
        // the seeded blob's jitter is drawn per vertex, never per sample: both runs have drawn
        // the same numbers, so their next draw is the same
        expect(r(), id).toBe(r256());
      }
    }
  });

  it('matches the analytic heart spectrum at every sample count', () => {
    for (const n of [64, 128, 256]) {
      const [xs, ys] = shape('heart', mulberry32(1), n);
      const p = power(xs, ys);
      for (let i = 0; i < HEART.length; i++) expect(Math.sqrt(p[i]), `n ${n} term ${i}`).toBeCloseTo(HEART[i] / 34, 12);
      expect(Math.sqrt(p[HEART.length])).toBeLessThan(1e-12);
    }
  });

  // Budget, counted: the setup's DFT takes n² rotations (one cosine each), so 64 and 128 samples
  // cost a sixteenth and a quarter of the default 256; a frame's work is the chain of terms
  it('costs n² rotations in setup, never more than at 256', () => {
    const rotations = (n: number) => {
      const [xs, ys] = shape('blob', mulberry32(DEFAULT_SEED), n);
      const cos = vi.spyOn(Math, 'cos');
      try {
        dft(xs, ys);
        return cos.mock.calls.length;
      } finally {
        cos.mockRestore();
      }
    };
    for (const n of [64, 128, 256]) expect(rotations(n)).toBe(n * n);
  });

  // the readout measures the error in the time domain; Parseval predicts it from the spectrum
  for (const samples of ['64', '128']) {
    it(`reads the Parseval error of the dropped terms at ${samples} samples`, async () => {
      for (const [id, terms] of [['square', 6], ['star', 12], ['heart', 3]] as [string, number][]) {
        const r = await read(PLATE, probe('RMS error / size', { shape: id, terms, samples }, { value: 0 }));
        expect(r.reason).toBeUndefined();
        const [xs, ys] = shape(id, mulberry32(DEFAULT_SEED), Number(samples));
        // the readout shows two decimals: within half a unit of the last one
        expect(Math.abs((r.value as number) - parseval(power(xs, ys), terms)), `${id}`).toBeLessThanOrEqual(0.005 + 1e-9);
        const t = await read(PLATE, probe('terms', { shape: id, terms, samples }, { value: terms }));
        expect(t.value).toBe(terms);
        expect(nthNumber(t.text!, 2)).toBe(Number(samples));
      }
      const h = await read(PLATE, probe('RMS error / size', { shape: 'heart', terms: 3, samples }, { value: 0 }));
      expect(Math.abs((h.value as number) - heart(3))).toBeLessThanOrEqual(0.005);
    }, 120_000);
  }
});
