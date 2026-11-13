---
id: minkowski-diagram
title: Spacetime Diagram
taxonomy: physics/relativity
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - Minkowski diagram
  - Lorentz transformation
  - twin paradox
sources:
  - id: taylor-wheeler-1992
    ref: 'Chapters 3 (the spacetime diagram), 4 (trekking through spacetime) and 6 (rapidity)'
    purpose: further-reading
  - id: rindler-2006
    ref: 'Chapter 3 (the Lorentz transformation), §3.7 rapidity and §3.8 hyperbolic motion'
    purpose: proof
tags:
  - special relativity
  - Lorentz transformation
  - rapidity
  - proper time
  - simultaneity
  - length contraction
complexity: O(events × slider positions) for the invariance readout; proper time by adaptive Simpson
interaction: The scene menu picks the events; the velocity slider tilts the axes of the moving frame.
motivation: The one picture from which simultaneity, contraction and the twins' ages can be read off.
pedagogy:
  difficulty: intermediate
  objectives:
    - Read an event's coordinates in two frames off one diagram, and see the axes of the moving frame tilt toward the light cone.
    - See that events simultaneous in one frame are not in another, by γ v Δx.
    - Compose two boosts by adding rapidities and recognise the velocity-addition formula.
    - Compute a traveller's proper time along an accelerated worldline and compare it with the stay-at-home time.
  misconceptions:
    - The interval is not a distance; it is the same for every observer, and on the light cone it is zero.
    - The travelling twin is not younger because of the acceleration as such; the ages differ by the integral of √(1 − v²) along the paths.
    - Velocities do not add; rapidities do.
  questions:
    - Why do the t′ and x′ axes close in on the light cone as v approaches c, and never cross it?
    - Two flashes 4 apart along a train are simultaneous for the platform; in which order does the train see them, and how far apart in time?
    - The traveller accelerates at a for a quarter of the trip on each leg. Why is the result 4 asinh(aT/4)/a, and what does it approach for small a?
algorithm:
  paradigm: transform
  invariants:
    - The interval t² − x² between any two events is the same in every frame the slider reaches.
    - Boosting by φ₁ and then by φ₂ is one boost by φ₁ + φ₂.
relations:
  - type: uses
    target: adaptive-quadrature
    reason: The traveller's proper time is adaptive Simpson's integral of √(1 − v²), split at the legs of the trip.
experiments:
  - id: simultaneity-at-high-speed
    title: Simultaneity at 0.9 c
    params: { scene: simultaneity, beta: 0.9 }
    observe: The three flashes simultaneous in S spread over almost 9 units of t′; the spread is γ v Δx.
  - id: rod-contracts
    title: A rod measured from a fast frame
    params: { scene: rod, beta: 0.8 }
    observe: The rod's length at one t′ is its rest length divided by γ, here 0.6 of it.
  - id: twins
    title: The twins
    params: { scene: twins, accel: 1, T: 8 }
    observe: The traveller ages 4 asinh(2) ≈ 5.77 against the home twin's 8, the quadrature agreeing with the closed form.
