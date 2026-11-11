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
---

A difference function with cumulative normalisation that finds the fundamental period.

YIN computes the difference function d(τ) = Σ (x[j] − x[j + τ])² over a frame, which dips at multiples of the period, and divides it by its own running mean: d'(τ) starts at 1 and its dips are comparable across signals. The first dip below the threshold, followed down to its local minimum, is the period; a parabola through its neighbours gives the period between samples.

Taking the first dip rather than the deepest one is what avoids octave errors on tones whose harmonics are strong. The tone here glides and has vibrato; the detected pitch is compared with the true fundamental frame by frame, in cents. Raise the threshold or lower the SNR to provoke gross errors.
