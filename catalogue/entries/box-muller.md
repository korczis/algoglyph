---
id: box-muller
title: Box–Muller transform
taxonomy: numerics/random
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - normal distribution
  - sampling
complexity: "two uniforms, one logarithm, one square root and a sine–cosine pair per two normals"
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
claims:
  - id: mean-within-three-se
    statement: >-
      The mean of 12,000 Box–Muller variates is within three standard errors of 0, 3/√12000 =
      0.0274, plus 0.0005 for the three printed decimals, at every seed of the fixed seed set 1–5.
    readout: Mean
    expect: { range: [-0.0279, 0.0279] }
    setup:
      params: { n: 12000 }
      seeds: [1, 2, 3, 4, 5]
  - id: variance-within-three-se
    statement: >-
      The sample variance is within three standard errors of 1, 3√(2/11999) = 0.03873, plus 0.00005
      for the printed decimals, at every seed of the fixed seed set 1–5.
    readout: Variance
    expect: { range: [0.96122, 1.03878] }
    setup:
      params: { n: 12000 }
      seeds: [1, 2, 3, 4, 5]
  - id: pair-product-within-three-se
    statement: >-
      The two values of each pair are uncorrelated: the mean of z1·z2 over 6,000 pairs, standard
      error 1/√6000, is within 3/√6000 = 0.03873 of 0, plus display rounding, at every seed of the
      fixed seed set 1–5.
    readout: Mean of z1·z2 (0 when uncorrelated)
    expect: { range: [-0.03878, 0.03878] }
    setup:
      params: { n: 12000 }
      seeds: [1, 2, 3, 4, 5]
  - id: ks-distance-within-three-sd
    statement: >-
      The Kolmogorov–Smirnov distance to the standard normal is that of a normal sample: √n·D
      follows Kolmogorov's distribution, mean 0.8687 and standard deviation 0.2603, and D stays
      below (0.8687 + 3 · 0.2603)/√12000 = 0.01506, plus display rounding, at every seed of the
      fixed seed set 1–5.
    readout: KS distance D
    expect: { below: 0.01511 }
    setup:
      params: { n: 12000 }
      seeds: [1, 2, 3, 4, 5]
---

Two uniform numbers turned into two independent Gaussians by a rotation and a logarithm.

Each pair of uniforms becomes a radius √(−2 ln u₁) and an angle 2πu₂; the point's two coordinates are independent standard normals because the radius squared of a standard bivariate normal is exponential and its angle uniform. The scatter colours each pair by its angle u₂.

The histogram fills against the N(0, 1) density, and the Kolmogorov–Smirnov distance D between the sample and the normal distribution function is recomputed as it grows: it shrinks like 1/√n and should stay under the 5% critical value 1.36/√n most of the time. The mean of z₁·z₂ checks that the two values of a pair are uncorrelated.
