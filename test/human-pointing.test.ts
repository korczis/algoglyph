// human-pointing (src/plates/human-pointing/motion.ts) against references outside its code: the
// generator against xorshift64* written here a second way (in 32-bit halves, no BigInt), the
// golden vectors motion.rs writes (test/fixtures/human-pointing.v1.json), the tests of the OpenTTD fork's motion.rs it is ported from, Fitts' law read back by least squares,
// and the minimum-jerk profile's own properties.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, drag, duration, minJerk, path, Rng, roundAway } from '../src/plates/human-pointing/motion';
import { data } from '../src/plates/human-pointing/data';
import { fit, moves } from '../src/plates/human-pointing/plate';

/** xorshift64* in two 32-bit halves: the same generator, arithmetic written independently. */
function halves(seed: number) {
  // 64-bit values as [hi, lo] unsigned 32-bit pairs
  const mul = ([ah, al]: number[], [bh, bl]: number[]) => {
    const a = [al & 0xffff, al >>> 16, ah & 0xffff, ah >>> 16]; const b = [bl & 0xffff, bl >>> 16, bh & 0xffff, bh >>> 16];
    const r = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) { let carry = 0; for (let j = 0; i + j < 4; j++) { const t = r[i + j] + a[i] * b[j] + carry; r[i + j] = t % 65536; carry = Math.floor(t / 65536); } }
    return [((r[3] << 16) | r[2]) >>> 0, ((r[1] << 16) | r[0]) >>> 0];
  };
  const shr = ([h, l]: number[], n: number) => (n >= 32 ? [0, h >>> (n - 32)] : [h >>> n, ((l >>> n) | (h << (32 - n))) >>> 0]);
  const shl = ([h, l]: number[], n: number) => [((h << n) | (l >>> (32 - n))) >>> 0, (l << n) >>> 0];
  const xor = (a: number[], b: number[]) => [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0];
  let s = mul([Math.floor(seed / 2 ** 32) >>> 0, seed >>> 0], [0x9E3779B9, 0x7F4A7C15]);
  s = [s[0], (s[1] | 1) >>> 0];
  return () => {
    let x = s;
    x = xor(x, shr(x, 12)); x = xor(x, shl(x, 25)); x = xor(x, shr(x, 27));
    s = x;
    const r = mul(x, [0x2545F491, 0x4F6CDD1D]);
    return (BigInt(r[0]) << 32n) | BigInt(r[1]);
  };
}

describe('human-pointing: the seeded source', () => {
  it('is xorshift64* exactly: a second implementation in 32-bit halves gives the same stream', () => {
    for (const seed of [0, 1, 7, 42, 4242, 2 ** 40 + 3]) {
      const a = new Rng(seed); const b = halves(seed);
      for (let i = 0; i < 200; i++) expect(a.nextU64(), `seed ${seed} draw ${i}`).toBe(b());
    }
  });

  it('rounds half away from zero, as Rust\'s f64::round does', () => {
    expect([2.5, -2.5, 0.5, -0.5, 1.4999, -1.5, -0.3].map(roundAway)).toEqual([3, -3, 1, -1, 1, -2, 0]);
    expect(Object.is(roundAway(-0.3), 0)).toBe(true);
  });
});

describe('human-pointing: bit for bit with motion.rs', () => {
  // written by the fork's `mcp-human golden` (korczis/OpenTTD f725a16fd5,
  // tools/research/mcp-human/golden/human-pointing.v1.json): each case a fresh Rng(seed)
  const golden = JSON.parse(readFileSync('test/fixtures/human-pointing.v1.json', 'utf8')) as {
    schema: string; model: typeof DEFAULT_MODEL;
    cases: { from: [number, number]; to: [number, number]; width: number; seed: number; drag: boolean; samples: number[][] }[];
  };
  it('reads the golden file\'s model as this one\'s defaults', () => {
    expect(golden.schema).toBe('human-pointing-golden/v1');
    expect(golden.model).toEqual(DEFAULT_MODEL);
    expect(golden.cases.length).toBeGreaterThan(0);
  });
  it.each(golden.cases.map((c, i) => [i, c] as const))('case %i gives motion.rs\'s samples exactly', (_i, c) => {
    const rng = new Rng(c.seed);
    const got = c.drag ? drag(golden.model, c.from, c.to, rng) : path(golden.model, c.from, c.to, c.width, rng);
    expect(got).toEqual(c.samples);
  });
});

