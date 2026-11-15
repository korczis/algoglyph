---
id: constrained-motion
title: Constrained Motion
taxonomy: physics/mechanics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - bead on a wire
  - tautochrone
  - RATTLE
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 12 (the characteristics of force: friction), ch. 4 and 14 (energy, work and potential)'
    purpose: further-reading
  - id: goldstein-classical-mechanics
    ref: 'Chapters 1 and 2: holonomic constraints, the forces of constraint, Lagrange multipliers'
    purpose: implementation
  - id: andersen-1983-rattle
    purpose: implementation
  - id: hairer-lubich-wanner
    ref: 'Chapter VII: constrained mechanical systems, SHAKE and RATTLE, and why RATTLE is symplectic'
    purpose: implementation
  - id: huygens-1673-horologium
    purpose: history
tags:
  - holonomic constraint
  - Lagrange multiplier
  - normal force
  - friction
  - cycloid
  - tautochrone
  - isochrony
  - symplectic integration
complexity: O(beads × steps) per run, 600 samples of 40 RATTLE steps; each step a scalar Newton solve of a few iterations
interaction: Choose the experiment, the bowl, how many beads and how high the highest one starts, or the incline's angle and friction; the step count per sample sets the integrator's resolution.
motivation: A bead on a wire is told only that it must stay on the wire; the force that keeps it there, and the time it takes to slide, follow from that one condition, and a cycloid turns out to be the curve on which the time does not depend on where the bead starts.
relations:
  - type: compares_with
    target: verlet-cloth
    reason: The cloth puts its particles back at their rod lengths by relaxation after an unconstrained step; here the constraint force is a multiplier solved inside a symplectic step, so it is measured, not only enforced.
  - type: related_to
    target: double-pendulum
    reason: Two rods of fixed length are two holonomic constraints; that plate removes them by choosing angles as coordinates, this one keeps Cartesian coordinates and solves for the force of constraint.
  - type: related_to
    target: driven-oscillator
    reason: The circular bowl is a pendulum of length 4R, and its time to the bottom is the quarter period that plate measures by the arithmetic-geometric mean, √(L/g)·K(sin(θ₀/2)).
pedagogy:
  difficulty: intermediate
  objectives:
    - Read the normal force off the multiplier that keeps a bead on its track, and check it against the component of gravity across the track.
    - Measure a block's acceleration down an incline with friction and compare it with g(sin θ − μ cos θ), and find the angle at which it starts to slide.
    - See five beads released from different heights on a cycloid reach the bottom together, and not on a circle or a parabola.
    - Tell the integrator's own error from the physics by cutting the step and watching the residual fall as its square.
  misconceptions:
    - The normal force is not always mg cos θ; on a curved track it also supplies the centripetal force v²/ρ, so it changes as the bead speeds up.
    - A pendulum is not exactly isochronous; its period grows with amplitude, by about 7 % at 60° of swing, and only the cycloid removes that growth.
    - A block on an incline with μ > tan θ does not creep down slowly; static friction holds it exactly.
    - A higher start does not mean a later arrival on the cycloid; the higher bead travels further but on a steeper slope and faster, and the two effects cancel.
  questions:
    - Why does the parabola, which matches the cycloid's curvature at the bottom, make the high beads arrive late rather than early?
    - At what height on the cycloid does the slope reach 45°, and how fast is a bead released from the cusp moving there?
    - With μ = 0.2, at what angle does the block start to slide, and how does its acceleration grow beyond it?
    - Why does the multiplier of the second half step, not the first, give the normal force at the new position?
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
  preconditions:
    - The track is a graph y = f(x) with a finite slope everywhere the bead goes; the cycloid's cusps, where the slope is infinite, are never reached because every bead starts below them.
  invariants:
    - After every step the bead is on the track to round-off and its velocity is tangent to it; both residuals are published.
    - Without friction the energy error stays bounded over the run, as for any symplectic integrator; it does not drift.
  limitations:
    - Friction uses the normal force of the step before, which on a curved track lags by one step; the incline, where the normal force is constant, is exact.
    - The bead is a wire bead held on both sides; a bead resting on top of a track would leave it where the normal force changes sign, and that is not modelled.
    - g = 1 and the cycloid's rolling circle R = 1; times are in units of √(R/g).
