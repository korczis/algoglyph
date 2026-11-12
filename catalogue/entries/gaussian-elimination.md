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
---

Eliminate unknowns column by column, pivoting on the largest entry, then substitute back.

The augmented matrix [A | b] is shaded on a signed logarithmic scale, so that a pivot of 10⁻¹⁴ and an entry of 10⁴ remain distinguishable. Each step is one row operation; with partial pivoting, the row with the largest entry in the column is swapped up first.

The planted solution makes the error measurable. On the system with a tiny first pivot, elimination without pivoting multiplies the rounding error by the size of the multipliers and loses most of its digits, while partial pivoting keeps the multipliers at most one; the readout compares both on the same system.
