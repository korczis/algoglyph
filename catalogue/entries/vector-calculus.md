---
id: vector-calculus
title: Flux, Circulation and the Theorems of Gauss and Stokes
taxonomy: physics/electrostatics
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 13 and 14 (work and potential energy); Vol. II, ch. 2 and 3 (differential and integral vector calculus)'
    purpose: further-reading
tags:
  - vector calculus
  - divergence theorem
  - Stokes's theorem
  - conservative fields
  - line integrals
  - Gaussian quadrature
complexity: O(n) boundary nodes and O(n²) inside nodes per integral, computed once when a control changes
interaction: Choose a field and a loop, move the loop and change its size; the integrals around it and over its inside are computed again. Attach your own loop as a table of corners.
motivation: Whatever flows out through a loop is made inside it, and whatever circulates around it is spun inside it; the two great theorems of vector calculus turn every law of electromagnetism from a statement about a point into a statement about a region.
relations:
  - type: related_to
    target: charges-and-field-lines
    reason: Gauss's law there is this theorem applied to the field of point charges, the flux through a sphere against the charge it encloses.
  - type: compares_with
    target: simpson-quadrature
    reason: Both integrate by weighting samples; here Gauss–Legendre nodes, exact for polynomials of twice the degree, and the trapezoid on a circle, exact to round-off for a smooth periodic integrand.
  - type: related_to
    target: point-in-polygon
    reason: The same signed area decides both; a loop's corners there say whether a point is inside, here they cut the inside into signed triangles to integrate over.
pedagogy:
  difficulty: intermediate
  objectives:
    - Compute the flux of a field out of a loop along its boundary, and again as the divergence integrated over its inside.
    - Compute the circulation around a loop along its boundary, and again as the curl integrated over its inside.
    - See that the work from A to B is the same along every path for a gradient field and not for a vortex.
    - Read the theorems as the reason a source shows up in the flux only when the loop encloses it.
  misconceptions:
    - A field whose lines curve is not necessarily curling; a source's lines are straight, the shear flow's lines are straight and it does curl.
    - Zero circulation around one loop does not make a field conservative; it must vanish around every loop.
    - The divergence is not where the field is strong; a uniform field has none, and a source's vanishes outside its core however strong it is there.
  questions:
    - Why is the flux of the smoothed source through a circle the same wherever the circle sits, as long as it encloses the whole core?
    - The shear flow (y, 0) moves in straight lines. Why does it carry a circulation, and why is it minus the area?
    - What is the work around the whole loop for the saddle, and why must it be zero for any loop?
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
  preconditions:
    - The fields are smooth; the source and the vortex are spread over a Gaussian core of width 0.35, so their divergence and curl are finite everywhere.
  limitations:
    - The divergence and curl are central differences of the field with step 10⁻⁴, good to about 10⁻⁸; the area integrals inherit that.
    - A reader's loop must be simple (its edges must not cross); a crossing loop counts the regions it winds round by their winding number.
experiments:
  - id: source-anywhere
    title: The source, off centre
    params: { field: source, cx: 0.4, cy: 0.3, size: 1 }
    observe: The flux is what the enclosed part of the core produces, and the divergence integral agrees with it to about 10⁻⁸.
  - id: shear-circulates
    title: Straight lines that circulate
    params: { field: shear, curve: square }
    observe: The circulation is minus the square's area, the curl −1 integrated over it.
  - id: vortex-paths
    title: Two paths around a vortex
    params: { field: vortex }
    observe: The work over the top and under the bottom differ by the circulation; for the saddle they agree.
