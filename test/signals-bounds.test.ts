// Every exact count or hard inequality the signals wing states in a bound (catalogue/entries/*.md,
// ADR 0006 §4), driven at several sizes and compared with what the kernel meters: the Meter's
// counters are the plate's readouts (src/engines/signal/trace.ts). The asymptotic form of the
// STFT's bound is not checked here; test/kernels-signal.test.ts measures FFT-based work growing as
// n log n and the wavelet transform as n ("signal lab"), and checks the butterflies of one FFT.
import { describe, expect, it } from 'vitest';
import { BUTTERFLY, FRAME, Meter, MUL, recordAll, type SignalKernel } from '../src/engines/signal/trace';
import { crc24, syndrome } from '../src/kernels/signal/_adsb';
import { fft, nextPow2 } from '../src/kernels/signal/_fft';
import { partialSum, type Wave } from '../src/kernels/signal/additive-gibbs';
import { design, filter } from '../src/kernels/signal/biquad-filters';
import { dwt, FILTERS } from '../src/kernels/signal/daubechies-dwt';
import { fmTone, spectrum } from '../src/kernels/signal/fm-synthesis';
import { analytic } from '../src/kernels/signal/hilbert-analytic';
import { stft } from '../src/kernels/signal/stft-spectrogram';
import { correlateAt } from '../src/kernels/signal/xcorr-alignment';
import { yin } from '../src/kernels/signal/yin-pitch';
import { mulberry32 } from '../src/core/random';

