---
id: rays-and-lenses
title: Rays, Lenses and the Path of Least Time
taxonomy: physics/optics
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 26 (optics: the principle of least time), ch. 27 (geometrical optics)'
    purpose: further-reading
tags:
  - geometrical optics
  - ray tracing
  - lensmaker's formula
  - ABCD matrices
  - spherical aberration
  - Fermat's principle
complexity: O(surfaces) per ray; a few dozen rays per change of the controls
interaction: Choose a lens, its glass, its radius, its thickness and aperture, and how far away the object is; or switch to Fermat's interface and move the end point. Attach your own prescription of surfaces.
motivation: Light takes the path of least time; out of that one sentence come the law of refraction, lenses that focus, and the reason a simple spherical lens never quite does.
relations:
  - type: related_to
    target: bound-electron-medium
    reason: The glass's index n, here a number on a slider, is what that plate derives from bound electrons driven by the light.
  - type: compares_with
    target: ripple-tank
    reason: The same refraction two ways, here by rays and Snell's law, there by waves slowing in shallow water, of which rays are the short-wave limit.
pedagogy:
  difficulty: intermediate
  objectives:
    - Trace rays exactly through spherical surfaces with Snell's law, and find where they cross the axis.
    - Compare the exact focus as the ray height goes to zero with the paraxial ABCD matrices and the lensmaker's formula.
    - Measure spherical aberration and see it grow as the square of the height, and depend on which way round a plano-convex lens faces.
    - Find the path of least time across an interface by search alone and see Snell's law come out of it.
  misconceptions:
    - A spherical lens does not have one focus; rays far from the axis cross it sooner, and only the paraxial ones meet at the textbook focal point.
    - Light does not bend at an interface because it is pulled; the bent path is the quickest, since light is slower in glass.
    - A thick lens's focal length is not measured from its middle; the back focal distance from the last surface differs from the effective focal length by where the principal plane lies.
  questions:
    - Why does a plano-convex lens with its curved side to the parallel light show about a quarter of the aberration of the same lens turned round?
    - What happens to the image distance as the object comes in towards the focal point, and why does the magnification grow without bound?
    - Fermat's principle asks for a stationary path, not always the least. Where would a ray follow a path of greatest time?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - Every ray stays within the caps of the spheres; the aperture stops short of the smallest radius.
  limitations:
    - Meridional rays only, in the plane through the axis; skew rays and off-axis aberrations are left out.
    - One wavelength; the index does not depend on colour, so there is no chromatic aberration.
experiments:
  - id: curved-first
    title: Plano-convex, curved side first
    params: { shape: plano-curved-first, aperture: 1.2 }
    observe: The marginal rays cross the axis a little before the paraxial focus.
  - id: flat-first
    title: Turned round
    params: { shape: plano-flat-first, aperture: 1.2 }
    observe: The same lens shows several times the spherical aberration.
  - id: near-object
    title: A near object
    params: { object: 12 }
    observe: The image recedes as the object approaches the focal length, and the exact trace and ABCD agree on where.
  - id: water
    title: Into water
    params: { view: fermat, n: 1.33 }
    observe: The quickest path bends at the surface, and n sin θ is the same on both sides.
