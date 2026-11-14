---
id: poisson-grid
title: Electrostatics on a Grid
taxonomy: physics/electrostatics
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. II, ch. 6 and 7 (the electric field in various circumstances), ch. 10 and 11 (dielectrics), ch. 12 (electrostatic analogues)'
    purpose: further-reading
  - id: hestenes-stiefel-1952
    purpose: implementation
tags:
  - Poisson equation
  - conjugate gradients
  - capacitance
  - Faraday cage
  - dielectrics
  - Gauss's law
complexity: O(n) conjugate-gradient iterations of O(n²) work each on an n × n grid
interaction: Choose what sits in the grounded box and how fine the grid is; watch the solve converge, replayed iteration by iteration. Attach your own electrodes (rectangles at a potential).
motivation: Most electrostatics problems have no closed form; a grid and a linear solver answer them all, and checking the grid against the few that do have one shows how far to trust it.
relations:
  - type: compares_with
    target: charges-and-field-lines
    reason: The same equation solved the other way; there the field is summed charge by charge in open space, here the potential is solved on a grid with conductors as boundaries.
  - type: compares_with
    target: gaussian-elimination
    reason: Both solve a linear system; elimination costs O(N³) for N unknowns, while conjugate gradients on this sparse grid converge in a few hundred sweeps.
  - type: analogue_of
    target: brownian-walkers
    reason: 'The walkers'' density at steady state obeys the same Laplace equation: concentration for the potential, the diffusion constant for ε, an absorbing wall for a grounded conductor, a source of walkers for a charge.'
  - type: related_to
    target: stable-fluids
    reason: Its pressure projection is a Poisson solve on a grid, the same operator with the velocity's divergence for the charge.
pedagogy:
  difficulty: intermediate
  objectives:
    - Solve Poisson's equation on a grid and check it against an independent series solution, at the expected second order.
    - Measure a conductor's charge as the flux out of it, and a capacitance as charge over potential.
    - See that no field enters a closed conductor, whatever charges sit outside.
    - Watch a dielectric weaken the field inside it by 2/(1 + ε/ε₀).
  misconceptions:
    - A conductor's shielding does not need it to be grounded; held at any potential, its inside is at that potential throughout.
    - The grid's error is not uniform; it is largest near sources and curved surfaces drawn as staircases.
    - The iterations do not converge from the boundary inwards in order; conjugate gradients corrects every scale at once, the fine ones first.
  questions:
    - Why does refining the grid four times reduce the error at a point far from the charge sixteen times, but the coaxial capacitance only a little?
    - Where on the ring does the induced charge collect, and why?
    - How does the field inside the cylinder change as ε grows without bound?
