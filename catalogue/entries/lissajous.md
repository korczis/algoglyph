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
---

Two sinusoids on two axes: the figure reads their frequency ratio and phase.

On an oscilloscope in X–Y mode, x = sin(a·ωt + δ) against y = sin(b·ωt) draws a closed figure when a/b is rational; the figure touches the vertical sides a times and the horizontal sides b times. With equal frequencies it is an ellipse, and where it crosses x = 0, |y| reads |sin δ|.

The plate reads the ratio and the phase back from the samples: each channel's frequency is its spectrum's peak bin, and δ is the phase of x at its bin less a/b times the phase of y at its bin. A steady drift of δ makes the figure appear to turn, as two slightly mistuned oscillators do.
