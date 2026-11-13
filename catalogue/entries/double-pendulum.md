---
id: double-pendulum
title: Chaos Fan
taxonomy: dynamics/chaos
status: live
engine: custom
sources:
  - id: shinbrot-1992-double-pendulum
    purpose: further-reading
tags:
  - chaos
  - Runge–Kutta
  - Hamiltonian
complexity: RK4, O(pendulums) per step
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - See a fan of double pendulums released a millionth of a radian apart move as one for a few swings, then break into a spray.
    - Measure the gap between the outermost pendulums growing roughly exponentially until it fills the whole circle.
    - Read the energy drift of the first pendulum, against its oscillation energy, as how faithful the integrator still is with no damping applied.
    - Release one pendulum at 1° and find the drift where the small-angle theory puts it, below n(ω₊h)⁶/72 after n steps.
  prerequisites:
    - driven-oscillator
  misconceptions:
    - "Chaos is not randomness: the motion is deterministic, only sensitive to its initial conditions."
    - "More steps per frame do not make the integration more accurate: they run more steps of the same size, so the drift comes on sooner."
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
bounds:
  model: derivative evaluations, four per pendulum per Runge–Kutta step
  best: '4 per pendulum per step: 4 · pendulums · steps'
  worst: '4 per pendulum per step: 4 · pendulums · steps'
claims:
  - id: small-angle-drift-below-the-rk4-bound
    statement: >-
      Released at 1° the pendulum is linear to O(θ²) = 3e-4: two normal modes, ω∓ = √((2 ∓ √2)g/l),
      the fast one ω₊ = 5.7874 rad/s at g 9.81. RK4 multiplies a mode's energy by |R(iωh)|² =
      1 − (ωh)⁶/72 + (ωh)⁸/576 a step, so with ω₊h = 0.011575 at dt 2 ms the 5000 steps of 10 s
      lose at most n(ω₊h)⁶/72 = 5000 · 2.405e-12 / 72 = 1.67e-10 of the oscillation energy:
      below 1.67e-8 %, the readout's unit. The fast mode carries only 2.9 % of the energy of a
      release from (θ, θ), so the drift sits some thirty times below the bound, where an
      evaluation's rounding (an ulp of |E| ≈ 29.4 J is 7.9e-13 of the 4.48e-3 J swing) is small
      against it.
    readout: energy drift (pendulum 1)
    expect: { below: 1.67e-8 }
    setup:
      params: { count: 1, theta: 1, dt: 2, runs: 10 }
  - id: small-angle-drift-below-the-rk4-bound-at-5-ms
    statement: >-
      At dt 5 ms ω₊h = 0.028937 and the 2000 steps of 10 s lose at most n(ω₊h)⁶/72 = 2000 ·
      5.871e-10 / 72 = 1.63e-8 of the oscillation energy: below 1.63e-6 %. The bound grows as
      h⁵ per simulated second (n ∝ 1/h, the loss a step ∝ h⁶).
    readout: energy drift (pendulum 1)
    expect: { below: 1.63e-6 }
    setup:
      params: { count: 1, theta: 1, dt: 5, runs: 10 }
  - id: small-angle-drift-is-the-modes-sum-at-5-ms
    statement: >-
      Released from (θ, θ) at rest the angles are a·(1, √2) + b·(1, −√2), a = (2 + √2)/4, b =
      (2 − √2)/4, and the modes carry a²/(a² + b²) = 97.1 % and 2.9 % of the energy, so after n
      steps the drift is Σ w_k (1 − |R(iω_k h)|^(2n)) = 5.461e-8 % at dt 5 ms over 10 s. The
      range allows 0.6 % for four ulps of rounding in the two energy evaluations (3.2e-12 of the
      swing), 0.2 % for the O(θ²) shift of the frequencies at 1° (six times 3e-4 in (ωh)⁶) and
      the printed third digit: 5.41e-8 … 5.51e-8.
    readout: energy drift (pendulum 1)
    expect: { range: [5.41e-8, 5.51e-8] }
    setup:
      params: { count: 1, theta: 1, dt: 5, runs: 10 }
  - id: small-angle-drift-is-the-modes-sum-at-10-ms
    statement: >-
      At dt 10 ms the same sum gives 1.748e-6 % over the 1000 steps of 10 s (the bound n(ω₊h)⁶/72
      is 5.22e-5 %); the rounding is now negligible (2e-4 of it), so the range allows the 0.2 % of
      the O(θ²) frequency shift and the printed third digit: 1.74e-6 … 1.76e-6.
    readout: energy drift (pendulum 1)
    expect: { range: [1.74e-6, 1.76e-6] }
    setup:
      params: { count: 1, theta: 1, dt: 10, runs: 10 }
---

A fan of double pendulums released a millionth of a radian apart: for a few swings they move as one, then chaos tears them into a spray.

Each pendulum is two equal point masses on rigid, massless rods, integrated with the fourth-order Runge–Kutta method. They differ only in the lower arm's starting angle, spread by the chosen offset across the fan.

The motion is deterministic but sensitive to initial conditions: the gap between the outermost pendulums grows roughly exponentially until it fills the whole circle. The readout measures that spread, and the energy drift of the first pendulum shows how faithful the integrator still is (no damping is applied). The drift is measured against the pendulum's oscillation energy E0 − E_min, its energy above hanging at rest, so it means the same at any release angle.

Lower the step size to keep the energy drift small; the substeps only run more steps of the same size each frame, so they bring the drift on sooner and never shrink it. Raise the offset to make the fan break early.

Released at 1° a pendulum is nearly linear: it swings in two normal modes, ω∓ = √((2 ∓ √2)g/l), and RK4 loses (ωh)⁶/72 of each mode's energy a step, so after n steps the drift stays below n(ω₊h)⁶/72.
