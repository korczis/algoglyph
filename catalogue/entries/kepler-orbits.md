---
id: kepler-orbits
title: Kepler Orbits and Their Departures
taxonomy: physics/gravitation
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 7 (the theory of gravitation), ch. 9 (an orbit computed step by step), ch. 13 and 14 (energy and potential)'
    purpose: further-reading
  - id: goldstein-classical-mechanics
    ref: 'Chapter 3: the central-force problem, Bertrand''s theorem, the apsidal angle, scattering in a central field, and the relativistic precession'
    purpose: implementation
  - id: rutherford-1911
    purpose: history
  - id: hairer-lubich-wanner
    ref: 'Chapters I and VI: symplectic integrators, and why their energy error stays bounded'
    purpose: implementation
tags:
  - Kepler's laws
  - central force
  - Bertrand's theorem
  - perihelion precession
  - Rutherford scattering
  - symplectic integration
complexity: O(steps) per orbit, ten perihelia at 2000 steps per time 2π; scattering O(particles × ~850 RK4 steps)
interaction: Choose the experiment, the integrator and the step; drag on the canvas to launch the body by hand. Attach your own table of bodies (x, y, vx, vy) to integrate them around the same centre.
motivation: One law of force gives ellipses, equal areas and a period fixed by the size alone; change the law even slightly and the orbit no longer closes, which is how a planet's slow turning revealed relativity and a few bounced alpha particles revealed the nucleus.
relations:
  - type: related_to
    target: poincare-section
    reason: Marking an orbit once a turn, at each perihelion, is a section of the flow; a closed orbit leaves one point, a precessing one a ring.
  - type: related_to
    target: foucault-pendulum
    reason: A line that turns slowly against the fixed stars, there the pendulum's plane carried by the Earth, here the perihelion pushed by a force that is not exactly inverse square.
  - type: analogue_of
    target: charges-and-field-lines
    reason: Rutherford's repulsion is Coulomb's law between two charges, Kepler's attraction is Newton's between two masses; κ = q₁q₂/4πε₀m stands for −GM.
pedagogy:
  difficulty: intermediate
  objectives:
    - Measure a period and a semimajor axis from an integrated orbit and check that T² grows as a³.
    - See equal areas swept in equal times, and tie it to the angular momentum a central force keeps.
    - Find by experiment that only the inverse square and the linear spring give closed orbits for every launch.
    - Separate a real perihelion advance from the one an integrator makes up, by running both.
    - Read Rutherford's sin⁻⁴(θ/2) law off the counts of a simulated beam.
  misconceptions:
    - The period does not depend on the eccentricity; two orbits of the same semimajor axis take the same time however stretched one is.
    - A symplectic integrator does not conserve energy exactly; its error stays bounded instead of growing, while the step-by-step error of an ordinary method accumulates.
    - A slowly turning ellipse is not a sign of a third body; any small departure from the inverse square does it.
    - Back-scattering is not a head-on collision only; a fraction (κ/v₀² b_max)² of a uniform beam is turned by more than 90°.
  questions:
    - Why does the explicit Euler orbit spiral outwards rather than inwards?
    - For n = −1, how many perihelia does the orbit need before it nearly returns to its start?
    - Why does halving the field strength GM/(c²a) halve the advance, but not exactly?
    - How would the counts change if the nucleus were a soft cloud of charge instead of a point?
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
  preconditions:
    - The body is launched outside r = 0.05 of the centre; nothing is regularised at r = 0.
    - Scattering particles start at 10⁴ κ/v₀² with the energy and angular momentum they have at infinity.
  invariants:
    - Under a central force the angular momentum per unit mass h = |q × v| is constant; leapfrog and symplectic Euler keep it to round-off.
  limitations:
    - The centre is fixed (an infinitely heavy sun or nucleus); the two-body reduced mass is not modelled.
    - The relativistic term is the first-order weak-field correction of the orbit equation, 3GMh²/(c²r⁴), not the full Schwarzschild geodesic.
    - Apsides are located by a cubic Hermite interpolant between steps; at fewer than about 20 steps per perihelion passage the located apsis is no better than the step.
    - Your bodies are integrated for a fixed 20π; slower orbits are reported as not closed rather than run longer.
