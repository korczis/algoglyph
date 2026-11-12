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
data:
  - id: points
    title: Your points
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: '1', min: -1.0e12, max: 1.0e12 }
      - { key: y, unit: '1', min: -1.0e12, max: 1.0e12 }
    rows: { min: 6, max: 160 }
    bytes: 16384
    replaces: target
    ignores: [samples, noise]
    url_bytes: 1800
    note: x is mapped onto [−1, 1]; a seeded half of the points is fitted and the other half held out, so the best held-out degree is measured on your data.
---

The curve that minimises the sum of squared vertical distances.

Polynomials of rising degree are fitted to noisy samples by Householder reflections, which triangularise the design matrix without forming the normal equations and so keep their conditioning. The readout max |Xᵀr| checks the result: at the minimum the residual is orthogonal to every column.

The training error can only fall as the degree rises. The held-out samples, drawn from the same function and noise but never fitted, show the price: past some degree the curve follows the noise and their error turns back up. The best held-out degree is measured, not chosen.

Your own points can replace the function: x is mapped linearly onto [−1, 1], a seeded half of the points trains the fits and the other half is held out, so the same curves of training and held-out error are measured on data whose truth nobody knows.
