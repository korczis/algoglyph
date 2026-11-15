---
id: force-atlas2
title: ForceAtlas2 layout
taxonomy: graphs/layout
status: live
engine: graph
sources:
  - id: practice-investigation
tags:
  - force-directed
  - layout
  - barnes-hut
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(V² + E) per iteration with exact repulsion; O(V log V + E) with Barnes–Hut"
related:
  - geo-graph
  - sugiyama-layout
relations:
  - { type: related_to, target: barnes-hut, reason: "ForceAtlas2 cuts its all-pairs repulsion to O(V log V) with a Barnes–Hut tree; this plate computes every pair exactly." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Repel every pair of vertices, attract the ends of every edge and pull every vertex towards the centre, until the layout settles into a readable map.
    - Watch the three-communities input sort its rings into clusters, since attraction grows linearly with distance while repulsion falls off only as 1/d.
    - Follow the total swing, which falls as vertices stop oscillating, and raise gravity to pull the clusters closer together or the scaling kr to push them apart.
  misconceptions:
    - That the charted total swing is the swing the speed rule uses; the chart is the plain unweighted sum of every vertex's swing, while the speed rule weighs each vertex's swing by its degree + 1.
algorithm:
  paradigm: iterative-refinement
bounds:
  model: "vertex moves: every vertex is placed once at its random start and moved once in each iteration, which also computes the repulsion of every pair and examines every edge once"
  best: "n(it + 1) vertex moves for it iterations, with it · n(n − 1)/2 pair forces and it · m edges examined, on every input"
  worst: "n(it + 1) vertex moves, it · n(n − 1)/2 pair forces and it · m edges examined"
claims:
  - id: one-round-per-iteration
    statement: >-
      Every iteration moves all the vertices once and ends one round, so the rounds are the
      iterations asked for: 250 at the default, exactly, at both seeds.
    readout: Rounds
    expect: { value: 250 }
    setup:
      seeds: [4242, 7]
  - id: one-round-per-iteration-at-500
    statement: >-
      At the control's top, 500 iterations, the rounds are 500, exactly.
    readout: Rounds
    expect: { value: 500 }
    setup:
      params: { iterations: 500 }
  - id: vertex-moves-are-n-times-iterations-plus-one
    statement: >-
      Every vertex is placed once at its random start and moved once in every iteration: n(it +
      1) moves, 70 · 251 = 17,570 on the default 70 vertices at 250 iterations, exactly, at both
      seeds.
    readout: Vertex moves
    expect: { value: 17570 }
    setup:
      seeds: [4242, 7]
  - id: vertex-moves-at-500-iterations
    statement: >-
      At 500 iterations the moves are 70 · 501 = 35,070, exactly.
    readout: Vertex moves
    expect: { value: 35070 }
    setup:
      params: { iterations: 500 }
  - id: vertex-moves-on-the-smallest-input
    statement: >-
      On 4 vertices at 20 iterations, the controls' lower ends, the moves are 4 · 21 = 84,
      exactly.
    readout: Vertex moves
    expect: { value: 84 }
    setup:
      params: { n: 4, iterations: 20 }
  - id: start-energy
    statement: >-
      The energy of the random start, E = Σ over edges d²/2 − kr Σ over pairs (deg u + 1)(deg v
      + 1) ln d + kg Σ (deg + 1)|x|, is −428,245 at seed 4242: test/force-atlas2-claims.test.ts
      draws the start from the seed and evaluates E itself, exactly at the integer the plate
      shows.
    readout: Layout energy
    expect: { value: -428245 }
  - id: start-energy-at-seed-7
    statement: >-
      On the graph and start seed 7 draws the same evaluation gives −427,612, exactly at the
      integer shown.
    readout: Layout energy
    expect: { value: -427612 }
    setup:
      seed: 7
  - id: start-energy-at-the-highest-scaling
    statement: >-
      The repulsion's term carries kr: at scaling 10, the control's top, the same start has
      energy −2,206,616, exactly at the integer shown.
    readout: Layout energy
    expect: { value: -2206616 }
    setup:
      params: { scaling: 10 }
  - id: start-energy-at-the-lowest-scaling
    statement: >-
      At scaling 0.1, the control's bottom, the repulsion's term is a twentieth of the default's
      and the same start has energy −5881.82, exactly at the six significant digits shown.
    readout: Layout energy
    expect: { value: -5881.82 }
    setup:
      params: { scaling: 0.1 }
---

Repulsion between all vertices, attraction along edges and gravity to the centre, settling into a readable map.

Vertices start scattered at random and every iteration moves all of them; the outer rings show the input’s known groups where it has them. On the three-communities input the rings sort themselves into clusters, since attraction grows linearly with distance while repulsion falls off only as 1/d.

The chart shows the total swing, the plain unweighted sum of every vertex’s swing (the speed rule weighs each vertex’s swing by its degree + 1), which falls as vertices stop oscillating. Raise gravity to pull the clusters closer together, or the scaling kr to push them apart.

The forces are minus the gradient of a layout energy, which the readouts give at the start and at the end of the run. They also give the force balance of the last positions, the work of attraction and gravity over the work of repulsion, which is 1 at a fixed point; the run ends after its iterations, short of a fixed point.
