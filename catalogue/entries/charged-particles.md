---
id: charged-particles
title: Charged Particles in Electric and Magnetic Fields
taxonomy: physics/electrostatics
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. II, ch. 29 (the motion of charges in electric and magnetic fields)'
    purpose: further-reading
  - id: jackson-1999
    ref: 'Ch. 12, dynamics of charged particles in electromagnetic fields'
    purpose: further-reading
tags:
  - Lorentz force
  - cyclotron motion
  - E×B drift
  - Wien filter
  - magnetic mirror
  - Boris pusher
complexity: O(steps) per orbit; the mirror O(particles × steps), a few particles a frame
interaction: Choose the experiment, the charge over mass, the fields and the speed; the orbit is pushed and drawn as it goes. Attach your own velocities to fill the mirror.
motivation: A magnetic field never changes a charge's speed, only its direction; from that come the circles of a cyclotron, the sideways drift of every charge across crossed fields, the velocity filter of a mass spectrometer and the bottles that hold a plasma.
relations:
  - type: related_to
    target: kepler-orbits
    reason: The same shared library of integrators pushes both; there leapfrog for a central force, here the Boris rotation, which keeps the speed exact in a magnetic field as leapfrog keeps the energy bounded.
  - type: related_to
    target: four-vectors
    reason: The E×B drift is the speed of the frame in which the electric field vanishes, the frame that plate boosts to.
pedagogy:
  difficulty: intermediate
  objectives:
    - See a charge in a uniform magnetic field circle with radius mv/qB and period 2πm/qB, the period independent of its speed.
    - See every charge, positive or negative, drift across crossed fields at E/B.
    - Find the speed a Wien filter passes undeflected, and see it is E/B.
    - Watch a magnetic mirror hold the particles outside its loss cone, sin²α > B₀/B_max, while the gyroradius is small against the field's scale.
  misconceptions:
    - A magnetic field does no work on a charge; it only turns it, so its speed and kinetic energy stay the same.
    - The drift across crossed fields does not depend on the charge or the mass; opposite charges drift the same way.
    - A mirror does not hold every particle; those moving too nearly along the field escape through the ends, whatever their speed.
  questions:
    - Why is the cyclotron period independent of the speed, and what breaks that at high energy?
    - How can a positive and a negative charge drift in the same direction when the forces on them are opposite?
    - Why does the mirror leak more when the particles are fast or light, though the loss cone's formula does not mention the speed?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - Non-relativistic speeds; the fields are prescribed and the particles do not feel each other.
  limitations:
    - The mirror's field is divergence-free only to first order in the distance from the axis, which the gyroradii here keep small.
    - The loss cone is the adiabatic prediction; when the gyroradius is not small against the field's length the invariant μ fails and more particles escape, as the fast settings show.
experiments:
  - id: negative
    title: A negative charge
    params: { qm: -1 }
    observe: The same circle, turned the other way.
  - id: drift-both-signs
    title: Drift of both signs
    params: { scenario: drift, qm: -2 }
    observe: The drift is E/B and in the same direction as for a positive charge.
  - id: tight-mirror
    title: A tight mirror
    params: { scenario: mirror, wall: 3 }
    observe: Only the particles within 18° of the axis escape.
  - id: non-adiabatic
    title: Too fast for the mirror
    params: { scenario: mirror, v: 2, qm: 0.25, wall: 3 }
    observe: The gyroradius is larger than the bottle, μ is not kept, and three times the predicted share escapes.
