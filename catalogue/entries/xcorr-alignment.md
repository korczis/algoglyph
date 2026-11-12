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
---

The lag between two captures, to a fraction of a sample, by correlating them.

Two noisy captures of the same band-limited burst, the second later by a delay that is not a whole number of samples. The cross-correlation r[l] = Σ a[n]·b[n + l] is built lag by lag as b slides over a, and it peaks at the lag closest to the delay.

The correlation of band-limited signals is itself band-limited, so its samples determine it between them: interpolating with sinc(τ − l) and searching that curve finds the delay to a small fraction of a sample. A parabola through the three highest samples is the cheap estimate, and it is biased toward the nearest integer.
