---
id: kuramoto
title: Kuramoto synchronisation
taxonomy: dynamics/synchrony
status: live
engine: signal
sources:
  - id: practice-signals
tags:
  - synchronisation
  - oscillators
  - order parameter
complexity: 'O(N) per step in the mean-field form'
motivation: Acoustic measurement and synthesis use it every day.
related:
  - lissajous
claims:
  - id: count-at-width-1
    statement: >-
      With the width γ at 1 and K at 4, K_c = 2γ = 2 and r∞ = √(1 − K_c/K) = 0.7071, so an
      oscillator locks when |ω_i| = γ|tan(π((i + ½)/N − ½))| ≤ K·r∞ = 2.828: that is |u| ≤
      0.3918, the oscillators i = 21 … 170 of 192, exactly 150 turning at the mean frequency (the
      finite-N fixed point of r gives the same count; the next drifting one turns at 0.49, far
      outside the 0.02).
    readout: Effective frequency within 0.02 of the mean (measured)
    expect: { value: 150 }
    setup:
      params: { gamma: 1, K: 4 }
  - id: critical-coupling-follows-the-width
    statement: >-
      The critical coupling of the Lorentzian is K_c = 2γ: at γ 2 it is 4, so at K 6 the theory
      for N → ∞ is √(1 − 4/6) = 0.57735, printed as 0.577 within its rounding of 0.0005.
    readout: Theory for N → ∞, √(1 − K_c/K)
    expect: { value: 0.577, tolerance: 0.0005 }
    setup:
      params: { gamma: 2, K: 6 }
  - id: r-follows-the-theory-at-width-2
    statement: >-
      At γ 2 and K 6 the finite-N self-consistent r of the 192 quantiles is within 5e-4 of
      √(1 − K_c/K) = 0.5774. Over seeds 1 … 200 (disjoint from the claim's 4242) the second
      half's mean r deviates from it by +0.00124 on average with sd 0.00066 (in
      test/controls-kuramoto.test.ts): 4 sd + bias = 0.0039, rounded up to 0.004, plus 0.001 for
      the two readouts' rounding, gives 0.005.
    readout: r averaged over the second half so far
    expect: { against: 'Theory for N → ∞, √(1 − K_c/K)', tolerance: 0.005 }
    setup:
      params: { gamma: 2, K: 6 }
---

Coupled oscillators locking into phase as the coupling passes a critical strength.

Each oscillator turns at its own natural frequency and is pulled toward the others by (K/N)·Σ sin(θj − θi), which equals K·r·sin(ψ − θi) for the order parameter r·e^(iψ), the mean of e^(iθ); the equations are integrated with the classical fourth-order Runge–Kutta method.

With natural frequencies placed at the quantiles of a Lorentzian of half-width γ, the incoherent state loses stability at K_c = 2γ, and for an infinite population r settles at √(1 − K_c/K) above it. Below, r hovers near 1/√N. The right panel measures each oscillator's effective frequency: the locked cluster sits on one horizontal line, the drifting ones near the diagonal.