experiments:
  - id: circle
    title: A circle
    params: { e: 0 }
    observe: The twelve wedges are congruent; the speed never changes.
  - id: comet
    title: A comet
    params: { e: 0.9 }
    observe: The wedges near the sun are short and wide, far ones long and thin, all of one area; the period is still 2π.
  - id: wide-orbit
    title: A wider orbit
    params: { a: 2.5, e: 0.3 }
    observe: The period grows as a^(3/2), to 2π × 3.95.
  - id: euler-spirals
    title: Explicit Euler
    params: { integrator: euler }
    observe: Each step adds energy; the orbit spirals outwards and its period grows.
  - id: coarse-steps
    title: A coarse step, computed as by hand
    params: { resolution: 100 }
    observe: With a hundred steps a turn the leapfrog orbit stays bounded but turns slowly; that advance belongs to the integrator, not to gravity.
  - id: spring
    title: A spring force
    params: { mode: power, n: 1, s: 1.3 }
    observe: An ellipse centred on the origin; the apsidal angle is 90° and the orbit closes.
  - id: rosette
    title: Gravity in a plane world
    params: { mode: power, n: -1, s: 1.2 }
    observe: A force falling as 1/r never closes the orbit; the apsides turn by about 127° each.
  - id: strong-field
    title: A stronger field
    params: { mode: relativity, delta: 0.01 }
    observe: The perihelion advances about a twentieth of a radian each orbit, a rosette after a few turns.
  - id: rutherford
    title: Rutherford's beam
    params: { mode: scattering }
    observe: Most particles barely turn; about one in a hundred is thrown back, as the sin⁻⁴(θ/2) law says.
