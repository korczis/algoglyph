---
id: horner-evaluation
title: Horner's rule
taxonomy: numerics/arithmetic
status: live
engine: numeric
sources:
  - id: sedgewick-aic-1990
    ref: Mathematical Algorithms
tags:
  - polynomials
  - evaluation
complexity: 'n multiplications and n additions for degree n'
related:
  - karatsuba
  - polynomial-interpolation
---

Evaluate a polynomial with n multiplications by nesting it from the highest coefficient.

The polynomial is evaluated left to right across the panel. At each point the bars on the right are the nested values b_n, b_{n−1}, …, b_0 = p(x), each one the previous times x plus the next coefficient.

The meter counts every multiplication: n for Horner's rule, 2n − 1 when powers are carried along, n(n + 1)/2 when every power is computed from scratch. The readout also tracks the largest difference between Horner's value and the naive sum, which is rounding only.
