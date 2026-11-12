---
id: xcorr-alignment
title: Alignment by cross-correlation
taxonomy: signals/measurement
status: live
engine: signal
sources:
  - id: practice-signals
tags:
  - cross-correlation
  - alignment
  - sinc
complexity: 'O(N · L) for L lags, directly; O(N log N) by FFT'
motivation: Acoustic measurement and synthesis use it every day.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Build the cross-correlation lag by lag and find its peak at the lag closest to the delay.
  - Interpolate the band-limited correlation with sinc and search it for the delay between samples.
  - Compare with a parabola through the three highest samples, the cheap estimate.
  misconceptions:
  - The parabola is not unbiased; it pulls the estimate toward the nearest integer lag.
bounds:
  model: real multiplies of the direct correlation
  worst: 'N − |l| for lag l, (2L + 1)N − L(L + 1) for lags −L to L: O(N · L)'
claims:
  - id: integer-peak-at-the-nearest-lag
    statement: >-
      The correlation peaks at the lag closest to the delay, so the integer peak is within half
      a sample of the true delay.
    readout: Integer peak
    expect: { against: True delay, tolerance: 0.5 }
  - id: sinc-finds-a-fraction-of-a-sample
    statement: >-
      Searching the sinc-interpolated correlation finds the delay to a small fraction of a
      sample, within a tenth of one.
    readout: Sinc-interpolated estimate
    expect: { against: True delay, tolerance: 0.1 }
---

The lag between two captures, to a fraction of a sample, by correlating them.

Two noisy captures of the same band-limited burst, the second later by a delay that is not a whole number of samples. The cross-correlation r[l] = Σ a[n]·b[n + l] is built lag by lag as b slides over a, and it peaks at the lag closest to the delay.

The correlation of band-limited signals is itself band-limited, so its samples determine it between them: interpolating with sinc(τ − l) and searching that curve finds the delay to a small fraction of a sample. A parabola through the three highest samples is the cheap estimate, and it is biased toward the nearest integer.
