---
id: page-hinkley
title: Page–Hinkley change detection
taxonomy: dynamics/change
status: live
engine: stochastic
sources:
  - id: practice-decisions
  - id: page-1954-cusum
    purpose: history
tags:
  - change detection
  - cusum
complexity: "constant time and memory per sample"
related:
  - drift-divergence
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Sum each sample's excess over the running mean, less a tolerance δ, and track how far that sum has climbed above its lowest point.
    - See the sum drift down by δ per sample while the mean holds still and climb after an upward shift, until the climb exceeds λ and the alarm is raised.
    - Trade sensitivity against false alarms with δ and the delay with λ, a shift of size s above δ needing roughly λ/(s − δ) samples to alarm.
  misconceptions:
    - A shift smaller than δ is never noticed; it is noticed rarely, with a probability of at most about n·e^(−2(δ−s)λ) over n samples.
algorithm:
  properties:
    online: true
claims:
  - id: shift-of-two-detected-within-thirty
    statement: >-
      Before the change each increment is an independent normal with mean −δ and variance t/(t +
      1) ≤ 1 (the running mean's recursive residuals), so exp(2δ(m_t − m_s)) is a supermartingale
      and, by Ville's inequality over the at most 390 start times before the change, a false alarm
      has probability at most 390·e^(−2·0.5·15) = 1.2e-4: the delay is not negative. After a shift
      of 2 at sample a ≥ 210 the increments' mean is 2a/(t + 1) − 0.5 ≥ 1.24 for 31 samples, a
      climb of at least 38.5 with a standard deviation of at most 5.6, so it passes λ = 15 within
      30 samples except with probability 1.2e-5.
    readout: Detection
    expect: { range: [0, 30] }
    setup:
      params: { shift: 2 }
  - id: stationary-stream-stays-below-lambda
    statement: >-
      With no shift the climb from any of the 601 start times passes λ with probability at most
      e^(−2δλ) = e^(−15) (Ville's inequality, as above), so the peak of m_t − min m stays below λ
      = 15 except with probability 601·e^(−15) = 1.8e-4.
    readout: Peak of m_t − min m
    expect: { below: 15 }
    setup:
      params: { shift: 0 }
  - id: small-shift-rarely-noticed
    statement: >-
      A shift s = 0.1 below δ = 0.5 leaves every increment's mean at most s − δ = −0.4, so the same
      bound holds with δ − s in place of δ: the peak passes λ = 15 with probability at most 601 ·
      e^(−2·0.4·15) = 0.0037.
    readout: Peak of m_t − min m
    expect: { below: 15 }
    setup:
      params: { shift: 0.1 }
---

A cumulative deviation that alarms when the mean of a stream has moved.

The statistic sums each sample's excess over the running mean, less a tolerance δ, and tracks how far that sum has climbed above its lowest point; while the mean holds still the sum drifts down by δ per sample, and after an upward shift it climbs. An alarm is raised the first time the climb exceeds λ.

δ trades sensitivity against false alarms: a shift s smaller than δ is rarely noticed, since the sum still drifts down by at least δ − s per sample and alarms within n samples with probability at most about n·e^(−2(δ−s)λ), and a larger δ makes long quiet stretches safer. λ sets the delay: a shift of size s above δ needs roughly λ/(s − δ) samples to alarm. Set the shift to zero to watch a stationary stream, where any alarm is false.
