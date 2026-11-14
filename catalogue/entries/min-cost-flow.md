---
id: min-cost-flow
title: Minimum-cost flow
taxonomy: graphs/flows
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - min cost flow
  - negative cycles
complexity: "O(VE) per cancelled cycle (Bellman–Ford); with integer costs the cycles are finite"
related:
  - bellman-ford
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites:
    - edmonds-karp
    - bellman-ford
  objectives:
    - Find a maximum flow by shortest augmenting paths, then lower its cost by pushing flow round negative-cost cycles of the residual network.
    - Price the residual network, a forward arc at +c and a backward one at −c, and find a negative cycle with Bellman–Ford from a virtual source.
    - Read the flow value staying flat while the cost falls, until no negative cycle is left and the flow is of minimum cost.
  misconceptions:
    - That cancelling a cycle changes the flow value; flow pushed round a cycle leaves the value as it was, and only the cost falls.
claims:
  - id: flow-value-is-dinics
    statement: >-
      The first phase ends with a maximum flow and cancelling keeps its value: on the default
      30-vertex network at seed 4242 Dinic's algorithm, written in test/flows-claims.test.ts,
      finds 5, and the flow value is exactly 5 (integer capacities, tolerance 0).
    readout: Flow value
    expect: { value: 5 }
  - id: flow-value-is-dinics-at-seed-7
    statement: >-
      On the network seed 7 draws Dinic's algorithm finds 10, and the flow value after every
      cancelled cycle is 10, exactly.
    readout: Flow value
    expect: { value: 10 }
    setup:
      seed: 7
  - id: minimum-cost-is-successive-shortest-paths
    statement: >-
      With no negative cycle left the flow is of minimum cost: successive shortest paths,
      written in test/flows-claims.test.ts, which augment along the cheapest residual path
      instead of cancelling cycles, reach the same maximum flow at cost 188 on the default
      network, and the plate's cost is 188, exactly (integer costs, tolerance 0).
    readout: Minimum cost
    expect: { value: 188 }
  - id: minimum-cost-at-seed-7
    statement: >-
      On the network seed 7 draws successive shortest paths cost 416, and so does the plate,
      exactly.
    readout: Minimum cost
    expect: { value: 416 }
    setup:
      seed: 7
  - id: minimum-cost-on-80-vertices
    statement: >-
      On the largest network, 80 vertices at seed 4242, successive shortest paths cost 131, and so
      does the plate, exactly.
    readout: Minimum cost
    expect: { value: 131 }
    setup:
      params: { n: 80 }
  - id: minimum-cost-on-4-vertices
    statement: >-
      On the smallest network, 4 vertices at seed 4242, successive shortest paths cost 128 for
      the maximum flow of 17, and so does the plate, exactly.
    readout: Minimum cost
    expect: { value: 128 }
    setup:
      params: { n: 4 }
---

A maximum flow whose cost is reduced by cancelling negative cycles in the residual graph.

Each edge has a capacity from 1 to 12 and a cost per unit from 1 to 9. The plate first finds a maximum flow by shortest augmenting paths, then repeatedly finds a negative-cost cycle in the residual network and pushes flow round it; the cycle flashes in the foreground colour.

The flow value in the chart stays flat while the cost falls; the readouts give the final cost and how many cycles were cancelled. Rounds counts both phases: the augmentations that build the maximum flow, then the cycles cancelled.
