---
id: fibonacci-sphere
title: Fibonacci sphere layout
taxonomy: graphs/layout
status: live
engine: graph
sources:
  - id: practice-investigation
tags:
  - sphere
  - golden angle
  - 3d
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(V + E) to place the vertices; the random-assignment baseline adds O(V²), one chord for every pair of points"
interaction: "Tap a vertex to start the placement from it."
related:
  - force-atlas2
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Spread points evenly on a sphere by the golden angle, a stable home for a 3D graph.
    - Hand the points to the vertices in breadth-first order from the circled source, so that neighbours tend to sit on nearby turns of the spiral.
    - Compare the mean chord length of the edges with the mean chord over every pair of the n points, which is what the edges would measure on average if the vertices took the points in a random order.
  prerequisites:
    - breadth-first-search
  misconceptions:
    - That 4/3, the mean distance between two random points on the unit sphere, is the baseline at every size; the random-assignment baseline tends to 4/3 only as n grows, and on a handful of points it is well above 4/3, so an edge chord above 4/3 can still beat a random assignment.
bounds:
  model: "vertex placements and edges examined: every vertex is queued once, placed when it leaves the queue, and scans its whole edge list then"
  best: "n placements and 2m edges examined on every input, connected or not: a new search starts from every vertex not yet placed"
  worst: "n placements and 2m edges examined on every input"
claims:
  - id: every-vertex-placed-once
    statement: >-
      Every vertex is queued once and placed once, when it leaves the queue, and a new
      breadth-first search starts from every vertex the earlier ones did not reach: the vertex
      moves equal the Graph readout's vertex count, with no tolerance, at both seeds.
    readout: Vertex moves
    expect: { against: Graph, tolerance: 0 }
    setup:
      seeds: [4242, 7]
  - id: every-vertex-placed-once-on-the-communities
    statement: >-
      On the three-communities input every vertex is placed once as well: vertex moves equal the
      vertex count, with no tolerance, at both seeds.
    readout: Vertex moves
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { shape: communities }
      seeds: [4242, 7]
  - id: every-edge-examined-twice
    statement: >-
      A placed vertex scans its whole edge list and an undirected edge lies in two lists, so the
      edges examined are 2m: the default small world of 160 vertices has 320 edges at both seeds
      (each vertex joined to two ring neighbours ahead of it, some rewired), so 640, exactly, the
      sum of the edge lists' lengths that test/fibonacci-sphere-claims.test.ts counts.
    readout: Edges examined
    expect: { value: 640 }
    setup:
      seeds: [4242, 7]
  - id: every-edge-examined-twice-on-the-grid
    statement: >-
      The grid of 160 is 17 columns by 9 rows, 153 vertices with 9 · 16 + 8 · 17 = 280 edges, so
      560 edges examined, exactly.
    readout: Edges examined
    expect: { value: 560 }
    setup:
      params: { shape: grid }
  - id: random-assignment-baseline
    statement: >-
      A uniformly random assignment of the vertices to the points sends each edge to a uniformly
      random pair of distinct points, so its expected edge chord is the mean chord over the
      lattice's pairs: 1.341 for the 160 points, which test/fibonacci-sphere-claims.test.ts
      computes from the lattice's formula, exactly at three decimals, whatever the graph, so at
      both seeds.
    readout: Mean chord of a random assignment
    expect: { value: 1.341 }
    setup:
      seeds: [4242, 7]
  - id: random-assignment-baseline-on-8-points
    statement: >-
      On 8 points the lattice's mean pairwise chord is 1.479, well above 4/3 ≈ 1.333, exactly at
      three decimals.
    readout: Mean chord of a random assignment
    expect: { value: 1.479 }
    setup:
      params: { n: 8 }
  - id: random-assignment-baseline-on-4-points
    statement: >-
      On the smallest lattice, 4 points, the mean pairwise chord is 1.616, exactly at three
      decimals.
    readout: Mean chord of a random assignment
    expect: { value: 1.616 }
    setup:
      params: { n: 4 }
  - id: mean-edge-chord
    statement: >-
      The breadth-first order from the source, computed in test/fibonacci-sphere-claims.test.ts
      with the lattice from its formula, puts the default small world's edges at a mean chord of
      1.156, exactly at three decimals, against 1.341 for a random assignment.
    readout: Mean edge chord
    expect: { value: 1.156 }
  - id: mean-edge-chord-at-seed-7
    statement: >-
      On the small world seed 7 draws the same computation gives a mean edge chord of 1.124,
      exactly at three decimals.
    readout: Mean edge chord
    expect: { value: 1.124 }
    setup:
      seed: 7
  - id: mean-edge-chord-on-8-points
    statement: >-
      On a small world of 8 vertices the same computation gives a mean edge chord of 1.423: above
      4/3, yet below the 1.479 a random assignment to these 8 points would give, so 4/3 is the
      wrong baseline here, exactly at three decimals.
    readout: Mean edge chord
    expect: { value: 1.423 }
    setup:
      params: { n: 8 }
---

Points spread evenly on a sphere by the golden angle, a stable home for a 3D graph.

The sphere turns slowly; nearer vertices are drawn larger and edges fainter towards the back. Vertices take the points in breadth-first order from the circled source, so neighbours tend to sit on nearby turns of the spiral.

The readouts compare the mean chord length of the edges with the mean chord over every pair of the n points, which is what the edges would measure on average if the vertices took the points in a random order. That baseline tends to 4/3, the mean distance between two random points on the unit sphere, only as n grows; on a handful of points it is well above 4/3, so an edge chord above 4/3 can still beat a random assignment.
