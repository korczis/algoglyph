---
id: bellman-ford
title: Bellman–Ford
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
  - negative weights
  - relaxation
complexity: "O(VE)"
interaction: "Tap a vertex to start from it."
related:
  - dijkstra
  - dag-shortest-paths
  - floyd-warshall
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Relax every edge out of a reached vertex in rounds, and watch the distances fall round by round until a round changes nothing, which ends the rounds early.
    - Explain why V − 1 rounds always suffice when no negative cycle is reachable, and why a V-th round that still improves a distance reveals one.
    - Find the negative cycle by walking parent edges back from the vertex the last round improved.
  misconceptions:
    - Negative edge weights do not by themselves make a negative cycle; the signed input has negative edges but, by construction, no negative cycle.
algorithm:
  paradigm: iterative-refinement
claims:
  - id: last-round-changes-nothing
    statement: >-
      With no negative cycle reachable the rounds end with one that improves no distance (that is
      what stops them), so the decrease charted for the last round is exactly 0 on the default
      signed input, whose potentials keep every cycle's weight positive.
    readout: Change in the last round
    expect: { value: 0 }
  - id: rounds-at-most-the-reached
    statement: >-
      After round k every vertex whose shortest path has at most k edges has its final distance; a
      shortest path through the R reached vertices has at most R − 1 edges, so round R − 1 fixes
      them all and round R at the latest changes nothing. Rounds minus the reached count is at most
      0 (below 1, as both are integers), a hard bound.
    readout: Rounds
    expect: { against: Reached, below: 1 }
  - id: reached-is-the-reachable-set
    statement: >-
      A vertex is reached when its distance first becomes finite, which happens exactly for the
      vertices a directed path leads to from the source: 16 of the signed input's 60, the set an
      explicit-stack depth-first search counts in test/bellman-ford-readouts.test.ts, exactly.
    readout: Reached
    expect: { value: 16 }
  - id: farthest-is-floyd-warshall
    statement: >-
      The largest finite distance is 398, the farthest of the source's distances by Floyd–Warshall
      on the dense matrix in test/bellman-ford-readouts.test.ts, exactly: the weights are integers,
      so no rounding enters.
    readout: Farthest
    expect: { value: 398 }
  - id: farthest-is-floyd-warshall-on-lengths
    statement: >-
      On the geometric input, with lengths as weights and no negative edge, the farthest distance is
      Floyd–Warshall's 1131, exactly.
    readout: Farthest
    expect: { value: 1131 }
    setup:
      params: { shape: geometric }
  - id: rounds-at-most-n
    statement: >-
      The geometric input is connected, so every one of its 60 vertices is reached and the bound
      above is V: Rounds minus the Graph readout's vertex count is below 1, a hard bound.
    readout: Rounds
    expect: { against: Graph, below: 1 }
    setup:
      params: { shape: geometric }
  - id: a-negative-cycle-takes-every-round
    statement: >-
      With a negative cycle reachable no round can be the last to change a distance (going round
      the cycle once more always lowers one), so the rounds stop only at the cap, V of them:
      Rounds equals the Graph readout's vertex count, with no tolerance.
    readout: Rounds
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { shape: negative-cycle }
  - id: a-negative-cycle-still-changes-in-the-last-round
    statement: >-
      For the same reason the V-th round still lowers some distance: the decrease charted for the
      last round is above 0.
    readout: Change in the last round
    expect: { above: 0 }
    setup:
      params: { shape: negative-cycle }
---

Relax every edge V − 1 times; one more round that still improves reveals a negative cycle.

Each round relaxes every edge out of a reached vertex; vertices are coloured by their current distance, and the chart shows how much the distances fell in each round, reaching zero when they are final, which ends the rounds early.

On the negative-cycle input a three-vertex cycle whose weights sum below zero is planted, round V still improves a distance, and the negative cycle found by walking parent edges back is drawn in the foreground colour, its vertices marked. The signed input has negative edges but, by construction, no negative cycle.
