---
id: spinning-bodies
title: Spinning Bodies
taxonomy: physics/mechanics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - rigid body rotation
  - Euler's equations
  - tennis racket theorem
  - Dzhanibekov effect
  - heavy top
  - gyroscope
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 20 (rotation in space: torque and angular momentum as vectors, the gyroscope, the angular momentum of a solid body)'
    purpose: further-reading
  - id: landau-lifshitz-mechanics
    ref: '§35–§37: the free symmetric top, Euler''s equations, and the asymmetric top solved by elliptic functions'
    purpose: implementation
  - id: goldstein-classical-mechanics
    ref: 'Chapter 5: the heavy symmetric top with one point fixed, its effective potential in cos θ, nutation and precession'
    purpose: implementation
  - id: hairer-lubich-wanner
    ref: 'Chapter VII.5: splitting methods for the rigid body, each piece an exact rotation'
    purpose: implementation
  - id: yoshida-1990
    purpose: implementation
tags:
  - rigid body
  - angular momentum
  - Euler's equations
  - principal axes
  - intermediate axis
  - precession
  - nutation
  - elliptic integral
  - splitting method
  - symplectic integrator
complexity: O(T/h) steps of O(1) each; the step size keeps every rate of the body below a fiftieth of a turn per step
interaction: Choose the body; for a free one, its sides, the axis it spins about, the tilt from that axis and how fast; for the top, its moments, spin, lean and torque, and whether it is released at rest or already precessing. Drag the body to turn the view.
motivation: A spinning body keeps its angular momentum fixed in space while the body itself may tumble; whether it tumbles, and how a top moves under gravity's torque, follows from three moments of inertia and the energy, and each of those motions has a closed form to hold the simulation to.
relations:
  - type: related_to
    target: spin-precession
    reason: A torque at right angles to an angular momentum turns it without changing its size; there the magnetic torque on a moment, here gravity's torque on a fast top, Ω ≈ Mgl/(I₃ω₃).
  - type: related_to
    target: foucault-pendulum
    reason: Both are a fast motion whose plane or axis turns slowly in space; there the Earth's rotation turns the swing, here gravity's torque turns the spin axis.
  - type: related_to
    target: pca-svd
    reason: The principal axes of a body are the principal components of its mass distribution; the plate finds a reader's body's axes by Jacobi rotations of the inertia tensor, the two-sided relative of the Jacobi sweeps there.
pedagogy:
  difficulty: advanced
  objectives:
    - Spin a box about each of its principal axes and see that the largest and smallest are stable while the middle one flips.
    - Measure the period of the body's motion and hold it to the elliptic closed form 4K(k)·√(I₁I₂I₃/((I₃ − I₂)(L² − 2EI₁))).
    - Measure how fast a tilt from the middle axis grows and compare it with λ = ω√((I₃ − I₂)(I₂ − I₁)/(I₁I₃)).
    - Find that a thin disc's wobble is twice its spin when the tilt is small, and how the ratio grows as I_s/(|I⊥ − I_s| cos θ).
    - Measure a fast top's precession and nutation and compare them with Mgl/(I₃ω₃) and 2πI⊥/(I₃ω₃), and with the exact reduced top.
  misconceptions:
    - The angular velocity of a free body is not fixed; the angular momentum is, in space, and the angular velocity moves about it unless the body spins about a principal axis.
    - A flip about the middle axis is not caused by a disturbance during the motion; the smallest tilt at the start grows exponentially by Euler's equations alone.
    - A top does not precess because gravity pulls its axis sideways; the torque is horizontal and adds horizontal angular momentum, which turns the spin's angular momentum about the vertical.
    - Steady precession is not what a top released at rest does; it falls a little, nutates between two leans, and precesses on average at nearly Mgl/(I₃ω₃).
  questions:
    - Why does a box flip about its middle axis at regular intervals rather than at random, and what sets the interval?
    - How does the period of the flips grow as the tilt from the middle axis shrinks?
    - Why is a disc's wobble faster than its spin, and why twice?
    - What happens to a top's nutation as its spin is halved, and when does it stop being small?
    - Why does a top released with its axis at rest first dip and then rise again?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - The body is rigid; a free body has no torque on it, the top is pivoted at the origin with its centre of mass on its symmetry axis and gravity along −z.
    - The box and the disc have unit mass; the top has I⊥ = 1 about the pivot, so its other quantities are in units of it.
  invariants:
    - Each piece of the splitting rotates the orientation and the body's angular momentum by the same angle in opposite senses, so a free body's angular momentum in space is kept to round-off and its magnitude exactly.
    - Gravity's torque is horizontal and at right angles to the top's axis, so L_z in space and L₃ along the axis are kept to round-off.
    - The energy is kept to fourth order in the step; it oscillates and does not drift.
  limitations:
    - No friction, no floor under the top and no air; a free body never loses energy.
    - A run takes at most 480 000 steps; a long, fast run takes larger steps than a fiftieth of a turn, and its energy readout shows the cost.
    - The growth near the middle axis is fitted only from a start within 1e−5 rad of it, so that the decaying mode has died out before the fit's window opens.
    - A reader's body that lies on a line has no moment about that line and is not run.
