// stft-spectrogram beyond the entry's claims (catalogue/entries/stft-spectrogram.md). The new
// readout measures the window's equivalent noise bandwidth from the noise the plate added, run
// alone through the same frames. Here: the closed form from the coefficients against Harris's
// tabled values and against M·Σw²/(Σw)² summed over the window itself; each claim's band, four
// standard deviations over 200 seeds disjoint from the claim's; three planted slips failing every
// claim between them through the instrument; and the default run recording exactly what the
// kernel before the pass recorded (test/fixtures/stft-spectrogram-before), a planted change of one
// unit in the last place shown to break that comparison.
import { describe, expect, it, vi } from 'vitest';
import type { Params } from '../src/core/plate';
import { addNoise, chirp, mulberry32, power, tones } from '../src/engines/signal/input';
import { Meter, type SignalKernel, type View } from '../src/engines/signal/trace';
import { windowOf } from '../src/kernels/signal/_fft';
import { framePower, kernel as kernelNew, noiseBandwidth } from '../src/kernels/signal/stft-spectrogram';
import { kernel as kernelOld } from './fixtures/stft-spectrogram-before/stft-spectrogram';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

// the waterfall panel paints into an offscreen canvas
installBrowserStubs();

const ID = 'stft-spectrogram';
const READOUT = 'Noise bandwidth of the window, measured';
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === ID)!.claims;
const bandwidthClaim = (win: string) => claims.find((c) => c.readout === READOUT && (c.setup?.params?.window ?? 'hann') === win);
/** Harris (1978), table 1: equivalent noise bandwidth in bins. */
const HARRIS: Record<string, number> = { rect: 1, hann: 1.5, hamming: 1.36, blackman: 1.73, 'blackman-harris': 2.0 };
/** The claims' seed (the instrument's default), and the seeds their bands come from. */
const CLAIM_SEEDS = [4242];
const SD_SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

/** The default signal of a seed, built as the kernel builds it, and its noise alone with σ². */
function noiseOf(seed: number): { noise: Float64Array; sigma2: number } {
  const rnd = mulberry32(seed);
  const tone = Math.round(1000 + rnd() * 1500);
  const x = chirp(16000, 8000, 200, 3400, 0.5);
  const t = tones(16000, 8000, [{ f: tone, a: 0.25 }]);
  for (let i = 0; i < x.length; i++) x[i] += t[i];
  const clean = x.slice();
  addNoise(x, rnd, 10);
  return { noise: Float64Array.from(x, (v, i) => v - clean[i]), sigma2: power(clean) / 10 };
}

/** The bandwidth the kernel measures at its defaults (256-sample frames, hop 128, 124 frames). */
function measured(noise: Float64Array, sigma2: number, win: string): number {
  const w = windowOf(win, 256);
  let p = 0;
  for (let f = 0; f < 124; f++) p += framePower(noise, w, 256, f * 128);
  return ((p / (124 * 127)) * 256) / (4 * sigma2);
}

describe('stft-spectrogram: the noise bandwidth\'s closed form', () => {
  it('is M·Σw²/(Σw)² of the sampled window, and Harris\'s tabled value to its digits', () => {
    for (const [win, tabled] of Object.entries(HARRIS)) {
      const w = windowOf(win, 256);
      let s1 = 0;
      let s2 = 0;
      for (const v of w) { s1 += v; s2 += v * v; }
      expect(noiseBandwidth(win)).toBeCloseTo((256 * s2) / (s1 * s1), 12);
      expect(Math.abs(noiseBandwidth(win) - tabled)).toBeLessThan(0.005);
      expect(bandwidthClaim(win)!.expect.value).toBeCloseTo(noiseBandwidth(win), 4);
    }
  });
});