claims:
  - id: exact-trace-is-paraxial-at-small-height
    statement: >-
      For a biconvex lens of index 1.5, radius 5 and thickness 0.4, the exact trace of a ray at height
      10⁻⁶ crosses the axis at the back focal distance the ABCD matrices give, within 10⁻⁸; the exact
      trace departs from it only by the h² of spherical aberration.
    readout: paraxial focus behind the last vertex, exact trace at h → 0
    expect: { against: 'back focal distance by ABCD, −A·n/C', tolerance: 1.0e-8 }
    setup:
      params: { view: lens, shape: biconvex, n: 1.5, R: 5, t: 0.4 }
  - id: lensmaker
    statement: >-
      The same exact trace meets the thick-lens lensmaker's back focal distance f(1 − (n − 1)t/nR₁),
      with 1/f = (n − 1)(1/R₁ − 1/R₂ + (n − 1)t/nR₁R₂), within 10⁻⁸.
    readout: paraxial focus behind the last vertex, exact trace at h → 0
    expect: { against: 'back focal distance, lensmaker f(1 − (n − 1)t/nR₁)', tolerance: 1.0e-8 }
    setup:
      params: { view: lens, shape: biconvex, n: 1.5, R: 5, t: 0.4 }
  - id: aberration-is-second-order
    statement: >-
      Spherical aberration is of second order in the ray height: between an eighth and a sixteenth of
      the aperture the axis crossing moves as h^k with k = 2 within 0.01 (the next term, h⁴, adds about
      (h/R)² to it).
    readout: order of the aberration in h, between h/8 and h/16 of the aperture
    expect: { value: 2, tolerance: 0.01 }
    setup:
      params: { view: lens, shape: biconvex, n: 1.5, R: 5, t: 0.4, aperture: 1 }
  - id: image-of-a-near-object
    statement: >-
      An object twelve units before a plano-convex lens is imaged where the ABCD matrices put it: the
      exact trace of a ray at a small angle crosses the axis there within 10⁻⁸.
    readout: image behind the last vertex, exact trace at a small angle
    expect: { against: 'image behind the last vertex by ABCD', tolerance: 1.0e-8 }
    setup:
      params: { view: lens, shape: plano-curved-first, n: 1.6, R: 4, t: 0.5, object: 12 }
  - id: snell-from-fermat
    statement: >-
      The crossing of least optical path from air into water, found by golden-section search on the
      path alone, satisfies Snell's law n₁ sin θ₁ = n₂ sin θ₂ within 10⁻⁷, the search's √ε precision
      on a minimum that is flat to second order.
    readout: n₁ sin θ₁ − n₂ sin θ₂ at the least-time crossing
    expect: { range: [-1.0e-7, 1.0e-7] }
    setup:
      params: { view: fermat, n: 1.33, depth: 1 }
data:
  - id: prescription
    title: Your lens prescription
    kind: table
    accepts: [csv, json]
    columns:
      - { key: c, unit: 'curvature 1/R (0 for a plane)', min: -2, max: 2 }
      - { key: t, unit: 'thickness to the next surface', min: 0, max: 20 }
      - { key: n, unit: 'index after the surface', min: 1, max: 3 }
    rows: { min: 1, max: 16 }
    bytes: 4096
    replaces: view
    ignores: [shape, n, R, t, depth]
    url_bytes: 1800
    note: Each row is a surface in order, from the light's side, its vertex the previous row's thickness further on; the last row's index is the medium the light ends in, and the aperture and the object distance apply as for the seeded lenses.
---

Rays traced through a lens exactly, surface by surface, and set against the paraxial approximation that the textbooks' lens formulas rest on; and the path of least time across an interface, found without Snell's law, obeying it.

**The exact trace.** A ray is a point and a direction. At each spherical surface the plate solves the quadratic for where the ray meets the sphere, keeps the meeting on the cap nearest the vertex, and bends the ray by Snell's law in vector form: the component along the surface is kept in proportion to the index ratio, and the normal component makes the direction a unit vector again. Beyond the last surface the ray runs straight, and where it crosses the axis is measured.

**The paraxial comparison.** For rays close to the axis every sine is its angle, and the system becomes a product of two-by-two matrices acting on the height and the reduced angle: a translation [[1, d/n], [0, 1]] for each gap and a refraction [[1, 0], [−(n′ − n)/R, 1]] for each surface. The plate reads the effective focal length −1/C and the back focal distance −A·n/C from the product, and the lensmaker's formula for a thick lens beside them. A ray at a height of 10⁻⁶ traced exactly lands on the paraxial focus to the h² of aberration.

**Spherical aberration.** Rays further from the axis cross it sooner for a converging lens; the curve at the bottom right plots the crossing against the height, and the measured order of the departure between two small heights is 2. Which way round a lens faces matters: a plano-convex lens with its curved side to the parallel light shares the bending between its two surfaces and shows several times less aberration than the same lens turned round.

**A near object.** With the object at a finite distance the rays fan out from a point on the axis; the image is where the exact trace of a ray at a small angle crosses the axis again, and the ABCD product from the object to the image puts it in the same place, with magnification 1/(C·s_o + D).

**Least time.** In the Fermat view a ray goes from A in air to B in a medium of index n. The plate searches the crossing point on the surface for the least optical path n₁|AX| + n₂|XB| by golden sections alone, a search that knows nothing of angles, and then measures n₁ sin θ₁ − n₂ sin θ₂ there: Snell's law, out of the principle of least time. The same refraction by waves slowing in shallow water is #/p/ripple-tank.

**Your prescription.** A table of surfaces, each with its curvature, the thickness to the next and the index after it, replaces the seeded lens; the exact trace, the ABCD matrices and the aberration are computed for it. The table stays in the browser.
