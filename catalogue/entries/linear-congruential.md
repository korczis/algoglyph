---
id: linear-congruential
title: Linear congruential generator
taxonomy: numerics/random
status: live
engine: numeric
sources:
  - id: sedgewick-aic-1990
    ref: Mathematical Algorithms
tags:
  - random numbers
  - lcg
  - spectral test
complexity: 'O(1) per number; period at most m'
claims:
  - id: toy-generator-has-full-period
    statement: >-
      x ← (137x + 187) mod 256 meets the Hull–Dobell conditions for a full period: c = 187 is
      prime to m = 256, and a − 1 = 136 is divisible by 2, the only prime of m, and by 4, since 4
      divides m. Every seed then lies on one cycle of all 256 residues, and Brent's cycle detection
      measures exactly 256.
    readout: Period from the seed
    expect: { value: 256 }
    setup:
      params: { generator: toy }
  - id: small-generator-has-full-period
    statement: >-
      x ← (1365x + 1) mod 2¹⁶ meets the same conditions (c = 1, and a − 1 = 1,364 = 4 · 341), so
      its period from any seed is the full 65,536, measured exactly.
    readout: Period from the seed
    expect: { value: 65536 }
    setup:
      params: { generator: small }
  - id: randu-triples-lie-on-planes
    statement: >-
      RANDU's multiplier a = 2¹⁶ + 3 satisfies a² = 6a − 9 (mod 2³¹), so every triple of
      consecutive outputs obeys 9x − 6y + z ≡ 0 and the triples lie on few planes: the dual
      lattice's shortest vector, on the modulus 2²⁹ the test uses for this multiplicative
      generator, is (9, −6, 1), of length ν₃ = √118 = 10.8628, which an exhaustive search over
      every shorter vector confirms. The tolerance is the readout's display rounding.
    readout: Spectral test, triples
    expect: { value: 10.8628, tolerance: 0.005 }
    setup:
      params: { generator: randu }
---

x ← (ax + c) mod m, and the lattice its consecutive pairs fall on.

Consecutive pairs of a linear congruential generator lie on a few parallel lines and triples on a few parallel planes. The spectral test measures their spacing from the shortest nonzero vector of the dual lattice: exactly, by Gauss reduction, for pairs; by bounded search for triples, whose shortest vector also gives the direction to look along.

RANDU passes for pairs and fails for triples: because a = 2^16 + 3, every triple satisfies 9x − 6y + z ≡ 0 (mod 2^31), and the right panel, viewed along that normal, shows the planes edge-on. A multiplicative generator (c = 0) with a power-of-two modulus visits only one class of odd numbers, so, as in Knuth's tables, its test runs with m/4 in place of m. The period is measured by Brent's cycle detection up to a cap.
