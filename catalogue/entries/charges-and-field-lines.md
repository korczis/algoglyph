---
id: charges-and-field-lines
title: Charges and Their Field Lines
taxonomy: physics/electrostatics
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. II, ch. 4 (electrostatics), ch. 5 (Gauss''s law), ch. 6 (images)'
    purpose: further-reading
  - id: abramowitz-stegun
    ref: 'Table 25.4: the Gauss–Legendre rule the flux integral uses'
    purpose: implementation
tags:
  - electrostatics
  - Gauss's law
  - image charges
  - field lines
  - superposition
complexity: O(charges) per field evaluation; Gauss flux O(96 × 192 × charges)
interaction: Drag a charge of the two-charge layout; every readout is recomputed from the new places.
motivation: Gauss's law and the image trick are the two ideas that make electrostatics solvable by hand; here both are checked by a computer that does not know them.
relations:
  - type: analogue_of
    target: n-body
    reason: Newton's gravity is Coulomb's law with mass for charge and G for 1/4πε₀, with the sign flipped, so like masses attract where like charges repel.
  - type: related_to
    target: barnes-hut
    reason: The same inverse-square sum over sources, there approximated by a tree to make it fast.
  - type: related_to
    target: adaptive-quadrature
    reason: Another numerical integral standing in for a closed form; here Gauss–Legendre nodes on a sphere check Gauss's law.
pedagogy:
  difficulty: introductory
  objectives:
    - Read field lines as the direction of E, and their crowding near a charge as its size.
    - Check Gauss's law on any sphere, whatever the charges outside it do.
    - Replace a grounded plane or sphere by an image charge and check that the conductor really is at zero.
    - Tell a dipole from a single charge by how fast its field falls with distance.
  misconceptions:
    - Field lines are not paths of charges; a charge released on one leaves it whenever it is moving.
    - Charges outside a Gauss sphere change the field on it but not the flux through it.
    - The image charge is not there; it reproduces the field the induced surface charge makes in the room.
  questions:
    - Why does the flux through a sphere around both charges not change when you drag one of them about inside it?
    - How much charge does a grounded plane hold when a charge q is brought near it, and where does it sit?
    - Why does a dipole's field fall one power of r faster than a charge's?
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
  invariants:
    - The flux out of a closed surface equals the charge inside it (ε₀ = 1), to the quadrature's accuracy.
  limitations:
    - The charges are points in three dimensions seen in the plane through them; field-line density in the picture is set by seeding in proportion to charge, not by the field's strength in the plane.
    - The flux quadrature loses accuracy when a charge sits within about a tenth of the radius of the surface; the readout says so instead of averaging across it.
experiments:
  - id: around-one-charge
    title: A sphere around one charge
    params: { around: charge1, radius: 0.5 }
    observe: The flux is that charge alone, 1, however the other is placed.
  - id: like-charges
    title: Two like charges
    params: { ratio: 1 }
    observe: The lines avoid the middle; the flux through the large sphere is 2.
  - id: grounded-plane
    title: Above a grounded plane
    params: { layout: plane }
    observe: The lines meet the plane at right angles; the plane carries −q.
  - id: grounded-sphere
    title: Beside a grounded sphere
    params: { layout: sphere }
    observe: The sphere holds −qR/a, the image's charge.
