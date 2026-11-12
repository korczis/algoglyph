// A radix-2 Cooley–Tukey FFT, written here, shared by the plates that transform a grid (the
// split-step Schrödinger solver of quantum-tunnelling and the recoiling wall of the two slits).
// Tested in test/quantum.test.ts against a direct DFT and for round trips.

/** In-place radix-2 FFT of one power-of-two length, with its tables computed once. */
export class Fft {
  readonly n: number;
  private readonly rev: Uint32Array;
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;

  constructor(n: number) {
    if (n < 2 || (n & (n - 1)) !== 0) throw new Error(`Fft: ${n} is not a power of two`);
    this.n = n;
    const bits = Math.log2(n);
    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float64Array(n / 2);
    this.sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((2 * Math.PI * i) / n);
    }
  }

  /**
   * Forward: X_k = Σ x_j e^{−2πijk/n}. Inverse: x_j = (1/n) Σ X_k e^{+2πijk/n}, so a forward
   * transform followed by an inverse one returns the input.
   */
  transform(re: Float64Array, im: Float64Array, inverse = false): void {
    const n = this.n;
    const rev = this.rev;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    // the size-2 stage needs no twiddle factor
    for (let a = 0; a < n; a += 2) {
      const xr = re[a + 1];
      const xi = im[a + 1];
      re[a + 1] = re[a] - xr;
      im[a + 1] = im[a] - xi;
      re[a] += xr;
      im[a] += xi;
    }
    const sign = inverse ? 1 : -1;
    const cos = this.cos;
    const sin = this.sin;
    for (let size = 4; size <= n; size <<= 1) {
      const half = size >> 1;
      const stride = n / size;
      // one twiddle factor per k, applied to every block of this size
      for (let k = 0; k < half; k++) {
        const wr = cos[k * stride];
        const wi = sign * sin[k * stride];
        for (let a = k; a < n; a += size) {
          const b = a + half;
          const br = re[b];
          const bi = im[b];
          const xr = br * wr - bi * wi;
          const xi = br * wi + bi * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
    if (inverse) {
      const s = 1 / n;
      for (let i = 0; i < n; i++) {
        re[i] *= s;
        im[i] *= s;
      }
    }
  }
}
