---
id: collisions
title: Collisions
taxonomy: physics/mechanics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - elastic collision
  - coefficient of restitution
  - Newton's cradle
  - Galperin's billiard
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 10 (conservation of momentum: elastic and inelastic collisions, in the centre-of-mass frame)'
    purpose: further-reading
  - id: goldstein-classical-mechanics
    ref: 'Chapter 3: scattering, and the transformation of the scattering angle from the centre-of-mass frame to the laboratory'
    purpose: implementation
  - id: galperin-2003
    purpose: implementation
tags:
  - conservation of momentum
  - elastic collision
  - inelastic collision
  - coefficient of restitution
  - centre-of-mass frame
  - Newton's cradle
  - digits of π
  - event-driven simulation
complexity: O(events × disks) on the shared event core; the π billiard takes ⌈π/θ⌉ − 1 events, about π·10^k
interaction: Choose the experiment, then the mass ratio, the second body's speed and the restitution, the billiard's mass ratio, the cradle's row, or the impact parameter of a glancing hit.
motivation: A collision is over in an instant and everything about it follows from two conservation laws and one number, the restitution; the same rule, repeated between a wall and two blocks, counts out the digits of π.
relations:
  - type: related_to
    target: hard-disk-gas
    reason: The same event-driven core of exact collision times in a priority queue; there four hundred disks make a gas, here two to eight make a collision readable one event at a time.
  - type: uses
    target: binary-heap
    reason: Each disk's next event waits in the event core's indexed binary heap, so the earliest collision is always at the top.
  - type: related_to
    target: kepler-orbits
    reason: Both turn an impact parameter into a deflection; for hard disks χ = π − 2 asin(b/d), for Rutherford's inverse square 2 atan(κ/(v₀²b)).
pedagogy:
  difficulty: introductory
  objectives:
    - Predict the velocities after a head-on collision from momentum and the restitution, and check them against the measured run.
    - Find the share of the kinetic energy an inelastic collision loses, ½μ(1 − e²)(u₁ − u₂)², and see it vanish for e = 1.
    - See why a row of equal balls sends out as many balls as came in, at the speed they came.
    - Count the collisions of Galperin's billiard and relate the count to π through the reflections of the state on the energy circle.
    - Measure the right angle between two equal masses after a glancing elastic collision.
  misconceptions:
    - A light body hitting a heavy one does not stop; it bounces back, nearly at the speed it came.
    - An inelastic collision does not lose momentum; it loses kinetic energy only, and momentum is kept exactly whatever e is.
    - Newton's cradle does not send out one ball at twice the speed when two come in; energy and momentum together forbid it.
    - The count of π in the billiard is not a numerical accident; each collision is a reflection that turns the state by 2θ on a circle, and the count is how many fit in half a turn.
  questions:
    - With m₂ = 3m₁ and e = 1, why does the first body come back at half its speed?
    - What restitution makes the two bodies leave at the same velocity, and how much energy is lost then?
    - Why does the billiard with M = m need exactly three collisions?
    - In a glancing hit of a light disk on a heavy one, why can the light disk be turned back, but a heavy one on a light one can only be deflected by less than a right angle?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - Disks have one diameter per run; the event core handles any masses and restitutions between 0 and 1.
  invariants:
    - Momentum is exchanged along the line of centres only, so total momentum is kept to round-off whatever the restitution.
    - Between collisions every disk flies straight; collision times are roots of a quadratic, never stepped.
  limitations:
    - The bodies are smooth disks, with no friction between them and no spin.
    - Restitution acts only between disks; the walls are elastic.
    - The billiard's run stops once the heavy disk can no longer be caught, before it meets the far wall; a last bounce of the light disk still due then is counted and not shown.
