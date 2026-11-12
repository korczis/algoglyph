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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - fft-butterfly
  objectives:
  - See the carrier and sidebands at fc ± n·fm, the n-th with amplitude |J_n(β)|.
  - See sidebands below zero hertz fold onto positive frequencies with their sign inverted.
  - Compare Carson's rule 2(β + 1)·fm with the measured 99 % bandwidth, and find the carrier vanish near β ≈ 2.405.
bounds:
  model: butterflies
  best: '(N/2) log2 N per spectrum of N = 8192 samples'
  worst: '(N/2) log2 N per spectrum of N = 8192 samples'
claims:
  - id: sidebands-match-the-folded-series
    statement: >-
      One second at 8192 samples per second puts every component on a bin, so the measured
      amplitudes match the folded Bessel series to rounding error, far below 10⁻⁹.
    readout: Largest disagreement with the folded series
    expect: { below: 1.0e-9 }
---

One oscillator modulating another's frequency, its sidebands weighted by Bessel functions.

The output is sin(2π fc t + β sin(2π fm t)): the modulator swings the carrier's frequency by β·fm either side. Its spectrum is the carrier and sidebands at fc ± n·fm, the n-th with amplitude |J_n(β)|, the Bessel function of the first kind; the plate sweeps β upward and plots the measured sidebands as dots on J0 to J3.

One second at 8192 samples per second puts every component exactly on a bin, so the measured amplitudes match the Bessel values computed by their series to rounding error. A high modulator and a large β push sidebands below zero hertz: sampled, sin(−x) is −sin x, so a sideband at −f lands on +f with its sign inverted and adds to or cancels the sideband already there, and one landing exactly on zero hertz is sin 0 at every sample and vanishes. The plate folds the series the same way, every term J_m(β) added into the bin it lands in, and the largest disagreement it reports is against that folded prediction. At β ≈ 2.405 the carrier vanishes (the first zero of J0); Carson's rule 2(β + 1)·fm predicts the bandwidth that holds about 98 % of the power, shown next to the measured 99 % bandwidth.
