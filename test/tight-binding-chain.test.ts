// The tight-binding chain (src/plates/_shared/quantum/tight-binding.ts) beyond the entry's claims:
// the spectrum of short chains against the cosine band, Crank–Nicolson keeping |ψₙ|² of an eigenmode
// fixed while it turns its phase at e^(−iEt) to second order, unitarity on a packet, and the
// averaged transmission tending to its value at k₀ as the packet widens.
import { describe, expect, it } from 'vitest';
import { CrankNicolsonChain, chainMode, chainSpectrum, moments, packet } from '../src/plates/_shared/quantum/tight-binding';
import { packetTransmission } from '../src/plates/tight-binding-chain/plate';

describe('tight-binding-chain', () => {
  it('has the cosine band −2A cos(nπ/(N + 1)) for short chains and any hopping', () => {
    for (const [N, A] of [[4, 1], [17, 0.7], [33, 2.5]]) {
      const E = chainSpectrum(new Float64Array(N), A);
      E.forEach((e, n) => expect(e).toBeCloseTo(-2 * A * Math.cos(((n + 1) * Math.PI) / (N + 1)), 12));
    }
  });

  it('evolves an eigenmode by its phase alone, at the energy Crank–Nicolson implies', () => {
    const N = 40;
    const eps = new Float64Array(N);
    const E = chainSpectrum(eps, 1)[5];
    const v = chainMode(eps, 1, E);
    const w = { re: Float64Array.from(v), im: new Float64Array(N) };
    const dt = 0.05;
    const cn = new CrankNicolsonChain(eps, 1, dt);
    for (let s = 0; s < 200; s++) cn.step(w);
    // the Cayley map turns the phase by 2 atan(E dt / 2) a step
    const phase = -200 * 2 * Math.atan((E * dt) / 2);
    for (let n = 0; n < N; n++) {
      expect(w.re[n]).toBeCloseTo(v[n] * Math.cos(phase), 10);
      expect(w.im[n]).toBeCloseTo(v[n] * Math.sin(phase), 10);
    }
  });

  it('keeps a packet normalised to round-off', () => {
    const eps = new Float64Array(300);
    eps[150] = 1.5;
    const w = packet(300, 80, 10, 1.2);
    const cn = new CrankNicolsonChain(eps, 1, 0.03);
    for (let s = 0; s < 2000; s++) cn.step(w);
    expect(Math.abs(moments(w).norm - 1)).toBeLessThan(1e-12);
  });

  it('averages the transmission towards its value at k₀ as the packet widens', () => {
    const at = (k: number, e: number) => 1 / (1 + (e / (2 * Math.sin(k))) ** 2);
    const gaps = [10, 40, 160].map((s) => Math.abs(packetTransmission(1.3, 0.9, s) - at(0.9, 1.3)));
    expect(gaps[1]).toBeLessThan(gaps[0]);
    expect(gaps[2]).toBeLessThan(gaps[1]);
    expect(gaps[2]).toBeLessThan(1e-4);
  });
});
