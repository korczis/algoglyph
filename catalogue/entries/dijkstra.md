---
id: dijkstra
title: Dijkstra's algorithm
taxonomy: graphs/shortest-paths
status: live
engine: graph
labs:
  - shortest-paths
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - shortest paths
  - greedy
  - priority queue
complexity: "O(E log V) with a binary heap"
interaction: "Tap a vertex to start from it."
related:
  - prim-mst
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Settle vertices in order of distance from a binary heap, relaxing the edges of each one settled.
    - Watch the shortest-path tree re-pointed whenever a relaxation improves a distance, and count the improving relaxations.
    - Compare the ragged settled region on the grid's random digit weights with the clean diamond of breadth-first search, and the rough disc on the geometric input.
  prerequisites:
    - breadth-first-search
  misconceptions:
    - Dijkstra's algorithm does not handle negative weights; a settled vertex is final only because no edge is negative, which is why the signed inputs are offered to Bellman–Ford and not here.
algorithm:
  paradigm: greedy
claims:
  - id: one-relaxation-per-edge
    statement: >-
      An edge is relaxed only towards a vertex not yet settled, and on a connected undirected input
      every vertex settles once, so each edge is relaxed exactly once, from whichever end settles
      first: relaxations equal the Graph readout's edge count on the geometric input, with no
      tolerance.
    readout: Relaxations (improving)
    expect: { against: Graph, against_number: 2, tolerance: 0 }
  - id: one-relaxation-per-edge-on-the-grid
    statement: >-
      The grid is connected and undirected too: relaxations equal its edges, with no tolerance.
    readout: Relaxations (improving)
    expect: { against: Graph, against_number: 2, tolerance: 0 }
    setup:
      params: { shape: grid }
  - id: every-edge-scanned-twice-on-the-grid
    statement: >-
      Every settled vertex scans its whole edge list and an undirected edge lies in two lists: the
      default grid of 140 is 16 columns by 9 rows with 9 · 15 + 8 · 16 = 263 edges, so 526 edges
      examined, exactly.
    readout: Edges examined
    expect: { value: 526 }
    setup:
      params: { shape: grid }
  - id: every-vertex-settles
    statement: >-
      The geometric input is connected by construction, so every vertex is settled exactly once:
      the settled count equals the Graph readout's vertices, with no tolerance.
    readout: Settled
    expect: { against: Graph, tolerance: 0 }
  - id: farthest-is-bellman-ford
    statement: >-
      The farthest settled distance is 1906, the largest of the source's distances by the
      Bellman–Ford in test/dijkstra-readouts.test.ts (rounds over every arc, no priority queue),
      exactly: the lengths are integers.
    readout: Farthest settled
    expect: { value: 1906 }
  - id: farthest-is-bellman-ford-on-the-grid
    statement: >-
      On the grid, with random digits as weights, the farthest settled distance is Bellman–Ford's
      65, exactly.
    readout: Farthest settled
    expect: { value: 65 }
    setup:
      params: { shape: grid }
  - id: farthest-within-the-weight-bounds-on-the-grid
    statement: >-
      The source is a corner of the 16-by-9 grid and the weights are digits 1 to 9: the opposite
      corner is 8 + 15 = 23 edges away, each costing at least 1, and every vertex has a path of at
      most 23 edges, each costing at most 9. The farthest distance lies in [23, 207], hard bounds.
    readout: Farthest settled
    expect: { range: [23, 207] }
    setup:
      params: { shape: grid }
  - id: digraph-settles-the-reachable
    statement: >-
      On the digraph only the vertices a directed path leads to are ever queued: 138 of the 140,
      the set an explicit-stack depth-first search counts in the same test, exactly.
    readout: Settled
    expect: { value: 138 }
    setup:
      params: { shape: digraph }
---

Settle vertices in order of distance, relaxing the edges of each one settled.

Vertices are coloured by their tentative distance from the circled source; ringed ones are in the queue, filled ones settled. Thick edges are the current shortest-path tree, re-pointed whenever a relaxation improves a distance (the improving count in the readouts).

On the grid the weights are random digits, so the settled region is ragged where breadth-first search draws a clean diamond; on the geometric input the weights are lengths and it grows as a rough disc. Weights must not be negative, which is why the signed inputs are offered to Bellman–Ford and not here.
