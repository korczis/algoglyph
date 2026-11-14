---
id: euclidean-mst
title: Euclidean minimum spanning tree
taxonomy: graphs/spanning-trees
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - mst
  - geometry
  - delaunay
complexity: "O(n²) here (Bowyer–Watson insertion); O(n log n) with a faster triangulation"
related:
  - kruskal-mst
relations:
  - { type: uses, target: bowyer-watson-delaunay, reason: "The graph it spans is the Delaunay triangulation, built by Bowyer–Watson insertion." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Find the minimum spanning tree of points in the plane among the edges of their Delaunay triangulation.
    - Watch Kruskal run on the triangulation's edges alone, ordered by true length, kept edges joining fragments and the rest fading.
    - See that the tree is the minimum spanning tree of all n(n − 1)/2 pairs, while only the triangulation's edges are ever examined.
  prerequisites:
    - kruskal-mst
    - bowyer-watson-delaunay
bounds:
  model: "edges examined: Kruskal's scans of the triangulation's edges in order of length (the Bowyer–Watson insertions before them are not scans)"
  best: "n − 1, when the n − 1 shortest edges of the triangulation form the tree"
  worst: "3n − 6: a triangulation of n ≥ 3 points with h on its hull has 3n − 3 − h edges (Euler's formula), and h ≥ 3"
claims:
  - id: tree-weight-is-all-pairs-prim
    statement: >-
      The tree is the minimum spanning tree of all n(n − 1)/2 pairs: its weight, the sum of the
      integer edge weights over it, equals that of a dense Prim run over every pair on true lengths
      (test/euclidean-mst-readouts.test.ts), 5,111 at the default 70 points, exactly.
    readout: Weight of the tree edges
    expect: { value: 5111 }
  - id: tree-weight-is-all-pairs-prim-at-seed-7
    statement: >-
      At seed 7 the 70 points' dense Prim tree weighs 5,252, and so does the tree found among the
      triangulation's edges, exactly.
    readout: Weight of the tree edges
    expect: { value: 5252 }
    setup:
      seed: 7
  - id: tree-weight-is-all-pairs-prim-at-150
    statement: >-
      At 150 points, the most the plate takes, the dense Prim tree over all 11,175 pairs weighs
      10,848, and so does the tree found among the triangulation's at most 444 edges, exactly.
    readout: Weight of the tree edges
    expect: { value: 10848 }
    setup:
      params: { n: 150 }
  - id: tree-has-n-minus-one-edges
    statement: >-
      The points form one complete graph, so the spanning tree has one edge fewer than there are
      vertices: Tree edges minus the Graph readout's vertex count is −1, exactly.
    readout: Tree edges
    expect: { against: Graph, offset: -1, tolerance: 0 }
  - id: tree-has-n-minus-one-edges-at-150
    statement: >-
      At 150 points as well, Tree edges is the vertex count minus one, exactly.
    readout: Tree edges
    expect: { against: Graph, offset: -1, tolerance: 0 }
    setup:
      params: { n: 150 }
  - id: examined-edges-within-the-planar-bound
    statement: >-
      Kruskal stops at its 69th tree edge, each one a scan, and scans only the triangulation's
      edges, of which a triangulation of n points with h ≥ 3 on its hull has 3n − 3 − h ≤ 3n − 6
      (Euler's formula): at 70 points the edges examined lie in [n − 1, 3n − 6] = [69, 204], a
      hard range.
    readout: Edges examined
    expect: { range: [69, 204] }
  - id: examined-edges-within-the-planar-bound-at-150
    statement: >-
      At 150 points the same theorem gives [n − 1, 3n − 6] = [149, 444], against the 11,175 pairs
      of the complete graph, a hard range.
    readout: Edges examined
    expect: { range: [149, 444] }
    setup:
      params: { n: 150 }
  - id: examined-edges-at-three-points
    statement: >-
      Three points not on one line triangulate into one triangle of 3 edges, and the two shortest
      never close a cycle, so Kruskal examines n − 1 = 2 of them: within [n − 1, 3n − 6] = [2, 3].
    readout: Edges examined
    expect: { range: [2, 3] }
    setup:
      params: { n: 3 }
---

The MST of points in the plane, found among the edges of their Delaunay triangulation.

Every pair of points is an edge of the input, but none is drawn until the triangulation is done. Then its edges appear and Kruskal runs on them alone, ordered by true length: kept edges join fragments and recolour them, the rest fade.

The tree is the minimum spanning tree of all n(n − 1)/2 pairs, while only the triangulation’s edges are ever examined, as the edge-examined readout shows.
