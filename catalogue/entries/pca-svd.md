---
id: pca-svd
title: Principal components
taxonomy: numerics/linear-algebra
status: live
engine: numeric
sources:
  - id: practice-decisions
tags:
  - pca
  - svd
  - dimensionality reduction
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'O(m d²) per sweep of the one-sided Jacobi method; a few sweeps converge'
related:
  - least-squares
claims:
  - id: rank-2-error-is-the-discarded-variance
    statement: >-
      Keeping the two leading components loses exactly the variance of the other two
      (Eckart–Young): on the default 260 points in 4 dimensions, ‖X − X₂‖²_F, rebuilt entry by
      entry from the converged factors, is 246.950047, the sum of the two smallest eigenvalues of
      XᵀX found by an independent eigen-decomposition (two-sided Jacobi on the Gram matrix, and
      QR iteration in Python). The tolerance is the display's seven significant digits.
    readout: Rank-2 reconstruction error ‖X − X₂‖²
    expect: { value: 246.950047, tolerance: 5.0e-5 }
    setup:
      params: { dims: 4, points: 260 }
  - id: rank-2-error-at-six-dimensions
    statement: >-
      At the controls' top, 600 points in 6 dimensions, the rank-2 reconstruction error is
      658.951796, the sum of the four smallest eigenvalues of XᵀX from the same independent
      eigen-decompositions, within the display's seven significant digits.
    readout: Rank-2 reconstruction error ‖X − X₂‖²
    expect: { value: 658.951796, tolerance: 5.0e-5 }
    setup:
      params: { dims: 6, points: 600 }
---

Rotate the data onto its axes of greatest variance.

The data matrix is centred, then pairs of its columns are rotated until each pair is orthogonal (Hestenes's one-sided Jacobi method). At convergence the column norms are the singular values, the accumulated rotations are the principal axes, and the columns themselves are the scores.

The left panel shows the cloud on its first two input coordinates with the current axes drawn to two standard deviations; the middle panel shows the data on the two longest rotated columns, decorrelating as the rotations proceed. The chart plots the largest cosine between any two columns, which falls quadratically in the final sweeps.

The readout rebuilds the data from the two leading components alone, X₂ = σ₁u₁v₁ᵀ + σ₂u₂v₂ᵀ, and sums the squared difference from X entry by entry. Beside it is the sum of the discarded σ²: the two agree only if the factors really are a singular value decomposition of X, so the agreement checks the rotations rather than restating them.