bounds:
  model: integration steps, each three second-order splits of O(1) rotations
  best: Θ(T/h)
  average: Θ(T/h)
  worst: Θ(T/h), at most 480 000 a run
  space: Θ(samples) for the trail; O(1) for the state
experiments:
  - id: tennis-racket
    title: The middle axis flips
    params: { body: box, axis: middle, tilt: 1 }
    observe: The box spun within a degree of its middle axis turns over by half a turn at regular intervals, while L stays fixed in space; ω₂ changes sign at each flip.
  - id: stable-largest
    title: The axis of the largest moment is stable
    params: { body: box, axis: largest, tilt: 20 }
    observe: Tilted by 20°, the box only wobbles about its axis, at a period a few per cent longer than the small-wobble limit 2π/Ω.
  - id: stable-smallest
    title: So is the axis of the smallest moment
    params: { body: box, axis: smallest, tilt: 20 }
    observe: ω circles the long axis instead; the period again follows the elliptic closed form, now on the other side of the separatrix.
  - id: growth-near-middle
    title: How a tilt grows near the middle axis
    params: { body: box, axis: middle, tilt: 0.0001, time: 60 }
    observe: A tilt of a ten-thousandth of a degree grows by e every 2.1 s, λ = 0.48 per second for this box, until it reaches a flip.
  - id: wobbling-plate
    title: A thin disc wobbles twice as fast as it spins
    params: { body: disc, axis: largest, tilt: 1 }
    observe: The disc's axis turns about L at |L|/I⊥ while the disc turns about its axis at half that rate, the other way.
  - id: fast-top
    title: A fast top precesses slowly
    params: { body: top, start: rest }
    observe: Released at rest at 30°, the top dips by less than a quarter of a degree, nutates 8 times a second and precesses at 0.2007 rad/s, within half a per cent of Mgl/(I₃ω₃).
  - id: steady-top
    title: Steady precession, without nutation
    params: { body: top, start: steady }
    observe: Given the slow root of I⊥ cos θ Ω² − I₃ω₃Ω + Mgl = 0 as its start, the top precesses at that rate with its lean unchanged.
  - id: slow-top
    title: A slow top loops
    params: { body: top, start: rest, w3: 15, mgl: 2 }
    observe: At a tenth of the spin the nutation is wide and slow, and the axis's path shows the cusps of a top released at rest.
