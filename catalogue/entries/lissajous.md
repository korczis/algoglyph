---
id: lissajous
title: Lissajous figures and phase
taxonomy: dynamics/synchrony
status: live
engine: signal
sources:
  - id: practice-signals
tags:
  - phase
  - lissajous
  - oscilloscope
complexity: 'O(N log N) to read ratio and phase back'
motivation: Acoustic measurement and synthesis use it every day.
relations:
  - type: uses
    target: fft-butterfly
    reason: Each channel's frequency and phase are read from its spectrum, computed by the radix-2 FFT.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Draw x = sin(a·ωt + δ) against y = sin(b·ωt) and see a closed figure when a/b is rational, touching the vertical sides a times and the horizontal sides b times.
    - Read |sin δ| where an equal-frequency ellipse crosses x = 0.
    - Read the ratio and the phase back from the samples, each channel's frequency as its spectrum's peak bin and δ as the phase of x at its bin less a/b times the phase of y at its bin.
    - See a steady drift of δ make the figure appear to turn, as two slightly mistuned oscillators do.
algorithm:
  paradigm: transform
  properties:
    deterministic: true
bounds:
  model: butterflies and real multiplies, per view of N = 1024 samples a channel
  best: '2 · (N/2) log2 N butterflies and 2 · (2N log2 N + N) real multiplies: two transforms and their magnitudes'
  worst: '2 · (N/2) log2 N butterflies and 2 · (2N log2 N + N) real multiplies: two transforms and their magnitudes'
claims:
  - id: ratio-read-is-set
    statement: >-
      Integer frequencies over one full period of N = 1024 samples fall on exact bins, so each
      channel's spectrum peaks at its own frequency with no leakage: the ratio read back is the
      ratio set, 3 : 2.
    readout: Ratio read from the spectra
    expect: { against: Ratio set, tolerance: 0 }
  - id: ratio-read-is-set-at-7-5
    statement: >-
      The same holds at any integer pair: at a 7, b 5 the peaks are bins 7 and 5, and the ratio
      read is the ratio set, 7 : 5.
    readout: Ratio read from the spectra
    expect: { against: Ratio set, tolerance: 0 }
    setup:
      params: { a: 7, b: 5 }
  - id: phase-read-is-set
    statement: >-
      On exact bins the phase of each peak is the sinusoid's own, so δ read back is δ set to
      rounding (about 1e-12°); the readout prints both to two decimals, so they agree within
      0.01°.
    readout: 'Phase δ now: set vs read'
    expect: { against: 'Phase δ now: set vs read', against_number: 2, tolerance: 0.01 }
  - id: ellipse-reading
    statement: >-
      With a = b = 3 the figure is an ellipse and y is interpolated linearly where x crosses 0:
      with the phase step h = 2π·3/1024 the error is at most h²/8 + h³/8 = 4.3e-5, and the two
      printed numbers' rounding adds 1e-4, so the reading is within 2e-4 of |sin δ| (checked over
      every whole degree in test/lissajous-claims.test.ts).
    readout: Ellipse reading |sin δ| at x = 0
    expect: { against: Ellipse reading |sin δ| at x = 0, against_number: 2, tolerance: 0.0002 }
    setup:
      params: { a: 3, b: 3 }
  - id: phase-under-noise
    statement: >-
      Noise of sd σ = 0.2 on each of N samples puts a Gaussian of sd σ√(N/2) per component in each
      bin against the peak's N/2, so each channel's phase has sd σ√(2/N) and δ = φx − (3/2)φy
      has sd σ√(2/N)·√(1 + 9/4) = 0.913° (0.899° measured on seeds 1 … 2000, disjoint from the
      claim's); 4°, over four of them plus the rounding, bounds the error.
    readout: 'Phase δ now: set vs read'
    expect: { against: 'Phase δ now: set vs read', against_number: 2, tolerance: 4 }
    setup:
      params: { noise: 0.2 }
  - id: butterflies-counted
    statement: >-
      Each of the 90 views transforms both channels of N = 1024 samples, (N/2) log2 N = 5,120
      butterflies each: exactly 90 · 2 · 5,120 = 921,600 butterflies.
    readout: Butterflies
    expect: { value: 921600 }
  - id: multiplies-counted
    statement: >-
      Each transform takes 2N real multiplies per stage over log2 N = 10 stages and its magnitudes
      N more, 21,504 a channel: exactly 90 · 2 · 21,504 = 3,870,720 real multiplies.
    readout: Real multiplies
    expect: { value: 3870720 }
---

Two sinusoids on two axes: the figure reads their frequency ratio and phase.

On an oscilloscope in X–Y mode, x = sin(a·ωt + δ) against y = sin(b·ωt) draws a closed figure when a/b is rational; the figure touches the vertical sides a times and the horizontal sides b times. With equal frequencies it is an ellipse, and where it crosses x = 0, |y| reads |sin δ|.

The plate reads the ratio and the phase back from the samples: each channel's frequency is its spectrum's peak bin, and δ is the phase of x at its bin less a/b times the phase of y at its bin. A steady drift of δ makes the figure appear to turn, as two slightly mistuned oscillators do.
