// Every live signal kernel of the catalogue, checked by one harness: the shared contract (views,
// finite readouts, counts that only grow, charts of finite points) for every kernel, and for
// every one a check against an independent reference — the definition of the transform, a
// published constant, a known test vector or an analytic result (ADR 0004 §4,
// project.no-fake-science).
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { mulberry32 } from '../src/core/random';
import { labWork } from '../src/engines/signal';
import { Meter, recordAll, type SignalKernel } from '../src/engines/signal/trace';
import { cprDecode, cprEncode, crc24, fields, flip, fromHex, positionFrame, repair, syndrome } from '../src/kernels/signal/_adsb';
import { amplitude, fft, welch, windowOf } from '../src/kernels/signal/_fft';
import { addNoise, tones } from '../src/engines/signal/input';
import { haversine } from '../src/kernels/signal/adsb-cpr';
import { coefficient, ideal, overshoot, partialSum } from '../src/kernels/signal/additive-gibbs';
import { design, measuredResponse, roots, type Kind } from '../src/kernels/signal/biquad-filters';
import { dwt, FILTERS, highpass, idwt } from '../src/kernels/signal/daubechies-dwt';
import { predicted, sidebands, spectrum } from '../src/kernels/signal/fm-synthesis';
import { analytic } from '../src/kernels/signal/hilbert-analytic';
import { frequencies, simulate } from '../src/kernels/signal/kuramoto';
import { figure, read } from '../src/kernels/signal/lissajous';
import { brown, pink, white } from '../src/kernels/signal/noise-colours';
import { convolve, deconvolve, room, sweep } from '../src/kernels/signal/sine-sweep-ir';
import { stft } from '../src/kernels/signal/stft-spectrogram';
import { lobes } from '../src/kernels/signal/window-leakage';
import { align, captures } from '../src/kernels/signal/xcorr-alignment';
import { FS as YIN_FS, kernel as yinKernel, TAU_MAX, voice, yin } from '../src/kernels/signal/yin-pitch';

const modules = import.meta.glob<SignalKernel>('../src/kernels/signal/[!_]*.ts', { import: 'kernel', eager: true });
const live = ENTRIES.filter((e) => e.engine === 'signal' && e.status === 'live');
const kernelOf = (id: string) => modules[`../src/kernels/signal/${id}.ts`];

/** The transform by its definition, O(N²). */
function naiveDft(re: ArrayLike<number>, im: ArrayLike<number>): [Float64Array, Float64Array] {
  const n = re.length;
  const R = new Float64Array(n); const I = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      const a = (-2 * Math.PI * k * j) / n;
      R[k] += re[j] * Math.cos(a) - im[j] * Math.sin(a);
      I[k] += re[j] * Math.sin(a) + im[j] * Math.cos(a);
    }
  }
  return [R, I];
}

