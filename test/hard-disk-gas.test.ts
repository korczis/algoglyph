// The event-driven hard-disk solver (src/plates/_shared/ensemble/hard-disks.ts) against what it does
// not compute: the closed forms of a head-on collision of two masses, the contact time of two disks
// found by stepping their gap, a brute-force overlap check after many collisions, momentum kept by
// collisions between disks, and the mixture's free-path factor against a Monte Carlo of Maxwellian
// relative speeds.
import { describe, expect, it } from 'vitest';
import { gaussian, mulberry32 } from '../src/core/random';
import { DiskGas, fromTable, initialState, type DiskInit } from '../src/plates/_shared/ensemble/hard-disks';
import { hardDiskGas, mixFactor } from '../src/plates/hard-disk-gas/plate';

const state = (rows: number[][]): DiskInit => ({
  x: Float64Array.from(rows.map((r) => r[0])), y: Float64Array.from(rows.map((r) => r[1])),
  vx: Float64Array.from(rows.map((r) => r[2])), vy: Float64Array.from(rows.map((r) => r[3])),
  m: Float64Array.from(rows.map((r) => r[4])),
});

describe('hard-disk-gas', () => {
  it('a head-on collision of two masses gives the textbook velocities', () => {
    // m1 at 1 against m2 at rest: v1' = (m1 − m2)/(m1 + m2), v2' = 2m1/(m1 + m2)
    for (const [m1, m2] of [[1, 1], [1, 4], [5, 2]]) {
      const g = new DiskGas(state([[0.3, 0.5, 1, 0, m1], [0.6, 0.5, 0, 0, m2]]), 0.1);
      g.advance(0.25, 100);
      expect(g.collisions).toBe(1);
      expect(g.vx[0]).toBeCloseTo((m1 - m2) / (m1 + m2), 12);
      expect(g.vx[1]).toBeCloseTo((2 * m1) / (m1 + m2), 12);
    }
  });

  it('finds the contact time that stepping the gap finds', () => {
    const g = new DiskGas(state([[0.2, 0.4, 0.3, 0.1, 1], [0.7, 0.55, -0.4, -0.05, 2]]), 0.08);
    // the first time the centres are d apart, by bisection on the gap of the straight lines
    const gap = (t: number) => Math.hypot(0.5 - 0.7 * t, 0.15 - 0.15 * t) - 0.08;
    let lo = 0; let hi = 1;
    for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (gap(mid) > 0) lo = mid; else hi = mid; }
    g.advance(lo - 1e-9, 100);
    expect(g.collisions).toBe(0);
    g.advance(lo + 1e-9, 100);
    expect(g.collisions).toBe(1);
  });

  it('never lets two disks overlap or a disk leave the box, and keeps the energy, after many collisions', () => {
    const s = initialState({ n: 200, eta: 0.32, kT: 1, heavy: 0.5, ratio: 3, start: 'equal' }, mulberry32(4));
    const g = new DiskGas(s, Math.sqrt((4 * 0.32) / (Math.PI * 200)));
    const e0 = g.energy();
    for (let k = 1; k <= 40; k++) {
      g.advance(k * 0.01, Infinity);
      for (let i = 0; i < g.n; i++) {
        expect(g.x[i]).toBeGreaterThanOrEqual(g.d / 2 - 1e-12);
        expect(g.x[i]).toBeLessThanOrEqual(1 - g.d / 2 + 1e-12);
        for (let j = i + 1; j < g.n; j++) expect(Math.hypot(g.x[i] - g.x[j], g.y[i] - g.y[j])).toBeGreaterThan(g.d * (1 - 1e-9));
      }
    }
    expect(g.collisions).toBeGreaterThan(1500);
    expect(g.bounces).toBeGreaterThan(100);
    // elastic collisions and bounces: the kinetic energy summed afresh is the starting one
    expect(Math.abs(g.energy() - e0) / e0).toBeLessThan(1e-12);
  });

  it('keeps momentum through collisions between disks', () => {
    // a cluster in the middle of the box, run only until the first wall bounce
    const rnd = mulberry32(8);
    const rows: number[][] = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      rows.push([0.4 + i * 0.04, 0.4 + j * 0.04, 0.3 * gaussian(rnd), 0.3 * gaussian(rnd), 1 + (i + j) % 3]);
    }
    const g = new DiskGas(state(rows), 0.02);
    const momentum = () => [0, 1].map((k) => Array.from(g.m).reduce((a, m, i) => a + m * (k ? g.vy[i] : g.vx[i]), 0));
    const p0 = momentum();
    let last = p0;
    // one event at a time, until the first bounce off a wall (which does not keep momentum)
    while (g.bounces === 0) {
      const before = g.collisions;
      g.advance(Infinity, 1);
      if (g.bounces === 0 && g.collisions > before) last = momentum();
    }
    expect(g.collisions).toBeGreaterThan(5);
    expect(Math.abs(last[0] - p0[0])).toBeLessThan(1e-12);
    expect(Math.abs(last[1] - p0[1])).toBeLessThan(1e-12);
  });

  it('places table rows inside the walls and leaves out a row that would overlap', () => {
    const { state: s, dropped } = fromTable({ x: [0.5, 0.52, 0, 0.9], y: [0.5, 0.5, 0.5, 1], vx: [0, 0, 0, 0], vy: [0, 0, 0, 0], m: [1, 1, 2, 3] }, 0.05);
    expect(dropped).toBe(1);
    expect(Array.from(s.x)).toEqual([0.5, 0.025, 0.9]);
    expect(s.y[2]).toBeCloseTo(0.975, 12);
  });

  it('the mixture factor is 1 for one mass and matches a Monte Carlo of Maxwellian speeds for two', () => {
    expect(mixFactor([2, 2, 2])).toBeCloseTo(1, 12);
    const masses = [1, 1, 1, 4];
    const rnd = mulberry32(11);
    const sample = (m: number) => [gaussian(rnd) / Math.sqrt(m), gaussian(rnd) / Math.sqrt(m)];
    let speed = 0; let rel = 0;
    const K = 200_000;
    for (let k = 0; k < K; k++) {
      const a = masses[Math.floor(rnd() * 4)];
      const b = masses[Math.floor(rnd() * 4)];
      const [ax, ay] = sample(a);
      const [bx, by] = sample(b);
      speed += Math.hypot(ax, ay);
      rel += Math.hypot(ax - bx, ay - by);
    }
    // standard error of the ratio of means is under 0.003 at this K; five of them
    expect(Math.abs(mixFactor(masses) - Math.SQRT2 * speed / rel)).toBeLessThan(0.015);
  });

  it('declares its pace', () => {
    expect(hardDiskGas.pace?.kind).toBe('replay');
  });
});