claims:
  - id: flip-period
    statement: >-
      Spun within 1° of its middle axis, the 1 × 2 × 3 box flips with the body-frame period 4K(k)·√(I₁I₂I₃/((I₃ −
      I₂)(L² − 2EI₁))) of Euler's top, about 42.2 s, within 1e−6 s; the closed form uses only the starting E and L.
    readout: period of the body’s motion, measured between upward zeros of ω₂ (s)
    expect: { against: 'period of the body’s motion 4K(k)·√(I₁I₂I₃/((I₃ − I₂)(L² − 2EI₁))) (s)', tolerance: 0.000001 }
  - id: flips-counted
    statement: >-
      In 120 s at that tilt ω₂ changes sign six times: three periods, two flips each.
    readout: flips of ω₂, the middle axis, counted
    expect: { value: 6 }
  - id: energy-kept
    statement: >-
      (numerics) The fourth-order splitting keeps the energy within 1e−8 of its start over the flipping run.
    readout: 'energy, largest relative change |E − E₀|/|E₀|, numerics'
    expect: { below: 0.00000001 }
  - id: magnitude-kept
    statement: >-
      (numerics) Every piece of the splitting is a rotation of L, so |L| stays within 1e−12 of its start.
    readout: '|L|, largest relative change, numerics'
    expect: { below: 0.000000000001 }
  - id: momentum-in-space-kept
    statement: >-
      (numerics) The body and its momentum turn by opposite angles in every piece, so L in space stays within
      1e−12 of its start while the body flips.
    readout: 'L in space, largest change |L − L₀|/|L₀|, numerics'
    expect: { below: 0.000000000001 }
  - id: stable-largest-period
    statement: >-
      Tilted 20° from the axis of the largest moment, the wobble's period matches the elliptic closed form within
      1e−6 s.
    readout: period of the body’s motion, measured between upward zeros of ω₂ (s)
    expect: { against: 'period of the body’s motion 4K(k)·√(I₁I₂I₃/((I₃ − I₂)(L² − 2EI₁))) (s)', tolerance: 0.000001 }
    setup:
      params: { axis: largest, tilt: 20 }
  - id: stable-smallest-period
    statement: >-
      Tilted 20° from the axis of the smallest moment, on the other side of the separatrix, it matches the closed
      form with 1 and 3 exchanged within 1e−6 s.
    readout: period of the body’s motion, measured between upward zeros of ω₂ (s)
    expect: { against: 'period of the body’s motion 4K(k)·√(I₁I₂I₃/((I₃ − I₂)(L² − 2EI₁))) (s)', tolerance: 0.000001 }
    setup:
      params: { axis: smallest, tilt: 20 }
  - id: small-wobble
    statement: >-
      Tilted only 0.5° from the largest axis, the period is the small-wobble limit 2π/(ω√((I₃ − I₁)(I₃ − I₂)/(I₁I₂)))
      within 1e−3 s; the gap grows as the square of the tilt, about 0.4 s at 20°.
    readout: period of the body’s motion, measured between upward zeros of ω₂ (s)
    expect: { against: small-wobble period 2π/Ω about that axis (s), tolerance: 0.001 }
    setup:
      params: { axis: largest, tilt: 0.5 }
  - id: growth-rate
    statement: >-
      A tilt of 1e−4° from the middle axis grows as e^(λt) with λ = ω√((I₃ − I₂)(I₂ − I₁)/(I₁I₃)) = 0.4804 per
      second within 1e−4, fitted while it grows from 1e−4 to 1e−2 rad.
    readout: growth rate of the tilt from the middle axis, fitted from 0.0001 to 0.01 rad (1/s)
    expect: { against: 'growth rate λ = ω√((I₃ − I₂)(I₂ − I₁)/(I₁I₃)) (1/s)', tolerance: 0.0001 }
    setup:
      params: { tilt: 0.0001, time: 60 }
  - id: disc-wobble
    statement: >-
      A thin disc tilted 10° from its axis wobbles about L at |L|/I⊥ within 1e−9 rad/s; its free flow is exact.
    readout: wobble of the symmetry axis about L, measured (rad/s)
    expect: { against: wobble |L|/I⊥ (rad/s), tolerance: 0.000000001 }
    setup:
      params: { body: disc, axis: largest, tilt: 10 }
  - id: wobble-twice-spin
    statement: >-
      Tilted 1°, the disc's wobble is twice its spin: the measured ratio lies between 2 and 2.001, as I_s/(|I⊥ −
      I_s| cos θ) = 2/cos 1° = 2.0003 says.
    readout: '|wobble/spin|, measured'
    expect: { range: [2, 2.001] }
    setup:
      params: { body: disc, axis: largest, tilt: 1 }
  - id: wobble-ratio-closed-form
    statement: >-
      At 10° the ratio has grown to 2/cos 10° = 2.0078, matched within 1e−9.
    readout: '|wobble/spin|, measured'
    expect: { against: '|wobble/spin| = I_s/(|I⊥ − I_s| cos θ)', tolerance: 0.000000001 }
    setup:
      params: { body: disc, axis: largest, tilt: 10 }
  - id: fast-top-precession
    statement: >-
      A top spinning at ω₃ = 100 rad/s, released at rest at 30°, precesses on average within 1 per cent of the
      gyroscope's Mgl/(I₃ω₃) = 0.2 rad/s; the remainder is of order I⊥Mgl/(I₃ω₃)², 0.4 per cent here.
    readout: mean precession rate, measured over whole nutations (rad/s)
    expect: { against: gyroscope approximation Mgl/(I₃ω₃) (rad/s), tolerance: 0.002 }
    setup:
      params: { body: top }
  - id: reduced-top-precession
    statement: >-
      The same mean precession matches the reduced top's, ⟨(b − au)/(1 − u²)⟩ over the nutation computed by
      quadrature from the starting E, L_z and L₃, within 1e−8 rad/s.
    readout: mean precession rate, measured over whole nutations (rad/s)
    expect: { against: 'mean precession of the reduced top, by quadrature (rad/s)', tolerance: 0.00000001 }
    setup:
      params: { body: top }
  - id: nutation-period
    statement: >-
      Its nutation repeats every 4K(k)/√(β(u₃ − u₁)), from the roots of the reduced top's cubic, within 1e−8 s.
    readout: nutation period, measured between the lowest points of the axis (s)
    expect: { against: 'nutation period 4K(k)/√(β(u₃ − u₁)) (s)', tolerance: 0.00000001 }
    setup:
      params: { body: top }
  - id: fast-nutation
    statement: >-
      That period is within 1 per cent of the fast top's 2πI⊥/(I₃ω₃) = 0.1257 s.
    readout: nutation period, measured between the lowest points of the axis (s)
    expect: { against: 'fast-top nutation period 2πI⊥/(I₃ω₃) (s)', tolerance: 0.0013 }
    setup:
      params: { body: top }
  - id: top-energy-kept
    statement: >-
      (numerics) The kick and the exact free flow together keep the top's energy within 1e−12 of its start.
    readout: 'energy, largest relative change |E − E₀|/|E₀|, numerics'
    expect: { below: 0.000000000001 }
    setup:
      params: { body: top }
  - id: top-lz-kept
    statement: >-
      (numerics) Gravity's torque is horizontal, so L_z in space stays within 1e−10 of |L|.
    readout: L_z in space, largest change over |L|, numerics
    expect: { below: 0.0000000001 }
    setup:
      params: { body: top }
  - id: top-l3-kept
    statement: >-
      (numerics) The torque is at right angles to the axis, so L₃ along it stays within 1e−12 of |L|.
    readout: L₃ along the axis, largest change over |L|, numerics
    expect: { below: 0.000000000001 }
    setup:
      params: { body: top }
  - id: steady-precession
    statement: >-
      Started at the slow root of I⊥ cos θ Ω² − I₃ω₃Ω + Mgl = 0, the top precesses at that rate within 1e−9 rad/s.
    readout: mean precession rate, measured over the run (rad/s)
    expect: { against: 'steady precession, slow root of I⊥ cos θ Ω² − I₃ω₃Ω + Mgl = 0 (rad/s)', tolerance: 0.000000001 }
    setup:
      params: { body: top, start: steady }
  - id: steady-lean
    statement: >-
      Its lean stays within 1e−9 rad of where it started: steady precession has no nutation.
    readout: range of the lean over the run, measured (rad)
    expect: { below: 0.000000001 }
    setup:
      params: { body: top, start: steady }
