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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Build square, sawtooth and triangle waves from their harmonics with amplitudes 4/(πk), 2/(πk) and falling as 1/k².
  - See the partial sum converge everywhere except next to a jump, where the first ripple overshoots by Si(π)/π − 1/2.
  - Taper the highest harmonics with Lanczos σ factors and trade the ringing for a softer edge.
  misconceptions:
  - The overshoot does not shrink as harmonics are added; it only gets narrower.
bounds:
  model: real multiplies
  worst: 'N per harmonic summed, at most K·N for K harmonics over N samples'
claims:
  - id: overshoot-at-the-gibbs-limit
    statement: >-
      With 61 harmonics the square wave's overshoot sits at the Gibbs limit: an independent
      computation of the 61-harmonic partial sum gives 8.953 % against Si(π)/π − 1/2 = 8.949 %,
      so within 0.01 percentage points.
    readout: Overshoot (measured, share of the jump)
    expect: { against: Gibbs limit Si(π)/π − 1/2, tolerance: 0.01 }
  - id: triangle-has-no-overshoot
    statement: >-
      The triangle has no jump: its series converges uniformly, the tail beyond 61 harmonics
      bounding any excess by 0.327 % of the jump.
    readout: Overshoot (measured, share of the jump)
    expect: { below: 0.33 }
    setup:
      params: { shape: triangle }
---

Square and saw waves from harmonics, and the overshoot that never goes away.

A square wave is the sum of its odd harmonics with amplitudes 4/(πk), a sawtooth of all harmonics with 2/(πk) and alternating sign, a triangle of odd harmonics falling as 1/k². Adding harmonics one at a time, the partial sum converges to the wave everywhere except next to a jump.

There the first ripple overshoots by Si(π)/π − 1/2 ≈ 8.95 % of the jump however many harmonics are summed; it only gets narrower. The triangle has no jump and no such overshoot. Lanczos σ factors taper the highest harmonics and remove most of the ringing at the cost of a softer edge.
