---
id: prim-mst
title: Prim's algorithm
taxonomy: graphs/spanning-trees
status: live
engine: graph
labs:
  - spanning-trees
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - mst
  - greedy
  - priority queue
complexity: "O(E log V) with a binary heap"
interaction: "Tap a vertex to start from it."
relations:
  - { type: uses, target: binary-heap, reason: "The queue of outside vertices, each keyed by its cheapest edge to the tree and lowered when a cheaper one appears, is an indexed binary heap with decrease-key." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - binary-heap
  objectives:
    - Grow one tree from the source, always adding the cheapest edge leaving it, with the vertices outside waiting in a queue keyed by their cheapest edge to the tree.
    - Compare it with Dijkstra, the same priority-queue loop keyed by one edge's weight instead of a path's length, which from the same source grows a different tree.
    - Span a disconnected input one component at a time.
  misconceptions:
    - That Prim's tree from a source is Dijkstra's shortest-path tree from it; the same loop keyed by one edge's weight instead of a path's length grows a different tree.
algorithm:
  paradigm: greedy
bounds:
  model: edges examined
  best: 2E, every vertex's edge list scanned once when it joins the tree
  worst: 2E
claims:
  - id: weight-is-dense-prims
    statement: >-
      The tree is a minimum spanning tree: on the default geometric graph, 120 vertices at seed
      4242, dense Prim, written in test/spanning-trees-claims.test.ts with a matrix and a linear
      scan instead of a heap or a sort, finds weight 8,881, and so does the plate, exactly
      (integer weights, tolerance 0); Kruskal and Borůvka claim the same weight on the same graph.
    readout: Weight of the tree edges
    expect: { value: 8881 }
  - id: weight-is-dense-prims-on-the-grid
    statement: >-
      On the grid, whose weights are digits and tie often, the tree may differ between plates but
      its weight cannot: dense Prim finds 388 at seed 4242, and so does the plate, exactly.
    readout: Weight of the tree edges
    expect: { value: 388 }
    setup:
      params: { shape: grid }
  - id: weight-is-dense-prims-on-the-small-world
    statement: >-
      On the small-world graph dense Prim finds 344 at seed 4242, and so does the plate, exactly.
    readout: Weight of the tree edges
    expect: { value: 344 }
    setup:
      params: { shape: small-world }
  - id: weight-is-dense-prims-on-the-random-graph
    statement: >-
      The random graph is disconnected, and the minimum spanning forest, one tree per component,
      weighs 4,194 by dense Prim at seed 4242; the plate's forest weighs 4,194, exactly.
    readout: Weight of the tree edges
    expect: { value: 4194 }
    setup:
      params: { shape: random }
  - id: weight-is-dense-prims-on-400-vertices
    statement: >-
      On the largest geometric graph, 400 vertices at seed 4242, dense Prim finds 29,198, and so
      does the plate, exactly.
    readout: Weight of the tree edges
    expect: { value: 29198 }
    setup:
      params: { n: 400 }
  - id: spanning-tree-has-n-minus-1-edges
    statement: >-
      A spanning tree of a connected graph has one edge fewer than it has vertices: the default
      geometric graph is connected (dense Prim grows one tree over it), so its 120 vertices take
      119 tree edges, exactly.
    readout: Tree edges
    expect: { value: 119 }
  - id: spanning-forest-has-n-minus-c-edges
    statement: >-
      A spanning forest of c components has n − c edges: the random graph at seed 4242 falls into
      13 components (counted by dense Prim's restarts), so its 120 vertices take 107 tree edges,
      exactly.
    readout: Tree edges
    expect: { value: 107 }
    setup:
      params: { shape: random }
  - id: examines-every-edge-twice
    statement: >-
      Every vertex joins a tree once and its whole edge list is scanned then, edges back into the
      tree included, and each edge lies on both its endpoints' lists: the default graph's 216
      edges are examined 2 · 216 = 432 times, exactly.
    readout: Edges examined
    expect: { value: 432 }
  - id: examines-every-edge-twice-on-the-grid
    statement: >-
      On the grid at seed 4242, 217 edges, the scans are 2 · 217 = 434, exactly.
    readout: Edges examined
    expect: { value: 434 }
    setup:
      params: { shape: grid }
  - id: examines-every-edge-twice-on-a-forest
    statement: >-
      On the disconnected random graph a new tree starts at each vertex still outside, so every
      vertex still joins once: 2 · 144 = 288 scans, exactly.
    readout: Edges examined
    expect: { value: 288 }
    setup:
      params: { shape: random }
---

Grow one tree, always adding the cheapest edge leaving it.

The tree grows from the circled source: filled vertices are in it, ringed ones wait in the queue keyed by their cheapest edge to the tree, which is drawn in the frontier colour until a cheaper one replaces it.

It is the same priority-queue loop as Dijkstra, keyed by one edge’s weight instead of a path’s length, so from the same source it grows a different tree. On a disconnected input it spans each component in turn. Each vertex’s edge list is scanned once, when it joins, so the edges examined are always twice the edges, and the weight it ends with is the one Kruskal and Borůvka find on the same graph.
