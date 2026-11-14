// Shared test functions: integrands with closed-form integrals for the quadrature kernels, and
// functions on [-1, 1] for the interpolation and fitting kernels. Kernels of one lab read the
// same parameter key, so the lab runs all of them on the same function.
import type { SelectParam } from '../../core/plate';

export interface Integrand {
  label: string;
  f: (x: number) => number;
  a: number;
  b: number;
  /** The exact integral over [a, b], in closed form. */
  exact: number;
}

export const INTEGRANDS: Record<string, Integrand> = {
  sine: { label: 'sin x on [0, π]', f: Math.sin, a: 0, b: Math.PI, exact: 2 },
  peak: { label: '1 / (x² + 0.01) on [-1, 1]', f: (x) => 1 / (x * x + 0.01), a: -1, b: 1, exact: 20 * Math.atan(10) },
  sqrt: { label: '√x on [0, 1]', f: (x) => Math.sqrt(Math.max(0, x)), a: 0, b: 1, exact: 2 / 3 },
  wave: { label: 'x sin 7x on [0, π]', f: (x) => x * Math.sin(7 * x), a: 0, b: Math.PI, exact: Math.PI / 7 },
  // a cubic, which Simpson's parabolas integrate exactly; 81/4 − 27 + 9 + 3 is a double exactly
  cubic: { label: 'x³ − 3x² + 2x + 1 on [0, 3]', f: (x) => x ** 3 - 3 * x * x + 2 * x + 1, a: 0, b: 3, exact: 5.25 },
};

export const integrandParam = (): SelectParam => ({
  kind: 'select', key: 'integrand', label: 'Integrand', value: 'peak', rebuild: true,
  options: Object.entries(INTEGRANDS).map(([value, g]) => ({ value, label: g.label })),
});

export const integrand = (key: unknown): Integrand => INTEGRANDS[String(key)] ?? INTEGRANDS.peak;

export interface Target { label: string; f: (x: number) => number }

export const TARGETS: Record<string, Target> = {
  runge: { label: 'Runge 1 / (1 + 25x²)', f: (x) => 1 / (1 + 25 * x * x) },
  sine: { label: 'sin 3x', f: (x) => Math.sin(3 * x) },
  abs: { label: '|x|', f: Math.abs },
  step: { label: 'tanh 8x', f: (x) => Math.tanh(8 * x) },
};

export const targetParam = (): SelectParam => ({
  kind: 'select', key: 'target', label: 'Function', value: 'runge', rebuild: true,
  options: Object.entries(TARGETS).map(([value, t]) => ({ value, label: t.label })),
});

export const target = (key: unknown): Target => TARGETS[String(key)] ?? TARGETS.runge;

/** Largest |f - g| on a fine grid of [a, b]. */
export function maxError(f: (x: number) => number, g: (x: number) => number, a = -1, b = 1, n = 800): number {
  let e = 0;
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    e = Math.max(e, Math.abs(f(x) - g(x)));
  }
  return e;
}
