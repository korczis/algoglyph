---
id: articulation-points
title: Articulation points and biconnected components
taxonomy: graphs/connectivity
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
  - id: tarjan-1972-dfs
    purpose: history
tags:
  - articulation points
  - biconnectivity
  - dfs
complexity: "O(V + E)"
interaction: "Tap a vertex to start from it."
related:
  - bridges
  - depth-first-search
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Find the articulation points with one depth-first search and low points, a vertex being one exactly when some child's subtree has no back edge climbing above it.
    - Read the low points off the DFS tree (the thick edges) and the back edges (the frontier colour) they are computed from.
    - Count the biconnected blocks, the pieces that stay connected when any single vertex is removed, which share at most one vertex with each other, always an articulation point.
  prerequisites:
    - depth-first-search
  misconceptions:
    - Lying on a cycle does not spare a vertex; one where a cycle meets a branch or another cycle is still the only way between them, and the plate counts those apart as articulation points on a cycle.
algorithm:
  paradigm: search
bounds:
  model: "edges examined: each vertex scans its incident edges once, skipping the tree edge it was reached by"
  best: "2m − n + c on every input, c its components"
  worst: "2m − n + c on every input"
claims:
  - id: no-cut-vertex-on-the-geometric
    statement: >-
      Deleting any one vertex of the default 70-vertex geometric input leaves the rest connected,
      as deleting each in turn and counting the components by breadth-first search shows in
      test/articulation-points-claims.test.ts at both seeds listed, so no articulation point,
      exactly.
    readout: Articulation points
    expect: { value: 0 }
    setup:
      seeds: [4242, 7]
  - id: cut-vertices-by-removal-on-random
    statement: >-
      On the random sparse input 12 vertices leave more components when deleted, counted by the
      same deletion and breadth-first search in the test, and the search marks 12, exactly.
    readout: Articulation points
    expect: { value: 12 }
    setup:
      params: { shape: random }
  - id: cut-vertices-by-removal-on-islands
    statement: >-
      On the Separate islands input deletion finds 21 cut vertices, and the search marks 21,
      exactly.
    readout: Articulation points
    expect: { value: 21 }
    setup:
      params: { shape: islands }
  - id: cut-vertices-by-removal-on-islands-at-300
    statement: >-
      At 300 vertices the islands have 108 cut vertices by deletion, and the search marks 108,
      exactly.
    readout: Articulation points
    expect: { value: 108 }
    setup:
      params: { shape: islands, n: 300 }
  - id: cut-vertices-on-a-cycle-on-islands
    statement: >-
      Lying on a cycle does not spare a vertex: of the islands' cut vertices, 20 also have an edge
      whose deletion leaves its two ends connected, an edge on a cycle, counted by deletion in the
      test, and the plate counts 20 articulation points on a cycle, exactly.
    readout: Articulation points on a cycle
    expect: { value: 20 }
    setup:
      params: { shape: islands }
  - id: blocks-by-the-block-cut-identity-on-islands
    statement: >-
      The blocks and the cut vertices of a connected graph form a tree, so its blocks number
      1 + Σ (c(G − v) − c(G)) over its vertices; summed over the islands' components the identity
      gives 26 blocks with no search for blocks (the derivation is in the test), and the search
      pops 26, exactly.
    readout: Biconnected blocks
    expect: { value: 26 }
    setup:
      params: { shape: islands }
  - id: a-forest-is-all-blocks-of-one-edge
    statement: >-
      At 0.5 edges per vertex the random input is a forest at both seeds listed (its edges number
      its vertices less its components, counted by breadth-first search in the test), and in a
      forest every edge is a block of its own: the blocks equal the Graph readout's edges, with no
      tolerance.
    readout: Biconnected blocks
    expect: { against: Graph, against_number: 2, tolerance: 0 }
    setup:
      params: { shape: random, edgesPerVertex: 0.5 }
      seeds: [4242, 7]
  - id: a-forest-cuts-at-every-inner-vertex
    statement: >-
      In a forest a vertex separates its tree exactly when it has two neighbours or more: the
      random input at 0.5 edges per vertex has 19 such vertices, counted from its degrees in the
      test, and the search marks 19 articulation points, exactly.
    readout: Articulation points
    expect: { value: 19 }
    setup:
      params: { shape: random, edgesPerVertex: 0.5 }
  - id: tree-spans-the-geometric
    statement: >-
      The geometric input is connected at both seeds listed (breadth-first search in the test), so
      the depth-first tree has one edge fewer than the graph has vertices: DFS tree edges minus
      the Graph readout's vertices is −1, with no tolerance.
    readout: DFS tree edges
    expect: { against: Graph, offset: -1, tolerance: 0 }
    setup:
      seeds: [4242, 7]
  - id: forest-on-random
    statement: >-
      A depth-first forest has one edge fewer than vertices in each tree, one tree per component:
      the random input has 70 vertices in 10 components by breadth-first search, so 60 DFS tree
      edges, exactly.
    readout: DFS tree edges
    expect: { value: 60 }
    setup:
      params: { shape: random }
  - id: scans-skip-the-edge-in
    statement: >-
      Each vertex scans its whole edge list except the tree edge it was reached by, so the edges
      examined are 2m − n + c: the geometric input's 120 edges, 70 vertices and one component
      (counted in the test) give 171, exactly.
    readout: Edges examined
    expect: { value: 171 }
  - id: scans-skip-the-edge-in-on-islands
    statement: >-
      On the islands 2m − n + c is 2 · 101 − 70 + 4 = 136, from the test's own count of edges and
      components, exactly.
    readout: Edges examined
    expect: { value: 136 }
    setup:
      params: { shape: islands }
---

The vertices whose removal disconnects the graph, and the blocks they separate.

Thick edges form the DFS tree and edges in the frontier colour are back edges. When the search ends, the articulation points are filled with the foreground colour and ringed. A vertex is one exactly when some child’s subtree has no back edge climbing above it, which is why the joints of a chain and the only link to a pendant cluster light up. Lying on a cycle does not spare a vertex: one where a cycle meets a branch or another cycle is still the only way between them, and lights up too.

The readouts give the number of articulation points and of biconnected blocks: the pieces that stay connected when any single vertex is removed, which share at most one vertex with each other, always an articulation point.
