---
id: bootstrap-ci
title: Bootstrap confidence intervals
taxonomy: inference/uncertainty
status: live
engine: stochastic
labs:
  - uncertainty
sources:
  - id: practice-systems
tags:
  - bootstrap
  - resampling
  - confidence
complexity: "B n draws for B resamples of n points"
related:
  - conformal-intervals
motivation: Coordinating many workers and machines without a shared clock depends on it.
---

Resample the data with replacement and read the interval off the resampled statistic.

Every resample draws n points from the sample with replacement and recomputes the mean; the spread of those means estimates the standard error, and the percentile interval keeps their middle 90%. The readout compares the bootstrap standard error with s/√n.

Repeating the whole experiment on fresh samples measures what the interval promises; when large samples and many experiments would make that run too long, each experiment resamples fewer times, and the readout says how many. For small samples from a skewed population the percentile interval covers less often than its nominal level, because the sample under-represents the long tail; the coverage-against-nominal chart shows the shortfall, and it closes as the sample grows.
