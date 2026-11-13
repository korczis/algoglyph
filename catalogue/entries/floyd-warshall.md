---
id: floyd-warshall
title: Floyd–Warshall
taxonomy: graphs/shortest-paths
status: live
engine: graph
labs:
  - shortest-paths
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - all pairs
  - shortest paths
  - matrix
complexity: "O(V³)"
related:
  - transitive-closure
  - dijkstra
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - dijkstra
  objectives:
    - Improve all-pairs distances through one intermediate vertex at a time, round k letting every path pass through vertex k.
    - Read the matrix of d[i][j], coloured from short to long and blank where no path is known yet.
    - Recognise a negative cycle by a negative entry on the diagonal at the end.
  misconceptions:
    - Negative weights do not break Floyd–Warshall; only a negative cycle does, and it shows as a negative entry on the diagonal.
claims:
  - id: rounds-are-n-plus-one
    statement: >-
      One round enters the edges and one round follows for each of the n intermediate vertices,
      so the rounds are n + 1: the Graph row's vertex count plus 1, exactly.
    readout: Rounds
    expect: { against: Graph, offset: 1, tolerance: 0 }
  - id: rounds-are-n-plus-one-at-60
    statement: >-
      At 60 vertices too the rounds are n + 1, exactly.
    readout: Rounds
    expect: { against: Graph, offset: 1, tolerance: 0 }
    setup:
      params: { n: 60 }
  - id: finite-pairs-are-the-closure
    statement: >-
      A distance is finite exactly when a path exists, so the finite pairs are the pairs of the
      transitive closure (each vertex with itself included): on the default directed graph at
      seed 4242 every vertex reaches every other, 484 = 22² pairs by a breadth-first search from
      every vertex in the test.
    readout: Finite distances
    expect: { value: 484 }
  - id: finite-pairs-are-the-closure-at-seed-7
    statement: >-
      At seed 7 the directed graph is not strongly connected, and the breadth-first searches in
      the test find 287 reachable ordered pairs, the diagonal included: 287 finite distances,
      exactly.
    readout: Finite distances
    expect: { value: 287 }
    setup:
      seed: 7
  - id: finite-pairs-on-a-dag
    statement: >-
      On the layered DAG no path runs backwards, and the breadth-first searches in the test find
      78 reachable ordered pairs, the diagonal included: 78 finite distances, exactly.
    readout: Finite distances
    expect: { value: 78 }
    setup:
      params: { shape: dag }
  - id: longest-distance-is-dijkstras
    statement: >-
      The longest finite distance of the default directed graph is 1,279, the largest of the
      distances Dijkstra gives from every vertex in the test (a linear-scan Dijkstra over the
      edge list); the lengths are integers, so exactly.
    readout: Longest finite distance
    expect: { value: 1279 }
  - id: distance-sum-is-dijkstras
    statement: >-
      The finite distances of the default directed graph sum to 188,078, the sum of Dijkstra's
      distances from every vertex in the test, exactly.
    readout: Sum of finite distances
    expect: { value: 188078 }
  - id: geometric-distances-are-dijkstras
    statement: >-
      On the undirected geometric input the longest finite distance is 514, Dijkstra's from
      every vertex in the test, exactly.
    readout: Longest finite distance
    expect: { value: 514 }
    setup:
      params: { shape: geometric }
  - id: geometric-distance-sum-is-dijkstras
    statement: >-
      On the geometric input the finite distances sum to 114,050, Dijkstra's from every vertex
      in the test, exactly.
    readout: Sum of finite distances
    expect: { value: 114050 }
    setup:
      params: { shape: geometric }
  - id: dag-distance-sum-is-dijkstras
    statement: >-
      On the layered DAG the 78 finite distances sum to 793, Dijkstra's from every vertex in the
      test, exactly.
    readout: Sum of finite distances
    expect: { value: 793 }
    setup:
      params: { shape: dag }
  - id: potentials-leave-the-sum
    statement: >-
      The signed input is the default directed graph with each edge u → v changed by p(u) − p(v)
      for a potential p, so every distance d(i, j) changes by p(i) − p(j); with all 484 pairs
      finite those changes cancel over the pairs, and the sum stays 188,078, the directed
      graph's sum by Dijkstra in the test, exactly, though some weights are now negative.
    readout: Sum of finite distances
    expect: { value: 188078 }
    setup:
      params: { shape: signed }
  - id: every-finite-entry-was-written
    statement: >-
      Every finite entry was written at least once, as a zero on the diagonal, as an edge or as
      an improvement, so the matrix writes are at least the finite distances: their difference
      is above −1.
    readout: Matrix writes
    expect: { against: Finite distances, above: -1 }
  - id: every-finite-entry-was-written-on-a-dag
    statement: >-
      On the layered DAG too the matrix writes are at least the finite distances.
    readout: Matrix writes
    expect: { against: Finite distances, above: -1 }
    setup:
      params: { shape: dag }
---

All-pairs distances, improved through one intermediate vertex at a time.

The matrix holds d[i][j], coloured from short to long and blank where no path is known yet. Round k lets paths pass through the ringed vertex k; the outlined cell is the last one improved. The matrix-write count counts the diagonal's zeros and the edges' entries as well as every improvement, and the inner loop skips row i of round k while d[i][k] is still infinite, so it tests at most V³ sums, and fewer whenever a vertex cannot yet reach the intermediate.

Negative weights are fine as long as no cycle is negative (the signed inputs): the result matches a Bellman–Ford run from every vertex. A negative entry on the diagonal at the end would reveal a negative cycle, and its vertices would be marked.

The readouts give the finite pairs, the longest finite distance and the sum of the finite distances, the diagonal's zeros included.
