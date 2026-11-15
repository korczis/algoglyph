---
id: currents-and-magnetic-fields
title: Currents and Their Magnetic Fields
taxonomy: physics/magnetism
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. II, ch. 13 (magnetostatics), ch. 14 (the magnetic field in various situations), ch. 17 (the laws of induction)'
    purpose: further-reading
  - id: abramowitz-stegun
    ref: 'Chapter 17: K and E by the arithmetic-geometric mean; table 25.4, the Gauss–Legendre rule'
    purpose: implementation
tags:
  - Biot–Savart law
  - Ampère's law
  - solenoid
  - mutual inductance
  - Faraday's law
  - magnetic field
complexity: O(segments) per field point; the map is 48 × 30 points; Neumann's integral O(segments²)
interaction: Choose the currents, the number of straight segments per turn and the geometry; attach your own wire as a list of points.
motivation: Every magnetic field of a circuit comes from one law summed along its wires; checking it against Ampère, against a solenoid, against two loops' shared flux and against a moving loop shows the laws are one.
relations:
  - type: related_to
    target: charges-and-field-lines
    reason: The electric counterpart; there fields of charges summed point by point, here fields of currents summed segment by segment.
  - type: related_to
    target: adaptive-quadrature
    reason: The flux through a loop and Neumann's double integral are quadratures standing in for closed forms, checked against them as that plate checks its own.
pedagogy:
  difficulty: intermediate
  objectives:
    - Compute a magnetic field by summing straight segments exactly, and check the loop's axis and the solenoid's centre.
    - Verify Ampère's law around a circuit that does and one that does not enclose a current.
    - Find the mutual inductance of two loops three independent ways.
    - See Faraday's law as the force on the charges of a moving wire.
  misconceptions:
    - The field of a solenoid is not uniform to its ends; at an end it is about half the centre's.
    - A circuit around a wire collects the same ∮B·dl however it is shaped or placed, as long as it encloses the wire.
    - Mutual inductance is symmetric; the flux of loop one through loop two per unit current equals the reverse, though the two loops differ.
  questions:
    - Why does a polygon of 256 sides give the circle's field to five digits?
    - How does the end field of a solenoid compare with the centre, and why one half?
    - What sets the sign of the EMF in the moving loop?
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
  invariants:
    - The field of a straight segment is integrated exactly; only the shape of a curved wire is approximated, by straight segments.
  limitations:
    - Wires are thin lines; the field on or very near a wire is not resolved.
    - Statics only; the moving loop is slow, so the field never lags (no radiation).
    - The long wire is 2000 units long, so Ampère's integral misses about (r/L)² of the current.
experiments:
  - id: centre
    title: The centre of the loop
    params: { z: 0 }
    observe: The field is μ₀I/2R, the strongest on the axis.
  - id: coarse
    title: A square for a circle
    params: { sides: 16 }
    observe: Sixteen sides already give the field on the axis to a few parts in a thousand.
  - id: long-solenoid
    title: A tightly wound solenoid
    params: { mode: solenoid, turns: 60 }
    observe: Near the centre the field approaches μ₀nI; outside it is weak.
  - id: outside
    title: A circuit not enclosing the wire
    params: { mode: ampere, offset: 1.5 }
    observe: The circulation vanishes, though B is nowhere zero on the circuit.
  - id: close-loops
    title: Close loops
    params: { mode: mutual, gap: 0.1 }
    observe: The mutual inductance grows as the loops nearly touch, logarithmically.
