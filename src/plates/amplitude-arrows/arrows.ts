// Partial reflection of light from a glass plate as a sum of amplitude arrows, one per way the light
// can come back, against the closed form those arrows sum to. Normal incidence, a plate of index n
// and thickness d in air, light of vacuum wavelength λ.

/** One arrow: its complex amplitude. */
export interface Arrow { re: number; im: number }

/** The plate: index, thickness and wavelength (the last two in the same unit). */
export interface Plate { n: number; d: number; lambda: number }

/** The amplitude of one reflection at the air–glass face, r = (n − 1)/(n + 1). */
export const faceAmplitude = (n: number): number => (n - 1) / (n + 1);

/** The phase a round trip through the glass adds, δ = 4πnd/λ. */
export const roundTrip = (p: Plate): number => (4 * Math.PI * p.n * p.d) / p.lambda;

/**
 * The reflected light's arrows, in the order the light takes them: off the front face (−r, the
 * reflection from the denser side turned half a turn), then in, off the back face k + 1 times and
 * k times off the front from inside, and out: (1 − r²)·r^(2k+1)·e^(i(k+1)δ). Arrows are added until
 * the next is shorter than `tiny`, or `max` of them.
 */
export function reflected(p: Plate, max = 64, tiny = 1e-18): Arrow[] {
  const r = faceAmplitude(p.n);
  const delta = roundTrip(p);
  const out: Arrow[] = [{ re: -r, im: 0 }];
  let len = (1 - r * r) * r;
  for (let k = 0; out.length < max && len >= tiny; k++) {
    out.push({ re: len * Math.cos((k + 1) * delta), im: len * Math.sin((k + 1) * delta) });
    len *= r * r;
  }
  return out;
}

/** The transmitted light's arrows: straight through, (1 − r²)·e^(iδ/2), then two more bounces each. */
export function transmitted(p: Plate, max = 64, tiny = 1e-18): Arrow[] {
  const r = faceAmplitude(p.n);
  const delta = roundTrip(p);
  const out: Arrow[] = [];
  let len = 1 - r * r;
  for (let k = 0; out.length < max && len >= tiny; k++) {
    out.push({ re: len * Math.cos((k + 0.5) * delta), im: len * Math.sin((k + 0.5) * delta) });
    len *= r * r;
  }
  return out;
}

/** The sum of the first `count` arrows (all of them by default). */
export function total(arrows: Arrow[], count = arrows.length): Arrow {
  let re = 0;
  let im = 0;
  for (let k = 0; k < count && k < arrows.length; k++) { re += arrows[k].re; im += arrows[k].im; }
  return { re, im };
}

/** The probability an arrow stands for: its length squared. */
export const probability = (a: Arrow): number => a.re * a.re + a.im * a.im;

/**
 * The Airy reflectance of a plate, never from the arrows: R = F sin²(δ/2)/(1 + F sin²(δ/2)) with
 * the coefficient of finesse F = 4r²/(1 − r²)².
 */
export function airy(p: Plate): number {
  const r = faceAmplitude(p.n);
  const F = (4 * r * r) / (1 - r * r) ** 2;
  const s = Math.sin(roundTrip(p) / 2) ** 2;
  return (F * s) / (1 + F * s);
}