describe('human-pointing: the tests of motion.rs, each ported', () => {
  const m = DEFAULT_MODEL;
  it('a path ends exactly on its target', () => {
    const rng = new Rng(7);
    for (const [from, to] of [[[0, 0], [900, 400]], [[500, 500], [520, 505]], [[10, 10], [10, 10]]] as [number, number][][]) {
      const p = path(m, from as [number, number], to as [number, number], 40, rng);
      expect(p[p.length - 1].slice(0, 2)).toEqual(to);
    }
  });
  it('farther and smaller targets take longer', () => {
    const rng = new Rng(1);
    const sum = (d: number, w: number) => Array.from({ length: 50 }, () => duration(m, d, w, rng)).reduce((s, v) => s + v, 0);
    const near = sum(100, 40); const far = sum(1200, 40); const small = sum(1200, 8);
    expect(near).toBeLessThan(far);
    expect(far).toBeLessThan(small);
  });
  it('the profile is slow at both ends and fast in the middle', () => {
    const p = path({ ...m, tremor: 0, curvature: 0, overshoot_from: 1e9 }, [0, 0], [1000, 0], 40, new Rng(3));
    const steps = p.slice(1).map((q, i) => Math.abs(q[0] - p[i][0]));
    const mid = steps[Math.floor(steps.length / 2)];
    expect(steps[0]).toBeLessThan(mid);
    expect(steps[steps.length - 1]).toBeLessThan(mid);
  });
  it('a long move overshoots then corrects', () => {
    const p = path({ ...m, tremor: 0, curvature: 0 }, [0, 0], [1000, 0], 40, new Rng(11));
    expect(p.some((q) => q[0] > 1000)).toBe(true);
    expect(p[p.length - 1][0]).toBe(1000);
  });
  it('the same seed moves the same way', () => {
    expect(path(m, [0, 0], [700, 300], 30, new Rng(42))).toEqual(path(m, [0, 0], [700, 300], 30, new Rng(42)));
  });
});

describe('human-pointing: the model\'s own properties', () => {
  it('minimum jerk goes from 0 to 1 with zero speed at both ends and its fastest at the middle', () => {
    expect([minJerk(0), minJerk(0.5), minJerk(1)]).toEqual([0, 0.5, 1]);
    const v = (t: number) => (minJerk(t + 1e-6) - minJerk(t - 1e-6)) / 2e-6;
    expect(v(1e-6)).toBeLessThan(1e-3);
    expect(v(1 - 1e-6)).toBeLessThan(1e-3);
    expect(v(0.5)).toBeCloseTo(1.875, 5);
  });

  it('Fitts\' law read back by least squares has the model\'s slope when nothing overshoots', () => {
    // with no overshoot each move takes MT (1 + noise), so duration against difficulty has slope b
    const model = { ...DEFAULT_MODEL, overshoot_from: 1e9 };
    const rng = new Rng(5);
    const ids: number[] = []; const ms: number[] = [];
    for (let i = 0; i < 4000; i++) {
      const d = 20 + (i % 40) * 30; const w = 8 + (i % 7) * 10;
      ids.push(Math.log2(d / w + 1)); ms.push(1000 * duration(model, d, w, rng));
    }
    const [a, b] = fit(ids, ms);
    expect(b).toBeGreaterThan(140 * 0.97);
    expect(b).toBeLessThan(140 * 1.03);
    expect(a).toBeGreaterThan(150 * 0.9);
    expect(a).toBeLessThan(150 * 1.1);
  });

  it('a drag runs straight, without tremor, and arrives on its target', () => {
    const p = drag(DEFAULT_MODEL, [0, 0], [600, 0], new Rng(9));
    expect(p.every((q) => q[1] === 0)).toBe(true);
    expect(p[p.length - 1].slice(0, 2)).toEqual([600, 0]);
  });

  it('the plate\'s run ends every move on its target, and its long moves are the ones that overshoot', () => {
    // the claims instrument draws the plate at 800 × 500 px with seed 4242
    const run = moves(800, 500, 4242, DEFAULT_MODEL, 40);
    for (const m of run) expect(m.samples[m.samples.length - 1].slice(0, 2)).toEqual(m.to);
    // the plate counts a move as overshooting when it passes the target's projection by over 2 px
    const passes = (m: (typeof run)[number]) => {
      const dx = m.to[0] - m.from[0]; const dy = m.to[1] - m.from[1]; const d2 = dx * dx + dy * dy;
      return m.samples.some(([x, y]) => ((x - m.from[0]) * dx + (y - m.from[1]) * dy) / d2 > 1 + 2 / Math.sqrt(d2));
    };
    const long = run.filter((m) => Math.hypot(m.to[0] - m.from[0], m.to[1] - m.from[1]) > DEFAULT_MODEL.overshoot_from);
    expect(long.length).toBe(16);
    expect(long.every(passes)).toBe(true);
    expect(run.filter((m) => !long.includes(m) && passes(m)).length).toBe(1);
  });
});

describe('human-pointing: the data form', () => {
  it('answers samples and their total time, the same for the same seed', () => {
    const q = { from: [0, 0], to: [900, 400], width: 40, seed: 7 };
    const r = data.solve(q);
    if (typeof r === 'string') throw new Error(r);
    const samples = r.samples as number[][];
    expect(samples[samples.length - 1].slice(0, 2)).toEqual([900, 400]);
    expect(r.duration_ms).toBe(samples.reduce((s, v) => s + v[2], 0));
    expect(data.solve(q)).toEqual(r);
    expect(data.solve({ ...q, drag: true })).toMatchObject({ ok: true });
  });
  it('refuses a malformed request with the field named', () => {
    expect(data.solve({ from: [0], to: [1, 1] })).toMatch(/from/);
    expect(data.solve({ from: [0, 0], to: [1, 1], seed: -1 })).toMatch(/seed/);
    expect(data.solve({ from: [0, 0], to: [1, 1], model: { speed: 0 } })).toMatch(/model.speed/);
    expect(data.solve({ from: [0, 0], to: [1, 1], model: { jitter: 1 } })).toMatch(/unknown field jitter/);
    expect(data.solve({ from: [0, 0], to: [90000, 0], drag: true, model: { rate_hz: 1000, speed: 0.01 } })).toMatch(/samples/);
  });
});
