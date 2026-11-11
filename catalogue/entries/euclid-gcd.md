---
id: euclid-gcd
title: Euclid's algorithm
taxonomy: numerics/number-theory
status: live
engine: numeric
sources:
  - id: sedgewick-aic-1990
    ref: Mathematical Algorithms
tags:
  - gcd
  - euclid
complexity: 'O(log min(a, b)) divisions; at most five per decimal digit of the smaller input (Lamé)'
related:
  - karatsuba
---

The greatest common divisor by repeated remainders, the oldest algorithm in use.

Each division a = q b + r cuts q squares of side b from the a × b rectangle, leaving r × b to cut the other way. The last square fits exactly; its side is gcd(a, b). The quotients are the terms of the continued fraction of a / b.

Consecutive Fibonacci numbers are the worst case: every quotient is 1, so each step removes as little as possible, and the chart compares them with the mean over random pairs. The extended algorithm carries the Bezout coefficients x and y along, and the readout checks a x + b y = gcd.
