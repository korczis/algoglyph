---
id: geo-graph
title: Graph over a map
taxonomy: graphs/layout
status: live
engine: graph
sources:
  - id: fruchterman-reingold-1991
    purpose: algorithm-reference
  - id: practice-geo
tags:
  - geospatial
  - force-directed
  - maps
motivation: Crisis maps and geospatial analysis are built from it.
complexity: "O(V² + E) per iteration"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Lay out a graph by force while a spring pulls each vertex towards its place on a map, the small square it is tied to by a faint line.
    - Start the layout on a circle and follow the total distance from the map, iteration by iteration.
    - Set the pull to 0 so that only the graph's own forces act, and to 1 so that the vertices settle near their places and the edges that join distant places stay long.
  prerequisites:
    - force-atlas2
  misconceptions:
    - That the map is a globe measured in great-circle distances; the places are points of a flat plane, and every distance here is a straight line.
algorithm:
  paradigm: iterative-refinement
bounds:
  model: "vertex moves: every vertex is placed once on the starting circle and moved once in each iteration, which also computes the repulsion of every pair and examines every edge once"
  best: "n(it + 1) vertex moves for it iterations, with it · n(n − 1)/2 pair forces and it · m edges examined, on every input"
  worst: "n(it + 1) vertex moves, it · n(n − 1)/2 pair forces and it · m edges examined"
claims:
  - id: one-round-per-iteration
    statement: >-
      Every iteration moves all the vertices once and ends one round, so the rounds are the
      iterations asked for: 200 at the default, exactly, at both seeds.
    readout: Rounds
    expect: { value: 200 }
    setup:
      seeds: [4242, 7]
  - id: one-round-per-iteration-at-410
    statement: >-
      At the iterations control's top, 410, the rounds are 410, exactly.
    readout: Rounds
    expect: { value: 410 }
    setup:
      params: { iterations: 410 }
  - id: vertex-moves-are-n-times-iterations-plus-one
    statement: >-
      Every vertex is placed once on the starting circle and moved once in every iteration: n(it +
      1) moves, 60 · 201 = 12,060 on the default 60 vertices at 200 iterations, exactly, at both
      seeds.
    readout: Vertex moves
    expect: { value: 12060 }
    setup:
      seeds: [4242, 7]
  - id: vertex-moves-at-410-iterations
    statement: >-
      At 410 iterations the moves are 60 · 411 = 24,660, exactly.
    readout: Vertex moves
    expect: { value: 24660 }
    setup:
      params: { iterations: 410 }
  - id: vertex-moves-at-20-iterations
    statement: >-
      At 20 iterations, the control's bottom, the moves are 60 · 21 = 1,260, exactly.
    readout: Vertex moves
    expect: { value: 1260 }
    setup:
      params: { iterations: 20 }
  - id: no-cooling-left-after-one-step
    statement: >-
      At cooling 0 the longest step a vertex may take, a quarter of the map's radius at first, is
      0 after the first iteration, so the vertices take one step and freeze: the mean distance
      from the map is that of one step from the starting circle, 0.787, which
      test/geo-graph-claims.test.ts computes by one step of the forces written there, exactly at
      the three significant digits shown.
    readout: Mean distance from the map
    expect: { value: 0.787 }
    setup:
      params: { cooling: 0 }
  - id: no-cooling-left-after-one-step-at-410
    statement: >-
      Since nothing moves after the first step, 410 iterations at cooling 0 end where 200 do, at
      the one step's 0.787, exactly at the digits shown.
    readout: Mean distance from the map
    expect: { value: 0.787 }
    setup:
      params: { cooling: 0, iterations: 410 }
  - id: no-cooling-left-after-one-step-at-seed-7
    statement: >-
      On the map seed 7 draws, one step from the circle leaves a mean distance of 0.813,
      and so does the run at cooling 0, exactly at the digits shown.
    readout: Mean distance from the map
    expect: { value: 0.813 }
    setup:
      params: { cooling: 0 }
      seed: 7
---

A force layout whose vertices are pulled towards their places on a map.

The small squares are the vertices’ places on the map, and a faint line ties each vertex to its place. The layout starts on a circle; the chart shows the total distance from the map, iteration by iteration.

Set the pull to 0 and only the graph’s own forces act; at 1 the vertices settle near their places and the edges that join distant places stay long.

The map is flat: the places are points of the plane, and every distance is a straight line, with no latitude or longitude. After each iteration the longest step a vertex may take is multiplied by the cooling; at 0 the vertices take one step and freeze, at 1 they never slow down. The readouts also give the force balance of the last positions, the work of the edges and the map springs over the work of repulsion, which is 1 at a fixed point; the run ends after its iterations, short of a fixed point.
