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
---

Areas under a curve from trapezoids and parabolas, and how fast their error falls.

Each step doubles the number of panels. The left panel fills the area with trapezoids, the right with one parabola through every three nodes; the chart plots the error against the closed-form integral for both rules, against the evaluations each one spent.

On a smooth integrand the measured slopes approach −2 and −4: halving the panel width cuts the trapezoid error by four and Simpson's by sixteen. The square root on [0, 1] breaks both rates, because its derivative is unbounded at zero; the sharp peak shows how many uniform panels a narrow feature costs.