describe('stft-spectrogram: the bands come from seeds other than the claims\'', () => {
  const values: Record<string, number[]> = Object.fromEntries(Object.keys(HARRIS).map((w) => [w, []]));
  for (const s of SD_SEEDS) {
    const { noise, sigma2 } = noiseOf(s);
    for (const win of Object.keys(HARRIS)) values[win].push(measured(noise, sigma2, win));
  }

  it('no claim seed is among the standard-deviation seeds', () => {
    for (const s of CLAIM_SEEDS) expect(SD_SEEDS).not.toContain(s);
    for (const c of claims) expect(CLAIM_SEEDS).toContain(c.setup?.seed ?? 4242);
  });

  for (const win of Object.keys(HARRIS)) {
    it(`${win}: the tolerance is four standard deviations, the estimator centred on the closed form`, () => {
      const v = values[win];
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
      const tol = bandwidthClaim(win)!.expect.tolerance as number;
      expect(tol).toBeGreaterThanOrEqual(4 * sd);
      expect(tol).toBeLessThan(4 * sd + 0.01);
      expect(Math.abs(mean - noiseBandwidth(win)), `mean ${mean}, sd ${sd}`).toBeLessThan(sd);
    });
  }

  it('the kernel\'s own run reads what this estimator reads, at the claim\'s seed', () => {
    const { noise, sigma2 } = noiseOf(4242);
    let last: View | null = null;
    for (const v of kernelNew.run(Object.fromEntries(kernelNew.params!.map((d) => [d.key, d.value])), 4242, new Meter())) if (v) last = v;
    const row = last!.stats.find((s) => s.label === READOUT)!;
    expect(Number.parseFloat(row.value)).toBe(Number(measured(noise, sigma2, 'hann').toFixed(3)));
  });
});

type Fft = typeof import('../src/kernels/signal/_fft');
type Input = typeof import('../src/engines/signal/input');
type Trace = typeof import('../src/engines/signal/trace');
/** Three slips, each planted in one module the kernel imports, and the claims each must fail. */
const PLANTED: { name: string; path: string; plant: (m: never) => object; fails: (c: Claim) => boolean }[] = [
  {
    name: 'the one-sided doubling dropped from the amplitude spectrum',
    path: '../src/kernels/signal/_fft',
    plant: (m: Fft) => ({ ...m, amplitude: (...a: Parameters<Fft['amplitude']>) => m.amplitude(...a).map((v) => v / 2) }),
    fails: (c) => c.readout === READOUT,
  },
  {
    name: 'the tone synthesised one 256-sample bin high',
    path: '../src/engines/signal/input',
    plant: (m: Input) => ({ ...m, tones: (n: number, fs: number, parts: { f: number; a: number }[]) =>
      m.tones(n, fs, parts.map((p) => ({ ...p, f: p.f + fs / 256 }))) }),
    fails: (c) => c.readout === 'Welch average peak',
  },
  {
    name: 'the first frame left out of the count',
    path: '../src/engines/signal/trace',
    plant: (m: Trace) => {
      class Planted extends m.Meter {
        private skipped = false;
        add(name: string, k = 1): void {
          if (name === m.FRAME && !this.skipped) { this.skipped = true; return; }
          super.add(name, k);
        }
      }
      return { ...m, Meter: Planted };
    },
    fails: (c) => c.readout === 'Frames',
  },
];

describe('stft-spectrogram: a planted slip fails the claims it should', () => {
  it('between them the slips cover every claim', () => {
    expect(claims.filter((c) => !PLANTED.some((p) => p.fails(c))).map((c) => c.id)).toEqual([]);
  });

  for (const { name, path, plant, fails } of PLANTED) {
    it(`${name}: each of its claims reads outside its band`, async () => {
      vi.resetModules();
      vi.doMock(path, async (orig) => plant(await orig<never>()));
      const planted = await import('./support/claims');
      const held: string[] = [];
      for (const c of claims.filter(fails)) {
        const f = await planted.failures(ID, c);
        if (f.length === 0) held.push(c.id);
        for (const msg of f) expect(msg, c.id).toMatch(/" read .* expected /);
      }
      vi.doUnmock(path);
      vi.resetModules();
      expect(held, 'claims the planted slip did not fail').toEqual([]);
    });
  }
});

/** A run as the plate shows it, without the row the pass added. */
function shown(k: SignalKernel, over: Params = {}): View[] {
  const out: View[] = [];
  const params = { ...Object.fromEntries(k.params!.map((d) => [d.key, d.value])), ...over };
  for (const v of k.run(params, 4242, new Meter())) if (v) out.push({ ...v, stats: v.stats.filter((s) => s.label !== READOUT) });
  return out;
}

describe('stft-spectrogram: the default run is unchanged by the pass', () => {
  it('records exactly the views, readouts, counts and charts the kernel before the pass recorded', () => {
    expect(shown(kernelNew)).toEqual(shown(kernelOld));
  });

  it('the comparison sees a planted change of one unit in the last place of the SNR', () => {
    expect(shown(kernelNew, { snr: 10 * (1 + Number.EPSILON) })).not.toEqual(shown(kernelOld));
  });
});
