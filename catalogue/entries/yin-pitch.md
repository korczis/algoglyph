---
id: yin-pitch
title: YIN pitch detection
taxonomy: signals/measurement
status: live
engine: signal
sources:
  - id: practice-signals
tags:
  - pitch
  - autocorrelation
  - yin
complexity: 'O(W · τmax) per frame'
motivation: Acoustic measurement and synthesis use it every day.
related:
  - xcorr-alignment
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Compute the difference function d(τ) over a frame and normalise it by its own running mean.
  - Take the first dip below the threshold, followed to its local minimum, and refine it with a parabola.
  - See why the first dip keeps YIN off sub-harmonics, and how a strong second harmonic still reads an octave high.
  misconceptions:
  - The first-dip rule guards only against octave-low errors; a strong second harmonic still gives an octave-high one.
bounds:
  model: real multiplies per frame
  worst: 'W·τmax for the difference function over a frame of W samples, and 2τmax for its normalisation'
claims:
  - id: multiplies-at-w-512
    statement: >-
      Counted from the code: 1.5 s at 16 kHz is 24,000 samples, frames of W + τmax samples at hop
      256 fit ⌊(24000 − W − 400)/256⌋ + 1 = 91 times for W = 512, and each costs W·τmax + 2τmax =
      205,600 multiplies: 18,709,600 in all, exactly.
    readout: Real multiplies
    expect: { value: 18709600 }
  - id: multiplies-at-w-384
    statement: >-
      At W = 384 the frames still number 91, at 154,400 multiplies each: 14,050,400, exactly.
    readout: Real multiplies
    expect: { value: 14050400 }
    setup:
      params: { w: '384' }
  - id: frames-at-w-256
    statement: At W = 256 one more frame fits, ⌊23344/256⌋ + 1 = 92, exactly.
    readout: Frames
    expect: { value: 92 }
    setup:
      params: { w: '256' }
  - id: multiplies-at-w-256
    statement: The 92 frames at W = 256 cost 103,200 multiplies each, 9,494,400 in all, exactly.
    readout: Real multiplies
    expect: { value: 9494400 }
    setup:
      params: { w: '256' }
---

A difference function with cumulative normalisation that finds the fundamental period.

YIN computes the difference function d(τ) = Σ (x[j] − x[j + τ])² over a frame, which dips at multiples of the period, and divides it by its own running mean: d'(τ) starts at 1 and its dips are comparable across signals. The first dip below the threshold, followed down to its local minimum, is the period; a parabola through its neighbours gives the period between samples.

The difference function dips at every multiple of the period, and in noise the deepest of those dips is as often the second or third as the first; taking the first dip below the threshold is what keeps YIN off those sub-harmonics, the errors of an octave or more too low. It does not guard the other direction: when the second harmonic is much stronger than the fundamental, d'(τ) already dips below the threshold at half the period and the reading is an octave too high. The tone here glides and has vibrato, and the pitch control is bounded so that the lowest pitch it can reach stays above the longest period the detector searches; the detected pitch is compared with the true fundamental frame by frame, in cents. Raise the threshold or lower the SNR to provoke gross errors.
