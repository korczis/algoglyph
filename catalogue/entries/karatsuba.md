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
---

Three half-size products instead of four: n^1.58 instead of n².

Each call splits both factors in half and recurses on three products: the two halves' products and the product of their sums, from which the middle term follows by two subtractions. The icicle on the left shows every call, one row per level, in the order the calls finish.

The meter counts exactly 3^k single-coefficient multiplications for 2^k coefficients, against n² for the schoolbook method, and the chart fits the growth exponents from the counts. With decimal digits as coefficients the product, carried, is the product of two integers; it is checked against BigInt.