claims:
  - id: divergence-theorem
    statement: >-
      For the mixed field through an off-centre circle, the flux walked along the boundary equals the
      divergence integrated over the inside within 2 × 10⁻⁷, the central differences' error integrated
      over the area with a factor of ten to spare.
    readout: outward flux ∮F·n dl, along the loop
    expect: { against: 'area integral of div F, inside', tolerance: 2.0e-7 }
    setup:
      params: { field: mixed, curve: circle, cx: 0.3, cy: 0.2, size: 0.9 }
  - id: stokes-theorem
    statement: >-
      For the mixed field around an off-centre square, the circulation walked along the boundary
      equals the curl integrated over the inside within 2 × 10⁻⁷.
    readout: circulation ∮F·dl, along the loop
    expect: { against: 'area integral of curl F, inside', tolerance: 2.0e-7 }
    setup:
      params: { field: mixed, curve: square, cx: -0.4, cy: 0.1, size: 0.7 }
  - id: gauss-flux-of-a-source
    statement: >-
      The flux of the smoothed source out of a centred circle of radius 0.8 is the charge it encloses,
      2π(1 − e^(−R²/a²)), within 10⁻⁹.
    readout: outward flux ∮F·n dl, along the loop
    expect: { against: 'flux, closed form', tolerance: 1.0e-9 }
    setup:
      params: { field: source, curve: circle, cx: 0, cy: 0, size: 0.8 }
  - id: circulation-of-a-vortex
    statement: >-
      The circulation of the smoothed vortex around a centred circle of radius 0.8 is the spin it
      encloses, 2π(1 − e^(−R²/a²)), within 10⁻⁹, and the work from A to B under the bottom exceeds the
      work over the top by exactly that.
    readout: bottom minus top, which is the circulation
    expect: { against: 'circulation, closed form', tolerance: 1.0e-9 }
    setup:
      params: { field: vortex, curve: circle, cx: 0, cy: 0, size: 0.8 }
  - id: path-independence
    statement: >-
      For the saddle, a gradient field, the work from A to B over the top is the potential drop
      φ(A) − φ(B) within 10⁻⁹, whichever circle joins them.
    readout: work from A to B over the top
    expect: { against: 'φ(A) − φ(B), the potential drop', tolerance: 1.0e-9 }
    setup:
      params: { field: saddle, curve: circle, cx: 0.5, cy: -0.3, size: 0.6 }
  - id: shear-circulation-is-the-area
    statement: >-
      The shear flow (y, 0) carries a circulation of minus the area round any loop: around a square of
      half-side 0.8 it is −2.56 within 10⁻⁹, against the corners' shoelace area.
    readout: circulation ∮F·dl, along the loop
    expect: { against: 'circulation, closed form', tolerance: 1.0e-9 }
    setup:
      params: { field: shear, curve: square }
  - id: gradient-is-the-field
    statement: >-
      Numerics: the saddle is minus the gradient of its potential, |F + ∇φ| below 10⁻⁶ everywhere on the
      view, the gradient by central differences.
    readout: largest |F + ∇φ| over the view (numerics)
    expect: { below: 1.0e-6 }
    setup:
      params: { field: saddle }
data:
  - id: loop
    title: Your loop
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: 'length (the view is 6.4 wide)', min: -3, max: 3 }
      - { key: y, unit: 'length (the view is 4 high)', min: -2, max: 2 }
    rows: { min: 3, max: 200 }
    bytes: 8192
    replaces: curve
    ignores: [cx, cy, size]
    url_bytes: 1800
    note: The rows are the corners of a closed polygon in order, either way round; the flux, the circulation and the integrals of the divergence and the curl over its inside are computed for the field chosen.
---

A vector field, a loop, and four integrals: the flux out through the loop and the circulation around it, each walked along the boundary and again added up over the inside, where the theorems of Gauss and Stokes say they must agree.

**The fields.** A source spreading out from a core, a vortex turning round one, a saddle that is minus the gradient of x² − y², a shear flow (y, 0), a uniform field, and a mixture of a source, a vortex and a drift. The source and the vortex are the fields of a line charge and of a line vortex in the plane, 1/r away from the core, with the core smeared over a Gaussian of width 0.35 so that nothing is infinite.

**Along the boundary.** The outward flux ∮F·n dl and the circulation ∮F·dl are integrals over the loop. On a circle the plate uses the trapezoid rule in the angle, which for a smooth periodic integrand is exact to round-off; on a polygon, Gauss–Legendre on every edge.

**Over the inside.** The divergence ∂Fx/∂x + ∂Fy/∂y and the curl ∂Fy/∂x − ∂Fx/∂y are central differences of the field itself, never formulas typed in. They are integrated over the inside: on a circle by Gauss–Legendre in the radius and the trapezoid in the angle; on a polygon by cutting it into triangles from its first corner, which add up with signs to exactly the polygon whatever its shape, each triangle by a Gauss–Legendre rule on the square mapped onto it. Gauss's theorem sets the flux equal to the divergence integral, Stokes's sets the circulation equal to the curl integral, and the readouts show both pairs.

**Work and potential.** From A on the left of the loop to B on its right, the work ∫F·dl is taken over the top and under the bottom. The bottom path minus the top path is the circulation around the loop, so the two agree for every loop exactly when the field has no curl, which is when it is minus the gradient of a potential, and the work is then the potential drop φ(A) − φ(B). The vortex gives two different answers, the saddle and the uniform field one.

**Closed forms.** The source's flux out of a circle centred on its core is the charge enclosed, 2π(1 − e^(−R²/a²)), and the vortex's circulation the same; the shear flow's circulation is minus the area of any loop, its curl being −1 everywhere. The divergence theorem applied to point charges in three dimensions is #/p/charges-and-field-lines.

**Your loop.** A table of corners, in order either way round, replaces the circle or the square; the four integrals and the closed forms that apply are computed for it. The table stays in the browser.
