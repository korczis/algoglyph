---
id: fm-synthesis
title: FM synthesis and Bessel sidebands
taxonomy: signals/synthesis
status: live
engine: signal
sources:
  - id: practice-signals
tags:
  - fm
  - bessel
  - operators
complexity: 'O(N log N) per spectrum'
motivation: Acoustic measurement and synthesis use it every day.
---

One oscillator modulating another's frequency, its sidebands weighted by Bessel functions.

The output is sin(2π fc t + β sin(2π fm t)): the modulator swings the carrier's frequency by β·fm either side. Its spectrum is the carrier and sidebands at fc ± n·fm, the n-th with amplitude |J_n(β)|, the Bessel function of the first kind; the plate sweeps β upward and plots the measured sidebands as dots on J0 to J3.

One second at 8192 samples per second puts every component exactly on a bin, so the measured amplitudes match the Bessel values computed by their series to rounding error, until a high modulator and a large β push sidebands below zero hertz, where they fold back onto the positive ones. At β ≈ 2.405 the carrier vanishes (the first zero of J0); Carson's rule 2(β + 1)·fm predicts the bandwidth that holds about 98 % of the power, shown next to the measured 99 % bandwidth.