claims:
  - id: kepler-third-law
    statement: >-
      An orbit of semimajor axis 2.5 and eccentricity 0.3, integrated by leapfrog at 2000 steps per time 2π,
      returns to perihelion every 2π√(a³/GM), a measured from its own apsides, within 1e−4 of a period of
      24.8; the step's own error, second order, is under a tenth of that.
    readout: period T, measured between perihelia
    expect: { against: 'Kepler III: 2π√(a³/GM), a measured', tolerance: 0.0001 }
    setup:
      params: { a: 2.5, e: 0.3 }
  - id: energy-of-an-ellipse
    statement: >-
      The energy per unit mass the body starts with equals −GM/2a, a measured from the apsides, within
      1e−4: the energy of a Kepler orbit depends on its size alone.
    readout: energy per unit mass at the start
    expect: { against: 'energy −GM/2a, a measured', tolerance: 0.0001 }
  - id: equal-areas
    statement: >-
      The areas swept in twelve equal times of one period agree within 1e−6 of their mean, Kepler's
      second law; leapfrog keeps h exactly, so the measured spread is round-off.
    readout: 'Kepler II: areas swept in 12 equal times, spread (max − min)/mean'
    expect: { below: 0.000001 }
  - id: leapfrog-keeps-h
    statement: >-
      (numerics) Leapfrog keeps the angular momentum of a central force to round-off: over ten orbits h
      departs from its start by less than 1e−12.
    readout: angular momentum drift |Δh/h|
    expect: { below: 0.000000000001 }
  - id: euler-gains-energy
    statement: >-
      (numerics) Explicit Euler at the same step gains energy every orbit: its largest error exceeds 10 %
      where leapfrog's stays near 3e−5.
    readout: largest energy error |ΔE/E|
    expect: { above: 0.1 }
    setup:
      params: { integrator: euler }
  - id: spring-closes
    statement: >-
      Under a force growing as r, launched 30 % above the circular speed, the angle from perihelion to
      aphelion is 90° within 1e−5° (integrated by RK4), at any amplitude: one of Bertrand's two closed cases.
    readout: apsidal angle, perihelion to aphelion, measured (°)
    expect: { against: 'apsidal angle 180°/√(n + 3), the near-circular closed form', tolerance: 0.00001 }
    setup:
      params: { mode: power, n: 1, s: 1.3, integrator: rk4 }
  - id: inverse-square-closes
    statement: >-
      Under the inverse square, launched 30 % above the circular speed, the apsidal angle is 180° within
      1e−5° (by RK4): the other closed case. Leapfrog at the same step turns it by its own 1e−4°.
    readout: apsidal angle, perihelion to aphelion, measured (°)
    expect: { against: 'apsidal angle 180°/√(n + 3), the near-circular closed form', tolerance: 0.00001 }
    setup:
      params: { mode: power, n: -2, s: 1.3, integrator: rk4 }
  - id: near-circular-apsidal-angle
    statement: >-
      Under a force falling as 1/r, launched 1 % above the circular speed, the apsidal angle is
      180°/√2 = 127.28° within 3e−3°; the gap is second order in the departure from the circle (it falls
      by four when the departure halves).
    readout: apsidal angle, perihelion to aphelion, measured (°)
    expect: { against: 'apsidal angle 180°/√(n + 3), the near-circular closed form', tolerance: 0.003 }
    setup:
      params: { mode: power, n: -1, s: 1.01 }
  - id: relativistic-advance
    statement: >-
      With GM/(c²a) = 0.001 and e = 0.5 the perihelion advances 6πGM/(c²a(1 − e²)) = 0.0252 rad per orbit
      within 3e−4 rad, once the integrator's own advance, measured on the same launch without the
      correction, is taken off; the formula is first order, and the next order is about 0.6 % here.
    readout: 'relativistic advance: measured less the integrator’s own (rad)'
    expect: { against: 'first-order weak field 6πGM/(c²a(1 − e²)), a and e measured (rad)', tolerance: 0.0003 }
    setup:
      params: { mode: relativity }
  - id: rutherford-deflection
    statement: >-
      Every particle of the beam leaves at the angle 2 atan(κ/(v₀² b)) within 1e−5 rad, the hyperbola's
      closed form, though the integrator knows only the force.
    readout: largest |θ − 2 atan(κ/(v₀² b))| over the beam (rad)
    expect: { below: 0.00001 }
    setup:
      params: { mode: scattering }
  - id: rutherford-counts
    statement: >-
      A thousand particles counted in ten bins of equal Rutherford probability give a χ² below its
      99.9 % point for nine degrees of freedom, 27.88: the counts follow the sin⁻⁴(θ/2) law.
    readout: χ² of the counts in 10 bins of equal Rutherford probability
    expect: { against: 'χ² 99.9 % point for 9 degrees of freedom', below: 0 }
    setup:
      params: { mode: scattering }
  - id: rutherford-back-scattering
    statement: >-
      The particles turned through more than 90° number N(κ/(v₀² b_max))², ten in a thousand, within four
      binomial standard errors.
    readout: deflected beyond 90°, in standard errors from Rutherford’s N(κ/(v₀² b_max))²
    expect: { range: [-4, 4] }
    setup:
      params: { mode: scattering }
data:
  - id: bodies
    title: Your bodies
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: 'length (GM = 1)', min: -5, max: 5 }
      - { key: y, unit: 'length (GM = 1)', min: -5, max: 5 }
      - { key: vx, unit: 'speed (GM = 1)', min: -5, max: 5 }
      - { key: vy, unit: 'speed (GM = 1)', min: -5, max: 5 }
    rows: { min: 1, max: 16 }
    bytes: 8192
    replaces: mode
    ignores: [a, e, n, s, delta, particles, beam]
    url_bytes: 1800
    note: Each row is a test body launched at (x, y) with velocity (vx, vy) around a fixed centre of GM = 1; each is integrated for 20π with the integrator and step chosen, and its period, axis and eccentricity are measured from its own apsides.
