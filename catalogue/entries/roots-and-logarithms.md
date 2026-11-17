---
id: roots-and-logarithms
title: Roots and Logarithms by Hand
taxonomy: numerics/arithmetic
status: live
engine: numeric
schema: algoglyph.entry/v2
aliases:
  - Newton's method
  - Babylonian square root
  - secant method
  - table of logarithms
  - successive square roots
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 22 (Algebra: square roots by successive approximation, and a table of logarithms from successive square roots of 10)'
    purpose: further-reading
  - id: brent-1976
    purpose: algorithm-reference
  - id: abramowitz-stegun
    ref: 'Chapter 4: the series for ln z in powers of (z − 1)/(z + 1)'
    purpose: implementation
tags:
  - Newton's method
  - quadratic convergence
  - secant method
  - bisection
  - logarithm
  - square root
  - order of convergence
  - multiple precision
complexity: O(log D) Newton iterations for D digits, each one D-digit division; bisection takes about 3.3 D steps
interaction: Choose the experiment and the number a; the run shows each method's correct digits iteration by iteration, or the ladder of square roots of 10 rung by rung.
motivation: A square root and a logarithm can be computed with nothing but arithmetic, and how fast the digits come is the whole story; Newton doubles them each step, the secant method multiplies them by the golden ratio, bisection adds a third of a digit, and Feynman's ladder turns square roots into a table of logarithms one bit at a time.
relations:
  - type: compares_with
    target: binary-search
    reason: Bisection on x² = a is binary search on the real line; each halves what is left, one bit a step, against Newton's doubling of the digits.
  - type: related_to
    target: bound-states
    reason: That plate finds a box's energy levels by Sturm bisection, the bracket halved a step as bisection halves it here; one bit of the level a halving.
  - type: related_to
    target: karatsuba
    reason: Every Newton step on D digits is a D-digit division, which a fast multiplication like Karatsuba's speeds up; with doubling digits the last step costs as much as all the others together.
pedagogy:
  difficulty: introductory
  objectives:
    - Run Newton's iteration x ← (x + a/x)/2 and watch the correct digits of √a double each step once they pass a few.
    - Measure the order of convergence as the ratio of correct digits from one iterate to the next, and compare Newton's 2, the secant method's 1.618 and bisection's single bit.
    - Build log₁₀ a from successive square roots of 10, one bit a rung, and see the correction δ/ln 10 double the digits gained a rung.
    - See ln 10 itself appear as 2ᵏ(10^(1/2ᵏ) − 1).
  misconceptions:
    - Newton's method does not gain a fixed number of digits a step; it doubles the number it has, so the first steps from a poor start gain almost nothing.
    - The secant method is not a slower Newton by a constant; its order is the golden ratio, so its digits multiply by 1.618 a step.
    - A logarithm does not need a series to begin; square roots and division alone give it, one bit at a time.
  questions:
    - Why does Newton's error square each step, and what does that do to the number of correct digits?
    - Why is the secant method's order (1 + √5)/2?
    - Why does 2ᵏ(10^(1/2ᵏ) − 1) tend to ln 10, and why does its error halve each rung?
    - How many bisection steps give 200 digits?
algorithm:
  paradigm: iterative-refinement
  properties:
    deterministic: true
  preconditions:
    - a is 2, 3 or 7; all arithmetic is exact integer arithmetic on numbers scaled by 10^D (BigInt fixed point), with D = 200 for roots and 120 for the ladder.
  invariants:
    - The reference root is found by the pencil method, two digits of a·10^(2D) at a time, and proved by r² ≤ a·10^(2D) < (r + 1)²; no method shown uses it.
    - The reference logarithm is ln a / ln 10, each by the series 2Σy²ʲ⁺¹/(2j + 1) with y ≤ 1/3; the ladder never uses it.
  limitations:
    - Digits are capped at the precision carried, so a method's ratio is read at the last pair of iterates clear of the start (5 digits) and of the cap (90% of it).
    - Bisection's rate is fitted over 400 steps after the twentieth; Newton and the secant method are shown for 14 iterations.
    - The ladder's correction uses ln 10 from the ladder itself, 2ᵏ(10^(1/2ᵏ) − 1), as Feynman does; at 60 rungs that is good to about 18 digits.
experiments:
  - id: newton-sqrt2
    title: √2 three ways
    params: { experiment: roots, a: '2' }
    observe: Newton's digits go 0.4, 1, 2.6, 5.7, 11.8, 24, 48.5, 97.5, 195.5; the secant's grow by 1.62 a step; bisection is still under 5 digits at the fourteenth.
  - id: newton-sqrt7
    title: √7, a poorer start
    params: { experiment: roots, a: '7' }
    observe: From x = 1 Newton first halves its way toward √7 and gains little; the doubling starts once a few digits are right.
  - id: ladder-log2
    title: Feynman's ladder for log₁₀ 2
    params: { experiment: ladder, a: '2' }
    observe: Each rung decides one bit of 0.30103…; the bits alone give about 0.3 digits a rung, and with δ / ln 10 about 0.6.
  - id: ladder-log7
    title: The ladder for log₁₀ 7
    params: { experiment: ladder, a: '7' }
    observe: The same rungs, square roots of 10, serve every number; only the bits change.
