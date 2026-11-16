---
id: bridges
title: Bridges
taxonomy: graphs/connectivity
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
  - id: tarjan-1972-dfs
    purpose: history
tags:
  - bridges
  - edge connectivity
  - dfs
complexity: "O(V + E)"
interaction: "Tap a vertex to start from it."
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Find the bridges with a depth-first search and low points, a tree edge being one exactly when nothing below it has a back edge reaching its upper end or above.
    - See that any edge on a cycle survives, so a bridge is the only link between the two sides it joins.
    - Compare the inputs, the random sparse one with many vertices hanging by one edge and the small-world ring with usually no bridge at all, every edge lying on some cycle around the ring.
  prerequisites:
    - depth-first-search
algorithm:
  paradigm: search
bounds:
  model: "edges examined: each vertex scans its incident edges once, skipping the tree edge it was reached by"
  best: "2m − n + c on every input, c its components"
  worst: "2m − n + c on every input"
claims:
  - id: bridges-by-removal-on-random
    statement: >-
      On the random sparse input 15 edges leave more components when deleted, counted by deleting
      each edge in turn and searching breadth-first in test/bridges-claims.test.ts, and the low
      points find 15 bridges, exactly.
    readout: Bridges
    expect: { value: 15 }
    setup:
      params: { shape: random }
  - id: bridges-by-removal-on-islands
    statement: >-
      On the Separate islands input deletion finds 9 bridges, and the search finds 9, exactly.
    readout: Bridges
    expect: { value: 9 }
    setup:
      params: { shape: islands }
  - id: bridges-by-removal-at-one-edge-per-vertex
    statement: >-
      At 1 edge per vertex the random input has 17 bridges by deletion, and the search finds 17,
      exactly.
    readout: Bridges
    expect: { value: 17 }
    setup:
      params: { shape: random, edgesPerVertex: 1 }
  - id: no-bridge-on-the-small-world
    statement: >-
      Deleting any one edge of the small-world ring leaves its ends connected at both seeds listed,
      counted by deletion in the test, so no bridge, exactly.
    readout: Bridges
    expect: { value: 0 }
    setup:
      params: { shape: small-world }
      seeds: [4242, 7]
  - id: no-bridge-on-the-geometric
    statement: >-
      Every vertex of the geometric input is joined to its three nearest, so none hangs by one
      edge, and at both seeds listed no edge is the only link between two clusters either:
      deletion finds no bridge, exactly.
    readout: Bridges
    expect: { value: 0 }
    setup:
      seeds: [4242, 7]
  - id: every-edge-of-a-forest-is-a-bridge
    statement: >-
      At 0.5 edges per vertex the random input is a forest at both seeds listed (its edges number
      its vertices less its components, counted in the test), and no edge of a forest lies on a
      cycle: the bridges equal the Graph readout's edges, with no tolerance.
    readout: Bridges
    expect: { against: Graph, against_number: 2, tolerance: 0 }
    setup:
      params: { shape: random, edgesPerVertex: 0.5 }
      seeds: [4242, 7]
  - id: forest-on-random
    statement: >-
      The depth-first forest has one edge fewer than vertices in each tree: the random input has
      70 vertices in 10 components by breadth-first search, so 60 DFS tree edges, exactly.
    readout: DFS tree edges
    expect: { value: 60 }
    setup:
      params: { shape: random }
  - id: tree-edges-that-are-not-bridges-on-random
    statement: >-
      Every bridge is a tree edge, so the tree edges that are not bridges are the forest less the
      bridges: 60 − 15 = 45 by the test's breadth-first search and deletion, exactly.
    readout: Tree edges that are not bridges
    expect: { value: 45 }
    setup:
      params: { shape: random }
  - id: tree-spans-the-geometric
    statement: >-
      The geometric input is connected at both seeds listed, so its depth-first tree has one edge
      fewer than the graph has vertices: DFS tree edges minus the Graph readout's vertices is −1,
      with no tolerance.
    readout: DFS tree edges
    expect: { against: Graph, offset: -1, tolerance: 0 }
    setup:
      seeds: [4242, 7]
  - id: scans-skip-the-edge-in
    statement: >-
      Each vertex scans its whole edge list except the tree edge it was reached by: 2m − n + c =
      2 · 120 − 70 + 1 = 171 edges examined on the geometric input, from the test's own count,
      exactly.
    readout: Edges examined
    expect: { value: 171 }
---

The edges whose removal disconnects the graph, found from DFS low points.

The same depth-first search with low points: thick edges are the tree, edges in the frontier colour are back edges. When the search ends the bridges are drawn thickest. A tree edge is a bridge exactly when nothing below it has a back edge reaching its upper end or above; any edge on a cycle survives.

On the random sparse input many vertices hang by a single edge, and each such edge is a bridge; on the geometric input every vertex is joined to its three nearest, so none hangs by one edge, and a bridge there, in the runs that have one, is the only link between two clusters. On the small-world ring there are usually none, because every edge lies on some cycle around the ring.

Each bridge is repainted from the tree to the bridge state when the search ends, so the tree row counts the tree edges that are not bridges; the DFS tree edges row is the whole forest, one edge fewer than vertices in each component.