/** Simpson's rule on [a, b] with m (even) intervals. */
function simpson(f: (x: number) => number, a: number, b: number, m = 4000): number {
  const h = (b - a) / m;
  let s = f(a) + f(b);
  for (let i = 1; i < m; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

/** J_n(x) by Bessel's integral (1/π) ∫0^π cos(nτ − x sin τ) dτ. */
const besselIntegral = (n: number, x: number) => simpson((t) => Math.cos(n * t - x * Math.sin(t)), 0, Math.PI) / Math.PI;

/** CRC-24 by long division over a bit list, independent of the table-free shift register. */
function crcByDivision(bits: number[]): number {
  const g = [1, ...Array.from({ length: 24 }, (_, i) => (0xfff409 >> (23 - i)) & 1)];
  const m = [...bits, ...new Array(24).fill(0)];
  for (let i = 0; i < bits.length; i++) if (m[i]) for (let j = 0; j < 25; j++) m[i + j] ^= g[j];
  return m.slice(bits.length).reduce((v, b) => v * 2 + b, 0);
}

const bitsOfBytes = (b: Uint8Array, n: number) => Array.from({ length: n }, (_, i) => (b[i >> 3] >> (7 - (i & 7))) & 1);

/** One independent check per live entry; the harness refuses a live entry without one. */
const REFERENCES: Record<string, () => void> = {
  'fft-butterfly': () => {
    const rnd = mulberry32(3);
    for (let n = 1; n <= 512; n *= 2) {
      const re = Float64Array.from({ length: n }, () => rnd() - 0.5);
      const im = Float64Array.from({ length: n }, () => rnd() - 0.5);
      const [R, I] = naiveDft(re, im);
      const fr = re.slice(); const fi = im.slice();
      const m = new Meter();
      fft(fr, fi, m);
      for (let k = 0; k < n; k++) { expect(fr[k]).toBeCloseTo(R[k], 9); expect(fi[k]).toBeCloseTo(I[k], 9); }
      if (n > 1) expect(m.get('Butterflies')).toBe((n / 2) * Math.log2(n));
      // Parseval: Σ|x|² = (1/N) Σ|X|²
      const et = re.reduce((s, v, i) => s + v * v + im[i] * im[i], 0);
      const ef = fr.reduce((s, v, i) => s + v * v + fi[i] * fi[i], 0) / n;
      expect(ef).toBeCloseTo(et, 9);
      fft(fr, fi, undefined, true);
      for (let k = 0; k < n; k++) expect(fr[k]).toBeCloseTo(re[k], 12);
    }
  },
  'stft-spectrogram': () => {
    const rnd = mulberry32(5);
    const x = Float64Array.from({ length: 1024 }, () => rnd() - 0.5);
    const rows = stft(x, 128, 64, 'hann');
    expect(rows.length).toBe(Math.floor((1024 - 128) / 64) + 1);
    const w = windowOf('hann', 128);
    const gain = w.reduce((s, v) => s + v, 0);
    for (const r of [0, 7, rows.length - 1]) {
      const seg = Array.from({ length: 128 }, (_, i) => x[r * 64 + i] * w[i]);
      const [R, I] = naiveDft(seg, new Float64Array(128));
      for (let k = 1; k < 64; k++) expect(rows[r][k]).toBeCloseTo((2 * Math.hypot(R[k], I[k])) / gain, 9);
    }
    // a tone on bin 16 of a 128-sample frame reads its own amplitude there
    const tone = Float64Array.from({ length: 128 }, (_, i) => 0.7 * Math.sin((2 * Math.PI * 16 * i) / 128));
    expect(amplitude(tone, w, 128)[16]).toBeCloseTo(0.7, 9);
    // the note's overlap claim: on white noise of a fixed length, Hann frames at 50 % overlap
    // lower the spread of Welch's estimate against none, and 75 % gains little more
    const spread = (hop: number) => {
      let sum = 0;
      for (const seed of [1, 2, 3, 4]) {
        const r = mulberry32(seed);
        const noise = Float64Array.from({ length: 8192 }, () => r() - 0.5);
        const { psd } = welch(noise, 256, hop, windowOf('hann', 256));
        const band = Array.from(psd.subarray(4, 124));
        const mean = band.reduce((a, b) => a + b, 0) / band.length;
        sum += Math.sqrt(band.reduce((a, b) => a + (b - mean) ** 2, 0) / band.length) / mean;
      }
      return sum / 4;
    };
    const [none, half, most] = [256, 128, 64].map(spread);
    expect(half / none).toBeLessThan(0.85);
    expect(most / half).toBeGreaterThan(0.9);
  },
  'window-leakage': () => {
    // highest side lobe and −3 dB width of the classic windows, as published (Harris, 1978);
    // the published Blackman width is left out, the tables in circulation disagree on it
    const published: Record<string, [number, number | null]> = {
      rect: [-13.26, 0.89], hann: [-31.47, 1.44], hamming: [-42.68, 1.30], blackman: [-58.11, null], 'blackman-harris': [-92.0, 1.90],
    };
    for (const [id, [side, width]] of Object.entries(published)) {
      const l = lobes(id, 256, 32);
      expect(Math.abs(l.sidelobe - side), `${id} side lobe ${l.sidelobe}`).toBeLessThan(0.7);
      if (width !== null) expect(Math.abs(l.width3 - width), `${id} width ${l.width3}`).toBeLessThan(0.03);
    }
  },
  'hilbert-analytic': () => {
    const n = 2048;
    // the Hilbert transform of cos is sin; the envelope of an AM tone is its modulation
    const cos = Float64Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * 100 * i) / n));
    const [, h] = analytic(cos);
    for (let i = 0; i < n; i += 37) expect(h[i]).toBeCloseTo(Math.sin((2 * Math.PI * 100 * i) / n), 9);
    const env = (i: number) => 1 + 0.5 * Math.cos((2 * Math.PI * 7 * i) / n);
    const am = Float64Array.from({ length: n }, (_, i) => env(i) * Math.cos((2 * Math.PI * 200 * i) / n + 0.3));
    const [re, im] = analytic(am);
    for (let i = 0; i < n; i += 11) expect(Math.hypot(re[i], im[i])).toBeCloseTo(env(i), 9);
  },
  'daubechies-dwt': () => {
    for (const [id, { h }] of Object.entries(FILTERS)) {
      const p = h.length / 2;
      expect(h.reduce((s, v) => s + v, 0), id).toBeCloseTo(Math.SQRT2, 12);
      for (let m = 0; m < p; m++) {
        let s = 0;
        for (let k = 0; k + 2 * m < h.length; k++) s += h[k] * h[k + 2 * m];
        expect(s, `${id} shift ${m}`).toBeCloseTo(m === 0 ? 1 : 0, 12);
      }
      // p vanishing moments of the wavelet: Σ k^q g_k = 0 for q < p
      const g = highpass(h);
      for (let q = 0; q < p; q++) expect(g.reduce((s, v, k) => s + v * k ** q, 0), `${id} moment ${q}`).toBeCloseTo(0, 9);
      const rnd = mulberry32(9);
      const x = Float64Array.from({ length: 256 }, () => rnd() - 0.5);
      for (const levels of [1, 3, 5]) {
        const { details, approx } = dwt(x, h, levels);
        const energy = [...details, approx].reduce((s, d) => s + d.reduce((t, v) => t + v * v, 0), 0);
        expect(energy).toBeCloseTo(x.reduce((s, v) => s + v * v, 0), 10);
        const back = idwt(details, approx, h);
        for (let i = 0; i < x.length; i++) expect(back[i]).toBeCloseTo(x[i], 12);
      }
    }
  },
  'fm-synthesis': () => {
    // the test's own folding: sampled at 8192 Hz, a sine at f reads at f mod 8192, mirrored and
    // inverted above 4096 Hz, and not at all on 0 Hz or 4096 Hz
    const fs = 8192; const fc = 2000;
    const folded = (fm: number, beta: number, n: number) => {
      const at = fc + n * fm;
      let sum = 0;
      for (let m = -30; m <= 30; m++) {
        const j = (m < 0 && m % 2 ? -1 : 1) * besselIntegral(Math.abs(m), beta);
        const g = (((fc + m * fm) % fs) + fs) % fs;
        if (g === 0 || g === fs / 2) continue;
        if (g < fs / 2 && g === at) sum += j;
        if (g > fs / 2 && fs - g === at) sum -= j;
      }
      return Math.abs(sum);
    };
    for (const [fm, beta] of [[100, 0.5], [125, 2.4048], [200, 3.8], [250, 2], [200, 6], [250, 6]]) {
      const s = sidebands(fm, beta, 8);
      const want = predicted(fm, beta, 8);
      for (let n = -8; n <= 8; n++) {
        expect(s[n + 8], `fm ${fm} β ${beta} n ${n}`).toBeCloseTo(folded(fm, beta, n), 9);
        expect(want[n + 8], `prediction fm ${fm} β ${beta} n ${n}`).toBeCloseTo(folded(fm, beta, n), 9);
      }
    }
    // 2000 − 8·250 = 0 Hz: that sideband vanishes rather than reading |J_8(6)|
    expect(Math.abs(besselIntegral(8, 6))).toBeGreaterThan(0.05);
    expect(sidebands(250, 6, 8)[0]).toBeLessThan(1e-9);
    // a constant and a Nyquist cosine read their own amplitude: bins 0 and N/2 are not doubled
    const flat = spectrum(new Float64Array(fs).fill(0.5));
    expect(flat[0]).toBeCloseTo(0.5, 12);
    const nyq = spectrum(Float64Array.from({ length: fs }, (_, i) => 0.3 * Math.cos(Math.PI * i)));
    expect(nyq[fs / 2]).toBeCloseTo(0.3, 12);
  },
  'additive-gibbs': () => {
    // the series coefficients against the Fourier integral of the ideal waves
    for (const shape of ['square', 'saw', 'triangle'] as const) {
      for (let k = 1; k <= 7; k++) {
        const b = 2 * simpson((t) => ideal(shape, t) * Math.sin(2 * Math.PI * k * t), 0, 1, 20000);
        expect(coefficient(shape, k), `${shape} b${k}`).toBeCloseTo(b, 4);
      }
    }
    // the overshoot tends to Si(π)/π − 1/2, with Si by its power series
    let si = 0; let term = Math.PI;
    for (let n = 0; n < 30; n++) { si += term / (2 * n + 1); term *= -(Math.PI ** 2) / ((2 * n + 2) * (2 * n + 3)); }
    const limit = si / Math.PI - 0.5;
    expect(overshoot('square', partialSum('square', 401, false, 1 << 16))).toBeCloseTo(limit, 3);
    expect(overshoot('saw', partialSum('saw', 400, false, 1 << 16))).toBeCloseTo(limit, 3);
    // σ factors suppress most of it, and a wave without a jump has none to speak of
    expect(overshoot('square', partialSum('square', 401, true, 1 << 14))).toBeLessThan(0.02);
    // without a jump the excess is only truncation error, and it shrinks as harmonics are added
    const tri = [51, 201].map((K) => overshoot('triangle', partialSum('triangle', K)));
    expect(tri[0]).toBeLessThan(0.01);
    expect(tri[1]).toBeLessThan(tri[0] / 3);
  },
  'noise-colours': () => {
    const w = windowOf('hann', 1024);
    for (const seed of [1, 2, 3]) {
      const rnd = mulberry32(seed);
      const n = 1 << 17;
      const cases: [Float64Array, number][] = [[white(n, rnd), 0], [pink(n, rnd), -3.01], [brown(n, rnd), -6.02]];
      for (const [x, want] of cases) {
        const { psd } = welch(x, 1024, 512, w);
        // the test's own fit: power summed in octave bands from 62.5 Hz to 2 kHz at fs = 8000
        const pts: [number, number][] = [];
        for (let lo = 8; lo < 256; lo *= 2) {
          let s = 0;
          for (let k = lo; k < 2 * lo; k++) s += psd[k];
          pts.push([Math.log2(lo), 10 * Math.log10(s / lo)]);
        }
        const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const slope = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
        expect(Math.abs(slope - want), `seed ${seed} want ${want} got ${slope}`).toBeLessThan(0.6);
      }
    }
  },
  'biquad-filters': () => {
    const H = (b: number[], a: number[], f: number, fs: number) => {
      const w = (2 * Math.PI * f) / fs;
      const ev = (c: number[]) => [c[0] + c[1] * Math.cos(-w) + c[2] * Math.cos(-2 * w), c[1] * Math.sin(-w) + c[2] * Math.sin(-2 * w)];
      const [br, bi] = ev(b); const [ar, ai] = ev(a);
      return Math.hypot(br, bi) / Math.hypot(ar, ai);
    };
    const kinds: Kind[] = ['lowpass', 'highpass', 'bandpass', 'notch', 'peaking'];
    for (const kind of kinds) {
      for (const [f0, q] of [[300, 0.7071], [1000, 2], [4000, 8]]) {
        const f = design(kind, f0, q, 6);
        const { mag } = measuredResponse(f);
        const df = 16000 / 16384;
        for (let k = 1; k < mag.length; k += 97) {
          const want = H(f.b, f.a, k * df, 16000);
          expect(Math.abs(mag[k] - want), `${kind} ${f0} ${q} bin ${k}`).toBeLessThan(1e-6 * Math.max(1, want));
        }
        for (const [re, im] of roots(1, f.a[1], f.a[2])) {
          expect(Math.hypot(re * re - im * im + f.a[1] * re + f.a[2], 2 * re * im + f.a[1] * im)).toBeLessThan(1e-12);
          expect(Math.hypot(re, im)).toBeLessThan(1);
        }
      }
    }
    // Butterworth Q: −3.0103 dB at the corner; the notch's zero; the peaking gain at the centre
    const lp = design('lowpass', 1000, Math.SQRT1_2, 0);
    expect(20 * Math.log10(H(lp.b, lp.a, 1000, 16000))).toBeCloseTo(-3.0103, 3);
    const notch = design('notch', 1500, 3, 0);
    expect(H(notch.b, notch.a, 1500, 16000)).toBeLessThan(1e-9);
    const pk = design('peaking', 2000, 1.5, 9);
    expect(20 * Math.log10(H(pk.b, pk.a, 2000, 16000))).toBeCloseTo(9, 9);
  },
  'sine-sweep-ir': () => {
    const { x, L } = sweep();
    for (const seed of [1, 2, 3]) {
      const { taps, fir } = room(seed);
      const { h, zero } = deconvolve(convolve(x, fir), x, L);
      let peak = zero;
      for (let i = zero - 50; i < zero + fir.length; i++) if (Math.abs(h[i]) > Math.abs(h[peak])) peak = i;
      expect(peak - zero).toBe(taps[0][0]);
      for (const [d, g] of taps.slice(1)) expect(Math.abs(h[zero + d] / h[zero + taps[0][0]] - g / taps[0][1]), `seed ${seed} tap ${d}`).toBeLessThan(0.03);
      // the band-limited recovery keeps nearly all of each tap
      expect(h[zero + taps[0][0]]).toBeGreaterThan(0.9);
    }
  },
  'xcorr-alignment': () => {
    const rnd = mulberry32(17);
    for (let t = 0; t < 8; t++) {
      const delay = (rnd() * 2 - 1) * 30;
      const [a, b] = captures(100 + t, delay, 30);
      const r = align(a, b);
      expect(r.integer).toBe(Math.round(delay));
      expect(Math.abs(r.sinc - delay), `delay ${delay} sinc ${r.sinc}`).toBeLessThan(0.05);
      expect(Math.abs(r.parabola - delay)).toBeLessThan(0.2);
    }
  },
  'yin-pitch': () => {
    for (const f0 of [70, 110, 220, 440, 880]) {
      const { x } = voice(Math.round(0.4 * YIN_FS), f0, 0, 0, 30, f0);
      const errs: number[] = [];
      for (let from = 0; from + 912 < x.length; from += 512) errs.push(Math.abs(1200 * Math.log2(yin(x, from, YIN_FS).f / f0)));
      errs.sort((a, b) => a - b);
      expect(errs[errs.length >> 1], `f0 ${f0}`).toBeLessThan(10);
    }
    // what the first-dip rule guards: in noise the deepest dip of d'(τ) is often at two or three
    // periods (threshold 0 leaves only the deepest), the first dip under 0.1 is the period itself
    const cents = (f: number, ref: number) => Math.abs(1200 * Math.log2(f / ref));
    for (const seed of [1, 2, 3]) {
      const x = addNoise(tones(YIN_FS, YIN_FS, [{ f: 200, a: 1 }, { f: 400, a: 0.5 }, { f: 600, a: 0.3 }]), mulberry32(seed), 20);
      let firstDip = 0; let deepest = 0; let frames = 0;
      for (let from = 0; from + 912 < x.length; from += 256, frames++) {
        if (cents(yin(x, from, YIN_FS).f, 200) > 50) firstDip++;
        if (yin(x, from, YIN_FS, 0).f < 200 / 1.4) deepest++;
      }
      expect(firstDip, `seed ${seed}`).toBe(0);
      expect(deepest, `seed ${seed}`).toBeGreaterThan(frames / 4);
    }
    // and what it does not: a second harmonic five times the fundamental dips first at half the
    // period, so a 150 Hz tone reads an octave high
    const strong = tones(8000, YIN_FS, [{ f: 150, a: 0.2 }, { f: 300, a: 1 }, { f: 450, a: 0.1 }]);
    expect(cents(yin(strong, 0, YIN_FS).f, 300)).toBeLessThan(10);
    // the controls stay inside the detector: their lowest reachable pitch is above the longest
    // period searched, and at every corner of pitch and glide, clean, no frame is a gross error
    const def = Object.fromEntries((yinKernel.params ?? []).map((d) => [d.key, d]));
    const lo = (key: string) => (def[key].kind === 'range' ? def[key].min : NaN);
    const hi = (key: string) => (def[key].kind === 'range' ? def[key].max : NaN);
    expect(lo('f0') * 2 ** (lo('glide') / 12) * 2 ** (-hi('vib') / 1200)).toBeGreaterThan(1.15 * YIN_FS / TAU_MAX);
    for (const f0 of [lo('f0'), hi('f0')]) {
      for (const glide of [lo('glide'), hi('glide')]) {
        const views = recordAll(yinKernel.run({ f0, glide, vib: hi('vib'), snr: hi('snr'), thr: 0.1 }, 5, new Meter()));
        const gross = views[views.length - 1].stats.find((s) => s.label.startsWith('Gross errors'))!.value;
        expect(gross, `f0 ${f0} glide ${glide}`).toMatch(/^0 of /);
      }
    }
  },
  'adsb-cpr': () => {
    // published test frames: an identification message and an even/odd airborne position pair
    const even = fromHex('8D40621D58C382D690C8AC2863A7');
    const odd = fromHex('8D40621D58C386435CC412692AD6');
    for (const f of [fromHex('8D4840D6202CC371C32CE0576098'), even, odd]) {
      expect(syndrome(f)).toBe(0);
      expect(crc24(f)).toBe(crcByDivision(bitsOfBytes(f, 88)));
    }
    const fe = fields(even); const fo = fields(odd);
    expect(fe.alt).toBe(38000);
    expect([fe.odd, fo.odd]).toEqual([0, 1]);
    const pos = cprDecode(fe.cpr, fo.cpr, 0)!;
    expect(pos.lat).toBeCloseTo(52.25720, 4);
    expect(pos.lon).toBeCloseTo(3.91937, 4);
    // round trip of seeded positions through frames, and one damaged bit repaired
    const rnd = mulberry32(23);
    for (let t = 0; t < 50; t++) {
      const lat = -80 + 160 * rnd(); const lon = -179 + 358 * rnd();
      const e = positionFrame(0xabcdef, 30000, cprEncode(lat, lon, 0), 0);
      const o = positionFrame(0xabcdef, 30000, cprEncode(lat, lon, 1), 1);
      const bit = Math.floor(rnd() * 112);
      flip(o, bit);
      expect(repair(o)).toBe(bit);
      const got = cprDecode(fields(e).cpr, fields(o).cpr, t % 2 as 0 | 1);
      expect(got).not.toBeNull();
      expect(haversine(got!, { lat, lon }), `${lat}, ${lon}`).toBeLessThan(5);
    }
  },
  kuramoto: () => {
    const n = 256; const width = 0.5;
    const kc = frequencies(n, 'lorentz', width, mulberry32(1)).kc;
    expect(kc).toBe(1);
    const strong = simulate(n, 4 * kc, width, 2500, 7);
    expect(Math.abs(strong.mean - Math.sqrt(1 - 1 / 4)), `r = ${strong.mean}`).toBeLessThan(0.06);
    const weak = simulate(n, 0.5 * kc, width, 2500, 7);
    expect(weak.mean, `r = ${weak.mean}`).toBeLessThan(0.2);
  },
  lissajous: () => {
    const rnd = mulberry32(31);
    for (let t = 0; t < 20; t++) {
      const a = 1 + Math.floor(rnd() * 9); const b = 1 + Math.floor(rnd() * 9);
      const delta = (rnd() * 2 - 1) * Math.PI * 0.9;
      const [x, y] = figure(a, b, delta);
      const got = read(x, y);
      expect([got.a, got.b]).toEqual([a, b]);
      expect(got.delta).toBeCloseTo(delta, 9);
    }
  },
};

