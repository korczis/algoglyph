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
---

Coupled oscillators locking into phase as the coupling passes a critical strength.

Each oscillator turns at its own natural frequency and is pulled toward the others by (K/N)·Σ sin(θj − θi), which equals K·r·sin(ψ − θi) for the order parameter r·e^(iψ), the mean of e^(iθ); the equations are integrated with the classical fourth-order Runge–Kutta method.

With natural frequencies placed at the quantiles of a Lorentzian of half-width γ, the incoherent state loses stability at K_c = 2γ, and for an infinite population r settles at √(1 − K_c/K) above it. Below, r hovers near 1/√N. The right panel measures each oscillator's effective frequency: the locked cluster sits on one horizontal line, the drifting ones near the diagonal.
