---
id: polynomial-interpolation
title: Polynomial interpolation
taxonomy: numerics/fitting
status: live
engine: numeric
labs:
  - interpolation
sources:
  - id: sedgewick-aic-1990
    ref: Mathematical Algorithms
tags:
  - interpolation
  - lagrange
  - runge
complexity: 'O(n²) for the divided differences, O(n) per evaluation'
claims:
  - id: runge-equal-spacing-diverges
    statement: >-
      One polynomial through 25 equally spaced nodes of Runge's 1/(1 + 25x²) swings far off near
      the ends: its largest error on the 801-point grid of [−1, 1] is 257.21, from an independent
      barycentric Lagrange evaluation in exact rational arithmetic. The tolerance is the readout's
      display rounding to four significant digits.
    readout: Max error on [-1, 1]
    expect: { value: 257.213, tolerance: 0.05 }
    setup:
      params: { target: runge, spacing: equal }
  - id: runge-chebyshev-nodes-converge
    statement: >-
      Through 25 Chebyshev nodes of the first kind, cos((2k + 1)π/50), the same function is
      matched within 0.0069481 on the same grid, by an independent barycentric evaluation: the error
      falls at the rate ρ⁻ⁿ set by the function's poles at ±i/5, ρ = (1 + √26)/5, and ρ⁻²⁵ =
      0.00696. The tolerance is the display rounding.
    readout: Max error on [-1, 1]
    expect: { value: 0.0069481, tolerance: 5.0e-7 }
    setup:
      params: { target: runge, spacing: chebyshev }
---

The polynomial through n points, and how it oscillates between equally spaced ones.

The interpolant is built in Newton's form from a table of divided differences and evaluated by nesting, the way Horner's rule evaluates a power series. Each step adds one node and redraws the polynomial through all of them.

With equally spaced nodes the Runge function's interpolant swings ever wider near the ends as n grows: the error curve on the right shows where. Chebyshev nodes, crowded towards the ends, make the same error fall steadily; the chart measures both against the function on a fine grid.