describe('signal kernels', () => {
  it('every live signal entry has its kernel and every kernel its entry', () => {
    const files = Object.keys(modules).map((f) => f.replace(/^.*\/(.*)\.ts$/, '$1')).sort();
    expect(files).toEqual(live.map((e) => e.id).sort());
  });

  for (const e of live) {
    const kernel = kernelOf(e.id);
    describe(e.id, () => {
      it('records views with finite readouts and growing counts, for every option', () => {
        const defaults: Record<string, number | string | boolean> = {};
        for (const d of kernel.params ?? []) defaults[d.key] = d.value;
        const variants = [defaults];
        for (const d of kernel.params ?? []) {
          if (d.kind === 'select') for (const o of d.options) variants.push({ ...defaults, [d.key]: o.value });
          if (d.kind === 'range') variants.push({ ...defaults, [d.key]: d.min }, { ...defaults, [d.key]: d.max });
          if (d.kind === 'toggle') variants.push({ ...defaults, [d.key]: !d.value });
        }
        variants.forEach((params, vi) => {
          for (const seed of vi === 0 ? [1, 99] : [7]) {
            const views = recordAll(kernel.run(params, seed, new Meter()));
            expect(views.length, JSON.stringify(params)).toBeGreaterThan(0);
            let prev: Record<string, number> = {};
            for (const v of views) {
              expect(v.panels.length).toBeGreaterThan(0);
              for (const s of v.stats) expect(s.value, `${s.label} ${JSON.stringify(params)}`).not.toMatch(/NaN|Infinity|undefined/);
              for (const [k, c] of Object.entries(prev)) expect(v.counts[k] ?? 0, k).toBeGreaterThanOrEqual(c);
              prev = v.counts;
              for (const s of v.chart?.series ?? []) for (const [x, y] of s.points) expect(Number.isFinite(x) && Number.isFinite(y), `${s.name} point`).toBe(true);
            }
            expect(Object.values(views[views.length - 1].counts).some((c) => c > 0)).toBe(true);
          }
        });
      });

      it('agrees with an independent reference', () => {
        const check = REFERENCES[e.id];
        expect(check, `${e.id} needs an entry in REFERENCES`).toBeTypeOf('function');
        check();
      });
    });
  }
});

describe('signal lab', () => {
  it('measures FFT-based work growing as n log n and the wavelet transform as n', () => {
    const slope = (id: string) => {
      const pts = [512, 4096].map((n) => labWork(kernelOf(id), n, 3));
      return Math.log(pts[1] / pts[0]) / Math.log(8);
    };
    if (kernelOf('fft-butterfly')) expect(slope('fft-butterfly')).toBeGreaterThan(1.05);
    if (kernelOf('daubechies-dwt')) expect(Math.abs(slope('daubechies-dwt') - 1)).toBeLessThan(0.02);
  });
});
