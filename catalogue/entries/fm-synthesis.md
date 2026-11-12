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
  - id: folded-above-nyquist-at-3500-hz
    statement: >-
      With the carrier at 3500 Hz the sidebands from order 5 up (3500 + 5·125 = 4125 Hz) lie above
      the 4096 Hz Nyquist frequency and fold back; every setting is a whole number of hertz, so
      every component, folded or not, still lands on a bin and the measurement matches the folded
      series to rounding, the same 10⁻⁹ as at the default.
    readout: Largest disagreement with the folded series
    expect: { below: 1.0e-9 }
    setup:
      params: { fc: 3500 }
  - id: folded-below-zero-at-500-hz
    statement: >-
      With the carrier at 500 Hz the sidebands from order −5 down (500 − 5·125 = −125 Hz) fold
      inverted onto the lower ones and partly cancel them; each component still lands on a bin, so
      the measurement matches the folded series to rounding, below 10⁻⁹.
    readout: Largest disagreement with the folded series
    expect: { below: 1.0e-9 }
    setup:
      params: { fc: 500 }
  - id: ninety-nine-percent-band-at-3000-hz
    statement: >-
      Each sideband holds the power J_n(β)², and Σ J_n(5)² over |n| ≤ 5 is 0.959 while over |n| ≤ 6
      it is 0.994, so at β = 5 and 125 Hz the 99 % band ends exactly at the sixth sideband, 2·6·125
      = 1500 Hz, read to the hertz: at 3000 Hz that band (2250 to 3750 Hz) lies below the Nyquist
      frequency, and only orders 12 and up fold into it (5192 − 125·n Hz), each below 10⁻⁴ in
      amplitude, power far below the 0.994 − 0.99 margin.
    readout: 99 % power bandwidth (measured)
    expect: { value: 1500 }
    setup:
      params: { fc: 3000 }
---

One oscillator modulating another's frequency, its sidebands weighted by Bessel functions.

The output is sin(2π fc t + β sin(2π fm t)): the modulator swings the carrier's frequency by β·fm either side. Its spectrum is the carrier and sidebands at fc ± n·fm, the n-th with amplitude |J_n(β)|, the Bessel function of the first kind; the plate sweeps β upward and plots the measured sidebands as dots on J0 to J3.

One second at 8192 samples per second puts every component exactly on a bin, wherever the carrier control puts it, so the measured amplitudes match the Bessel values computed by their series to rounding error. A high modulator and a large β push sidebands below zero hertz: sampled, sin(−x) is −sin x, so a sideband at −f lands on +f with its sign inverted and adds to or cancels the sideband already there, and one landing exactly on zero hertz is sin 0 at every sample and vanishes. The plate folds the series the same way, every term J_m(β) added into the bin it lands in, and the largest disagreement it reports is against that folded prediction. At β ≈ 2.405 the carrier vanishes (the first zero of J0); Carson's rule 2(β + 1)·fm predicts the bandwidth that holds about 98 % of the power, shown next to the measured 99 % bandwidth.
