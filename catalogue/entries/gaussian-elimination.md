---
id: gaussian-elimination
title: Gaussian elimination
taxonomy: numerics/linear-algebra
status: live
engine: numeric
sources:
  - id: sedgewick-aic-1990
    ref: Mathematical Algorithms
tags:
  - linear systems
  - pivoting
complexity: 'about n³/3 multiplications to triangularise, n²/2 to substitute back'
related:
  - least-squares
  - simplex-method
claims:
  - id: multiplications-of-this-variant-8
    statement: >-
      This variant counts the multiplications of elimination on [A | b], the b column included,
      Σ (n − 1 − k)(n − k) = (n − 1)n(n + 1)/3, and of back substitution, n(n − 1)/2; the divisions
      (one per multiplier, one per unknown) are not in the count. In all n(n − 1)(2n + 5)/6, which
      is exactly 196 at n = 8 (168 + 28), not the leading term n³/3 ≈ 171.
    readout: Multiplications
    expect: { value: 196 }
    setup:
      params: { n: 8, system: random, pivot: true }
  - id: multiplications-of-this-variant-14
    statement: >-
      At n = 14, the control's top, the same count n(n − 1)(2n + 5)/6 is exactly 1,001
      multiplications (910 to eliminate, 91 to substitute back), divisions not counted.
    readout: Multiplications
    expect: { value: 1001 }
    setup:
      params: { n: 14, system: random, pivot: true }
  - id: tiny-pivot-without-pivoting-loses-digits
    statement: >-
      With A[0][0] = 10⁻¹⁴ and pivoting off, the first column's multipliers are of order 10¹⁴, and
      the rounding of the updated rows grows with them: on seed 4242's system of 8 unknowns the
      largest error against the planted solution is above 10⁻³ (an independent re-run of the same
      elimination gives 0.0301).
    readout: Error against the planted solution
    expect: { above: 0.001 }
    setup:
      params: { n: 8, system: tiny-pivot, pivot: false }
  - id: tiny-pivot-with-pivoting-keeps-them
    statement: >-
      On the same system with partial pivoting every multiplier is at most 1 in size, and the
      largest error against the planted solution falls below 10⁻¹² (an independent re-run gives
      1.6e−15, a few units of rounding).
    readout: Error against the planted solution
    expect: { below: 1.0e-12 }
    setup:
      params: { n: 8, system: tiny-pivot, pivot: true }
---

Eliminate unknowns column by column, pivoting on the largest entry, then substitute back.

The augmented matrix [A | b] is shaded on a signed logarithmic scale, so that a pivot of 10⁻¹⁴ and an entry of 10⁴ remain distinguishable. Each step is one row operation; with partial pivoting, the row with the largest entry in the column is swapped up first.

The planted solution makes the error measurable. On the system with a tiny first pivot, elimination without pivoting multiplies the rounding error by the size of the multipliers and loses most of its digits, while partial pivoting keeps the multipliers at most one; the readout compares both on the same system.
