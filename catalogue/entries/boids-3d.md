---
id: boids-3d
title: Murmuration
taxonomy: dynamics/collective
status: live
engine: custom
tags:
  - flocking
  - emergence
  - spatial grid
  - 3D
complexity: O(N·k) per step, uniform grid (k neighbours a bird)
interaction: Drag to orbit, scroll to zoom.
sources:
  - id: reynolds-1987-boids
    purpose: algorithm-reference
relations:
  - type: uses
    target: grid-method
    reason: Neighbours come from a uniform grid with cells at least one radius wide, so a bird tests only the 27 cells around its own.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - See separation, alignment and cohesion among near neighbours fold a random swarm into flowing flocks, with nothing in the code describing a flock.
    - Count the pair checks the uniform grid makes against the N(N−1) of testing every pair, and predict them on the random start from the cells alone.
    - Read polarisation, the length of the mean unit velocity, near 0 for the random start and 1 when all fly the same way.
    - Raise separation and see the mean nearest-neighbour distance open.
  prerequisites:
    - grid-method
  misconceptions:
    - "Alignment alone does not order the swarm: with separation and cohesion at 0 the polarisation is still 0.26 after 3000 steps."
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
bounds:
  model: pair distance checks a step, as the readout counts them
  best: '0, when no two birds lie in neighbouring cells'
  average: 'N(N−1)·Π P_axis for birds scattered uniformly, P_axis the chance that two lie in the same or adjacent cells along an axis'
  worst: 'N(N−1), when every bird lies in one 3 × 3 × 3 block of cells'
claims:
  - id: first-step-checks-from-the-grid-geometry
    statement: >-
      The first step checks the random start, scattered uniformly over 0.9 of the box on each
      axis. The 800 birds' grid has ⌊2·half/r⌋ = 18 × 11 × 12 cells, and two birds are checked
      when they lie in the same or adjacent cells on every axis: P_x = 0.17688, P_y = 0.27757,
      P_z = 0.25652 (the cells' shares of the scatter interval, summed over neighbouring pairs),
      so E = N(N − 1)·Π P_axis = 639 200 · 0.012594 = 8050.2. Over seeds 1 … 400 (disjoint from
      the claim's 4242, in test/boids-3d-claims.test.ts) the count has sd 195.6, and the mean
      meets E: within 4 sd, 7268 … 8832.
    readout: pair checks / step
    expect: { range: [7268, 8832] }
    setup:
      params: { runs: 1 }
  - id: first-step-checks-at-1500
    statement: >-
      With 1500 birds the same grid gives E = 1500 · 1499 · 0.012594 = 28 317.9 checks; over
      seeds 1 … 400 the sd is 443.2, so within 4 sd: 26 545 … 30 090.
    readout: pair checks / step
    expect: { range: [26545, 30090] }
    setup:
      params: { runs: 1, n: 1500 }
  - id: first-step-checks-at-radius-0-3
    statement: >-
      At a perception radius of 0.3 the cells are 10 × 6 × 6, P_x = 0.30247, P_y = P_z = 0.47257,
      so E = 639 200 · 0.067547 = 43 175.9; over seeds 1 … 400 the sd is 1059.4, so within 4 sd:
      38 938 … 47 413.
    readout: pair checks / step
    expect: { range: [38938, 47413] }
    setup:
      params: { runs: 1, radius: 0.3 }
  - id: fewer-checks-than-all-pairs
    statement: >-
      A bird checks only the birds of its 27 cells, never itself, so a step makes at most N(N −
      1) checks, and fewer unless every bird shares one block: the count is below the readout's
      second number, 639 200.
    readout: pair checks / step
    expect: { against: pair checks / step, against_number: 2, below: 0 }
    setup:
      params: { runs: 1 }
  - id: fewer-checks-than-all-pairs-at-radius-0-3
    statement: >-
      With the 10 × 6 × 6 cells of radius 0.3 a block spans 3/10 of the box's length and half of
      its height and depth, so still not every pair: below N(N − 1) = 639 200.
    readout: pair checks / step
    expect: { against: pair checks / step, against_number: 2, below: 0 }
    setup:
      params: { runs: 1, radius: 0.3 }
---

Reynolds boids in a box: separation, alignment and cohesion among near neighbours, found with a uniform grid, fold a random swarm into flowing flocks. Drag to orbit.

Craig Reynolds' boids (1987). Each bird sees only neighbours within the perception radius and steers by three rules: separation (away from those closer than half the radius, the nearest pushing hardest), alignment (towards their mean heading) and cohesion (towards their centre). Each rule is a steering force, the desired velocity at full speed minus the current one, capped at a maximum force; speed stays between 40 % of the maximum and the maximum, and soft walls turn birds back near the faces of the box. Nothing in the code describes a flock.

Testing every pair costs N(N−1) distance checks a step. A uniform grid with cells at least one radius wide sorts the birds by cell, and each bird tests only the 27 cells around its own, so the cost grows with N times the local density. The readout counts the checks actually made against N(N−1). On the random start two birds are checked when they lie in the same or adjacent cells along every axis, so the first step makes about N(N−1)·Π P_axis checks, P_axis that chance along one axis.

Polarisation is the length of the mean unit velocity: near 0 for the random start, 1 when all fly the same way. Set separation and cohesion to zero and alignment turns neighbours together but does not order the swarm: its polarisation is 0.26 after 3000 steps, against 0.41 with all three rules. Raise separation and the mean nearest-neighbour distance opens. Real starlings seem to track about seven nearest neighbours whatever their distance (Ballerini et al., 2008); these boids use a fixed radius instead.
