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
---

An exponential sweep through a system, deconvolved into its impulse response.

An exponential sweep spends equal time in every octave. Convolved with its inverse filter, the sweep reversed in time and attenuated by 6 dB per octave as it descends, it collapses into a band-limited impulse; convolving a recording of the sweep with the same filter turns it into the impulse response of whatever it passed through, here a seeded room of a direct path and reflections.

Harmonic distortion of the k-th order arrives earlier by L·ln k, where L is the sweep's time per e-fold of frequency, so the distortion's own responses separate from the linear one in time and can be cut away. The readouts compare the recovered delay, reflection ratios and magnitude response with the room that was used.
