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
---

Rotate the data onto its axes of greatest variance.

The data matrix is centred, then pairs of its columns are rotated until each pair is orthogonal (Hestenes's one-sided Jacobi method). At convergence the column norms are the singular values, the accumulated rotations are the principal axes, and the columns themselves are the scores.

The left panel shows the cloud on its first two input coordinates with the current axes drawn to two standard deviations; the middle panel shows the data on the two longest rotated columns, decorrelating as the rotations proceed. The chart plots the largest cosine between any two columns, which falls quadratically in the final sweeps.
