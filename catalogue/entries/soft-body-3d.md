---
id: soft-body-3d
title: Jelly Physics
taxonomy: physics/mechanics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - mass-spring system
  - pressure soft body
sources:
  - id: matyka-pressure-soft-body
    ref: arXiv physics/0407003
    purpose: implementation
  - id: hairer-lubich-wanner
    ref: 'Chapter I.1 and IX: the Störmer–Verlet method, its modified energy, quadratic first integrals'
    purpose: implementation
  - id: feynman-lectures
    ref: 'Vol. I, ch. 18 and 20 (angular momentum and its conservation), ch. 21 and 49 (harmonic oscillators, modes)'
    purpose: further-reading
tags:
  - mass-spring
  - Verlet
  - pressure
  - 3D
  - angular momentum
complexity: O(springs + faces) per step, velocity Verlet
interaction: Drag to orbit, scroll to zoom.
motivation: A jelly is many oscillators coupled by springs; one symplectic step keeps its spin exactly while it flies, and keeps its energy within a bound the step size alone sets.
relations:
  - type: compares_with
    target: verlet-cloth
    reason: Both are point masses joined in a lattice; here the springs are forces integrated by velocity Verlet, so energy and angular momentum are kept, there the links are projected back to length, which keeps momentum but not angular momentum.
  - type: related_to
    target: kepler-orbits
    reason: The same reason keeps angular momentum in both; a central force has no moment, and a leapfrog step moves each position along the velocity it was kicked with, so the spin of a flying jelly, like the orbit's h, is kept to round-off.
  - type: related_to
    target: driven-oscillator
    reason: Each normal mode of the spring network is a harmonic oscillator, and Verlet's energy error is set mode by mode, (ω·dt)²/4 of the mode's energy at most.
  - type: related_to
    target: pca-svd
    reason: The energy bound reads the Rayleigh quotient vᵀKv/vᵀMv, the energy-weighted mean ω² of the excited modes; its extremes over all v are the extreme eigenvalues of M⁻¹K, as principal components are those of a covariance.
experiments:
  - id: spin-in-flight
    title: A spinning cube in flight
    params: { preset: cube, runs: 1 }
    observe: Until its first corner touches the floor the cube's angular momentum about its mass centre stays the same to about 1e−15 of itself, springs, damping and all, and its momentum falls by exactly M·g per second.
  - id: ball-in-flight
    title: A pressurised ball in flight
    params: { preset: ball, runs: 1 }
    observe: The gas pushes every face outwards, yet its pushes have no net moment over a closed surface, so the ball keeps its spin as the cube does.
  - id: undamped-column
    title: An undamped column in zero gravity
    params: { preset: column, damping: 0, gravity: 0 }
    observe: Released straight with a shear velocity, the column's energy only ever rises above its release value, and by at most (dt²/4)·vᵀKv/vᵀMv, about 6e−5 of it at the default eight steps a frame.
  - id: finer-steps
    title: Five times smaller a step
    params: { preset: column, damping: 0, gravity: 0, substeps: 40 }
    observe: Forty steps a frame instead of eight shrink the largest energy change by 25, the square of the step, and the bound with it.
  - id: soft-jelly
    title: Soft jelly, strong gravity
    params: { preset: cube, stiffness: 40, gravity: 20, restitution: 0.1 }
    observe: At the lowest stiffness under twice Earth's gravity the cube slumps on landing, its strain colours saturating before it springs back.
