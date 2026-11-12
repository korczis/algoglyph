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
---

Piecewise cubics joined with matching slope and curvature, without the wiggles.

The second derivatives at the interior knots satisfy a tridiagonal system, solved by one forward elimination and one back substitution; the natural spline sets them to zero at both ends. Each interval then gets its own cubic, drawn here in alternating tones.

The right panel shows the second derivative, piecewise linear and continuous across every knot; the readout measures the largest jump in slope between neighbouring cubics. Where one polynomial through equally spaced knots diverges on the Runge function, the spline's error keeps falling, as the chart shows.
