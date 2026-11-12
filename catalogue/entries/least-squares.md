---
id: least-squares
title: Least squares
taxonomy: numerics/fitting
status: live
engine: numeric
sources:
  - id: sedgewick-aic-1990
    ref: Mathematical Algorithms
tags:
  - regression
  - least squares
complexity: 'O(m n²) for m samples and n coefficients by Householder QR'
related:
  - polynomial-interpolation
  - gaussian-elimination
---

The curve that minimises the sum of squared vertical distances.

Polynomials of rising degree are fitted to noisy samples by Householder reflections, which triangularise the design matrix without forming the normal equations and so keep their conditioning. The readout max |Xᵀr| checks the result: at the minimum the residual is orthogonal to every column.

The training error can only fall as the degree rises. The held-out samples, drawn from the same function and noise but never fitted, show the price: past some degree the curve follows the noise and their error turns back up. The best held-out degree is measured, not chosen.
