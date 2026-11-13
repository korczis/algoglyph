---
id: cubic-splines
title: Cubic splines
taxonomy: numerics/fitting
status: live
engine: numeric
labs:
  - interpolation
sources:
  - id: sedgewick-aic-1990
    ref: Mathematical Algorithms
tags:
  - splines
  - interpolation
complexity: 'O(n) to build (one tridiagonal solve), O(log n) per evaluation'
related:
  - polynomial-interpolation
claims:
  - id: runge-natural-spline-error
    statement: >-
      The natural cubic spline through 25 equally spaced knots of Runge's 1/(1 + 25x²) stays within
      0.0019257 of it on the 801-point grid of [−1, 1], where one polynomial through the same knots
      is off by 257. The oracle is the same spline solved independently, as a dense system in
      exact rational arithmetic; the tolerance is the readout's display rounding.
    readout: Max error on [-1, 1]
    expect: { value: 0.0019257, tolerance: 5.0e-7 }
    setup:
      params: { target: runge }
  - id: natural-ends-cap-the-order-at-two
    statement: >-
      A cubic spline converges as h⁴ only when its end conditions are right; the natural ends set
      s″ = 0 where sin 3x has f″(±1) = ∓9 sin 3 ≠ 0, so the error near the ends falls as h² and
      limits the whole. Fitted by least squares over the last halving of h (13 to 25 knots), the
      measured order is 2.0635, about 2 and not 4, recomputed from a spline solved independently in
      exact rational arithmetic. It sits 0.06 above 2, fourteen times the fit's standard error of
      0.0044: that spread measures scatter about the line, not the approach to the limit. The
      tolerance is the display's four significant digits.
    readout: Measured order, last halving of h
    expect: { value: 2.063527, tolerance: 5.0e-4 }
    setup:
      params: { target: sine }
---

Piecewise cubics joined with matching slope and curvature, without the wiggles.

The second derivatives at the interior knots satisfy a tridiagonal system, solved by one forward elimination and one back substitution; the natural spline sets them to zero at both ends. Each interval then gets its own cubic, drawn here in alternating tones.

The right panel shows the second derivative, piecewise linear and continuous across every knot; the readout measures the largest jump in slope between neighbouring cubics. Where one polynomial through equally spaced knots diverges on the Runge function, the spline's error keeps falling, as the chart shows.

The order readout fits error ≈ C·h^p to the chart's errors over the last halving of h, with the slope's standard error. On sin 3x it reads about 2, because the natural ends force a zero curvature the function does not have. On the Runge function the same fit reads 2.2 ± 1.2 and means little: at up to 25 knots the largest error sits in the interior, near the function's poles at ±i/5, and it alternates between odd and even knot counts, because x = 0 is a knot only when the count is odd. The h² error from the ends overtakes it only beyond about a hundred knots.
