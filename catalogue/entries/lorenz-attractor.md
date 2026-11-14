---
id: lorenz-attractor
title: Lorenz Butterfly
taxonomy: dynamics/chaos
status: live
engine: custom
tags:
  - chaos
  - strange attractor
  - 3D
complexity: RK4, O(tracers × trail)
interaction: Drag to orbit, scroll to zoom.
schema: algoglyph.entry/v2
sources:
  - { id: lorenz-1963, purpose: algorithm-reference }
relations:
  - { type: compares_with, target: double-pendulum, reason: "Both chaotic: one dissipative attractor, one conservative mechanical system." }
pedagogy:
  difficulty: intermediate
  objectives:
    - See sensitive dependence on initial conditions as a measured divergence, not a slogan.
    - Find the change of behaviour as ρ crosses about 24.76, where the wings' fixed points lose their stability.
    - Measure the distance to the nearer fixed point decaying as e^(μt), μ the real part of the slow eigenvalues of the Jacobian at C±.
  misconceptions:
    - "Below the transition the swarm does not fall in at once: at ρ 20 the tracers first wander chaotically, some for about 100 time units."
algorithm:
  paradigm: numerical-integration
  properties: { deterministic: true }
  limitations:
    - "A fixed RK4 step agrees with the exact flow only for a while: the chaos that separates the tracers also amplifies the integration error."
claims:
  - id: falls-in-at-the-linear-rate-at-rho-12
    statement: >-
      At ρ 12 the Jacobian at C± has the eigenvalues −12.689 and −0.4905 ± 6.786i (the roots of
      λ³ + (σ + β + 1)λ² + β(σ + ρ)λ + 2σβ(ρ − 1)), so near C± the distance decays as e^(μt), μ =
      −0.4905. Below the homoclinic value (about 13.9) no orbit lingers, and the start spirals
      straight in: an independent integration from (1, 1, 20) at a quarter of the step puts the
      envelope D(t)·e^(−μt) at A = 15.158 from time 20 on, so at time 54 (90 blocks) every
      tracer, at any seed, is within A·e^(μ·54) = 4.76e-11 of C±: below 4.8e-11.
    readout: largest distance to the nearer of C±
    expect: { below: 4.8e-11 }
    setup:
      params: { rho: 12, runs: 90 }
  - id: falls-in-at-the-linear-rate-at-rho-12-time-36
    statement: >-
      Eighteen time units earlier the same envelope gives A·e^(μ·36) = 15.157 · e^(−17.658) =
      3.25e-7: at time 36 (60 blocks) every tracer is within it of C±, below 3.3e-7, and the two
      readings stand e^(0.4905·18) = 6.8e3 apart, the linear decay over 18 time units.
    readout: largest distance to the nearer of C±
    expect: { below: 3.3e-7 }
    setup:
      params: { rho: 12, runs: 60 }
  - id: settles-to-rounding-at-rho-20
    statement: >-
      At ρ 20 the decay rate is only μ = −0.1554 and the tracers first wander: over seeds 1 … 60
      (960 tracers) the last time any is farther than 2 from C± is at most 106. From there
      e^(μ·494) = 4e-34, so at time 600 (1000 blocks) what is left is float64's rounding: a step
      stops moving a coordinate once |dt·f| < ulp(19)/2, within 3.55e-15 / (2·dt·σ_min(J)) =
      4.4e-14 of C± (σ_min(J) = 6.67, the Jacobian's smallest singular value). Below 1e-12, over
      twenty times that. Twelve steps a frame, so the 100 000 steps fit the instrument's frames.
    readout: largest distance to the nearer of C±
    expect: { below: 1e-12 }
    setup:
      params: { rho: 20, runs: 1000, speed: 12, trail: 100 }
experiments:
  - { id: chaotic, title: Classic chaos, params: { sigma: 10, rho: 28, beta: 2.67 }, observe: "The swarm spreads over both wings within a few orbits." }
  - { id: settles, title: Below the transition, params: { sigma: 10, rho: 12, beta: 2.67 }, observe: "The tracers spiral into one of the two fixed points and stop." }
---

A swarm of tracers on the Lorenz system, released a hair apart, smearing across both wings of the strange attractor. Drag to orbit, scroll to zoom.

Edward Lorenz's 1963 three-variable model of convection: dx/dt = σ(y − x), dy/dt = x(ρ − z) − y, dz/dt = xy − βz. With σ = 10, β = 2.67 (the control's default: its step of 0.01 cannot reach Lorenz's 8/3) and ρ = 28 the orbits never settle and never repeat, wrapping round two unstable fixed points.

Each tracer starts with every coordinate within ±0.5·10⁻⁴ of (1, 1, 20), so two of them start up to √3·10⁻⁴ apart, and all are integrated with RK4. The readout measures how far apart the swarm has drifted: a few orbits are enough to lose every trace of the shared start.

Lower ρ below about 24.76 (σ(σ + β + 3)/(σ − β − 1) at these σ and β) and the wings become stable fixed points, C± = (±√(β(ρ−1)), ±√(β(ρ−1)), ρ − 1); the swarm spirals in and stops, after wandering for a while above about 13.9. A readout measures the largest distance from a tracer to the nearer of them. Colour is speed along the trail.