experiments:
  - id: bounce-off-heavier
    title: A bounce off a heavier body
    params: { experiment: pair, ratio: 3 }
    observe: The first body comes back at half its speed and the heavier one leaves at half of it forwards; momentum and energy are both kept.
  - id: equal-exchange
    title: Equal masses swap
    params: { experiment: pair, ratio: 1 }
    observe: The first body stops dead and the second leaves with exactly its velocity.
  - id: sticking
    title: A perfectly inelastic collision
    params: { experiment: pair, ratio: 3, e: 0 }
    observe: The two leave together at the centre-of-mass velocity, a quarter of the first one's, and three quarters of the energy is gone.
  - id: closing-head-on
    title: Head on, from both sides
    params: { experiment: pair, ratio: 1, u2: -1, e: 0.5 }
    observe: Equal bodies meeting at equal speeds both rebound at half their speed; the centre of mass stays at rest.
  - id: pi-three-digits
    title: Three digits of π
    params: { experiment: pi, digits: 2 }
    observe: With M = 10 000 m the light disk is struck 314 times, wall bounces included; the state runs once around half of the energy circle.
  - id: pi-four-digits
    title: Four digits of π
    params: { experiment: pi, digits: 3 }
    observe: With the heavy disk a million times the light one, 3141 collisions.
  - id: cradle-two
    title: Two balls into a row of five
    params: { experiment: cradle, balls: 5, incoming: 2 }
    observe: Two balls leave the far end at the incoming speed and three stay at rest, after six collisions.
  - id: right-angle
    title: A glancing hit of equal masses
    params: { experiment: oblique, ratio: 1, impact: 0.5 }
    observe: The two disks leave at right angles, the first turned by 60°, the second along the line of centres.
  - id: light-on-heavy
    title: A light disk off a heavy one
    params: { experiment: oblique, ratio: 10, impact: 0.3 }
    observe: The light disk is turned back by more than a right angle, almost as from a wall.
claims:
  - id: head-on-first
    statement: >-
      A body hitting one three times heavier at rest, elastically, leaves with −½ its speed, the closed form
      (m₁u₁ + m₂u₂ + m₂e(u₂ − u₁))/(m₁ + m₂), within 1e−12.
    readout: velocity of body 1 after, measured (units of u₁)
    expect: { against: 'body 1 after, closed form (m₁u₁ + m₂u₂ + m₂e(u₂ − u₁))/(m₁ + m₂)', tolerance: 0.000000000001 }
  - id: head-on-second
    statement: >-
      The heavier body leaves with ½ the first one's speed, (m₁u₁ + m₂u₂ + m₁e(u₁ − u₂))/(m₁ + m₂), within 1e−12.
    readout: velocity of body 2 after, measured (units of u₁)
    expect: { against: 'body 2 after, closed form (m₁u₁ + m₂u₂ + m₁e(u₁ − u₂))/(m₁ + m₂)', tolerance: 0.000000000001 }
  - id: elastic-keeps-energy
    statement: >-
      With e = 1 the kinetic energy after equals the energy before within 1e−12 of it.
    readout: kinetic energy lost, measured (share of the start)
    expect: { value: 0, tolerance: 0.000000000001 }
  - id: inelastic-keeps-momentum
    statement: >-
      (numerics) With e = 0.5 the collision still keeps the total momentum within 1e−14 of it.
    readout: momentum change |Δp|/|p|, numerics
    expect: { below: 0.00000000000001 }
    setup:
      params: { e: 0.5 }
  - id: inelastic-energy-loss
    statement: >-
      With e = 0.5 the share of the kinetic energy lost equals ½μ(1 − e²)(u₁ − u₂)² over the starting energy,
      0.5625 here, within 1e−12.
    readout: kinetic energy lost, measured (share of the start)
    expect: { against: 'energy lost, closed form ½μ(1 − e²)(u₁ − u₂)² over the start', tolerance: 0.000000000001 }
    setup:
      params: { e: 0.5 }
  - id: galperin-three-digits
    statement: >-
      Galperin's billiard with M/m = 10⁴ counts ⌈π/θ⌉ − 1 = 314 collisions, θ = atan √(m/M), exactly.
    readout: collisions counted, disks and wall
    expect: { against: 'closed form ⌈π/θ⌉ − 1, θ = atan √(m/M)', tolerance: 0.5 }
    setup:
      params: { experiment: pi, digits: 2 }
  - id: galperin-four-digits
    statement: >-
      With M/m = 10⁶ the count is 3141, again ⌈π/θ⌉ − 1.
    readout: collisions counted, disks and wall
    expect: { against: 'closed form ⌈π/θ⌉ − 1, θ = atan √(m/M)', tolerance: 0.5 }
    setup:
      params: { experiment: pi, digits: 3 }
  - id: galperin-energy-circle
    statement: >-
      (numerics) Through the 314 collisions the state (√M v₂, √m v₁) stays on the energy circle within 1e−12
      of its radius.
    readout: largest departure from the energy circle |r − r₀|/r₀, numerics
    expect: { below: 0.000000000001 }
    setup:
      params: { experiment: pi, digits: 2 }
  - id: cradle-balls-out
    statement: >-
      Two balls swung into a row of five send out exactly two.
    readout: balls leaving the row
    expect: { against: 'balls swung in', tolerance: 0.5 }
    setup:
      params: { experiment: cradle, balls: 5, incoming: 2 }
  - id: cradle-speed
    statement: >-
      Three balls into a row of eight: the three that leave move at the incoming speed within 1e−12.
    readout: largest |v/u − 1| of a leaving ball
    expect: { below: 0.000000000001 }
    setup:
      params: { experiment: cradle, balls: 8, incoming: 3 }
  - id: right-angle
    statement: >-
      Two equal disks, one at rest, hit at half a diameter off centre, leave at 90° to each other within 1e−9°.
    readout: angle between the velocities after (°)
    expect: { value: 90, tolerance: 0.000000001 }
    setup:
      params: { experiment: oblique, ratio: 1, impact: 0.5 }
  - id: glancing-deflection
    statement: >-
      A disk hitting one 0.3 times its mass at 0.7 of a diameter off centre is deflected by
      atan(sin χ/(m₁/m₂ + cos χ)), χ = π − 2 asin(b/d), within 1e−9°.
    readout: deflection of the first disk, measured (°)
    expect: { against: 'deflection, closed form atan(sin χ/(m₁/m₂ + cos χ)), χ = π − 2 asin(b/d) (°)', tolerance: 0.000000001 }
    setup:
      params: { experiment: oblique, ratio: 0.3, impact: 0.7 }
