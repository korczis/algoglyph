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
---

Two uniform numbers turned into two independent Gaussians by a rotation and a logarithm.

Each pair of uniforms becomes a radius √(−2 ln u₁) and an angle 2πu₂; the point's two coordinates are independent standard normals because the radius squared of a standard bivariate normal is exponential and its angle uniform. The scatter colours each pair by its angle u₂.

The histogram fills against the N(0, 1) density, and the Kolmogorov–Smirnov distance D between the sample and the normal distribution function is recomputed as it grows: it shrinks like 1/√n and should stay under the 5% critical value 1.36/√n most of the time. The mean of z₁·z₂ checks that the two values of a pair are uncorrelated.
