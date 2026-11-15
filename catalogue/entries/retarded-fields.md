---
id: retarded-fields
title: The Fields of a Moving Charge
taxonomy: physics/radiation
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 28 (electromagnetic radiation), ch. 34 (relativistic effects in radiation); Vol. II, ch. 21 (solutions of Maxwell’s equations with currents and charges), ch. 26 (Lorentz transformations of the fields)'
    purpose: further-reading
  - id: jackson-1999
    ref: 'Ch. 14, radiation by moving charges'
    purpose: further-reading
tags:
  - Liénard–Wiechert potentials
  - retarded time
  - Larmor formula
  - synchrotron radiation
  - relativistic Doppler effect
  - electromagnetic radiation
complexity: O(Newton steps) per field point; the map is a few thousand points a frame, the power one sphere of points a frame
interaction: Choose how the charge moves and how fast, and for the antenna how fast it is carried along; the field map follows the run's time.
motivation: A charge is felt where it was, not where it is, because the news of where it is travels at the speed of light; from that one fact come the flattened field of a fast charge, the light an antenna sends out, the beam a synchrotron makes and the Doppler shift of everything that moves.
relations:
  - type: related_to
    target: minkowski-diagram
    reason: The retarded time is where the observer's past light cone cuts the charge's worldline, the cone that diagram draws.
  - type: related_to
    target: four-vectors
    reason: The field of a charge in uniform motion is its Coulomb field transformed to a moving frame, which that plate does with the field tensor.
  - type: compares_with
    target: maxwell-1d
    reason: The same Maxwell equations, solved there on a grid that steps the fields forward, here in closed form from the charge's retarded position.
pedagogy:
  difficulty: advanced
  objectives:
    - Find the retarded time at which a charge sends the field that arrives at a point now, and see that it is unique while the charge is slower than light.
    - See that a charge in uniform motion has the flattened Heaviside field, pointing from where it is now, though it is computed from where it was.
    - Measure the power an oscillating charge radiates through a large sphere and compare it with Larmor's formula, and its pattern with sin²θ.
    - Measure the frequency an observer receives from a moving source and compare it with the relativistic Doppler formula.
  misconceptions:
    - The field of a charge in uniform motion does not point back to its retarded position; the velocity field, flattened, points from its present position.
    - Radiation does not come from velocity; a charge in uniform motion radiates nothing, and only acceleration sends energy to infinity.
    - The Doppler shift of light is not the sound's; even an observer at right angles to the motion receives a lower frequency, by the time dilation 1/γ.
  questions:
    - Why is the field ahead of a fast charge weaker and the field beside it stronger than Coulomb's, by (1 − β²) and 1/√(1 − β²)?
    - The pattern of an antenna departs from sin²θ by an amount of second order in its speed. Why does the first order cancel over a period?
    - Why does a charge on a circle radiate γ⁴ times Larmor's power, and where in the plane does most of it go?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - The charge is always slower than light; the controls keep the peak speed below 0.9 c, and an antenna carried along has the speed √(V² + β²(1 − V²)).
  limitations:
    - The worldline is prescribed; the charge does not feel its own field (radiation reaction is left out).
    - The map is in the plane z = 0 only; the power is measured through a sphere at twelve units, where the near field still exchanges energy within a period but not on average.
experiments:
  - id: fast-uniform
    title: A fast charge, coasting
    params: { motion: uniform, beta: 0.8 }
    observe: The field is squeezed into the plane at right angles to the motion and points from where the charge is now.
  - id: antenna
    title: An antenna
    params: { motion: oscillating, beta: 0.3 }
    observe: The radiation leaves in two lobes at right angles to the oscillation, and its power is Larmor's with Liénard's correction.
  - id: carried-antenna
    title: An antenna carried along
    params: { motion: oscillating, beta: 0.1, drift: 0.5 }
    observe: Ahead the waves crowd together, three times as frequent as behind.
  - id: synchrotron
    title: A synchrotron
    params: { motion: circular, beta: 0.8 }
    observe: The radiation is a spiral swept forward, and its power γ⁴ times Larmor's.
