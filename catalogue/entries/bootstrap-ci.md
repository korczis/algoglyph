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
schema: algoglyph.entry/v2
claims:
  - id: skewed-small-sample-under-covers
    statement: >-
      For a sample of 30 from the skewed log-normal population, the 90% percentile interval
      covers the population mean less often than its nominal 90%.
    readout: 90% intervals covering
    expect: { range: [0, 89.9] }
  - id: shortfall-closes-as-the-sample-grows
    statement: >-
      For a sample of 200 from the normal population, the 90% percentile interval covers the
      population mean within three standard errors of 150 experiments (about 7.4 points) of 90%.
    readout: 90% intervals covering
    expect: { value: 90, tolerance: 7.4 }
    setup:
      params: { population: normal, n: 200 }
---

Resample the data with replacement and read the interval off the resampled statistic.

Every resample draws n points from the sample with replacement and recomputes the mean; the spread of those means estimates the standard error, and the percentile interval keeps their middle 90%. The readout compares the bootstrap standard error with s/√n.

Repeating the whole experiment on fresh samples measures what the interval promises; when large samples and many experiments would make that run too long, each experiment resamples fewer times, and the readout says how many. For small samples from a skewed population the percentile interval covers less often than its nominal level, because the sample under-represents the long tail; the coverage-against-nominal chart shows the shortfall, and it closes as the sample grows.
