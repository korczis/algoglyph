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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Read the difference equation's transfer function H(z) as a ratio of quadratics with zeros and poles.
  - See poles near the unit circle make a resonance and zeros on it make a notch.
  - Measure the response by filtering a unit impulse and check it against H evaluated on the unit circle.
bounds:
  model: real multiplies of the difference equation
  best: 5 per sample
  worst: 5 per sample
claims:
  - id: measured-response-is-the-evaluated-one
    statement: >-
      The response measured from the impulse response is H evaluated on the unit circle: the
      default low-pass's poles decay long before the 16384 samples end, so the two agree to
      rounding, within 10⁻⁶ dB.
    readout: Measured against evaluated, worst
    expect: { below: 1.0e-6 }
---

Moving poles and zeros on the z-plane and watching the frequency response follow.

A biquad is the difference equation y[n] = b0·x[n] + b1·x[n−1] + b2·x[n−2] − a1·y[n−1] − a2·y[n−2]; its transfer function H(z) is a ratio of quadratics, whose roots are the zeros and poles on the z-plane. The coefficients here come from the bilinear transform of the analogue low-pass, high-pass, band-pass, notch and peaking prototypes.

Poles close to the unit circle make a resonance at their angle, zeros on it make a notch; a pole outside it would make the filter unstable. The response is measured by filtering a unit impulse and transforming the result, and checked against H evaluated on the unit circle. A low-pass section's gain at its corner is Q itself, so with Q = 1/√2 ≈ 0.707 it is a Butterworth section, −3 dB exactly at the corner; the Q control moves in steps of 0.1, and its nearest setting, 0.7, reads about −3.1 dB there.
