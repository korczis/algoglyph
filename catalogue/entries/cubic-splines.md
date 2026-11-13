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
---

Piecewise cubics joined with matching slope and curvature, without the wiggles.

The second derivatives at the interior knots satisfy a tridiagonal system, solved by one forward elimination and one back substitution; the natural spline sets them to zero at both ends. Each interval then gets its own cubic, drawn here in alternating tones.

The right panel shows the second derivative, piecewise linear and continuous across every knot; the readout measures the largest jump in slope between neighbouring cubics. Where one polynomial through equally spaced knots diverges on the Runge function, the spline's error keeps falling, as the chart shows.
