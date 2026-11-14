---
id: transitive-closure
title: Transitive closure (Warshall)
taxonomy: graphs/digraphs
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - transitive closure
  - reachability
  - matrix
complexity: "O(V³)"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Fill in who can reach whom, one intermediate vertex at a time, a filled cell (i, j) of the matrix saying that i reaches j.
    - Watch round k use vertex k as the stepping stone, every row that reaches k gaining k's row.
    - See the vertices of one strong component end with identical rows, since each reaches whatever the others reach.
bounds:
  model: "matrix writes: one per cell filled, and a filled cell is never written again"
  best: "n + m, the diagonal and the distinct edges, when every pair joined by a path is already joined by an edge"
  worst: "n², when every vertex reaches every other"
claims:
  - id: writes-are-reachable-pairs
    statement: >-
      Each cell is written once, when it is first filled, and the filled cells are the pairs
      (i, j) with i reaching j, the diagonal included: on the default 24-vertex digraph a
      breadth-first search from every vertex finds 553 such pairs
      (test/transitive-closure-readouts.test.ts), so 553 matrix writes, exactly.
    readout: Matrix writes
    expect: { value: 553 }
  - id: writes-are-reachable-pairs-at-seed-7
    statement: >-
      At seed 7 the breadth-first searches find 458 reachable pairs, so 458 matrix writes,
      exactly.
    readout: Matrix writes
    expect: { value: 458 }
    setup:
      seed: 7
  - id: writes-are-reachable-pairs-at-64
    statement: >-
      At 64 vertices, the most the plate takes, the breadth-first searches find 3,635 reachable
      pairs of the 4,096, so 3,635 matrix writes, exactly.
    readout: Matrix writes
    expect: { value: 3635 }
    setup:
      params: { n: 64 }
  - id: writes-are-reachable-pairs-on-the-dag
    statement: >-
      On the layered DAG of 24 vertices the breadth-first searches find 75 reachable pairs, so
      75 matrix writes, exactly.
    readout: Matrix writes
    expect: { value: 75 }
    setup:
      params: { shape: dag }
  - id: rounds-are-n-plus-one
    statement: >-
      One round fills the diagonal and the edges, then one round per intermediate vertex: Rounds
      is one more than the Graph readout's vertex count, exactly.
    readout: Rounds
    expect: { against: Graph, offset: 1, tolerance: 0 }
  - id: rounds-are-n-plus-one-at-64
    statement: >-
      At 64 vertices Rounds is again the vertex count plus one, exactly.
    readout: Rounds
    expect: { against: Graph, offset: 1, tolerance: 0 }
    setup:
      params: { n: 64 }
  - id: writes-within-bounds
    statement: >-
      The writes start with the n diagonal cells and the m edges (the digraph has no loop and no
      repeated edge, so these are n + m distinct cells) and can fill at most every cell: with the
      default 24 vertices and 54 edges they lie in [n + m, n²] = [78, 576], a hard range.
    readout: Matrix writes
    expect: { range: [78, 576] }
  - id: writes-within-bounds-at-64
    statement: >-
      At 64 vertices the digraph has 159 edges, so the writes lie in [n + m, n²] = [223, 4096],
      a hard range.
    readout: Matrix writes
    expect: { range: [223, 4096] }
    setup:
      params: { n: 64 }
---

Who can reach whom, filled into a matrix one intermediate vertex at a time.

The matrix on the right has a row and a column per vertex; a filled cell (i, j) says that i reaches j. It starts from the diagonal and the edges. In round k the ringed vertex k is the stepping stone: every row that reaches k gains k’s row, and the outlined cell is the one just written.

Vertices of one strong component end with identical rows, since each reaches whatever the others reach. The chart counts the filled cells round by round.