algorithm:
  paradigm: iterative-refinement
  properties:
    deterministic: true
  preconditions:
    - Every conductor and the box's edge are held at a given potential; a floating conductor of fixed charge is not modelled.
  invariants:
    - On the grid, the charge on a conductor equals the flux out of it exactly (Gauss's law for the five-point operator).
  limitations:
    - Curved conductors are drawn as staircases of nodes, so their capacitance converges only at first order.
    - Two dimensions only; every charge is a line charge and every conductor an infinitely long prism.
    - The solve stops at a relative residual of 1e−10, or after 16 n iterations.
experiments:
  - id: coarse
    title: A coarse grid
    params: { cells: 32 }
    observe: The potential is already within a few parts in ten thousand of the series away from the charge.
  - id: coax
    title: A coaxial cable
    params: { mode: coax }
    observe: The potential falls as the logarithm of the radius between the conductors; the outer one carries the opposite charge.
  - id: cage
    title: The cage
    params: { mode: cage }
    observe: Outside the ring the charge's field is bent onto it; inside, nothing.
  - id: strong-dielectric
    title: A strong dielectric
    params: { mode: cylinder, eps2: 20 }
    observe: The field inside is a tenth of the applied one; the lines crowd around the cylinder instead.
claims:
  - id: grid-is-series
    statement: >-
      A line charge at the centre of the grounded box, on 128 cells, gives the potential at (0.5, 0.75) of the
      box's sine series within 4e−5; the gap is second order in h (four times smaller each halving).
    readout: φ at (0.5, 0.75), grid
    expect: { against: 'φ at (0.5, 0.75), the grounded box’s sine series', tolerance: 0.00004 }
  - id: grid-is-series-off-axis
    statement: >-
      Off the axes, at (0.25, 0.625), the grid matches the series within 4e−5 as well.
    readout: φ at (0.25, 0.625), grid
    expect: { against: 'φ at (0.25, 0.625), the sine series', tolerance: 0.00004 }
  - id: energy-two-ways
    statement: >-
      (numerics) The energy summed over the grid's faces, ½Σε|∇φ|², equals ½Σρφ over the charge within 1e−8:
      the discrete Green's identity, once the solve has converged.
    readout: energy ½Σε|∇φ|² over the grid’s faces
    expect: { against: 'energy ½(Σρφh² + ΣQV) over the sources', tolerance: 0.00000001 }
  - id: coax-capacitance
    statement: >-
      The coaxial pair's capacitance, the inner conductor's charge measured by Gauss on the grid over its
      potential, is 2πε/ln(b/a) = 3.904 within 3 %; staircase circles make it converge slowly.
    readout: capacitance per length C = Q/V, measured (ε₀ = 1)
    expect: { against: 'capacitance 2πε/ln(b/a), the round coaxial pair', tolerance: 0.12 }
    setup:
      params: { mode: coax }
  - id: coax-charges-cancel
    statement: >-
      Every line of force from the inner conductor ends on the outer one: their charges cancel within 1e−8.
    readout: total charge on the two conductors
    expect: { range: [-0.00000001, 0.00000001] }
    setup:
      params: { mode: coax }
  - id: cage-shields
    statement: >-
      Inside a conducting ring held at 0.5 with a charge outside, the largest field is below 1e−8 of the largest
      field outside: a closed conductor shields its inside completely.
    readout: largest |E| inside over outside
    expect: { below: 0.00000001 }
    setup:
      params: { mode: cage }
  - id: cage-potential
    statement: >-
      The whole inside sits at the ring's potential, 0.5, within 1e−8.
    readout: φ at the centre (the ring is held at 0.5)
    expect: { value: 0.5, tolerance: 0.00000001 }
    setup:
      params: { mode: cage }
  - id: dielectric-cylinder
    statement: >-
      A cylinder of permittivity 4ε₀ in a uniform field E₀ carries inside it the uniform field 2E₀/(1 + ε/ε₀) =
      0.4 within 0.01, the staircased surface's error at 128 cells.
    readout: E inside the cylinder (mean over its inner half), measured
    expect: { against: 'E inside 2E₀/(1 + ε/ε₀), the closed form', tolerance: 0.01 }
    setup:
      params: { mode: cylinder }
data:
  - id: electrodes
    title: Your electrodes
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x0, unit: box width, min: 0, max: 1 }
      - { key: y0, unit: box width, min: 0, max: 1 }
      - { key: x1, unit: box width, min: 0, max: 1 }
      - { key: y1, unit: box width, min: 0, max: 1 }
      - { key: v, unit: potential, min: -100, max: 100 }
    rows: { min: 1, max: 12 }
    bytes: 8192
    replaces: mode
    ignores: [eps2]
    url_bytes: 1800
    note: Each row is a rectangular electrode from (x0, y0) to (x1, y1) in the unit box, held at v; the box's edge is grounded, later rows override earlier ones where they overlap, and each electrode's charge is measured by Gauss's law on the grid.
---

Poisson's equation solved on a grid inside a grounded box: a line charge, a coaxial cable, a charge outside a conducting ring, and a dielectric cylinder in a uniform field.

**The grid.** The unit square is sampled at n × n nodes. At each free node the five-point operator Σ ε_f(φ − φ_neighbour)/h², summed over its four faces, must equal the charge density there; ε on a face is the harmonic mean of its two nodes, which keeps the normal component of D continuous across a boundary between materials. Conductors are nodes held at their potential, and the box's edge is held at zero. The free nodes then form one symmetric positive-definite linear system, solved by conjugate gradients with a diagonal preconditioner until the residual is 10⁻¹⁰ of the right-hand side. The solve runs a few dozen iterations a frame, and the picture replays it: the coloured bands are equipotentials, sharpening as the residual falls.

**What is measured.** The charge on a conductor is the flux out of it, the operator applied at its own nodes: Gauss's law, exact on the grid. A capacitance is that charge over the potential. The energy is summed two ways, over the field on every face and over the sources, and the two agree once the solve has converged. The field is the potential's central difference.

**Against the few closed forms.** A line charge in a grounded square has an exact potential as a sine series in one direction with hyperbolic functions in the other; the grid matches it at second order in the spacing away from the charge. A coaxial pair has capacitance 2πε/ln(b/a), approached slowly because round conductors become staircases of nodes. A ring held at a potential leaves its inside at that potential, with no field at all, whatever stands outside: the cage. A dielectric cylinder in a uniform field has a uniform field inside, 2/(1 + ε/ε₀) of the applied one. The same field summed charge by charge in open space is #/p/charges-and-field-lines; the same operator is the pressure solve of #/p/stable-fluids.

**Your electrodes.** A table of rectangles, each with a potential, is placed in the box and solved; the charge on each is measured by Gauss's law and the energy two ways. The table stays in the browser.
