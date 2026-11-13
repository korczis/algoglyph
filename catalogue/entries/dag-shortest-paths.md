---
id: dag-shortest-paths
title: Shortest paths in a DAG
taxonomy: graphs/shortest-paths
status: live
engine: graph
labs:
  - shortest-paths
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - dag
  - shortest paths
  - topological order
complexity: "O(V + E)"
interaction: "Tap a vertex to start from it."
related:
  - topological-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Build a topological order first, then relax each reached vertex's out-edges exactly once, in that order.
    - Explain why one pass suffices, every predecessor being final before a vertex is reached, so that negative weights do no harm.
    - Compare its relaxations with Bellman–Ford's rounds on the layered DAG of the shortest-paths lab.
  prerequisites:
    - topological-sort
  misconceptions:
    - Negative weights do not force a slower algorithm on a DAG; where Dijkstra's greedy settling could go wrong, the topological order still gives the distances Bellman–Ford does in a single pass.
claims:
  - id: relaxed-is-reached
    statement: >-
      A vertex is relaxed only when the source reaches it (its distance is final when its turn
      comes, so an infinite one stays infinite): the relaxed count equals the reached count, with
      no tolerance.
    readout: Relaxed
    expect: { against: Reached, tolerance: 0 }
  - id: relaxed-is-reached-at-the-largest-size
    statement: >-
      At 400 vertices too the relaxed count equals the reached count, with no tolerance.
    readout: Relaxed
    expect: { against: Reached, tolerance: 0 }
    setup:
      params: { n: 400 }
  - id: one-relaxation-per-reached-out-edge
    statement: >-
      Each reached vertex's out-edges are relaxed exactly once and no other edge is: 127
      relaxations, the out-degrees of the reachable vertices summed, counted from the edge list
      and a depth-first search in test/dag-shortest-paths-readouts.test.ts, exactly.
    readout: Relaxations (improving)
    expect: { value: 127 }
  - id: edges-examined-twice-m-plus-the-relaxations
    statement: >-
      Ordering scans every edge twice, once to count in-degrees and once as Kahn's peeling removes
      its tail (on a DAG every vertex is ordered), and the pass scans an edge exactly when it relaxes
      it: edges examined = 2m + relaxations, and the default graph has 137 edges, so edges examined
      minus relaxations is 274, with no tolerance.
    readout: Edges examined
    expect: { against: Relaxations (improving), offset: 274, tolerance: 0 }
  - id: one-ordering-one-pass
    statement: >-
      A round ends with the ordering and one with the relaxation pass, and there is no other: 2
      rounds, exactly, whatever the weights.
    readout: Rounds
    expect: { value: 2 }
  - id: farthest-is-floyd-warshall
    statement: >-
      With weights from −8 to 12 the farthest distance is 12, Floyd–Warshall's on the dense matrix
      in test/dag-shortest-paths-readouts.test.ts, exactly: the weights are integers.
    readout: Farthest
    expect: { value: 12 }
  - id: farthest-is-floyd-warshall-without-negative-weights
    statement: >-
      On the layered DAG with weights from 1 to 20 the farthest distance is Floyd–Warshall's 54,
      exactly.
    readout: Farthest
    expect: { value: 54 }
    setup:
      params: { shape: dag }
---

Relax edges in topological order: linear time, negative weights allowed.

First a topological order: vertices are ringed as they join it. Then one pass in that order relaxes each reached vertex’s out-edges exactly once and fills it; a vertex the source cannot reach stays ringed, its edges skipped. Vertices are coloured by distance.

The signed input has weights from −8 to 12, where Dijkstra’s greedy settling could go wrong, and the result still matches Bellman–Ford. In the shortest-paths lab, on the layered DAG, compare its relaxations with Bellman–Ford’s rounds.
