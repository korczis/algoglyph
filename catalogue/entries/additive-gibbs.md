---
id: additive-gibbs
title: Additive synthesis and the Gibbs phenomenon
taxonomy: signals/synthesis
status: live
engine: signal
sources:
  - id: practice-signals
tags:
  - fourier series
  - gibbs
  - band limiting
complexity: 'O(K · N) for K harmonics over N samples'
motivation: Acoustic measurement and synthesis use it every day.
related:
  - fourier-epicycles
---

Square and saw waves from harmonics, and the overshoot that never goes away.

A square wave is the sum of its odd harmonics with amplitudes 4/(πk), a sawtooth of all harmonics with 2/(πk) and alternating sign, a triangle of odd harmonics falling as 1/k². Adding harmonics one at a time, the partial sum converges to the wave everywhere except next to a jump.

There the first ripple overshoots by Si(π)/π − 1/2 ≈ 8.95 % of the jump however many harmonics are summed; it only gets narrower. The triangle has no jump and no such overshoot. Lanczos σ factors taper the highest harmonics and remove most of the ringing at the cost of a softer edge.
