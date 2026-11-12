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
---

Each number the sum of two earlier ones in a shift register, with a very long period.

The table holds the last 55 outputs; each new number is the sum of the words 24 and 55 places back, modulo 2^30, written over the oldest. The outlined cells are the two taps as they walk around the table.

The lowest bits do not depend on carries, so they obey b_n = b_{n−24} ⊕ b_{n−55}, a linear feedback shift register whose trinomial x^55 + x^24 + 1 is primitive; the readout checks that relation on every output. The pairs panel shows no lattice of the kind a linear congruential generator draws.
