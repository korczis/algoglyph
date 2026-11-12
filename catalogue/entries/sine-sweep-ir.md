---
id: sine-sweep-ir
title: Sine sweep and impulse response
taxonomy: signals/measurement
status: live
engine: signal
sources:
  - id: practice-signals
tags:
  - impulse response
  - deconvolution
  - sweep
complexity: 'O(n log n) by FFT convolution'
motivation: Acoustic measurement and synthesis use it every day.
related:
  - xcorr-alignment
  - biquad-filters
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
  - Convolve an exponential sweep with its inverse filter and see it collapse into a band-limited impulse.
  - Deconvolve the recording of the sweep into the impulse response of the room it passed through.
  - See the k-th order distortion arrive L·ln k earlier and separate from the linear response.
claims:
  - id: direct-path-at-its-delay
    statement: >-
      The deconvolved response is a band-limited impulse at each path, so the direct path's peak
      lies at its true delay, to the sample.
    readout: 'Direct path: measured vs true delay'
    expect: { against: 'Direct path: measured vs true delay', against_number: 2, tolerance: 0 }
  - id: second-harmonic-arrives-l-ln-2-early
    statement: >-
      The second-order distortion arrives earlier by L·ln 2, to one sample (0.125 ms at 8 kHz)
      plus the readout's 0.1 ms rounding.
    readout: '2nd-harmonic response: measured vs L·ln 2'
    expect: { against: '2nd-harmonic response: measured vs L·ln 2', against_number: 2, tolerance: 0.25 }
  - id: direct-path-at-its-delay-1-s
    statement: The same holds for a 1 s sweep, to the sample.
    readout: 'Direct path: measured vs true delay'
    expect: { against: 'Direct path: measured vs true delay', against_number: 2, tolerance: 0 }
    setup:
      params: { sweepT: '1' }
  - id: direct-path-at-its-delay-half-second
    statement: The same holds for a 0.5 s sweep, to the sample.
    readout: 'Direct path: measured vs true delay'
    expect: { against: 'Direct path: measured vs true delay', against_number: 2, tolerance: 0 }
    setup:
      params: { sweepT: '0.5' }
  - id: second-harmonic-lead-1-s
    statement: >-
      A 1 s sweep from 20 Hz to 3.9 kHz has L = 1/ln 195 s, so the second-order response leads by
      L·ln 2 = 131.45 ms, to one sample (0.125 ms) plus the readout's 0.1 ms rounding.
    readout: '2nd-harmonic response: measured vs L·ln 2'
    expect: { value: 131.45, tolerance: 0.25 }
    setup:
      params: { sweepT: '1' }
  - id: second-harmonic-lead-half-second
    statement: >-
      A 0.5 s sweep has L = 0.5/ln 195 s and the lead halves again to L·ln 2 = 65.73 ms, to one
      sample plus the readout's rounding.
    readout: '2nd-harmonic response: measured vs L·ln 2'
    expect: { value: 65.73, tolerance: 0.25 }
    setup:
      params: { sweepT: '0.5' }
---

An exponential sweep through a system, deconvolved into its impulse response.

An exponential sweep spends equal time in every octave. Convolved with its inverse filter, the sweep reversed in time and attenuated by 6 dB per octave as it descends, it collapses into a band-limited impulse; convolving a recording of the sweep with the same filter turns it into the impulse response of whatever it passed through, here a seeded room of a direct path and reflections.

Harmonic distortion of the k-th order arrives earlier by L·ln k, where L = T/ln(f2/f1) is the sweep's time per e-fold of frequency (a shorter sweep of length T brings it closer), so the distortion's own responses separate from the linear one in time and can be cut away. The readouts compare the recovered delay, reflection ratios and magnitude response with the room that was used.
