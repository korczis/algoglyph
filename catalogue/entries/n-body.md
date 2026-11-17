---
id: n-body
title: Galactic Waltz
taxonomy: physics/gravitation
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: hairer-lubich-wanner
    ref: 'Chapter I.1 and VI: the Störmer–Verlet (leapfrog) method, symplectic, its energy error bounded over long times'
    purpose: implementation
  - id: toomre-toomre-1972
    purpose: further-reading
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
  - type: compares_with
    target: barnes-hut
    reason: Both sum the same softened gravity; here every pair directly at O(n²) a step, there a tree groups far bodies at O(n log n), at a stated error.
  - type: related_to
    target: poincare-section
    reason: Both step by kick-drift-kick leapfrog, whose energy error oscillates and does not drift; there one orbit of two degrees of freedom is cut by a plane, here hundreds of bodies pull on each other.
pedagogy:
  difficulty: intermediate
  objectives:
    - Watch two discs merge and throw out tidal tails, and a cold cube collapse and settle into a round cluster.
    - Read the energy error of the symplectic leapfrog, bounded instead of drifting, and see it grow as the square of the step.
    - Measure a circular binary's orbital rate against √(GM/(d² + ε²)^(3/2)) of the softened force.
    - See the total momentum and angular momentum kept to round-off, because every pair's forces are equal, opposite and along the line between them.
  misconceptions:
    - A symplectic integrator does not keep the energy exactly; its error stays bounded and oscillates, instead of drifting.
    - The softening length is not a physical size of the stars; it caps the force of close encounters so that a fixed step can follow them.
    - The tidal tails are not thrown out by a collision of stars; the stars hardly ever meet, and the tails come from the other galaxy's pull on the far side of each disc.
  questions:
    - Why does the energy error peak during the cold collapse's bounce?
    - How does the binary's measured rate move away from the softened oracle as the step grows, and at what power of it?
    - Why is the angular momentum kept to round-off while the energy is not?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - Point masses under Newtonian gravity softened as G m₁m₂/(r² + ε²)^(1/2), ε = 0.04, G = 1.
  invariants:
    - Each pair's forces are equal, opposite and along the line joining the pair, so the leapfrog keeps the total momentum and the total angular momentum to round-off.
    - The energy error of the leapfrog is bounded over long times and of second order in the step.
  limitations:
    - Direct summation, O(n²) a step; at most 600 bodies, and the steps a frame may take are capped by a pair budget.
    - The softening changes close encounters; the binary is set 25 softening lengths apart so that its orbit is nearly Kepler's.
bounds:
  model: pair forces, n(n − 1)/2 a step
  best: Θ(n²) per step
  average: Θ(n²) per step
  worst: Θ(n²) per step
  space: Θ(n)
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
  - id: binary
    title: A circular binary
    params: { preset: binary }
    observe: Two equal bodies one unit apart circle their centre of mass at the softened pair's rate, 0.99880 rad per time unit, within a millionth.
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
  - id: binary-rate
    statement: >-
      A circular binary of total mass 1 at separation 1 turns at √(GM/(d² + ε²)^(3/2)) of the softened force within 3e−6 rad
      per time unit, measured from the angle its separation turns in two time units of leapfrog at Δt = 0.003.
    readout: orbital rate of the binary, measured from the angle turned in the first run
    expect: { against: 'orbital rate √(GM/(d² + ε²)^(3/2)) of the softened pair', tolerance: 0.000003 }
    setup:
      params: { preset: binary, runs: 1 }
  - id: binary-rate-large-step
    statement: >-
      At Δt = 0.01 the leapfrog's phase error has grown as the square of the step, about eleven times, and the rate is
      still within 3e−5.
    readout: orbital rate of the binary, measured from the angle turned in the first run
    expect: { against: 'orbital rate √(GM/(d² + ε²)^(3/2)) of the softened pair', tolerance: 0.00003 }
    setup:
      params: { preset: binary, dt: 0.01, runs: 1 }
  - id: angular-momentum-kept
    statement: >-
      (numerics) Every pair's forces lie along the line joining it, so the merger's total angular momentum changes by less
      than 1e−12 of Σm|x||v| over two time units.
    readout: largest change of the total angular momentum, over Σm|x||v| at the start, sampled every ten frames
    expect: { below: 0.000000000001 }
    setup:
      params: { runs: 1 }
---

Newtonian gravity between every pair of bodies: a disc in orbit, two galaxies colliding, or a cold cube collapsing into a cluster. Drag to orbit.

Every body pulls on every other (direct summation, O(n²) pairs) with a small softening length so close encounters stay finite. The integrator is kick-drift-kick leapfrog: symplectic, so the total energy oscillates around its true value instead of drifting away, and momentum is conserved to rounding error.

Two galaxies: two discs with heavy cores on a grazing approach. Watch tidal tails and a bridge of stars form, the shapes Toomre & Toomre explained with this kind of experiment in 1972.

Cold collapse: a uniform cube released at rest falls in on itself, overshoots, and settles into a hot, round cluster: violent relaxation. Colour is speed.

A circular binary: two equal bodies circling their centre of mass, where the softened force has a closed form. The relative orbit turns at √(GM/(d² + ε²)^(3/2)), and the plate measures the angle the pair's separation turns in its first two time units. The leapfrog's phase error is of second order in the step, so the gap grows elevenfold from Δt = 0.003 to 0.01. Each pair's forces are equal, opposite and along the line between the pair, so the total momentum and angular momentum are kept to round-off, and the readouts show both. The plate takes no reader's data: its inputs are an initial condition and a step.