const noise = (n: number, seed = 7) => { const r = mulberry32(seed); return Float64Array.from({ length: n }, () => r() - 0.5); };
const modules = import.meta.glob<SignalKernel>('../src/kernels/signal/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/signal/${id}.ts`];

describe('signals: exact bounds against metered runs', () => {
  it('fft-butterfly: (N/2) log2 N butterflies and 2N log2 N real multiplies, on the plate too', () => {
    for (let n = 2; n <= 4096; n *= 2) {
      const m = new Meter();
      fft(noise(n), new Float64Array(n), m);
      expect(m.get(BUTTERFLY), `N=${n}`).toBe((n / 2) * Math.log2(n));
      expect(m.get(MUL), `N=${n}`).toBe(2 * n * Math.log2(n));
    }
    for (const n of [8, 16, 32, 64]) {
      const m = new Meter();
      const views = recordAll(kernelOf('fft-butterfly').run({ n: String(n), signal: 'tones' }, 5, m));
      const last = views[views.length - 1].counts;
      expect(last[BUTTERFLY]).toBe((n / 2) * Math.log2(n));
      expect(last[MUL]).toBe(2 * n * Math.log2(n));
    }
  });

  it('hilbert-analytic: N log2 N butterflies, one forward and one inverse FFT of the padded length', () => {
    for (const len of [16, 100, 1024, 3000, 4096]) {
      const m = new Meter();
      analytic(noise(len), m);
      const n = nextPow2(len);
      expect(m.get(BUTTERFLY), `length ${len}`).toBe(n * Math.log2(n));
    }
  });

  it('stft-spectrogram: ⌊(n − M)/H⌋ + 1 frames of (M/2) log2 M butterflies each', () => {
    for (const n of [1024, 4000, 16000]) {
      for (const M of [128, 256, 512, 1024]) {
        for (const hop of [M, M / 2, M / 4]) {
          const m = new Meter();
          const rows = stft(noise(n), M, hop, 'hann', m);
          const frames = Math.floor((n - M) / hop) + 1;
          expect(rows.length).toBe(frames);
          expect(m.get(FRAME)).toBe(frames);
          expect(m.get(BUTTERFLY)).toBe(frames * (M / 2) * Math.log2(M));
        }
      }
    }
  });

  it('daubechies-dwt: N·L multiplies at the first level, 2NL(1 − 2^−J) over J levels, below 2NL', () => {
    for (const n of [64, 512, 4096]) {
      for (const f of Object.values(FILTERS)) {
        const L = f.h.length;
        for (const J of [1, 3, 6]) {
          const m = new Meter();
          dwt(noise(n), f.h, J, m);
          expect(m.get(MUL), `${f.label} n=${n} J=${J}`).toBe(2 * n * L * (1 - 2 ** -J));
          expect(m.get(MUL)).toBeLessThan(2 * n * L);
        }
      }
    }
  });

  it('additive-gibbs: N multiplies per harmonic summed, at most K·N', () => {
    const nonZero: Record<Wave, (K: number) => number> = {
      square: (K) => Math.ceil(K / 2), triangle: (K) => Math.ceil(K / 2), saw: (K) => K,
    };
    for (const shape of ['square', 'saw', 'triangle'] as Wave[]) {
      for (const n of [256, 4096]) {
        for (const K of [1, 2, 15, 61, 151]) {
          for (const sigma of [false, true]) {
            const m = new Meter();
            partialSum(shape, K, sigma, n, m);
            expect(m.get(MUL), `${shape} K=${K} n=${n}`).toBe(n * nonZero[shape](K));
            expect(m.get(MUL)).toBeLessThanOrEqual(K * n);
          }
        }
      }
    }
  });

  it('fm-synthesis: (N/2) log2 N butterflies per spectrum of N = 8192 samples', () => {
    for (const [fm, beta] of [[100, 0.5], [440, 2.405], [1000, 6]]) {
      const m = new Meter();
      spectrum(fmTone(fm, beta), m);
      expect(m.get(BUTTERFLY)).toBe(4096 * 13);
    }
  });

  it('biquad-filters: five real multiplies per sample', () => {
    for (const kind of ['lowpass', 'highpass', 'bandpass', 'notch', 'peaking'] as const) {
      for (const n of [1, 100, 16384]) {
        const m = new Meter();
        filter(design(kind, 1000, 0.7, 9), noise(n), m);
        expect(m.get(MUL)).toBe(5 * n);
      }
    }
  });

  it('xcorr-alignment: N − |l| multiplies at lag l, (2L + 1)N − L(L + 1) for lags −L to L', () => {
    for (const n of [64, 512, 2048]) {
      const a = noise(n, 1); const b = noise(n, 2);
      for (const L of [0, 1, 16, 63]) {
        const m = new Meter();
        for (let l = -L; l <= L; l++) correlateAt(a, b, l, m);
        expect(m.get(MUL), `n=${n} L=${L}`).toBe((2 * L + 1) * n - L * (L + 1));
      }
    }
  });

  it('yin-pitch: W·τmax multiplies for the difference function and 2τmax for its normalisation', () => {
    const x = noise(4096);
    for (const w of [128, 512, 1024]) {
      for (const tauMax of [50, 400, 1000]) {
        const m = new Meter();
        yin(x, 0, 16000, 0.1, w, tauMax, m);
        expect(m.get(MUL), `W=${w} τmax=${tauMax}`).toBe(w * tauMax + 2 * tauMax);
      }
    }
  });

  it('adsb-cpr: 88 CRC bit steps per parity check', () => {
    const r = mulberry32(9);
    for (let k = 0; k < 20; k++) {
      const frame = Uint8Array.from({ length: 14 }, () => Math.floor(r() * 256));
      const m = new Meter();
      crc24(frame, 88, m);
      expect(m.get('CRC bit steps')).toBe(88);
      const s = new Meter();
      syndrome(frame, s);
      expect(s.get('CRC bit steps')).toBe(88);
    }
  });
});

describe('signals: what the notes say about the plates', () => {
  it('sine-sweep-ir: the second-order response arrives L·ln 2 before the linear one', () => {
    const k = kernelOf('sine-sweep-ir');
    const params = Object.fromEntries((k.params ?? []).map((d) => [d.key, d.value]));
    for (const seed of [1, 2, 3, 4242]) {
      const views = recordAll(k.run(params, seed, new Meter()));
      const row = views[views.length - 1].stats.find((r) => r.label === '2nd-harmonic response: measured vs L·ln 2');
      const [measured, predicted] = (row?.value.match(/[\d.]+/g) ?? []).map(Number);
      // one sample at 8 kHz is 0.125 ms, and each value is shown to 0.1 ms
      expect(Math.abs(measured - predicted), `seed ${seed}: ${row?.value}`).toBeLessThanOrEqual(0.25);
    }
  });

  it('biquad-filters: a low-pass gains exactly Q at its corner, and the Q control cannot reach 1/√2', () => {
    const gainAt = (f: ReturnType<typeof design>, f0: number) => {
      const w = (2 * Math.PI * f0) / 16000;
      const br = f.b[0] + f.b[1] * Math.cos(w) + f.b[2] * Math.cos(2 * w);
      const bi = -(f.b[1] * Math.sin(w) + f.b[2] * Math.sin(2 * w));
      const ar = 1 + f.a[1] * Math.cos(w) + f.a[2] * Math.cos(2 * w);
      const ai = -(f.a[1] * Math.sin(w) + f.a[2] * Math.sin(2 * w));
      return Math.hypot(br, bi) / Math.hypot(ar, ai);
    };
    for (const f0 of [50, 1000, 7000]) {
      for (const q of [0.3, 0.7, Math.SQRT1_2, 2, 20]) expect(gainAt(design('lowpass', f0, q, 0), f0)).toBeCloseTo(q, 9);
      // Butterworth: −3.0103 dB at the corner; the control's 0.7 is −3.098 dB
      expect(20 * Math.log10(gainAt(design('lowpass', f0, Math.SQRT1_2, 0), f0))).toBeCloseTo(-3.0103, 4);
      expect(20 * Math.log10(gainAt(design('lowpass', f0, 0.7, 0), f0))).toBeCloseTo(-3.098, 3);
    }
    const q = kernelOf('biquad-filters').params?.find((d) => d.key === 'q');
    expect(q?.kind).toBe('range');
    if (q?.kind !== 'range') return;
    const settings = Array.from({ length: Math.round((q.max - q.min) / q.step) + 1 }, (_, i) => q.min + i * q.step);
    expect(Math.min(...settings.map((v) => Math.abs(v - Math.SQRT1_2)))).toBeGreaterThan(0.005);
    expect(settings.some((v) => Math.abs(v - 0.7) < 1e-9)).toBe(true);
  });
});