data:
  - id: points
    title: Your body
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: 'length (any unit)', min: -1000000, max: 1000000 }
      - { key: y, unit: 'length (any unit)', min: -1000000, max: 1000000 }
      - { key: z, unit: 'length (any unit)', min: -1000000, max: 1000000 }
      - { key: m, unit: 'mass (any unit)', min: 0, max: 1000000 }
    rows: { min: 1, max: 5000 }
    bytes: 262144
    replaces: body
    ignores: [a, b, c, ratio, w3, lean, mgl, start, run]
    url_bytes: 1800
    note: Each row is a point mass; the plate finds the centre of mass, the inertia tensor about it and its principal axes, and spins that body freely about the axis chosen, the moments scaled by the largest so the run depends only on their ratios.
---

A body spinning freely in space, and a top spinning on a pivot under gravity. A free body keeps its angular momentum L fixed in space, yet the body may tumble around it; a box spun about the axis of its middle moment turns over at regular intervals, however carefully it is started. A top's axis does not fall but turns slowly about the vertical, and nods as it goes.

**The model.** The state is the body's orientation and its angular momentum seen from the body. The energy of a free body is a sum of three pieces, L₁²/2I₁ + L₂²/2I₂ + L₃²/2I₃, and the motion under any one piece alone is a turn about that axis at L_i/I_i: exact, with no error. The plate takes those turns in Strang's symmetric order and raises the step to fourth order by Yoshida's triple jump. Every piece turns the body one way and its momentum, seen from the body, the other way by the same angle, so L in space and |L| are kept to round-off and the energy is kept to the fourth order of the step, without drift. A body with two equal moments has an exact free flow, a turn about L at |L|/I⊥ and one about its symmetry axis; the top adds gravity's torque as a kick at fixed orientation, half before and half after it.

