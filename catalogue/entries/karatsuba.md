---
id: karatsuba
title: Polynomial multiplication by divide and conquer
taxonomy: numerics/arithmetic
status: live
engine: numeric
sources:
  - id: sedgewick-aic-1990
    ref: Mathematical Algorithms
tags:
  - divide and conquer
  - multiplication
complexity: '3^lg n = n^1.585 multiplications for n coefficients'
related:
  - strassen
claims:
  - id: three-to-the-lg-n-multiplications-32
    statement: >-
      Three half-size products per call, recursing down to single coefficients, cost 3^lg n
      multiplications: exactly 3⁵ = 243 for two factors of 32 coefficients, against 32² = 1,024
      for the schoolbook method.
    readout: Multiplications
    expect: { value: 243 }
    setup:
      params: { n: '32' }
  - id: three-to-the-lg-n-multiplications-64
    statement: >-
      For 64 coefficients the count is exactly 3⁶ = 729 multiplications, against 64² = 4,096 for
      the schoolbook method.
    readout: Multiplications
    expect: { value: 729 }
    setup:
      params: { n: '64' }
  - id: additions-closed-form-32
    statement: >-
      This variant counts, in a call on s coefficients, s additions to form the two operand sums
      and five per coefficient of the s − 1 long sub-products when combining them (two
      subtractions for the middle term, three additions into the result), 6s − 5 in all. The
      recurrence A(n) = 3A(n/2) + 6n − 5 with A(1) = 0 solves to (19 · 3^k − 24n + 5)/2 for n =
      2^k, which is exactly 1,927 at n = 32.
    readout: Additions
    expect: { value: 1927 }
    setup:
      params: { n: '32' }
  - id: additions-closed-form-64
    statement: >-
      The same closed form (19 · 3^k − 24n + 5)/2 gives exactly 6,160 additions at n = 64, k = 6.
    readout: Additions
    expect: { value: 6160 }
    setup:
      params: { n: '64' }
---

Three half-size products instead of four: n^1.58 instead of n².

Each call splits both factors in half and recurses on three products: the two halves' products and the product of their sums, from which the middle term follows by two subtractions. The icicle on the left shows every call, one row per level, in the order the calls finish.

The meter counts exactly 3^k single-coefficient multiplications for 2^k coefficients, against n² for the schoolbook method, and the chart fits the growth exponents from the counts. With decimal digits as coefficients the product, carried, is the product of two integers; it is checked against BigInt.
