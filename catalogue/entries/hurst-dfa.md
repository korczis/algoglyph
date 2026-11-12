---
id: hurst-dfa
title: Hurst exponent and detrended fluctuation
taxonomy: dynamics/time-series
status: live
engine: numeric
sources:
  - id: practice-decisions
tags:
  - hurst
  - dfa
  - long memory
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'O(N) per window size, O(N log N) over the logarithmic set of sizes'
related:
  - recurrence-plot
---

Whether a series' trends persist or reverse, from how its fluctuations scale.

The profile is the cumulative sum of the series minus its mean. It is cut into boxes of n samples, each box's least-squares line is removed, and F(n) is the RMS of what remains; the slope of log F against log n is α. White noise gives ½, persistent noise more, anti-persistent noise less, and a random walk 1.5.

The fractional Gaussian noise is generated exactly by Hosking's recursion from its autocovariance, with the chosen Hurst exponent H, so the plate has a planted answer. The rescaled range R/S, measured on the same windows, is the older estimate of H and is known to be biased on short series.
