---
id: boruvka-mst
title: Borůvka's algorithm
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
  - parallel
  - components
complexity: "O(E log V)"
related:
  - kruskal-mst
  - prim-mst
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - kruskal-mst
  objectives:
    - Let every fragment pick its cheapest edge to another fragment in one scan of every edge, and join all the picks at once.
    - Count the rounds, the fragment count at least halving in each, so there are at most log₂ V of them.
    - See why ties are broken by edge index, on the grid whose digit weights tie often, so that the simultaneous picks close no cycle.
  misconceptions:
    - That cheapest picks made at once can never close a cycle; with tied weights they can, unless every fragment breaks ties the same way, here by edge index.
algorithm:
  paradigm: greedy
bounds:
  model: rounds, each a scan of every edge
  worst: ⌊log₂ V⌋ rounds, so (⌊log₂ V⌋ + 1)·E edges examined with the scan that finds no pick
claims:
  - id: weight-is-dense-prims
    statement: >-
      The tree is a minimum spanning tree: on the default geometric graph, 120 vertices at seed
      4242, dense Prim, written in test/spanning-trees-claims.test.ts with a matrix and a linear
      scan instead of a heap or a sort, finds weight 8,881, and so does the plate, exactly
      (integer weights, tolerance 0); Kruskal and Prim claim the same weight on the same graph.
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
  - id: rounds-within-log2-v
    statement: >-
      Every fragment that can merge merges with at least one other, so the fragments at least
      halve per round and 120 vertices need at most ⌊log₂ 120⌋ = 6 rounds, and at least 1 (the
      derivation for this plate is in test/spanning-trees-claims.test.ts).
    readout: Rounds
    expect: { range: [1, 6] }
  - id: rounds-within-log2-v-on-400-vertices
    statement: >-
      On 400 vertices the same halving allows at most ⌊log₂ 400⌋ = 8 rounds, and at least 1.
    readout: Rounds
    expect: { range: [1, 8] }
    setup:
      params: { n: 400 }
  - id: rounds-within-log2-v-on-the-grid
    statement: >-
      On the grid, whose tied weights the edge index orders, the rounds are at most ⌊log₂ 120⌋ =
      6 as well, and at least 1.
    readout: Rounds
    expect: { range: [1, 6] }
    setup:
      params: { shape: grid }
  - id: rounds-within-log2-v-on-a-forest
    statement: >-
      On the disconnected random graph each component halves on its own, side by side, so the
      rounds are at most ⌊log₂ 120⌋ = 6 there too, and at least 1.
    readout: Rounds
    expect: { range: [1, 6] }
    setup:
      params: { shape: random }
---

Every component takes its cheapest outgoing edge at once, and the components at least halve.

Each round scans every edge once, every fragment picks its cheapest edge to another fragment, and all the picks join at once. On a connected input the fragment count in the chart at least halves per round, so there are at most log₂ V rounds.

Ties are broken by edge index, which keeps the simultaneous picks from closing a cycle; the grid input, whose weights are digits and tie often, is the place to see that matter. The weight it ends with is the one Kruskal and Prim find on the same graph, though where weights tie the trees may differ.