experiments:
  - id: tautochrone
    title: Five beads on a cycloid
    params: { experiment: release, track: cycloid }
    observe: Released from a fifth of the cusp height up to nine tenths of it, all five reach the bottom at t = π√(R/g) and meet there again a full swing later.
  - id: pendulum-bowl
    title: The same beads on a circle
    params: { experiment: release, track: circle }
    observe: The circle of radius 4R has the cycloid's curvature at the bottom, so a low bead takes nearly π√(R/g), but the highest one arrives about 6 % later.
  - id: parabola-bowl
    title: A parabolic bowl
    params: { experiment: release, track: parabola }
    observe: The parabola widens faster than the cycloid, so its high beads have further to go at a gentler slope and arrive last of all, 14 % apart.
  - id: small-swings
    title: Small swings, all bowls alike
    params: { experiment: release, track: circle, top: 0.1 }
    observe: Below a tenth of the cusp height the circle is nearly isochronous too; the spread of the times falls to about five parts in a thousand.
  - id: frictionless-incline
    title: A frictionless incline
    params: { experiment: incline, mu: 0 }
    observe: The block accelerates at g sin θ, half of g at 30°, and the energy it gains is exactly the height it loses.
  - id: block-holds
    title: Friction holds the block
    params: { experiment: incline, mu: 0.7 }
    observe: With μ above tan 30° ≈ 0.577 the block stays where it is; the normal force is still g cos θ.
  - id: steep-incline
    title: A steep incline
    params: { experiment: incline, angle: 60, mu: 0.5 }
    observe: The acceleration is g(sin 60° − 0.5 cos 60°) ≈ 0.616 g; the friction work is μN times the distance slid, and the energy balance closes to round-off.
  - id: coarse-steps
    title: A coarse step
    params: { experiment: release, track: cycloid, resolution: 4 }
    observe: Ten times fewer steps make the energy error and the spread of the times a hundred times larger, the mark of a second-order method, while the bead stays on the track to round-off.
claims:
  - id: incline-acceleration
    statement: >-
      On an incline of 30° with μ = 0.2 the block's acceleration, fitted to its sampled distance as
      s = ½at², equals g(sin θ − μ cos θ) = 0.3268 g within 1e−8; velocity Verlet is exact for a constant
      force, so the gap is round-off.
    readout: acceleration along the track, fitted to s = ½at²
    expect: { against: 'closed form g(sin θ − μ cos θ)', tolerance: 0.00000001 }
    setup:
      params: { experiment: incline }
  - id: incline-normal-force
    statement: >-
      The normal force per unit mass, read off the multiplier that keeps the velocity along the incline,
      averages g cos θ within 1e−8, though the integrator is never told it.
    readout: normal force per unit mass, from the multiplier
    expect: { against: 'closed form g cos θ', tolerance: 0.00000001 }
    setup:
      params: { experiment: incline }
  - id: incline-holds
    statement: >-
      With μ = 0.7 > tan 30° the block does not move: its fitted acceleration is 0 within 1e−12.
    readout: acceleration along the track, fitted to s = ½at²
    expect: { value: 0, tolerance: 0.000000000001 }
    setup:
      params: { experiment: incline, mu: 0.7 }
  - id: friction-energy-balance
    statement: >-
      On an incline of 60° with μ = 0.5 the energy gained plus the work friction takes, μN along the path,
      balances the height lost within 1e−9 of g|Δy| at every step.
    readout: energy balance |ΔE + friction work| / g|Δy|, largest, numerics
    expect: { below: 0.000000001 }
    setup:
      params: { experiment: incline, angle: 60, mu: 0.5 }
  - id: cycloid-time
    statement: >-
      Five beads released on the cycloid from 0.18 to 0.9 of the cusp height reach the bottom on average
      after π√(R/g) within 1e−6; the step's own error, second order, is a few parts in 10⁸.
    readout: mean time to the bottom
    expect: { against: 'tautochrone π√(R/g)', tolerance: 0.000001 }
  - id: cycloid-isochrony
    statement: >-
      The five times to the bottom on the cycloid agree within 1e−6 of their mean: the time does not
      depend on the height a bead starts from.
    readout: spread of the times to the bottom, (max − min)/mean
    expect: { below: 0.000001 }
  - id: circle-is-not-isochronous
    statement: >-
      On the circle of the same curvature at the bottom the same five beads spread by more than 3 % of
      their mean; the elliptic integral puts the spread at 5.1 %.
    readout: spread of the times to the bottom, (max − min)/mean
    expect: { above: 0.03 }
    setup:
      params: { track: circle }
  - id: circle-elliptic-integral
    statement: >-
      Each bead on the circle reaches the bottom after √(L/g)·K(sin(θ₀/2)), the pendulum's quarter period
      at amplitude θ₀ computed by the arithmetic-geometric mean, within 1e−6.
    readout: 'largest |t − √(L/g)·K(sin(θ₀/2))| over the beads'
    expect: { below: 0.000001 }
    setup:
      params: { track: circle }
  - id: rattle-energy-bounded
    statement: >-
      (numerics) Without friction RATTLE keeps the energy of every bead within 1e−6 of its start over the
      whole run on the cycloid; at the default step the measured error is near 3e−8.
    readout: 'largest energy error |ΔE/E₀|, numerics'
    expect: { below: 0.000001 }
  - id: rattle-on-the-track
    statement: >-
      (numerics) After every step each bead's velocity is tangent to the cycloid within 1e−13; the position
      lies on the track by construction.
    readout: 'largest speed off the track |v·n̂|, numerics'
    expect: { below: 0.0000000000001 }