claims:
  - id: uniform-motion-is-heaviside
    statement: >-
      At 0.8 c the Liénard–Wiechert field, computed from the retarded position, velocity and acceleration,
      is Heaviside's field computed from the present position alone, to 10⁻¹⁰ of its size at sixty points.
    readout: largest |E − E_Heaviside|/|E| over sixty points
    expect: { below: 1.0e-10 }
    setup:
      params: { motion: uniform, beta: 0.8 }
  - id: field-flattens
    statement: >-
      At 0.8 c the field ahead over the field beside, at the same distance from the present position, is
      (1 − β²)^(3/2) = 0.216 within 10⁻⁹.
    readout: field ahead over field beside, at equal present distance
    expect: { against: 'Heaviside’s flattening (1 − β²)^(3/2)', tolerance: 1.0e-9 }
    setup:
      params: { motion: uniform, beta: 0.8 }
  - id: larmor-power
    statement: >-
      An antenna oscillating at a peak speed of 0.05 c radiates, through a sphere of radius twelve and on
      average over a period, Liénard's (2/3)⟨γ⁶a²⟩, Larmor's formula at low speed, within 10⁻⁸ (the
      quadrature's error, five orders below that).
    readout: power through a sphere of radius 12, averaged over a period
    expect: { against: 'Liénard’s (2/3)⟨γ⁶a²⟩, Larmor’s (2/3)⟨a²⟩ at low speed', tolerance: 1.0e-8 }
    setup:
      params: { motion: oscillating, beta: 0.05, drift: 0 }
  - id: dipole-pattern
    statement: >-
      Its radiation pattern dP/dΩ is sin²θ to within 2β² = 0.005 of its peak: the first-order Doppler
      tilt cancels over a period, and what remains is second order in the speed.
    readout: largest departure of dP/dΩ from sin²θ, of its peak
    expect: { below: 0.005 }
    setup:
      params: { motion: oscillating, beta: 0.05, drift: 0 }
  - id: synchrotron-power
    statement: >-
      A charge on a circle at 0.6 c radiates, through a sphere of radius twelve and on average over a
      turn, the synchrotron's (2/3)γ⁴a² within 10⁻⁸.
    readout: power through a sphere of radius 12, averaged over a turn
    expect: { against: 'synchrotron (2/3)γ⁴a², a = β²/ρ', tolerance: 1.0e-8 }
    setup:
      params: { motion: circular, beta: 0.6 }
  - id: doppler-ahead-and-behind
    statement: >-
      An antenna carried at 0.5 c is received ahead at (1 + β)/(1 − β) = 3 times the frequency received
      behind, within 2 × 10⁻⁴, timed from the zero crossings of the field forty units away, where the
      fading near field still moves the phase by about 10⁻⁵ of a period.
    readout: frequency ahead over behind, measured
    expect: { against: '(1 + β)/(1 − β)', tolerance: 2.0e-4 }
    setup:
      params: { motion: oscillating, beta: 0.05, drift: 0.5 }
  - id: relativistic-doppler
    statement: >-
      The frequency received ahead is the source's own over γ(1 − β), the relativistic Doppler factor, within
      10⁻⁴; the source keeps its own frequency in its own frame, so a lab clock sees it slowed by γ.
    readout: frequency ahead over the source’s own, measured
    expect: { against: 'relativistic Doppler 1/(γ(1 − β)), ahead', tolerance: 1.0e-4 }
    setup:
      params: { motion: oscillating, beta: 0.05, drift: 0.5 }
  - id: retarded-time-solved
    statement: >-
      Numerics: the retarded time solves t − t_r = |r − r_s(t_r)| to 10⁻¹¹ at forty points and times.
    readout: largest |t − t_r − |r − r_s(t_r)|| (numerics)
    expect: { below: 1.0e-11 }
    setup:
      params: { motion: circular, beta: 0.9 }
---

A point charge moving along a prescribed path, and its electric field computed from where it was when the field set out, the only place a field can come from.

**The retarded time.** The field at a point r at time t was sent by the charge at an earlier time t_r, when it was a light-time away: t − t_r = |r − r_s(t_r)|. The left side falls as t_r grows and the right falls more slowly while the charge is slower than light, so there is exactly one root. The plate finds it by Newton's method, kept inside a bracket where the equation changes sign and bisecting whenever a step would leave it.

**The fields.** From the charge's position, velocity β and acceleration β̇ at t_r, with n the direction from there to the point, R the distance and κ = 1 − n·β, the Liénard–Wiechert field is E = (n − β)(1 − β²)/(κ³R²) + n × ((n − β) × β̇)/(κ³R), and B = n × E (units c = 1, q/4πε₀ = 1). The first term falls as 1/R² and belongs to the charge; the second falls as 1/R, carries energy to infinity, and is there only while the charge accelerates. The map shows |E| on a log scale in the plane of the motion, and its direction.

**Uniform motion.** A coasting charge's field, computed from its retarded position, turns out to point from its present position and to be Heaviside's flattened field: weaker ahead and behind by (1 − β²), stronger beside by 1/√(1 − β²). The plate computes both, one from the retarded time and one from the present position alone, and compares them.

**Radiation.** For an oscillating charge the plate integrates the Poynting flux E × B/4π through a sphere at twelve units, by Gauss–Legendre in the polar angle and the trapezoid around it, at sixteen times spread over a period, one time a frame. The average is the radiated power, compared with Liénard's (2/3)⟨γ⁶(a² − (β × a)²)⟩, which is Larmor's (2/3)⟨a²⟩ at low speed, and the flux on each ring of the sphere gives the pattern, sin²θ about the axis of oscillation. A charge on a circle at speed β radiates (2/3)γ⁴a², the synchrotron's power, swept forward into a beam as β approaches 1.

**Doppler.** An antenna carried along at V keeps its own frequency in its own frame; observers far ahead and far behind time the zero crossings of the field they receive. Ahead the frequency is the source's own over γ(1 − β), behind over γ(1 + β), and the ratio of the two, (1 + β)/(1 − β), does not depend on the time dilation at all.

**The kick.** A charge at rest is accelerated briefly and then coasts. Outside the light front of the kick's start the field still points from where the charge was; inside the front of its end, from where it now coasts; between them is a thin shell where the field lines are joined sideways, the radiation, running outwards at the speed of light.
