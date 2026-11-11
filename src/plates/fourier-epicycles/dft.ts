// The discrete Fourier transform of a closed curve sampled as complex numbers (x + iy), and
// the epicycle chain it defines: each coefficient is a circle turning at its own frequency.

export interface Term {
  /** Signed frequency in turns per period: 0, 1, -1, 2, -2, ... */
  freq: number;
  re: number;
  im: number;
  amp: number;
  phase: number;
}

/** X_k = (1/N) Σ x_n e^{-2πikn/N}, with k mapped to signed frequencies, sorted by amplitude. */
export function dft(xs: Float64Array, ys: Float64Array): Term[] {
  const n = xs.length;
  const out: Term[] = [];
  for (let k = 0; k < n; k++) {
    let re = 0;
    let im = 0;
    for (let j = 0; j < n; j++) {
      const a = (-2 * Math.PI * k * j) / n;
      const c = Math.cos(a);
      const s = Math.sin(a);
      re += xs[j] * c - ys[j] * s;
      im += xs[j] * s + ys[j] * c;
    }
    re /= n;
    im /= n;
    const freq = k <= n / 2 ? k : k - n;
    out.push({ freq, re, im, amp: Math.hypot(re, im), phase: Math.atan2(im, re) });
  }
  return out.sort((a, b) => b.amp - a.amp);
}

/** The sum of the first `count` terms at time t ∈ [0, 1). */
export function evaluate(terms: Term[], count: number, t: number): [number, number] {
  let x = 0;
  let y = 0;
  for (let i = 0; i < count && i < terms.length; i++) {
    const a = 2 * Math.PI * terms[i].freq * t + terms[i].phase;
    x += terms[i].amp * Math.cos(a);
    y += terms[i].amp * Math.sin(a);
  }
  return [x, y];
}

/** Root-mean-square distance between the partial sum and the samples it approximates. */
export function rmsError(terms: Term[], count: number, xs: Float64Array, ys: Float64Array): number {
  const n = xs.length;
  let sum = 0;
  for (let j = 0; j < n; j++) {
    const [x, y] = evaluate(terms, count, j / n);
    sum += (x - xs[j]) ** 2 + (y - ys[j]) ** 2;
  }
  return Math.sqrt(sum / n);
}

/** Resample a closed polygon to n points evenly spaced along its perimeter. */
export function resample(poly: [number, number][], n: number): [Float64Array, Float64Array] {
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const l = Math.hypot(bx - ax, by - ay);
    lens.push(l);
    total += l;
  }
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  let seg = 0;
  let acc = 0;
  for (let j = 0; j < n; j++) {
    const d = (j / n) * total;
    while (acc + lens[seg] < d && seg < poly.length - 1) acc += lens[seg++];
    const u = lens[seg] > 0 ? (d - acc) / lens[seg] : 0;
    const [ax, ay] = poly[seg];
    const [bx, by] = poly[(seg + 1) % poly.length];
    xs[j] = ax + (bx - ax) * u;
    ys[j] = ay + (by - ay) * u;
  }
  return [xs, ys];
}