---

A body under a central force, in four experiments: the inverse square with Kepler's three laws, other powers of r and whether their orbits close, the first relativistic correction and the perihelion advance it causes, and a repulsive inverse square scattering a beam as Rutherford's alpha particles were scattered.

**The method.** The acceleration −k rⁿ⁻¹ q (k = GM = 1) is integrated by one of four integrators of the shared library: leapfrog by default, the classical Runge–Kutta method, symplectic Euler or explicit Euler. Nothing in the plate knows the conic sections. It finds each perihelion and aphelion where the radial velocity q·v changes sign, places it between the two steps that bracket it by a cubic Hermite interpolant through their positions and velocities, and reads the period, the semimajor axis (r_peri + r_apo)/2, the eccentricity, the apsidal angle and the advance of the perihelion from those points alone. The closed forms beside the measurements are what they are held to.

**Kepler's laws.** Launched at perihelion with the speed of an ellipse of the chosen size and shape, the body returns every 2π√(a³/GM) whatever its eccentricity (the third law), with energy −GM/2a (the size alone fixes it), sweeping equal areas in equal times (the second law, which is the angular momentum a central force cannot change). The twelve wedges are cut at equal times of the measured period; their areas are summed from the steps' own triangles. Leapfrog keeps the angular momentum exactly, so the wedges agree to round-off, and its energy error stays bounded orbit after orbit. Explicit Euler adds energy at every step and the orbit spirals outwards. Even leapfrog, at a coarse step, makes the ellipse turn a little: an advance the integrator invents, which the next experiment has to subtract.

**Which orbits close.** For a force ∝ rⁿ a nearly circular orbit swings between its apsides through the angle π/√(n + 3), so it closes only when that is a rational fraction of a turn for every launch, which leaves n = −2 (the angle is π) and n = 1 (π/2), Bertrand's theorem. The plate shows both closing at large eccentricity, and the rosettes every other law makes; away from the circle the angle drifts from π/√(n + 3) by an amount second order in the departure.

**The relativistic advance.** General relativity adds to Newton's attraction a term 3GMh²/(c²r⁴), with h the angular momentum per unit mass. The orbit is no longer closed: its perihelion advances by 6πGM/(c²a(1 − e²)) per orbit to first order in GM/(c²a). The plate measures the advance twice on the same launch, with and without the term, and takes the integrator's own advance off. For Mercury GM/(c²a) is about 2.6 × 10⁻⁸, which gives the famous 43 seconds of arc a century; the default exaggerates the field some forty thousand times so the turning shows in a few orbits.

**Rutherford scattering.** With the force reversed and κ = q₁q₂/4πε₀m in place of GM, a particle coming in at impact parameter b leaves on a hyperbola turned through θ = 2 atan(κ/(v₀²b)). The plate integrates each particle by RK4, with the step proportional to r/v so that the close approach is resolved, from 10⁴ κ/v₀² away and back; a beam uniform over a disc of radius b_max then has the fraction (cot(θ/2) κ/(v₀² b_max))² deflected beyond θ, which is the sin⁻⁴(θ/2) law per solid angle. The counts in ten bins of equal predicted probability are tested by χ², and the back-scattered fraction against its binomial standard error. The same equation with the sign flipped is gravity; with masses for charges it is in #/p/charges-and-field-lines, and with many bodies pulling on each other it is #/p/n-body.

**Your bodies.** A table of starting positions and velocities runs each body around the same centre for 20π with the integrator and step chosen; every bound one that closes two perihelia in that time gets its period, axis and eccentricity measured, and the worst departure from the third law among them is reported. The table stays in the browser.
