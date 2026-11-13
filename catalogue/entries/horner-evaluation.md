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
claims:
  - id: horner-degree-9-takes-9-multiplications
    statement: >-
      Horner's rule nests p(x) as b_k = b_{k+1}·x + a_k, one multiplication per coefficient below
      the leading one: at degree 9 the meter counts exactly 9 multiplications for the evaluation at
      the last of the 49 points, an exact count with no margin.
    readout: This evaluation
    expect: { value: 9 }
    setup:
      params: { degree: 9 }
  - id: horner-degree-16-takes-16-multiplications
    statement: >-
      At degree 16, the control's top, Horner's rule still costs exactly n = 16 multiplications
      for one evaluation, where powers computed from scratch would cost n(n + 1)/2 = 136.
    readout: This evaluation
    expect: { value: 16 }
    setup:
      params: { degree: 16 }
  - id: horner-every-point-costs-n
    statement: >-
      Not only the last evaluation costs n: over all 49 evaluation points at degree 9 the meter
      totals exactly 49 · 9 = 441 Horner multiplications.
    readout: Multiplications so far
    expect: { value: 441 }
    setup:
      params: { degree: 9 }
---

Evaluate a polynomial with n multiplications by nesting it from the highest coefficient.

The polynomial is evaluated left to right across the panel. At each point the bars on the right are the nested values b_n, b_{n−1}, …, b_0 = p(x), each one the previous times x plus the next coefficient.

The meter counts every multiplication: n for Horner's rule, 2n − 1 when powers are carried along, n(n + 1)/2 when every power is computed from scratch. The readout also tracks the largest difference between Horner's value and the naive sum, which is rounding only.
