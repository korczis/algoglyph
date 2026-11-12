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
pedagogy:
  difficulty: intermediate
  objectives:
    - Estimate a standard error from the spread of the means of resamples drawn with replacement.
    - Build the percentile interval and measure what it promises by repeating the whole experiment on fresh samples.
    - Explain why the percentile interval covers less often than its nominal level for small samples from a skewed population, and how the shortfall closes as the sample grows.
algorithm:
  paradigm: randomized
claims:
  - id: skewed-small-sample-under-covers
    statement: >-
      Over 400 repeated experiments, for a sample of 30 from the skewed log-normal population,
      the 90% percentile interval covers the population mean less often than its nominal 90%.
    readout: 90% intervals covering
    expect: { below: 90 }
    setup:
      params: { reps: 400 }
  - id: shortfall-closes-as-the-sample-grows
    statement: >-
      For a sample of 200 from the normal population, the 90% percentile interval covers the
      population mean within three standard errors of 150 experiments (about 7.4 points) of 90%.
    readout: 90% intervals covering
    expect: { value: 90, tolerance: 7.4 }
    setup:
      params: { population: normal, n: 200 }
  - id: large-normal-sample-covers-at-50
    statement: >-
      Shown at the 50% level, for a sample of 200 from the normal population, the percentile
      interval covers the population mean within three binomial standard errors of 150
      experiments, 3 · √(0.5 · 0.5/150) ≈ 12.3 points, of 50%.
    readout: 50% intervals covering
    expect: { value: 50, tolerance: 12.3 }
    setup:
      params: { level: "0.5", population: normal, n: 200 }
  - id: large-normal-sample-covers-at-80
    statement: >-
      Shown at the 80% level, for a sample of 200 from the normal population, the percentile
      interval covers the population mean within three binomial standard errors of 150
      experiments, 3 · √(0.8 · 0.2/150) ≈ 9.8 points, of 80%.
    readout: 80% intervals covering
    expect: { value: 80, tolerance: 9.8 }
    setup:
      params: { level: "0.8", population: normal, n: 200 }
  - id: large-normal-sample-covers-at-95
    statement: >-
      Shown at the 95% level, for a sample of 200 from the normal population, the percentile
      interval covers the population mean within three binomial standard errors of 150
      experiments, 3 · √(0.95 · 0.05/150) ≈ 5.4 points, of 95%.
    readout: 95% intervals covering
    expect: { value: 95, tolerance: 5.4 }
    setup:
      params: { level: "0.95", population: normal, n: 200 }
  - id: mild-skew-population-mean
    statement: >-
      At σ = 0.25 the log-normal population's mean, marked as the truth every interval is judged
      against, is exp(σ²/2) = exp(0.03125) = 1.03174, shown to four decimals (±0.00005).
    readout: Population mean
    expect: { value: 1.0317, tolerance: 0.00005 }
    setup:
      params: { sigma: 0.25 }
  - id: strong-skew-population-mean
    statement: >-
      At σ = 1.5 the log-normal population's mean is exp(σ²/2) = exp(1.125) = 3.08022, shown to
      four decimals (±0.00005).
    readout: Population mean
    expect: { value: 3.0802, tolerance: 0.00005 }
    setup:
      params: { sigma: 1.5 }
---

Resample the data with replacement and read the interval off the resampled statistic.

Every resample draws n points from the sample with replacement and recomputes the mean; the spread of those means estimates the standard error, and the percentile interval keeps their middle 90%, or the middle of whichever measured level is shown. The readout compares the bootstrap standard error with s/√n.

Repeating the whole experiment on fresh samples measures what the interval promises; when large samples and many experiments would make that run too long, each experiment resamples fewer times, and the readout says how many. For small samples from a skewed population the percentile interval covers less often than its nominal level, because the sample under-represents the long tail; the coverage-against-nominal chart shows the shortfall, and it closes as the sample grows.
