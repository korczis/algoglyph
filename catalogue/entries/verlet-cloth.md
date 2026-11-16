---
id: verlet-cloth
title: Verlet Cloth
taxonomy: physics/mechanics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - position-based dynamics
  - Jakobsen cloth
sources:
  - id: jakobsen-2001
    purpose: implementation
  - id: verlet-1967
    purpose: history
  - id: feynman-lectures
    ref: 'Vol. I, ch. 9 (Newton''s laws solved step by step), ch. 10 (conservation of momentum), ch. 12 (the characteristics of force: forces of constraint)'
    purpose: further-reading
tags:
  - Verlet
  - constraints
  - 3D
  - momentum
complexity: O(links × iterations) per step
interaction: Drag to orbit, scroll to zoom.
motivation: A cloth held together only by a rule that puts each pair of particles back at its rest length still obeys Newton's third law, and that alone decides how fast it falls and who carries its weight.
relations:
  - type: related_to
    target: kepler-orbits
    reason: 'The cloth''s step x[n+1] = x[n] + γ(x[n] − x[n−1]) + a is Störmer–Verlet in position form; with γ = 1 it is the step-by-step orbit Feynman computes, whose leapfrog form that plate runs.'
  - type: compares_with
    target: double-pendulum
    reason: Both hold masses at fixed distances; that plate removes its two rods by choosing angles as coordinates, this one moves particles freely and then projects every link back to its length.
  - type: related_to
    target: collisions
    reason: Both rest on Newton's third law; there two balls' impulses are equal and opposite, so a collision keeps the total momentum, here every link's two corrections are, so the cloth's centre of mass falls as if the links were not there.
experiments:
  - id: free-fall
    title: The first steps of the drop
    params: { setup: drape, runs: 30 }
    observe: Until the cloth reaches the sphere nothing but gravity acts on it as a whole; the centre of mass falls at exactly a(1 − γⁿ)/(1 − γ), the links' corrections cancelling in pairs, wind or no wind.
  - id: hammock-at-rest
    title: A hammock comes to rest
    params: { setup: corners, wind: 0 }
    observe: The two corner pins take over the whole weight as the swing dies out; the weight on the pins reads 1 within a few thousand steps.
  - id: curtain-trembles
    title: A curtain that never quite stops
    params: { setup: curtain, wind: 0 }
    observe: At 36 particles a side and 8 iterations the 36 pins share the weight only to about 1e−5; the relaxation keeps trading stretch along the top edge. Raise the iterations to 24 and it comes to rest.
  - id: jersey
    title: Two iterations, a stretchy knit
    params: { setup: curtain, iterations: 2 }
    observe: Two relaxation passes leave a mean strain near 6 %, four times that of the default, and the curtain sags and bounces like jersey.
  - id: stiff
    title: Twenty-four iterations, a stiff weave
    params: { setup: corners, iterations: 24, wind: 0 }
    observe: More passes per step shrink the strain to under 1 %; the hammock hangs as if woven tight, at three times the work per step.
claims:
  - id: free-fall-momentum
    statement: >-
      Before the drape reaches the sphere, the free particles' mean y velocity equals the damped
      free fall a(1 − γⁿ)/(1 − γ) (a = 0.012, γ = 0.995, n = 30 steps) within 1e−9 per step: the two
      free ends of a link move by equal and opposite amounts, so the links carry no net impulse,
      and the wind pushes along z only. The gap is the rounding of summing 1296 positions of
      magnitude 20 (about 1e−11) and the readouts' ten significant digits (5e−11 each).
    readout: centre of mass falls
    expect: { against: 'free fall a(1 − γⁿ)/(1 − γ)', tolerance: 0.000000001 }
    setup:
      params: { setup: drape, runs: 30 }
  - id: hammock-pins-carry-the-weight
    statement: >-
      A hammock of 16 × 16 particles at rest after 6000 steps: its two corner pins deliver an
      impulse equal to the weight of the 254 free particles every step, to the six decimals the
      readout shows. P' = γP + N·a + J_pins exactly, so the gap is the motion left; the swing
      decays as γⁿ, e^(−30) after 6000 steps, far below the last digit.
    readout: weight on the pins
    expect: { value: 1, tolerance: 0.000001 }
    setup:
      params: { setup: corners, res: 16, wind: 0, runs: 6000 }
  - id: curtain-pins-carry-the-weight
    statement: >-
      A curtain of 16 × 16 particles at rest after 6000 steps: its 16 pins along the top edge
      carry the weight of the other 240, to the six decimals shown (the same balance as the
      hammock's, spread over sixteen supports).
    readout: weight on the pins
    expect: { value: 1, tolerance: 0.000001 }
    setup:
      params: { setup: curtain, res: 16, wind: 0, runs: 6000 }
  - id: sphere-carries-the-weight
    statement: >-
      A 16 × 16 drape at rest on the sphere after 6000 steps: the sphere's push, booked from the
      collision projections, equals the weight of all 256 particles to the six decimals shown,
      though nothing in the solver computes a normal force.
    readout: weight on the sphere and floor
    expect: { value: 1, tolerance: 0.000001 }
    setup:
      params: { setup: drape, res: 16, wind: 0, runs: 6000 }
---

A sheet of particles held together by distance constraints: hang it as a curtain, pin it by two corners, or drop it over a sphere, then blow wind through it.

Each particle moves by position Verlet integration: the velocity is implicit in the difference between its current and previous position. Structural and shear links are then relaxed by projecting each pair back to its rest length, a few iterations per step (Jakobsen's method from Hitman, 2001).

More iterations make the fabric stiffer; fewer make it stretch like jersey. The readout reports the mean strain of the links in the last relaxation pass: that stiffness, measured.

Wind is a travelling sine field pushing along the depth axis. Drag to orbit the camera.

**Momentum, booked.** With unit masses and the velocity v = x[n] − x[n−1], the free particles' total y momentum obeys P' = γP + N·a + J_pins + J_contact after every step, exactly: a link between two free particles moves them by equal and opposite amounts, so its correction cancels in the sum, and only a link with one pinned end, or a push from the sphere or the floor, changes P. The plate books those two impulses as the step makes them, without touching a position, and shows each as a share of the weight N·a. At rest P' = P = 0, so whatever holds the cloth up carries exactly its weight. In flight nothing holds it, and the centre of mass falls by the closed form of the damped recurrence v' = γv + a.

**What the relaxation does not keep.** The corrections are applied one link after another, each at positions the previous one moved, and stop after a fixed number of passes. They keep linear momentum to round-off, but not angular momentum: a hammock at rest shares its weight between its two corners about half a per cent away from the lever rule, the gap shrinking as the iterations rise and the strain falls. A 36-pin curtain at 8 iterations never quite settles; at 24 it does.

**Settle.** *Stop after (steps)* holds the cloth on its k-th step, two to a frame, so its readouts stay still and the claims can read them. At 0, the default, it runs on.

**Data.** The plate takes no data of a reader's: its inputs are a scene and its sliders, and the site has no parser for a mesh (ADR 0010 lists the kinds that exist).
