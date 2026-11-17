// hilbert-analytic beyond the entry's claims (catalogue/entries/hilbert-analytic.md). The two new
// readouts compare the analytic signal with closed forms of the signal it was made from: Im z
// against e·sin φ, and the measured frequency against the exact phase advance over one sample.
// Here: that advance formula against the phase itself, every claim's bound at seeds disjoint from
// the claim's, two planted slips in the transform failing every claim through the instrument,
// and the default run recording exactly what the kernel before the pass recorded
// (test/fixtures/hilbert-analytic-before), a planted change of one unit in the last place shown to
// break that comparison.
import { describe, expect, it, vi } from 'vitest';
import type { Params } from '../src/core/plate';
import { Meter, type View } from '../src/engines/signal/trace';
import { kernel as kernelNew } from '../src/kernels/signal/hilbert-analytic';
import { kernel as kernelOld } from './fixtures/hilbert-analytic-before/hilbert-analytic';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from './support/claims';
import type { SignalKernel } from '../src/engines/signal/trace';

const ID = 'hilbert-analytic';
const FS = 8000;
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === ID)!.claims;
const DEFAULTS: Params = Object.fromEntries((kernelNew.params ?? []).map((d) => [d.key, d.value]));
/** The seeds the bounds are checked at, disjoint from the claims' (4242, the instrument's default). */
const OTHER_SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);

/** Every view of one run. */
function views(k: SignalKernel, over: Params, seed: number): View[] {
  const out: View[] = [];
  for (const v of k.run({ ...DEFAULTS, ...over }, seed, new Meter())) if (v) out.push(v);
  return out;
}
/** The last view's readouts, one run per setup and seed however many claims read it. */
const runs = new Map<string, Record<string, string>>();
const lastRows = (over: Params, seed: number) => {
  const key = `${JSON.stringify(over)}@${seed}`;
  if (!runs.has(key)) {
    const v = views(kernelNew, over, seed);
    runs.set(key, Object.fromEntries(v[v.length - 1].stats.map((s) => [s.label, s.value])));
  }
  return runs.get(key)!;
};

describe('hilbert-analytic: the phase-step closed form', () => {
  it('is the advance of φ = 2πfc·t + (dev/fm)·sin 2πfm·t over one sample, divided by 2πΔ', () => {
    // near t = 0 the phase is small, so its difference loses nothing to cancellation
    for (const [fc, dev, fm] of [[600, 120, 1.953125], [2400, 200, 3.90625], [400, 0, 1.953125]]) {
      const phi = (t: number) => 2 * Math.PI * fc * t + (dev / fm) * Math.sin(2 * Math.PI * fm * t);
      const half = (Math.PI * fm) / FS;
      for (let i = 0; i < 40; i++) {
        const t = i / FS;
        const closed = fc + dev * Math.cos(2 * Math.PI * fm * (t + 0.5 / FS)) * (Math.sin(half) / half);
        expect(Math.abs((phi(t + 1 / FS) - phi(t)) * FS / (2 * Math.PI) - closed)).toBeLessThan(1e-9);
      }
    }
  });
});

describe('hilbert-analytic: every bound holds at seeds other than the claim\'s', () => {
  for (const c of claims) {
    it(`${c.id}: below ${c.expect.below} at seeds ${OTHER_SEEDS[0]}…${OTHER_SEEDS[OTHER_SEEDS.length - 1]}`, () => {
      let worst = 0;
      for (const s of OTHER_SEEDS) worst = Math.max(worst, Number.parseFloat(lastRows(c.setup?.params ?? {}, s)[c.readout]));
      expect(worst).toBeLessThan(c.expect.below as number);
    });
  }
});

type Fft = typeof import('../src/kernels/signal/_fft');
/** A slip planted in the spectrum just before the inverse transform. */
const PLANTED: Record<string, { slip: (re: Float64Array, im: Float64Array) => void; fails: string[] }> = {
  'the positive bins left undoubled': {
    slip: (re, im) => { for (let k = 1; k < re.length / 2; k++) { re[k] /= 2; im[k] /= 2; } },
    fails: ['envelope-to-rounding-on-a-whole-bin', 'envelope-to-rounding-at-the-top-carrier',
      'quadrature-to-rounding-on-a-whole-bin', 'quadrature-at-the-top-carrier', 'cos-to-sin'],
  },
  'the negative frequencies kept instead of the positive': {
    slip: (re, im) => {
      const n = re.length;
      for (let k = 1; k < n / 2; k++) { re[n - k] = re[k]; im[n - k] = -im[k]; re[k] = 0; im[k] = 0; }
    },
    fails: ['quadrature-to-rounding-on-a-whole-bin', 'quadrature-at-the-top-carrier', 'cos-to-sin',
      'phase-step-to-rounding', 'phase-step-at-the-top-carrier'],
  },
};

describe('hilbert-analytic: a planted slip in the transform fails the claims it should', () => {
  it('between them the slips cover every claim', () => {
    const covered = new Set(Object.values(PLANTED).flatMap((p) => p.fails));
    expect(claims.map((c) => c.id).filter((id) => !covered.has(id))).toEqual([]);
  });

  for (const [name, { slip, fails }] of Object.entries(PLANTED)) {
    it(`${name}: each of its claims reads outside its band`, async () => {
      vi.resetModules();
      vi.doMock('../src/kernels/signal/_fft', async (orig) => {
        const m = await orig<Fft>();
        return { ...m, fft: (re: Float64Array, im: Float64Array, meter?: Meter, inverse = false) => {
          if (inverse) slip(re, im);
          return m.fft(re, im, meter, inverse);
        } };
      });
      const planted = await import('./support/claims');
      const held: string[] = [];
      for (const id of fails) {
        const f = await planted.failures(ID, claims.find((c) => c.id === id)!);
        if (f.length === 0) held.push(id);
        for (const msg of f) expect(msg, id).toMatch(/" read .* expected /);
      }
      vi.doUnmock('../src/kernels/signal/_fft');
      vi.resetModules();
      expect(held, 'claims the planted slip did not fail').toEqual([]);
    });
  }
});

/** A run as the plate shows it, without the rows the pass added. */
const ADDED = new Set(['Quadrature error, Im z − e·sin φ (RMS)', 'Phase-step frequency error (largest)']);
const shown = (k: SignalKernel, over: Params = {}) =>
  views(k, over, 4242).map((v) => ({ ...v, stats: v.stats.filter((s) => !ADDED.has(s.label)) }));

describe('hilbert-analytic: the default run is unchanged by the pass', () => {
  it('records exactly the views, readouts, counts and charts the kernel before the pass recorded', () => {
    expect(shown(kernelNew)).toEqual(shown(kernelOld));
  });

  it('the comparison sees a planted change of one unit in the last place of the AM depth', () => {
    expect(shown(kernelNew, { depth: 0.6 * (1 + Number.EPSILON) })).not.toEqual(shown(kernelOld));
  });
});
