---
id: topological-sort
title: Topological sort
taxonomy: graphs/digraphs
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - dag
  - topological order
  - dfs
complexity: "O(V + E)"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Put every edge pointing forward by taking the reverse postorder of a DFS.
    - Watch the vertices take their place in the final order as they finish, the last places filling first, since a vertex finishes only after everything it points to.
    - Find the root of the last search in place 0, with every edge running from an earlier place to a later one.
  prerequisites:
    - depth-first-search
algorithm:
  paradigm: search
bounds:
  model: "edges examined: each vertex's out-edges scanned once by the searches"
  best: "m on every input"
  worst: "m on every input"
claims:
  - id: no-edge-points-backward
    statement: >-
      A vertex finishes only after everything it points to, and the k-th to finish takes place
      n − 1 − k, so on a DAG every edge runs from an earlier place to a later one: the edges
      pointing backward are 0, exactly.
    readout: Edges pointing backward
    expect: { value: 0 }
  - id: no-edge-points-backward-at-300
    statement: >-
      On the layered DAG of 300 vertices, the most the plate takes, no edge points backward
      either, 0, exactly.
    readout: Edges pointing backward
    expect: { value: 0 }
    setup:
      params: { n: 300 }
  - id: no-edge-points-backward-on-the-signed-dag
    statement: >-
      The signed DAG is acyclic as well, so no edge points backward in its order, 0, exactly.
    readout: Edges pointing backward
    expect: { value: 0 }
    setup:
      params: { shape: signed-dag }
  - id: no-edge-points-backward-on-the-reasoning-graph
    statement: >-
      The reasoning graph's edges all point up a tier, so it is acyclic and no edge points
      backward in its order, 0, exactly.
    readout: Edges pointing backward
    expect: { value: 0 }
    setup:
      params: { shape: reasoning }
  - id: every-vertex-placed
    statement: >-
      Each vertex finishes once and takes one place, so the vertices placed equal the Graph
      readout's vertex count, exactly.
    readout: Placed
    expect: { against: Graph, tolerance: 0 }
  - id: every-edge-scanned-once
    statement: >-
      The searches scan every vertex's out-edges once, so the edges examined equal the Graph
      readout's edge count (its second number), exactly.
    readout: Edges examined
    expect: { against: Graph, against_number: 2, tolerance: 0 }
  - id: every-edge-scanned-once-at-300
    statement: >-
      At 300 vertices the edges examined equal the edge count as well, exactly.
    readout: Edges examined
    expect: { against: Graph, against_number: 2, tolerance: 0 }
    setup:
      params: { n: 300 }
  - id: last-root-takes-place-0
    statement: >-
      A search starts at each vertex that no smaller-numbered vertex reaches, in order, and the
      last one to start finishes last: on the default DAG a breadth-first search from every vertex
      finds that vertex 1 is the last such (test/topological-sort-readouts.test.ts), so the order
      begins with 1, exactly.
    readout: Order
    expect: { value: 1 }
  - id: last-root-takes-place-0-at-seed-7
    statement: >-
      At seed 7 the last vertex no smaller-numbered vertex reaches is again vertex 1, so the order
      begins with 1, exactly.
    readout: Order
    expect: { value: 1 }
    setup:
      seed: 7
---

Reverse postorder of a DFS puts every edge pointing forward.

Vertices are coloured by their place in the final order as they finish. A vertex finishes only after everything it points to, so the last places fill first, and the root of the last search finishes last and takes place 0. Every edge then runs from an earlier place to a later one.
