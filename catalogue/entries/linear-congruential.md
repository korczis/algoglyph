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
related:
  - additive-congruential
---

x ← (ax + c) mod m, and the lattice its consecutive pairs fall on.

Consecutive pairs of a linear congruential generator lie on a few parallel lines and triples on a few parallel planes. The spectral test measures their spacing from the shortest nonzero vector of the dual lattice: exactly, by Gauss reduction, for pairs; by bounded search for triples, whose shortest vector also gives the direction to look along.

RANDU passes for pairs and fails for triples: because a = 2^16 + 3, every triple satisfies 9x − 6y + z ≡ 0 (mod 2^31), and the right panel, viewed along that normal, shows the planes edge-on. A multiplicative generator (c = 0) with a power-of-two modulus visits only one class of odd numbers, so, as in Knuth's tables, its test runs with m/4 in place of m. The period is measured by Brent's cycle detection up to a cap.