---

A bead on a smooth track and a block on a rough incline, integrated by RATTLE: the force of constraint is solved for at every step, read out, and held to what statics and the cycloid say it must be.

**The method.** The bead has unit mass and feels gravity g downwards. The track is the curve y = f(x), the constraint c = y − f(x) = 0, and its gradient ∇c = (−f′, 1) points across the track. RATTLE is velocity Verlet with one Lagrange multiplier in each half step: the first, λ, is chosen so that the drifted position lies on the track (a scalar equation, solved by Newton's method in a few iterations); the second, μ, so that the new velocity is tangent to it (a linear equation, solved exactly). The force of constraint at the new position is −μ∇c per unit mass, so the normal force is measured, never assumed. The scheme is second order and symplectic on the constrained motion, which is why its energy error stays bounded instead of drifting.

**The incline.** On a straight incline at angle θ the normal force must be g cos θ, and kinetic friction takes μ g cos θ off the pull g sin θ along the slope, so the block accelerates at g(sin θ − μ cos θ) while tan θ > μ and stays put otherwise. The plate fits a to the sampled distance by least squares on s = ½at² and averages the normal force from the multiplier; both match the closed forms to round-off, because velocity Verlet is exact for a constant force. The friction work μN along the path closes the energy balance: what the block gains in speed plus what friction takes is the height it loses.

**The tautochrone.** Huygens found that a bead sliding without friction in a cycloid reaches the bottom in the same time, π√(R/g), from wherever it starts. The plate releases up to eight beads at heights spread up to the cusp, integrates each by RATTLE on the cycloid x = R(φ + sin φ), y = R(1 − cos φ), and times each first passage through the bottom by a cubic Hermite interpolant between the two steps that bracket it. On the cycloid the times agree to the integrator's error. On a circle of radius 4R, which has the same curvature at the bottom, the bowl is a pendulum and the time is √(L/g)·K(sin(θ₀/2)), growing with the amplitude; the plate computes that closed form by the arithmetic-geometric mean, as #/p/driven-oscillator does for the pendulum's period, and holds each bead to it. A parabola of the same curvature spreads the times further still.

**What it shows about the integrator.** The bead's distance from the track is zero by construction, and the velocity's normal component is round-off. The energy error is second order in the step: ten times fewer steps make it a hundred times larger. Compare #/p/verlet-cloth, which restores its rod lengths by relaxing positions after an unconstrained step and measures no force at all.
