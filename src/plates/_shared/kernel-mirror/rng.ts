// SplitMix64 (Steele, Lea and Flood 2014) exactly as the sorting kernels' prelude implements it
// (crates/algoglyph-kernels/src/sorting/prelude.rs), in 32-bit halves so that a plate can draw
// the same random numbers as the wasm kernel without BigInt on its hot path. A bespoke plate
// that mirrors a randomised kernel step by step uses it with the kernel's seed; the tests prove
// the mirror against the kernel and this generator against a BigInt reference.

const TWO32 = 4294967296;

/** Low and high 32 bits of the 64-bit product of two unsigned 32-bit numbers. */
function mul32(a: number, b: number): [number, number] {
  const a0 = a & 0xffff;
  const a1 = a >>> 16;
  const b0 = b & 0xffff;
  const b1 = b >>> 16;
  const p00 = a0 * b0;
  const p01 = a0 * b1;
  const p10 = a1 * b0;
  const p11 = a1 * b1;
  const mid = (p00 >>> 16) + (p01 & 0xffff) + (p10 & 0xffff);
  const lo = (((mid & 0xffff) << 16) | (p00 & 0xffff)) >>> 0;
  const hi = (p11 + (p01 >>> 16) + (p10 >>> 16) + (mid >>> 16)) >>> 0;
  return [lo, hi];
}

export class SplitMix64 {
  private hi: number;
  private lo: number;
  /** The halves of the last `nextU64()`, high first. */
  readonly out: [number, number] = [0, 0];

  /** `seed` is a non-negative integer below 2^53, the way the ABI passes a u64 seed. */
  constructor(seed: number) {
    this.hi = Math.floor(seed / TWO32) >>> 0;
    this.lo = seed >>> 0;
  }

  /** Advances the state; the 64-bit output is left in `out` as [high, low]. */
  nextU64(): [number, number] {
    // state += 0x9E3779B97F4A7C15
    const lo = this.lo + 0x7f4a7c15;
    this.lo = lo >>> 0;
    this.hi = (this.hi + 0x9e3779b9 + (lo >= TWO32 ? 1 : 0)) >>> 0;
    let h = this.hi;
    let l = this.lo;
    // z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9
    l = (l ^ ((l >>> 30) | (h << 2))) >>> 0;
    h = (h ^ (h >>> 30)) >>> 0;
    [l, h] = mul64(h, l, 0xbf58476d, 0x1ce4e5b9);
    // z = (z ^ (z >> 27)) * 0x94D049BB133111EB
    l = (l ^ ((l >>> 27) | (h << 5))) >>> 0;
    h = (h ^ (h >>> 27)) >>> 0;
    [l, h] = mul64(h, l, 0x94d049bb, 0x133111eb);
    // z ^ (z >> 31)
    l = (l ^ ((l >>> 31) | (h << 1))) >>> 0;
    h = (h ^ (h >>> 31)) >>> 0;
    this.out[0] = h;
    this.out[1] = l;
    return this.out;
  }

  /** Uniform in 0..n, the high 64 bits of next_u64 · n (0 when n is 0); n below 2^20. */
  below(n: number): number {
    if (n <= 0) return 0;
    if (n >= 1 << 20) throw new RangeError(`SplitMix64.below: ${n} is beyond the exact range`);
    const [h, l] = this.nextU64();
    // (h·2^32 + l)·n / 2^64, floored: both partial products are exact doubles for n < 2^20
    return Math.floor((h * n + Math.floor((l * n) / TWO32)) / TWO32);
  }

  /** Uniform index in lo..hi (lo when the range is empty). */
  range(lo: number, hi: number): number {
    return hi <= lo ? lo : lo + this.below(hi - lo);
  }
}

/** The low 64 bits of (ah·2^32 + al)·(bh·2^32 + bl), as [low, high]. */
function mul64(ah: number, al: number, bh: number, bl: number): [number, number] {
  const [lo, carry] = mul32(al, bl);
  const hi = (carry + Math.imul(ah, bl) + Math.imul(al, bh)) >>> 0;
  return [lo, hi];
}
