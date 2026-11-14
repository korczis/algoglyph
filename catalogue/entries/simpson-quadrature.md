---
id: simpson-quadrature
title: Trapezoid and Simpson quadrature
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
  - quadrature
complexity: 'n + 1 evaluations; error O(h²) for trapezoids, O(h⁴) for Simpson on smooth integrands'
claims:
  - id: simpson-is-exact-for-cubics
    statement: >-
      A parabola through three nodes integrates every cubic exactly, so on x³ − 3x² + 2x + 1 over
      [0, 3] Simpson's error on 1,024 panels is zero to floating point: below 5.97e−13, the
      rounding bound (n + 1)·u·∫|f| for a sum of n + 1 = 1,025 terms with u = 2⁻⁵³ and
      ∫|f| = 5.25. The trapezoids on the same nodes are still off by order h².
    readout: Simpson error
    expect: { below: 5.97e-13 }
    setup:
      params: { integrand: cubic }
  - id: simpson-error-on-sine-is-h4-over-90
    statement: >-
      On sin x over [0, π] at 1,024 panels Simpson's error is the h⁴ estimate
      h⁴ (f‴(π) − f‴(0)) / 180 = h⁴/90 = 9.8437e−13 with h = π/1,024; the same sum in 50-digit
      decimal arithmetic gives 9.8437e−13 too, so the estimate's own h⁶ term is a millionth of it.
      The tolerance is a conservative rounding bound, the worst case for the plate's sum of 1,025
      terms, (n + 1)·u·∫|f| = 2.28e−13; it is not the error scale: the reading differs from the
      estimate by 1.6e−15.
    readout: Simpson error
    expect: { value: 9.8437e-13, tolerance: 2.28e-13 }
    setup:
      params: { integrand: sine }
---

Areas under a curve from trapezoids and parabolas, and how fast their error falls.

Each step doubles the number of panels. The left panel fills the area with trapezoids, the right with one parabola through every three nodes; the chart plots the error against the closed-form integral for both rules, against the evaluations each one spent.

On a smooth integrand the measured slopes approach −2 and −4: halving the panel width cuts the trapezoid error by four and Simpson's by sixteen. The square root on [0, 1] breaks both rates, because its derivative is unbounded at zero; the sharp peak shows how many uniform panels a narrow feature costs. On the cubic, Simpson's error is zero at every size, up to rounding, while the trapezoids' still falls as h².