claims:
  - id: cube-keeps-its-spin
    statement: >-
      The dropped cube's angular momentum about its mass centre changes by less than 1e−11 of
      itself in free flight, damping 0.1 and all: spring and damping forces act along their
      springs, gravity is uniform, so each half kick adds no moment about the mass centre and
      each drift moves x − X along v − V. The gap is rounding; over the 330 steps to the floor
      (0.46 s at 720 a second), thirty roundings of ε = 1.1e−16 a step add up to 1.1e−12 at worst.
    readout: angular momentum about the mass centre, change in free flight
    expect: { below: 1e-11 }
    setup:
      params: { preset: cube, runs: 1 }
  - id: ball-keeps-its-spin
    statement: >-
      The pressurised ball keeps its angular momentum about its mass centre to below 1e−11 of
      itself in free flight: each face's pressure force, a third at each corner, has the moment
      of the face's centroid, and over a closed surface those moments sum to p∮r × n dA = 0.
    readout: angular momentum about the mass centre, change in free flight
    expect: { below: 1e-11 }
    setup:
      params: { preset: ball, runs: 1 }
  - id: cube-falls-freely
    statement: >-
      In free flight the cube's vertical momentum is its release value minus M·g·t to below
      1e−11 of M·g·t: the internal forces cancel in pairs and velocity Verlet is exact for a
      constant force.
    readout: momentum against −M·g·t, change in free flight
    expect: { below: 1e-11 }
    setup:
      params: { preset: cube, runs: 1 }
  - id: column-energy-within-verlet-bound
    statement: >-
      Undamped, in zero gravity, the column released undeformed with its shear velocity keeps
      ½vᵀMv + ½xᵀKx − (dt²/8)|M^(−½)Kx|² exactly in linear theory, so its energy rises above the
      release value by at most (dt²/4)·vᵀKv/vᵀMv of it, the quotient read at the release: over
      ten seconds the largest change stays below that bound.
    readout: largest energy change since release or last control change
    expect: { against: 'Verlet bound at release (dt²/4)·vᵀKv/vᵀMv', below: 0 }
    setup:
      params: { preset: column, damping: 0, gravity: 0, runs: 10 }
  - id: column-energy-within-verlet-bound-finer
    statement: >-
      At forty steps a frame the step is five times smaller and the bound twenty-five times
      lower; the largest change over ten seconds stays below it, so the error falls as the
      square of the step.
    readout: largest energy change since release or last control change
    expect: { against: 'Verlet bound at release (dt²/4)·vᵀKv/vᵀMv', below: 0 }
    setup:
      params: { preset: column, damping: 0, gravity: 0, substeps: 40, runs: 10 }
---

Point masses on damped springs: drop a jelly cube or a gas-filled ball on the floor, or watch a column pinned at its base wobble. Colour is the local strain.

The cube and the column are lattices of masses joined by structural springs (axis neighbours), shear springs (face and body diagonals) and bending springs (second neighbours), which keep a solid's shape. The ball is a geodesic membrane with an ideal gas inside (the pressure model of Matyka and Ollila): a lattice ball would be a voxel staircase. The gas pushes every face outwards with p·area, p = nRT / V, which summed over the closed surface is exactly the force of the potential −nRT·ln V.

Velocity Verlet (kick-drift-kick) integrates the masses, with spring damping along each spring as a fraction of its critical damping. The ground projects masses back to y = 0, keeps a fraction of the impact speed (restitution) and removes tangential speed up to friction × the normal impulse (Coulomb). The steps per frame rise above the control when the spring network's Gershgorin frequency bound demands it; when that would exceed the frame's work budget, the plate keeps the stable step, takes fewer of them and runs in slow motion, and the readout says how slow.

Faces are coloured by the mean strain of their masses' structural springs, compressed at the low end of the palette and stretched at the high end. The energy readout and chart sum kinetic, gravitational, spring and gas energy, measured from the release and again from every change of a physical control. Ground impacts and damping change it; set damping to 0 on the column at the default stiffness, which then never touches the floor, and it holds to better than a thousandth of a per cent, as a symplectic integrator should. Drag to orbit.

**Invariants, read from the run.** While nothing is pinned and nothing has touched the floor, the plate reads the angular momentum about the mass centre and the vertical momentum against their release values, and holds the largest change it saw once the body lands. The energy readout keeps the largest change since the release, and beside it the bound velocity Verlet gives for a body released undeformed: the shadow energy ½vᵀMv + ½xᵀKx − (dt²/8)|M^(−½)Kx|² is kept exactly by the step in linear theory, so the energy can only rise above its release value, by at most (dt²/4) times the Rayleigh quotient vᵀKv/vᵀMv, the energy-weighted mean ω² of the modes the release excites. Gravity's sag starts the column away from its equilibrium and the gas adds a stiffness the quotient leaves out, so the bound is a claim only for the undamped column in zero gravity.

**Settle.** *Stop after (simulated s)* holds the body on its k-th simulated second, the last step cut to the time left; while it is set, a body at rest is not dropped again. At 0, the default, the plate runs and re-drops as before.

**Data.** The plate takes no data of a reader's: its bodies are built from a preset and a resolution, and the site has no parser for a mesh or a spring network (ADR 0010 lists the kinds that exist).