claims:
  - id: loop-axis
    statement: >-
      Summed over 256 straight segments, the field on the axis of a loop at z = 0.5R is the circle's
      μ₀IR²/2(R² + z²)^(3/2) within 2e−5; the polygon's gap falls as the square of its side.
    readout: B on the axis at height z, Biot–Savart over the polygon
    expect: { against: 'B on the axis μ₀IR²/2(R² + z²)^(3/2), the circle’s closed form', tolerance: 0.00002 }
  - id: solenoid-centre
    statement: >-
      A helix of twenty turns over four radii' length gives at its centre the finite current sheet's
      μ₀nI(L/2)/√((L/2)² + R²) within 0.002: the helix's pitch is its only difference.
    readout: B at the centre, Biot–Savart over the helix
    expect: { against: 'B at the centre of a finite current sheet μ₀nI(L/2)/√((L/2)² + R²)', tolerance: 0.002 }
    setup:
      params: { mode: solenoid }
  - id: ampere-enclosed
    statement: >-
      Around a circuit enclosing the wire, off centre, ∮B·dl = μ₀I within 1e−5.
    readout: ∮B·dl around the circuit, trapezoid over its points
    expect: { against: 'μ₀ times the current it encloses', tolerance: 0.00001 }
    setup:
      params: { mode: ampere }
  - id: ampere-outside
    statement: >-
      Around a circuit that does not enclose it, ∮B·dl = 0 within 1e−5.
    readout: ∮B·dl around the circuit, trapezoid over its points
    expect: { against: 'μ₀ times the current it encloses', tolerance: 0.00001 }
    setup:
      params: { mode: ampere, offset: 1.5 }
  - id: mutual-neumann
    statement: >-
      Two coaxial loops of radii 1 and 0.7, 0.4 apart, have the mutual inductance of the elliptic-integral
      closed form within 5e−5 by Neumann's double integral over their segments.
    readout: mutual inductance, Neumann’s double integral ∮∮dl₁·dl₂/4π|r₁ − r₂|
    expect: { against: 'mutual inductance μ₀√(R₁R₂)((2/k − k)K − (2/k)E), elliptic integrals by the AGM', tolerance: 0.00005 }
    setup:
      params: { mode: mutual }
  - id: mutual-flux
    statement: >-
      The same mutual inductance comes out within 5e−5 as the flux of the first loop's field through the
      second, a different integral of a different quantity.
    readout: mutual inductance, the flux through the second loop over I
    expect: { against: 'mutual inductance μ₀√(R₁R₂)((2/k − k)K − (2/k)E), elliptic integrals by the AGM', tolerance: 0.00005 }
    setup:
      params: { mode: mutual }
  - id: faraday-two-ways
    statement: >-
      A loop moving along the axis has the EMF −dΦ/dt of its changing flux equal to ∮(v × B)·dl, the
      magnetic force on its charges, within 1e−4.
    readout: EMF −dΦ/dt, the flux through it differentiated in time
    expect: { against: 'EMF ∮(v × B)·dl, the force on its charges', tolerance: 0.0001 }
    setup:
      params: { mode: induction }
data:
  - id: wire
    title: Your wire
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: length, min: -10, max: 10 }
      - { key: y, unit: length, min: -10, max: 10 }
      - { key: z, unit: length, min: -10, max: 10 }
    rows: { min: 2, max: 400 }
    bytes: 16384
    replaces: mode
    ignores: [sides, z, turns, offset, gap]
    url_bytes: 1800
    note: The points, in order, are the vertices of one wire carrying one unit of current; repeat the first point at the end to close it into a circuit. The map shows the field in the x–z plane.
---

The magnetic fields of currents, computed by the Biot–Savart law: a circular loop, a solenoid, a long straight wire, two coaxial loops and a loop moving through a loop's field.

**Biot–Savart, exactly per segment.** A current I along a straight segment from a to b makes at a point p the field (μ₀I/4π)(A × B)(|A| + |B|)/(|A||B|(|A||B| + A·B)), with A and B the segment's ends seen from p: the law integrated in closed form. A curved wire becomes a polygon, and the only approximation is the polygon's shape, whose error falls as the square of its side. The map shows |B| in the plane through the axis on a logarithmic scale, with B's direction as short strokes.

**Against the closed forms.** On the axis of a loop the field is μ₀IR²/2(R² + z²)^(3/2). At the centre of a solenoid of finite length it is that of a current sheet, μ₀nI(L/2)/√((L/2)² + R²), approaching μ₀nI as the coil grows long; at its end, about half of that. Around any circuit, ∮B·dl is μ₀ times the current it encloses, summed here point by point around a circle placed off the wire, and zero once the circle no longer encloses it.

**Mutual inductance, three ways.** The flux of one loop's field through another per unit current, the double integral ∮∮dl₁·dl₂/4π|r₁ − r₂| of Neumann over both loops' segments, and the closed form for coaxial circles with the complete elliptic integrals K and E computed by the arithmetic-geometric mean: three different calculations of one number.

**Induction.** Moving a loop through a static field changes the flux through it, and the EMF −dΦ/dt appears; but nothing in the field changes, and the same EMF is the magnetic force v × B on the loop's own charges, integrated around it. The plate computes both. Electric fields of charges are summed the same way in #/p/charges-and-field-lines.

**Your wire.** A list of points is one wire carrying unit current; close it by repeating the first point. The plate maps its field and reports its length, its magnetic moment and the field at the origin. The list stays in the browser.
