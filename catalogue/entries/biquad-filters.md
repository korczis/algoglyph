---
id: biquad-filters
title: Biquad filters, poles and zeros
taxonomy: signals/filters
status: live
engine: signal
sources:
  - id: practice-signals
tags:
  - filters
  - poles
  - zeros
  - frequency response
complexity: 'O(1) per sample: five multiplies'
motivation: Acoustic measurement and synthesis use it every day.
---

Moving poles and zeros on the z-plane and watching the frequency response follow.

A biquad is the difference equation y[n] = b0·x[n] + b1·x[n−1] + b2·x[n−2] − a1·y[n−1] − a2·y[n−2]; its transfer function H(z) is a ratio of quadratics, whose roots are the zeros and poles on the z-plane. The coefficients here come from the bilinear transform of the analogue low-pass, high-pass, band-pass, notch and peaking prototypes.

Poles close to the unit circle make a resonance at their angle, zeros on it make a notch; a pole outside it would make the filter unstable. The response is measured by filtering a unit impulse and transforming the result, and checked against H evaluated on the unit circle. With Q = 0.707 the low-pass is a Butterworth section: −3 dB exactly at the corner.
