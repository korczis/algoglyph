---
id: stable-fluids
title: Stable fluids
taxonomy: physics/fluids
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - semi-Lagrangian fluid
  - Stam's solver
sources:
  - id: stam-stable-fluids
    purpose: implementation
  - id: feynman-lectures
    ref: 'Vol. II, ch. 3 (circulation and Stokes''s theorem, proved by little squares), ch. 40 (the flow of dry water: vorticity and circulation)'
    purpose: further-reading
tags:
  - fluids
  - advection
  - projection
  - webassembly
  - circulation
complexity: O(n² · sweeps) per step, unconditionally stable
interaction: Drag across the box to push dye and momentum.
motivation: A fluid that never blows up, and on its grid the theorem that ties the circulation around a loop to the vorticity inside it holds to the last bit.
relations:
  - type: related_to
    target: vector-calculus
    reason: Stokes's theorem twice over; that plate integrates analytic fields along a loop and over its inside, this one sums the solver's own velocities, and the inner edges of the grid's little squares cancel exactly, Feynman's proof made literal.
  - type: related_to
    target: ripple-tank
    reason: Both step a field on a grid every frame; that one a wave equation explicitly, under a stability limit on the step, this one a fluid implicitly and backwards along the flow, under none.
  - type: related_to
    target: gray-scott
    reason: Dye here and the two chemicals there are densities that diffuse on a grid; here they are also carried by the flow and react with nothing.
experiments:
  - id: few-sweeps
    title: Two sweeps of the pressure solve
    params: { iters: 2 }
    observe: The projection still lowers the largest divergence, but leaves more of it, about two thirds of what it was given against one half at 14 sweeps.
  - id: many-sweeps
    title: Twenty sweeps
    params: { iters: 20 }
    observe: The largest divergence after projection falls a little further, but not to zero; Gauss–Seidel removes the fine error fast and the broad error slowly.
  - id: syrup
    title: Syrup
    params: { visc: 50 }
    observe: Fifty times the viscosity damps the swirls; the kinetic energy falls to about a third and the circulation around the loop shrinks with it.
  - id: still-water
    title: Still water
    params: { emit: false }
    observe: With the emitters off nothing moves until you drag; every readout stays at 0, and a drag starts a circulation the vorticity inside the loop matches exactly.
  - id: small-loop
    title: A small loop
    params: { loop: 0.1 }
    observe: Around a loop a tenth of the box wide the circulation is that of the few eddies crossing it, and the flux through it still matches it to rounding.
claims:
  - id: stokes-on-the-grid
    statement: >-
      After 200 steps the circulation around the loop, the midpoint rule along the cells' outer
      faces, and the vorticity flux through it, central differences at each cell's centre, agree
      to rounding: the flux telescopes row by row and column by column onto the faces. The gap
      is judged against the sum of every term's size, so it is a ratio of one run's numbers: by
      Higham's bound for recursive summation in doubles it is at most about (2304 + 192)·ε ≈
      2.8e−13 for the 48 × 48 cells of the default loop, below 1e−12.
    readout: Stokes gap |∮ − ∬| / Σ|terms|
    expect: { below: 1e-12 }
    setup:
      params: { runs: 200 }
  - id: projection-lowers-divergence
    statement: >-
      At the default 14 sweeps, after 200 steps, the projection leaves a largest divergence below
      the one it was given in the same step: it subtracts the gradient of the pressure the
      sweeps found. Only a ratio within one run is claimed; the field itself is float32 and
      differs between machines.
    readout: Max divergence after projection
    expect: { against: Max divergence before projection, below: 0 }
    setup:
      params: { runs: 200 }
  - id: projection-lowers-divergence-at-two-sweeps
    statement: >-
      At two sweeps the projection still leaves less divergence than it was given, though more of
      it than at 14 (about two thirds of the largest against one half at the seeded default).
    readout: Max divergence after projection
    expect: { against: Max divergence before projection, below: 0 }
    setup:
      params: { runs: 200, iters: 2 }
---

Diffuse, advect backwards along the velocity, and project out divergence: a fluid that never blows up.

The solver runs in WebAssembly, compiled from Rust; this plate only injects the seeded emitters and your drags, steps it, and draws the dye density it reads from the module's memory. The same Rust is tested natively, and the browser's build must reproduce the native build's fixture exactly.

Projection solves a Poisson equation by Gauss–Seidel sweeps. The readout shows the largest divergence before and after it: lower Solver sweeps per step and watch what is left grow, and the fluid start to compress.

Semi-Lagrangian advection traces each cell backwards along the velocity and interpolates, which is why no time step makes it blow up, and also why dye slowly smears: the total in the box is measured, not assumed.

**Circulation.** The dashed square is a loop of whole cells. Its circulation ∮v·dl is summed along the cells' outer faces, each face's velocity the mean of the two cells it separates, and the vorticity ω = ∂v/∂x − ∂u/∂y at every cell inside it by central differences, times the cell's area. The two sums share no term in the code, and they agree because summing the central differences along a row or a column leaves only the values at its ends: the inner edges cancel, as in Feynman's proof of Stokes's theorem with little squares. The gap is shown against the sum of every term's size, a pure number of one run, never a velocity that float32 arithmetic on one machine or another would change.

**Projection.** Even twenty sweeps do not bring the largest divergence near zero. Gauss–Seidel removes the fine part of the error in a few sweeps and the broad part slowly, and on a grid that stores both velocities at the cell centres, the five-point Laplacian the pressure is solved with is not the divergence of the central-difference gradient it is applied through, so a fully converged solve would still leave a checkerboard residue.

**Settle.** *Stop after (steps)* holds the fluid on its k-th step, one to a frame, so its readouts stay still and the claims can read them. At 0, the default, it runs on.

**Data.** The plate takes no data of a reader's. The natural input would be a mask of obstacles or a starting dye picture, and the site has no parser for a mask (ADR 0010 lists the kinds that exist); a table of emitters would only replace three seeded points.