claims:
  - id: the-interval-is-invariant
    statement: >-
      Over every one of the velocities the slider can be set to, from −0.95 c to 0.95 c, the
      interval between every pair of the scene's events changes by less than 1e-12 of its largest
      value: the boost preserves it, up to rounding.
    readout: largest relative change of s² over every boost the slider allows
    expect: { below: 1.0e-12 }
  - id: the-interval-is-invariant-for-the-twins
    statement: >-
      The same holds for the events of the twins' trip, a spacelike and a timelike pair among them.
    readout: largest relative change of s² over every boost the slider allows
    expect: { below: 1.0e-12 }
    setup:
      params: { scene: twins }
  - id: rapidities-add
    statement: >-
      Composing 0.6 c and 0.9 c by adding rapidities, tanh(φᵤ + φᵥ), gives the velocity-addition
      formula (u + v)/(1 + uv) ≈ 0.974 to within 1e-12.
    readout: (u + v)/(1 + uv)
    expect: { against: tanh(φᵤ + φᵥ), tolerance: 1.0e-12 }
    setup:
      params: { beta: 0.9, u: 0.6 }
  - id: boosts-compose
    statement: >-
      Boosting by φᵤ and then by φᵥ is one boost by φᵤ + φᵥ: the two matrices differ by less than
      1e-12 in every element.
    readout: boost by φᵤ then φᵥ, against one by φᵤ + φᵥ
    expect: { below: 1.0e-12 }
    setup:
      params: { beta: -0.7, u: 0.95 }
  - id: simultaneity-is-relative
    statement: >-
      Three flashes simultaneous in S, 4 apart, are spread over γ v Δx in S′: about 4.13 at 0.9 c
      (γ ≈ 2.29), read from the boosted events and from the closed form alike.
    readout: spread of t′ over the three flashes simultaneous in S
    expect: { against: 'the same spread in closed form, γ v Δx', tolerance: 0.0001 }
    setup:
      params: { scene: simultaneity, beta: 0.9 }
  - id: lengths-contract
    statement: >-
      A rod of rest length 2 measured at one t′ from a frame at 0.8 c is 2/γ = 1.2 long.
    readout: rod length in S′ at one t′
    expect: { against: rest length / γ, tolerance: 1.0e-12 }
    setup:
      params: { scene: rod, beta: 0.8 }
  - id: hyperbolic-proper-time
    statement: >-
      A quarter of the trip at proper acceleration a = 1 for coordinate time T/4 = 2 is hyperbolic
      motion: adaptive Simpson's ∫ √(1 − v²) dt agrees with asinh(aT)/a ≈ 1.4436 to within 1e-9.
    readout: first leg, by quadrature
    expect: { against: 'first leg, asinh(aT)/a of hyperbolic motion', tolerance: 1.0e-9 }
    setup:
      params: { scene: twins, accel: 1, T: 8 }
  - id: the-traveller-is-younger
    statement: >-
      The travelling twin ages 4 asinh(aT/4)/a ≈ 5.775 by quadrature, matching the closed form to
      within 1e-9 …
    readout: traveller ages, by quadrature
    expect: { against: 'traveller ages, 4 asinh(aT/4)/a', tolerance: 1.0e-9 }
    setup:
      params: { scene: twins, accel: 1, T: 8 }
  - id: and-younger-than-the-twin-at-home
    statement: >-
      … which is less than the 8 the twin at home ages over the same trip.
    readout: traveller ages, by quadrature
    expect: { against: the twin at home ages, below: 0 }
    setup:
      params: { scene: twins, accel: 1, T: 8 }
---

Two frames on one sheet: the axes of a frame moving at v tilt toward the light cone, and every event is read in both.

The diagram is drawn with c = 1, so light travels on the diagonals. The moving frame S′ has its time axis on x = v t and its space axis on t = v x, and its grid lines of constant t′ and x′ are drawn from the boost t′ = t cosh φ − x sinh φ, x′ = x cosh φ − t sinh φ, with rapidity φ = atanh v. Nothing in the picture moves; it is a function of the controls.

Three scenes ask the classic questions. Flashes simultaneous along a train in S are spread in t′ by γ v Δx. A rod at rest in S, measured where its ends cross one line of constant t′, is shorter by γ. A twin who travels out and back at proper acceleration a, four legs of a quarter of the trip each, ages the integral of √(1 − v²) along that worldline, computed by adaptive Simpson split at the legs, and the readouts set it beside the closed form 4 asinh(aT/4)/a and beside the stay-at-home twin's T.

The invariance of the interval is checked, not assumed: every frame the velocity slider can reach is applied to every pair of the scene's events, and the readout reports the largest change of t² − x², relative to the largest interval. Composition is checked twice, as tanh of summed rapidities against the velocity-addition formula, and as a product of two boost matrices against one.