claims:
  - id: gyroradius
    statement: >-
      A charge of q/m = 1 at speed 0.5 in B = 2 circles with radius mv/|q|B = 0.25 within 10⁻⁵, measured
      as its mean distance from the orbit's centre.
    readout: gyroradius, measured from the orbit
    expect: { against: 'closed form m v/(|q| B)', tolerance: 1.0e-5 }
    setup:
      params: { scenario: gyration }
  - id: cyclotron-period
    statement: >-
      Its period, from the turning of its velocity, is 2πm/|q|B within 10⁻⁵; the Boris step's phase error
      (ωh)²/12 is below 10⁻⁶ here.
    readout: period, measured from the turning velocity
    expect: { against: 'closed form 2πm/(|q| B)', tolerance: 1.0e-5 }
    setup:
      params: { scenario: gyration }
  - id: exb-drift
    statement: >-
      A charge of q/m = −2 drifts across E = 0.5 and B = 2 at E/B = 0.25 within 10⁻⁵, measured over ten
      gyrations: the same drift as a positive charge's.
    readout: drift speed, measured over ten gyrations
    expect: { against: 'closed form E/B, whatever the charge', tolerance: 1.0e-5 }
    setup:
      params: { scenario: drift, qm: -2 }
  - id: wien-filter
    statement: >-
      The speed a Wien filter passes undeflected, found by bisection on the exit offset of pushed
      charges, is E/B within 10⁻⁵.
    readout: undeflected speed, by bisection on the exit offset
    expect: { against: 'closed form E/B', tolerance: 1.0e-5 }
    setup:
      params: { scenario: wien }
  - id: loss-cone
    statement: >-
      Two thousand particles started isotropically at a mirror's centre escape in the adiabatic
      share 1 − √(1 − B₀/B_max) within 0.033 when the gyroradius is an eighth of the field's length:
      four standard deviations over the calibration seeds 101–130 (0.029) plus the offset the finite
      gyroradius leaves on the same seeds (0.004), at every seed of 1 and 2. The band is derived in
      test/charged-particles-claims.test.ts: a particle is kept exactly when |cos α| is at most one
      threshold, found by bisection on the plate's own orbit, so each calibration seed's share is
      counted from its launches; a loss cone 5° wider or narrower reads outside the band.
    readout: escaping share, measured
    expect: { against: 'adiabatic loss cone sin²α_c = B₀/B_max, escaping share 1 − √(1 − B₀/B_max)', tolerance: 0.033 }
    setup:
      params: { scenario: mirror, particles: 2000 }
      seeds: [1, 2]
data:
  - id: velocities
    title: Your particles
    kind: table
    accepts: [csv, json]
    columns:
      - { key: vx, unit: 'speed (q/m and B₀ = 1)', min: -3, max: 3 }
      - { key: vy, unit: 'speed (q/m and B₀ = 1)', min: -3, max: 3 }
      - { key: vz, unit: 'speed along the axis', min: -3, max: 3 }
    rows: { min: 1, max: 2000 }
    bytes: 65536
    replaces: scenario
    ignores: [B, E, v, wall, particles]
    url_bytes: 1800
    note: Each row is a particle started at the centre of the mirror, its walls at 1.5 L, with that velocity; the plate pushes each and counts how many escape.
---

Charges pushed through electric and magnetic fields by the Boris method, and four of the experiments that made the Lorentz force q(E + v × B) the most tested law in physics.

**The pusher.** Each step gives the charge half of its electric kick, rotates its velocity about B by the angle the magnetic force turns it through, and gives it the other half; the rotation is exact, so a magnetic field never changes the speed, and the step's only error is a phase, (ωh)²/12 of a turn per turn. The fields are taken where the charge is. The method is the shared library's, the one #/p/kepler-orbits uses for its integrators.

**Gyration.** In a uniform B a charge circles with angular frequency ω = |q|B/m, whatever its speed, at radius v/ω. The plate measures both from the orbit itself: the radius as the mean distance from its centre, the period from how fast its velocity turns.

**Drift.** Add an electric field across B and the circle slides sideways at E/B: on the half of the circle where the charge moves with the electric force it speeds up and turns less sharply, on the other half it slows and turns more. A negative charge circles the other way and is pushed the other way, and drifts in the same direction. The drift is the speed of the frame in which only the magnetic field remains (#/p/four-vectors).

**A velocity filter.** A beam through crossed E and B is deflected one way by E and the other by v × B; only the speed v = E/B passes straight. The plate finds that speed by bisection on where pushed charges leave the filter.

**A magnetic bottle.** Where the field lines crowd together the field is stronger, and a gyrating charge keeps its magnetic moment μ = mv⊥²/2B nearly constant while the field changes slowly over one gyration. Moving into the stronger field it must trade speed along the field for speed across it, and if it runs out it is reflected. A charge at the centre with pitch angle α escapes only if sin²α < B₀/B_max, so an isotropic cloud loses the share 1 − √(1 − B₀/B_max). Pushed one by one, the particles bear that out while their gyroradius is small against the bottle; made fast or light, the invariant fails and the mirror leaks more.

**Your particles.** A table of velocities fills the mirror instead of the isotropic cloud; each is pushed from the centre and counted as kept or lost. The table stays in the browser.
