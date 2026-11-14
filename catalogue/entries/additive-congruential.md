---
id: additive-congruential
title: Additive congruential generator
taxonomy: numerics/random
status: live
engine: numeric
sources:
  - id: sedgewick-aic-1990
    ref: Mathematical Algorithms
tags:
  - random numbers
  - lagged fibonacci
complexity: 'one addition per number, a table of 55 words'
related:
  - linear-congruential
claims:
  - id: chi-square-within-three-sd
    statement: >-
      The 4,096 outputs scaled to [0, 1) fill 16 equal bins as uniform numbers do: χ² with 15
      degrees of freedom has mean 15 and standard deviation √30 ≈ 5.48, and it stays below 15 + 3√30
      = 31.43, plus 0.005 of display rounding, at every seed of the fixed seed set 1–5.
    readout: χ² over 16 bins (15 dof)
    expect: { below: 31.44 }
    setup:
      seeds: [1, 2, 3, 4, 5]
  - id: serial-correlation-within-three-se
    statement: >-
      The lag-one serial correlation of the 4,096 outputs is within three standard errors of 0,
      ±3/√4096 = ±0.046875 (plus display rounding), at every seed of the fixed seed set 1–5.
    readout: Serial correlation
    expect: { range: [-0.04688, 0.04688] }
    setup:
      seeds: [1, 2, 3, 4, 5]
---

Each number the sum of two earlier ones in a shift register, with a very long period.

The table holds the last 55 outputs; each new number is the sum of the words 24 and 55 places back, modulo 2^30, written over the oldest. The outlined cells are the two taps as they walk around the table.

The lowest bits do not depend on carries, so they obey b_n = b_{n−24} ⊕ b_{n−55}, a linear feedback shift register whose trinomial x^55 + x^24 + 1 is primitive; the readout checks that relation on every output. The pairs panel shows no lattice of the kind a linear congruential generator draws.
