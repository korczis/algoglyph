---
id: noise-colours
title: White, pink and brown noise
taxonomy: signals/synthesis
status: live
engine: signal
sources:
  - id: practice-signals
tags:
  - noise
  - 1/f
  - filters
complexity: 'O(n) to generate; O(n log M) for the Welch estimate'
motivation: Acoustic measurement and synthesis use it every day.
related:
  - biquad-filters
relations:
  - { type: uses, target: least-squares, reason: "The slopes are fitted by least squares to the Welch-averaged power." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - stft-spectrogram
  objectives:
  - Tell white, pink and brown noise apart by power falling 0, 3 and 6 dB per octave.
  - Make pink noise by the Voss–McCartney algorithm and brown noise by a leaky integrator.
  - Fit the slopes by least squares to Welch-averaged power in third-octave bands.
claims:
  - id: brown-slope-at-the-default-leak
    statement: >-
      At a = 0.998 the brown slope is the AR(1) power 1/(1 − 2a cos ω + a²) averaged over the same
      third-octave bands and fitted the same way, −5.896 dB per octave, within 0.21: five times
      the fit's σ of 0.039 (191 Hann frames at 50 % overlap, frames correlated by (1/6)² and
      neighbouring bins by (2/3)², checked against 300 seeds), plus the window's smoothing bias of
      at most 0.013 and the readout's rounding.
    readout: brown slope (measured)
    expect: { value: -5.896, tolerance: 0.21 }
  - id: brown-slope-at-leak-0-99
    statement: >-
      At a = 0.99 the corner (1 − a)·fs/2π is 12.7 Hz, still below the fit, and the AR(1)
      prediction is −5.865 dB per octave, within the same 0.21.
    readout: brown slope (measured)
    expect: { value: -5.865, tolerance: 0.21 }
    setup:
      params: { leak: 0.99 }
  - id: brown-slope-at-leak-0-95
    statement: >-
      At a = 0.95 the corner climbs to 64 Hz, inside the fit, and the prediction shallows to
      −5.282 dB per octave, within the same 0.21.
    readout: brown slope (measured)
    expect: { value: -5.282, tolerance: 0.21 }
    setup:
      params: { leak: 0.95 }
  - id: brown-slope-at-leak-0-9
    statement: >-
      At a = 0.9 the corner is 127 Hz and the prediction is −4.345 dB per octave, within the same
      0.21: the leak, not the integrator, sets the slope.
    readout: brown slope (measured)
    expect: { value: -4.345, tolerance: 0.21 }
    setup:
      params: { leak: 0.9 }
---

Noise whose power falls by 0, 3 and 6 dB per octave, and the filters that colour it.

White noise has the same power in every hertz, so its spectrum is flat. Pink noise has the same power in every octave, falling by 10·log10 2 ≈ 3 dB per octave; here it is made by the Voss–McCartney algorithm, which sums held random values refreshed at rates an octave apart. Brown noise is integrated white noise and falls by 6 dB per octave; a leaky integrator keeps it bounded. The leak a sets a corner at (1 − a)·fs/2π: below it the spectrum is flat, so lowering a toward 0.9 moves the corner into the fitted bands and the measured slope shallows from the ideal −6 dB per octave.

The slopes are fitted by least squares to the Welch-averaged power in third-octave bands between the two marks, and settle as more frames are averaged. Fewer Voss–McCartney rows cover fewer octaves, and the pink spectrum flattens below the slowest row's rate.