claims:
  - id: gauss-with-a-charge-outside
    statement: >-
      With charges of 1 and −0.5 inside a sphere, the flux of E out of it, a numerical surface
      integral (Gauss–Legendre in cos θ, the trapezoid in φ), equals the summed charge inside, 0.5,
      within 1e−7.
    readout: flux of E out of the sphere, numerical
    expect: { against: 'charge inside the sphere, summed', tolerance: 0.0000001 }
  - id: gauss-ignores-what-is-outside
    statement: >-
      A smaller sphere about charge 1 alone has flux 1 within 1e−7, though charge 2 sits just outside
      and changes the field all over its surface.
    readout: flux of E out of the sphere, numerical
    expect: { against: 'charge inside the sphere, summed', tolerance: 0.0000001 }
    setup:
      params: { around: charge1, radius: 0.5 }
  - id: plane-holds-minus-q
    statement: >-
      A grounded plane under a charge q holds −q: the surface charge σ = E_n just above it,
      integrated over the whole plane numerically, comes to −1 within 1e−7.
    readout: charge induced on the plane, ∫σ dA numerical
    expect: { against: 'image charge −q', tolerance: 0.0000001 }
    setup:
      params: { layout: plane }
  - id: sphere-image-grounds-it
    statement: >-
      The image −qR/a at R²/a holds the whole sphere at zero potential: its largest |V|, sampled at
      720 points, is below 1e−12 of the potential the charge alone would make there.
    readout: largest |V| on the grounded sphere, over q/4π(a − R)
    expect: { below: 0.000000000001 }
    setup:
      params: { layout: sphere }
  - id: sphere-holds-the-image-charge
    statement: >-
      The flux out of a sphere drawn around the grounded sphere, a numerical integral, is the image's
      charge −qR/a within 1e−7: the conductor holds exactly that.
    readout: flux out of a sphere just around the conductor, numerical
    expect: { against: 'image charge −qR/a', tolerance: 0.0000001 }
    setup:
      params: { layout: sphere }
  - id: dipole-falls-as-r-cubed
    statement: >-
      A dipole 0.1 long, seen from 2 to 20, has a field falling as r⁻³ on its axis: the least-squares
      slope of ln|E| against ln r is −3 within 0.01.
    readout: far-field slope of |E| on the axis, r from 2 to 20
    expect: { value: -3, tolerance: 0.01 }
    setup:
      params: { layout: dipole }
  - id: a-charge-falls-as-r-squared
    statement: >-
      Over the same range a single charge's field falls as r⁻², the slope −2 within 1e−6, one power of
      r slower.
    readout: the same slope for a single charge
    expect: { value: -2, tolerance: 0.000001 }
    setup:
      params: { layout: dipole }
---

Point charges, the lines their field draws, and the equipotentials crossing them at right angles; a sphere checks Gauss's law, and an image charge stands in for a grounded conductor.

**The field.** Each charge contributes q(r − rᵢ)/(4π|r − rᵢ|³) in units where ε₀ = 1, and the field is their sum; the potential is the sum of q/(4π|r − rᵢ|). The charges are points in space, drawn in the plane that holds them. Field lines start near each charge, as many per unit charge as the slider asks, and follow the field's direction by the shared fourth-order Runge–Kutta integrator; they end on a charge of the other sign or leave the view. The equipotentials are contours of the potential, found cell by cell by marching squares.

**Gauss's law, checked.** The dashed circle is a sphere seen edge on. The flux of E out of it is computed as a surface integral, Gauss–Legendre nodes in cos θ and equally spaced points in φ, and compared with the charge inside, summed; the two agree to the quadrature's accuracy wherever no charge sits on the surface. Drag a charge across the sphere and the flux jumps by exactly that charge.

**Images.** A charge above a grounded plane makes the field of itself and an image of opposite sign mirrored below; the plane is then at zero potential, and the surface charge it must carry, the normal field just above it, integrates to −q. A charge q at distance a from the centre of a grounded sphere of radius R is answered by an image −qR/a at R²/a: the plate samples the potential round the sphere and finds it zero to rounding, and the flux out of a sphere drawn around the conductor is the image's charge.

**Far fields.** A dipole is two charges that nearly cancel; from far away their fields differ by the derivative of one, so the field falls as r⁻³ where a single charge's falls as r⁻². The plate fits the slope on a log-log scale over a decade of distance. Gravity obeys the same law with mass for charge and the sign flipped, as #/p/n-body shows; the same sum, sped up by a tree, is #/p/barnes-hut.
