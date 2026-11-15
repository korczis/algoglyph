---
id: euler-tour
title: Euler tour
taxonomy: graphs/connectivity
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
  - id: hierholzer-wiener-1873
    purpose: history
tags:
  - euler
  - tours
  - stack
complexity: "O(V + E)"
interaction: "Tap a vertex to start from it."
related:
  - hamilton-path
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Build a walk that uses every edge exactly once by splicing cycles, with a stack of the vertices walked.
    - Check the input's condition, a connected graph whose degrees are all even, which is exactly when a closed Euler tour exists. The midpoints are why the Graph readout can show more vertices than the control asks for.
    - Watch the walk get stuck only where its current cycle began, back up emitting vertices, and walk and splice in a new cycle wherever a vertex still has unused edges.
  prerequisites:
    - depth-first-search
  misconceptions:
    - A walk that gets stuck has not failed; with every degree even it can only get stuck where its current cycle began, and the edges it has not used are spliced in as further cycles as it backs up.
bounds:
  model: "edges examined: each vertex reads its edge list once, from a pointer that never moves back"
  best: "2m on every input"
  worst: "2m on every input"
claims:
  - id: every-edge-in-the-tour
    statement: >-
      The input is connected and every degree is even at both seeds listed (breadth-first search
      and a degree count in test/euler-tour-claims.test.ts), so a closed Euler tour exists and the
      splicing emits every edge once: the Tour's first number, the edges emitted, minus its
      second, the graph's edges, is 0, with no tolerance.
    readout: Tour
    expect: { against: Tour, against_number: 2, tolerance: 0 }
    setup:
      seeds: [4242, 7]
  - id: every-edge-in-the-tour-at-200
    statement: >-
      At 200 vertices asked the input is still connected with even degrees at both seeds listed,
      and the tour still emits every edge, with no tolerance.
    readout: Tour
    expect: { against: Tour, against_number: 2, tolerance: 0 }
    setup:
      params: { n: 200 }
      seeds: [4242, 7]
  - id: every-edge-in-the-tour-at-6
    statement: >-
      At 6 vertices asked, the smallest input, the tour emits every edge at both seeds listed, with
      no tolerance.
    readout: Tour
    expect: { against: Tour, against_number: 2, tolerance: 0 }
    setup:
      params: { n: 6 }
      seeds: [4242, 7]
  - id: every-vertex-exhausted
    statement: >-
      The input is connected, so the walk reaches every vertex and leaves none with an unused edge:
      Exhausted reads n of n at both seeds listed, its first number minus its second 0, with no
      tolerance.
    readout: Exhausted
    expect: { against: Exhausted, against_number: 2, tolerance: 0 }
    setup:
      seeds: [4242, 7]
  - id: every-edge-scanned-twice
    statement: >-
      Each vertex reads its edge list once, from a pointer that never moves back, and an undirected
      edge lies in two lists: the default input's 77 edges, counted in the test, give 154 edges
      examined, exactly.
    readout: Edges examined
    expect: { value: 154 }
  - id: every-edge-scanned-twice-at-200
    statement: >-
      At 200 vertices asked the input has 305 edges, so 610 edges examined, exactly.
    readout: Edges examined
    expect: { value: 610 }
    setup:
      params: { n: 200 }
---

A walk that uses every edge exactly once, built by splicing cycles.

The input is a connected graph whose degrees are all even (the odd vertices of a nearest-neighbour graph are paired by an extra edge, or through a new midpoint vertex when they are already neighbours), which is exactly when a closed Euler tour exists. The midpoints are why the Graph readout can show more vertices than the control asks for.

Thick edges in the tree colour have been walked but not yet emitted; edges in the foreground colour are in the tour. The walk can only get stuck where its current cycle began; it then backs up, emitting vertices, and wherever a vertex still has unused edges a new cycle is walked and spliced in.
