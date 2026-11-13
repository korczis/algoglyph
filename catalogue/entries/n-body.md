---
id: n-body
title: Galactic Waltz
taxonomy: physics/gravitation
status: live
engine: custom
tags:
  - gravity
  - symplectic
  - 3D
complexity: O(n²) per step, leapfrog KDK
interaction: Drag to orbit, scroll to zoom.
relations:
  - type: generalizes
    target: kepler-orbits
    reason: Two bodies, one heavy enough to stay put, are the Kepler problem; here every body pulls on every other, with a softening length.
experiments:
  - id: one-disc
    title: One disc
    params: { preset: disc }
    observe: A rotating disc of stars around a heavy core, slowly winding up.
  - id: collapse
    title: Cold collapse
    params: { preset: collapse }
    observe: The cube falls in, overshoots and settles into a round cluster; the energy error peaks at the bounce.
  - id: large-step
    title: A large step
    params: { dt: 0.01 }
    observe: The energy error grows several times but stays bounded; leapfrog does not drift.
claims:
  - id: energy-bounded
    statement: >-
      (numerics) Over two time units of the galaxies' merger, kick-drift-kick leapfrog at Δt = 0.003 keeps the
      total energy within 0.001 % of its start (6e−5 % measured): the symplectic method's error oscillates
      instead of growing.
    readout: largest energy error since the start, sampled every ten frames
    expect: { below: 0.001 }
    setup:
      params: { runs: 1 }
  - id: momentum-kept
    statement: >-
      (numerics) Every pair's forces are equal and opposite, so the total momentum is unchanged to round-off:
      within 1e−12 after two time units.
    readout: change of |total momentum| since the start
    expect: { below: 0.000000000001 }
    setup:
      params: { runs: 1 }
---

Newtonian gravity between every pair of bodies: a disc in orbit, two galaxies colliding, or a cold cube collapsing into a cluster. Drag to orbit.

Every body pulls on every other (direct summation, O(n²) pairs) with a small softening length so close encounters stay finite. The integrator is kick-drift-kick leapfrog: symplectic, so the total energy oscillates around its true value instead of drifting away, and momentum is conserved to rounding error.

Two galaxies: two discs with heavy cores on a grazing approach. Watch tidal tails and a bridge of stars form, the shapes Toomre & Toomre explained with this kind of experiment in 1972.

Cold collapse: a uniform cube released at rest falls in on itself, overshoots, and settles into a hot, round cluster: violent relaxation. Colour is speed.