**Euler's top.** With three unequal moments I₁ < I₂ < I₃, the energy and L² fix the motion: the body-frame ω runs along the curve where the energy ellipsoid meets the momentum sphere, and ω₂ is Jacobi's sn of time. Its period is 4K(k)·√(I₁I₂I₃/((I₃ − I₂)(L² − 2EI₁))), with 1 and 3 exchanged on the other side of the separatrix L² = 2EI₂, and K the complete elliptic integral, computed by the arithmetic–geometric mean from the start alone. The plate measures the period between upward zeros of ω₂ in its run and sets the two side by side. Near the axis of the largest or the smallest moment the curve is a small loop, and the period tends to 2π/Ω of a small wobble. Near the middle axis the curve passes close to the separatrix, and a small tilt grows as e^(λt), λ = ω√((I₃ − I₂)(I₂ − I₁)/(I₁I₃)), until the body has turned over; then it comes back and does it again, a flip every half period.

**The wobbling plate.** A disc has I_s = 2I⊥ about its axis. Thrown with a small wobble, its axis turns about L at |L|/I⊥, while the disc turns about its own axis at L_s(1/I_s − 1/I⊥), half as fast and the other way; the ratio is I_s/(|I⊥ − I_s| cos θ), 2/cos θ for the disc. The plate measures both rates from the run, the first as the azimuth of the axis about L, the second from L as the body sees it.

**The heavy top.** A symmetric top with its centre of mass at l along its axis feels the torque Mgl sin θ about a horizontal line, at right angles to the axis, so its L_z and its L₃ are kept and so is its energy. With u = cos θ these three reduce the motion to u̇² = f(u), a cubic; the axis nods between the two lower roots of f, in the time 4K(k)/√(β(u₃ − u₁)), while its azimuth turns at (b − au)/(1 − u²). The plate averages that rate over a nod by quadrature, a computation that never sees the three-dimensional run, and compares it with the precession it measures between the lowest points of the axis. A fast top, I₃²ω₃² ≫ I⊥Mgl, precesses at nearly Mgl/(I₃ω₃) and nods at nearly I₃ω₃/I⊥; given the slow root of steady precession as its start it does not nod at all. The magnetic analogue is #/p/spin-precession; the Earth's turn in #/p/foucault-pendulum is another slow turn of a fast motion.

**Your body.** A table of point masses replaces the box: the plate finds their centre of mass, their inertia tensor and its principal axes by Jacobi rotations, and spins that body. The run depends only on the ratios of the moments, so the units of length and mass do not matter. The data stays in the browser; the claims are made on the box, the disc and the top.
