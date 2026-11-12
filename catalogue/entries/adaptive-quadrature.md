---
id: adaptive-quadrature
title: Adaptive quadrature
taxonomy: numerics/integration
status: live
engine: numeric
labs:
  - quadrature
sources:
  - id: sedgewick-aic-1990
    ref: Mathematical Algorithms
tags:
  - integration
  - adaptive
  - recursion
complexity: 'evaluations grow where the integrand is hard, not with the length of the interval'
related:
  - simpson-quadrature
---

Split only where the estimate is not yet good enough.

An interval is estimated by Simpson's rule once over the whole and once over its two halves. When the two agree within fifteen times the interval's share of the tolerance (Lyness's criterion), the finer estimate plus a Richardson correction is accepted; otherwise both halves are examined with half the tolerance each.

Each parent hands its three function values down, so every node is evaluated exactly once: three to start, then two per interval examined. The depth panel shows the splitting crowd around the peak and the square root's corner, and the chart compares the error reached against uniform Simpson panels for the same number of evaluations.
