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
related:
  - cubic-splines
  - least-squares
---

The polynomial through n points, and how it oscillates between equally spaced ones.

The interpolant is built in Newton's form from a table of divided differences and evaluated by nesting, the way Horner's rule evaluates a power series. Each step adds one node and redraws the polynomial through all of them.

With equally spaced nodes the Runge function's interpolant swings ever wider near the ends as n grows: the error curve on the right shows where. Chebyshev nodes, crowded towards the ends, make the same error fall steadily; the chart measures both against the function on a fine grid.
