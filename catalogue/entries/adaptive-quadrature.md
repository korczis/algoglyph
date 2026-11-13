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
claims:
  - id: peak-within-the-asked-tolerance
    statement: >-
      On 1/(x² + 0.01) over [−1, 1] at tolerance 10⁻⁶ the final estimate is within the tolerance
      asked of the closed form 20 · atan 10 = 29.4225534861.
    readout: Final estimate
    expect: { value: 29.4225534861, tolerance: 1.0e-6 }
    setup:
      params: { integrand: peak, tol: 6 }
  - id: sqrt-corner-takes-105-evaluations
    statement: >-
      Where the error concentrates, adaptivity pays: on √x over [0, 1] at tolerance 10⁻⁶ the
      splitting crowds into the corner at 0 and the run takes exactly 105 evaluations (3 + 2 per
      interval examined), recomputed by an independent adaptive Simpson with the same criterion.
      Uniform composite Simpson needs 1,877 evaluations to reach 10⁻⁶ there, a figure computed off
      the plate.
    readout: Evaluations
    expect: { value: 105 }
    setup:
      params: { integrand: sqrt, tol: 6 }
  - id: smooth-peak-takes-441-evaluations
    statement: >-
      On the smooth peak the same tolerance costs exactly 441 evaluations, recomputed
      independently, more than the 109 that uniform Simpson needs for 10⁻⁶ (computed off the
      plate): the halving tolerance and the Richardson correction deliver an error of about
      4.2e−10, some 2,400 times below what was asked.
    readout: Evaluations
    expect: { value: 441 }
    setup:
      params: { integrand: peak, tol: 6 }
---

Split only where the estimate is not yet good enough.

An interval is estimated by Simpson's rule once over the whole and once over its two halves. When the two agree within fifteen times the interval's share of the tolerance (Lyness's criterion), the finer estimate plus a Richardson correction is accepted; otherwise both halves are examined with half the tolerance each.

Each parent hands its three function values down, so every node is evaluated exactly once: three to start, then two per interval examined. The depth panel shows the splitting crowd around the peak and the square root's corner, and the chart compares the error reached against uniform Simpson panels for the same number of evaluations.

Adaptivity pays where the error concentrates. On √x, whose derivatives blow up at 0, the splitting crowds into that corner and reaches the tolerance 10⁻⁶ with 105 evaluations, where uniform Simpson needs 1,877 evaluations to get within 10⁻⁶. On the smooth peak it does not pay: at the same tolerance the halving at every split and the Richardson correction over-deliver, ending about 2,400 times below what was asked (an error of 4.2 · 10⁻¹⁰), and the run spends 441 evaluations where uniform Simpson reaches 10⁻⁶ with 109. The tolerance is a request, not a budget; an adaptive rule earns its bookkeeping on an integrand that is hard in a small part of the interval.