---

Collisions between hard disks, found exactly by the event-driven core of #/p/hard-disk-gas and held to the closed forms of momentum, restitution and scattering: a head-on pair, Galperin's billiard counting the digits of π, Newton's cradle and a glancing hit in the plane.

**The rule of a collision.** Two smooth disks touch when the distance between their centres equals their diameter, a time the core finds as the root of a quadratic in the relative motion. At contact the only force is along the line of centres, so the impulse J changes the two velocities by ±J/m along that line, which keeps the total momentum exactly. Its size is fixed by the coefficient of restitution e: the normal relative speed after is e times the one before. With e = 1 the kinetic energy is kept too; with e < 1 the collision loses ½μ(1 − e²)u², μ = m₁m₂/(m₁ + m₂) the reduced mass and u the normal speed of approach, and at e = 0 the bodies leave together at the velocity of their centre of mass.

**Head on.** On a line the closed forms are v₁ = (m₁u₁ + m₂u₂ + m₂e(u₂ − u₁))/(m₁ + m₂) and v₂ = (m₁u₁ + m₂u₂ + m₁e(u₁ − u₂))/(m₁ + m₂). The plate runs the pair on the event core, which knows only the impulse, and matches them to round-off; the right panel shows each velocity against time, a step at the instant of contact.

**Counting π.** A light disk sits between a wall and a heavy disk of M = 100ᵏ m coming in. Rescaled as (√M v₂, √m v₁), every state has the same length, the square root of twice the energy, so it lies on a circle; a collision between the disks reflects it in a line at the angle θ = atan √(m/M), and a bounce of the light one on the wall reflects it in an axis. Each pair of reflections turns the state by 2θ, and collisions continue until no more fit in half a turn: ⌈π/θ⌉ − 1 of them, which for M/m = 100ᵏ is π·10ᵏ rounded down, the first k + 1 digits of π (Galperin 2003). The plate counts them on the event core and draws the path of the state round the circle.

**Newton's cradle.** A row of equal balls with gaps of a millionth of a diameter turns a hit into a chain of two-ball collisions, each a perfect exchange of velocities. Momentum alone would allow one ball to leave at twice the speed; momentum and energy together allow only as many balls out as came in, at the speed they came, and that is what the run measures.

**In the plane.** A disk hitting another at impact parameter b < d is turned, in the centre-of-mass frame, by χ = π − 2 asin(b/d); in the laboratory its deflection is atan(sin χ/(m₁/m₂ + cos χ)). For equal masses the two leave at a right angle, whatever b. The same transformation turns Rutherford's centre-of-mass angle in #/p/kepler-orbits into what a detector sees.
