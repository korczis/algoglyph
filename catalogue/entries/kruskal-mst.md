---
id: kruskal-mst
title: Kruskal's algorithm
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
  - union-find
complexity: "O(E log E)"
related:
  - path-compression
  - prim-mst
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - weighted-quick-union
  objectives:
    - Take edges cheapest first, an edge that joins two fragments becoming a tree edge and one that would close a cycle fading out.
    - Watch the smaller fragment take the larger one's colour, and the fragment count fall by one with every tree edge.
    - Span a disconnected input with a forest, one tree for each component.
algorithm:
  paradigm: greedy
bounds:
  model: edges examined, after the edges are sorted by weight in O(E log E)
  best: V − c, c the components, when the cheapest edges already span
  worst: E
claims:
  - id: weight-is-dense-prims
    statement: >-
      The tree is a minimum spanning tree: on the default geometric graph, 120 vertices at seed
      4242, dense Prim, written in test/spanning-trees-claims.test.ts with a matrix and a linear
      scan instead of a heap or a sort, finds weight 8,881, and so does the plate, exactly
      (integer weights, tolerance 0); Prim and Borůvka claim the same weight on the same graph.
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
  - id: examines-between-the-tree-and-every-edge
    statement: >-
      Kruskal examines the edges cheapest first, each at most once, and stops at the 119th tree
      edge, so on the default graph of 216 edges it examines at most 216, and at least the 119
      it takes: between 119 and 216.
    readout: Edges examined
    expect: { range: [119, 216] }
  - id: examines-every-edge-of-a-forest
    statement: >-
      On the disconnected random graph it never reaches 119 tree edges, so it never stops early
      and examines every one of the 144 edges, exactly.
    readout: Edges examined
    expect: { value: 144 }
    setup:
      params: { shape: random }
---

Take edges cheapest first, skipping any that would close a cycle.

Edges are taken cheapest first. One that joins two fragments becomes a tree edge and the smaller fragment takes the larger one’s colour; one that would close a cycle fades out. The fragment count in the chart falls by one with every tree edge, and the highlighted edge is the one just examined.

On a disconnected input, the random graph, it ends with a spanning forest of one tree per component, n − c edges for c components, and has examined every edge by then. Every plate in the spanning-trees lab finds the same weight on the same graph, though where weights tie the trees may differ.
