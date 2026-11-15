// The plane's vector calculus (src/plates/_shared/fields/calculus.ts) against closed forms it does
// not compute: the flux of F = (x, y) is twice the area, polygon areas by counting unit squares,
// ∫x² over the unit square, the derivatives of a polynomial field written out by hand, and the
// work of a gradient field.
import { describe, expect, it } from 'vitest';
import { arcWork, areaIntegral, boundary, curl, divergence, square, work, type Loop } from '../src/plates/_shared/fields/calculus';
import { vectorCalculus } from '../src/plates/vector-calculus/plate';

const radial = (x: number, y: number): [number, number] => [x, y];
const lShape: Loop = { kind: 'polygon', xs: [0, 2, 2, 1, 1, 0], ys: [0, 0, 1, 1, 2, 2] };

describe('vector-calculus', () => {
  it('the flux of (x, y) is twice the area, on a circle, a square and an L', () => {
    expect(boundary(radial, { kind: 'circle', cx: 0.3, cy: -0.2, r: 0.7 }).flux).toBeCloseTo(2 * Math.PI * 0.49, 10);
    expect(boundary(radial, square(0.1, 0.2, 0.5), 8).flux).toBeCloseTo(2, 12);
    expect(boundary(radial, lShape, 8).flux).toBeCloseTo(6, 12);
  });

  it('walks a clockwise polygon outwards all the same', () => {
    const cw: Loop = { kind: 'polygon', xs: [0, 0, 1, 1, 2, 2], ys: [0, 2, 2, 1, 1, 0] };
    expect(boundary(radial, cw, 8).flux).toBeCloseTo(6, 12);
    expect(areaIntegral(() => 1, cw, 4)).toBeCloseTo(3, 12);
  });

  it('integrates over the inside: areas, and x² over the unit square', () => {
    expect(areaIntegral(() => 1, { kind: 'circle', cx: 0, cy: 0, r: 1.5 })).toBeCloseTo(Math.PI * 2.25, 10);
    expect(areaIntegral(() => 1, lShape, 4)).toBeCloseTo(3, 12);
    const unit: Loop = { kind: 'polygon', xs: [0, 1, 1, 0], ys: [0, 0, 1, 1] };
    expect(areaIntegral((x) => x * x, unit, 8)).toBeCloseTo(1 / 3, 12);
  });

  it('central differences give the derivatives of a polynomial field', () => {
    const F = (x: number, y: number): [number, number] => [x * x * y, x * y * y * y];
    for (const [x, y] of [[0.3, -0.7], [1.2, 0.4]]) {
      expect(divergence(F, x, y)).toBeCloseTo(2 * x * y + 3 * x * y * y, 7);
      expect(curl(F, x, y)).toBeCloseTo(y ** 3 - x * x, 7);
    }
  });

  it('the work of −∇(x² − y²) is the potential drop along an arc and along a polyline', () => {
    const F = (x: number, y: number): [number, number] => [-2 * x, 2 * y];
    const phi = (x: number, y: number) => x * x - y * y;
    // from angle 0.3 to 2.1 on a circle about (0.2, 0.1) of radius 0.8
    const at = (t: number): [number, number] => [0.2 + 0.8 * Math.cos(t), 0.1 + 0.8 * Math.sin(t)];
    expect(arcWork(F, 0.2, 0.1, 0.8, 0.3, 2.1)).toBeCloseTo(phi(...at(0.3)) - phi(...at(2.1)), 12);
    expect(work(F, [0, 1, 1.5], [0, 0.5, -1])).toBeCloseTo(phi(0, 0) - phi(1.5, -1), 12);
  });

  it('declares itself a still', () => {
    expect(vectorCalculus.pace?.kind).toBe('still');
  });
});