claims:
  - id: newton-doubles-digits
    statement: >-
      Newton's iteration for √2 doubles its correct digits: the ratio of correct digits from one iterate to
      the next, against a reference root found by the pencil method, is 2 within 0.05.
    readout: Newton, digit ratio per iteration
    expect: { value: 2, tolerance: 0.05 }
    setup:
      params: { experiment: roots, a: '2' }
  - id: newton-doubles-digits-sqrt7
    statement: >-
      The doubling does not depend on the number: for √7 the ratio is 2 within 0.05 as well, once past the
      slow start from x = 1.
    readout: Newton, digit ratio per iteration
    expect: { value: 2, tolerance: 0.05 }
    setup:
      params: { experiment: roots, a: '7' }
  - id: secant-golden-ratio
    statement: >-
      The secant method on x² = 2 has order (1 + √5)/2: its ratio of correct digits per iteration is the
      golden ratio within 0.05.
    readout: Secant, digit ratio per iteration
    expect: { against: 'Golden ratio (1 + √5)/2, the secant’s order', tolerance: 0.05 }
    setup:
      params: { experiment: roots, a: '2' }
  - id: bisection-one-bit
    statement: >-
      Bisection gains one bit a step: over 400 steps on √2 its correct digits grow by log₁₀ 2 ≈ 0.301 a step
      within 0.01.
    readout: Bisection, digits per step over 400 steps
    expect: { against: 'One bit in decimal digits, log₁₀ 2', tolerance: 0.01 }
    setup:
      params: { experiment: roots, a: '2' }
  - id: pencil-reference-holds
    statement: >-
      The reference is the root to all 200 digits: the pencil root r satisfies r² ≤ 2·10⁴⁰⁰ < (r + 1)², checked
      in exact integers.
    readout: 'Reference: r² ≤ a·10^(2D) < (r + 1)², r the pencil root'
    expect: { value: 1 }
    setup:
      params: { experiment: roots, a: '2' }
  - id: ladder-one-bit-a-rung
    statement: >-
      Feynman's ladder for log₁₀ 3 gains one bit a rung: over 60 rungs the bits alone give log₁₀ 2 ≈ 0.301
      digits a rung within 0.03, against an atanh series it never uses.
    readout: Bits alone, digits per rung
    expect: { value: 0.30103, tolerance: 0.03 }
    setup:
      params: { experiment: ladder, a: '3' }
  - id: ladder-correction-doubles-rate
    statement: >-
      Feynman's correction δ / ln 10 for the remainder leaves an error of order δ², so log₁₀ 3 gains
      log₁₀ 4 ≈ 0.602 digits a rung within 0.03.
    readout: With the correction, digits per rung
    expect: { value: 0.60206, tolerance: 0.03 }
    setup:
      params: { experiment: ladder, a: '3' }
  - id: ln10-from-the-ladder
    statement: >-
      2ᵏ(10^(1/2ᵏ) − 1) tends to ln 10 with an error of about (ln 10)²/2ᵏ⁺¹, so the error halves each rung:
      the ratio at the last rung is 2 within 0.001.
    readout: ln 10 from the ladder, error ratio per rung at the last rung
    expect: { value: 2, tolerance: 0.001 }
    setup:
      params: { experiment: ladder, a: '2' }
  - id: ladder-matches-double-precision
    statement: >-
      After 60 rungs the corrected log₁₀ 7, rounded to double precision, equals Math.log10 7 computed in the
      same run within 1e−15.
    readout: log₁₀ a at the last rung minus Math.log10 a, in double precision
    expect: { below: 0.000000000000001 }
    setup:
      params: { experiment: ladder, a: '7' }
---

A square root and a logarithm from nothing but arithmetic, and how fast the digits come.

**Square roots.** Newton's iteration for x² = a is x ← (x + a/x)/2, the Babylonian rule. If x is off by e, the next iterate is off by about e²/2x: the error squares, so the number of correct digits doubles each step once there are a few. The secant method replaces the derivative by the slope through the last two iterates. Its error is about the product of the last two errors, so its digits grow like Fibonacci numbers, by the golden ratio 1.618 a step. Bisection keeps a bracket and halves it, one bit a step: log₁₀ 2 ≈ 0.301 digits.

**Measured, not assumed.** Every number is held exactly as an integer scaled by 10²⁰⁰. Each iterate's correct digits are counted against a reference root from the pencil method, which takes two digits of a·10⁴⁰⁰ at a time. That reference is proved, not trusted: r² ≤ a·10⁴⁰⁰ < (r + 1)² in exact integers. The order is the ratio of correct digits from one iterate to the next, log|eₖ₊₁|/log|eₖ|. It is read where the iterates are past their start and short of the 200 digits carried.

**Logarithms by a ladder.** Feynman builds a table of logarithms by taking square roots of 10 again and again: 10^(1/2), 10^(1/4), 10^(1/8) and so on. To find log₁₀ a, divide a by each rung that fits beneath it and add that rung's exponent 1/2ᵏ. Each rung decides one bit. What is left is 1 + δ with δ small, and log₁₀(1 + δ) ≈ δ/ln 10. The ladder supplies ln 10 too: 2ᵏ(10^(1/2ᵏ) − 1) tends to it, with an error that halves each rung. With that correction the remaining error is of order δ², and the digits come twice as fast. The plate checks the ladder against ln a / ln 10 by the atanh series 2Σy²ʲ⁺¹/(2j + 1), which it never uses, and against Math.log10 in double precision. Brent's methods (the arithmetic–geometric mean, Newton on exp) reach D digits in O(log D) steps; the ladder is the hand method they replace.

**Data.** The plate takes no data of a reader's. Its input is one number, chosen from the select, and its measurements need that number exactly, not a table of samples.
