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
claims:
  - id: fibonacci-pair-takes-k-minus-2-steps-4-digits
    statement: >-
      Consecutive Fibonacci numbers are Euclid's worst case (Lamé): every quotient is 1 but the
      last, so the remainders step down the sequence one term at a time. The largest pair below
      10⁴ is F₂₀ = 6,765 and F₁₉ = 4,181, and it takes exactly k − 2 = 18 divisions.
    readout: Steps
    expect: { value: 18 }
    setup:
      params: { pair: fibonacci, digits: 4 }
  - id: fibonacci-pair-takes-k-minus-2-steps-7-digits
    statement: >-
      Below 10⁷ the pair is F₃₅ = 9,227,465 and F₃₄ = 5,702,887: exactly k − 2 = 33 divisions,
      inside the Lamé bound of five per decimal digit of the smaller input, 35.
    readout: Steps
    expect: { value: 33 }
    setup:
      params: { pair: fibonacci, digits: 7 }
---

The greatest common divisor by repeated remainders, the oldest algorithm in use.

Each division a = q b + r cuts q squares of side b from the a × b rectangle, leaving r × b to cut the other way. The last square fits exactly; its side is gcd(a, b). The quotients are the terms of the continued fraction of a / b.

Consecutive Fibonacci numbers are the worst case: every quotient is 1, so each step removes as little as possible, and the chart compares them with the mean over random pairs. The extended algorithm carries the Bezout coefficients x and y along, and the readout checks a x + b y = gcd.
