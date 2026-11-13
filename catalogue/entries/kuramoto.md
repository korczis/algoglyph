---
id: kuramoto
title: Kuramoto synchronisation
taxonomy: dynamics/synchrony
status: live
engine: signal
sources:
  - id: practice-signals
  - id: strogatz-2000-kuramoto
    purpose: algorithm-reference
  - id: kuramoto-1984-chemical-oscillations
    purpose: history
tags:
  - synchronisation
  - oscillators
  - order parameter
complexity: 'O(N) per step in the mean-field form'
motivation: Acoustic measurement and synthesis use it every day.
related:
  - lissajous
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Write the pull (K/N)·Σ sin(θj − θi) as K·r·sin(ψ − θi) through the order parameter r·e^(iψ), the mean of e^(iθ).
    - Raise the coupling past K_c = 2γ and see the incoherent state lose stability and r settle near √(1 − K_c/K).
    - See r hover near 1/√N below the critical coupling.
    - Read each oscillator's effective frequency, the locked cluster on one horizontal line and the drifting ones near the diagonal.
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
bounds:
  model: derivative evaluations, one per oscillator per Runge–Kutta stage
  best: '4N per step: 4N · 2500 for the run of 2500 steps'
  worst: '4N per step: 4N · 2500 for the run of 2500 steps'
claims:
  - id: four-evaluations-per-oscillator-per-step
    statement: >-
      The classical Runge–Kutta method evaluates the derivative four times a step, each time for
      every oscillator, so the run of 2500 steps of the 192 oscillators costs exactly
      4 · 192 · 2500 = 1,920,000 derivative evaluations.
    readout: Derivative evaluations
    expect: { value: 1920000 }
  - id: count-at-k-4
    statement: >-
      At K 4 (γ 0.5, K_c = 1) r∞ = √(1 − 1/4) = 0.8660, so an oscillator locks when |ω_i| =
      0.5·|tan(π((i + ½)/N − ½))| ≤ K·r∞ = 3.464: that is |u| ≤ 0.4544, the oscillators i = 9 …
      182 of 192, exactly 174 turning at the mean frequency (the finite-N fixed point of r gives
      the same count; the next drifting one turns at 0.73, far outside the 0.02).
    readout: Effective frequency within 0.02 of the mean (measured)
    expect: { value: 174 }
    setup:
      params: { K: 4 }
  - id: r-follows-the-theory-at-k-2
    statement: >-
      At K 2 = 2K_c the finite-N self-consistent r of the 192 Lorentzian quantiles is within
      2.5e-4 of √(1 − K_c/K) = 0.7071. The quantiles are not drawn, so the seed draws only the
      initial phases; over seeds 1 … 200 (disjoint from the claim's 4242) the second half's mean
      r deviates from the theory by +0.00048 on average with sd 0.00064 (in
      test/controls-kuramoto.test.ts): 4 sd + bias = 0.0030, rounded up to 0.004 at the third
      decimal, plus 0.001 for the two readouts' rounding, gives 0.005.
    readout: r averaged over the second half so far
    expect: { against: 'Theory for N → ∞, √(1 − K_c/K)', tolerance: 0.005 }
  - id: r-follows-the-theory-at-k-4
    statement: >-
      At K 4 the finite-N self-consistent r is within 2.5e-4 of √(1 − 1/4) = 0.8660. Over seeds
      1 … 200 the second half's mean r deviates from it by +0.00004 on average with sd 0.00030:
      4 sd + bias = 0.0012, rounded up to 0.002, plus 0.001 for the readouts' rounding, gives
      0.003.
    readout: r averaged over the second half so far
    expect: { against: 'Theory for N → ∞, √(1 − K_c/K)', tolerance: 0.003 }
    setup:
      params: { K: 4 }
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

Each oscillator turns at its own natural frequency and is pulled toward the others by (K/N)·Σ sin(θj − θi), which equals K·r·sin(ψ − θi) for the order parameter r·e^(iψ), the mean of e^(iθ); the equations are integrated with the classical fourth-order Runge–Kutta method of the shared integrator library.

With natural frequencies placed at the quantiles of a Lorentzian of half-width γ, the incoherent state loses stability at K_c = 2γ, and for an infinite population r settles at √(1 − K_c/K) above it. Below, r hovers near 1/√N. The right panel measures each oscillator's effective frequency: the locked cluster sits on one horizontal line, the drifting ones near the diagonal. The readout counts the oscillators whose effective frequency is within 0.02 of the mean, which is the locked cluster once the transient has passed.
