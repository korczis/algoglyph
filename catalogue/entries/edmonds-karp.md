---
id: edmonds-karp
title: Shortest augmenting paths (Edmonds–Karp)
taxonomy: graphs/flows
status: live
engine: graph
labs:
  - max-flow
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - max flow
  - bfs
complexity: "O(V E²)"
related:
  - ford-fulkerson
  - preflow-push
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - ford-fulkerson
    - breadth-first-search
  objectives:
    - Augment along a shortest path each time, found by a breadth-first search of the residual network, so every augmenting path has as few edges as possible.
    - Bound the rounds by VE/2 whatever the capacities, because the lengths of the shortest augmenting paths never decrease.
    - Run it against Ford–Fulkerson on one network and see the final flow value agree while the paths and the number of rounds differ.
  misconceptions:
    - That Ford–Fulkerson and Edmonds–Karp, which end with the same flow value, take the same paths or as many rounds; the paths taken and the number of rounds generally differ.
bounds:
  model: augmenting paths (rounds)
  worst: E·⌊V/2⌋ ≤ VE/2 whatever the capacities, and at most f, the flow value, for integer capacities
claims:
  - id: max-flow-is-dinics
    statement: >-
      The flow it ends with is a maximum one: on the default 40-vertex network at seed 4242
      Dinic's algorithm, written in test/flows-claims.test.ts, finds 12, and the flow value is
      exactly 12 (integer capacities, tolerance 0).
    readout: Flow value
    expect: { value: 12 }
  - id: max-flow-is-dinics-at-seed-7
    statement: >-
      On the network seed 7 draws Dinic's algorithm finds 15, and so does the plate, exactly.
    readout: Flow value
    expect: { value: 15 }
    setup:
      seed: 7
  - id: cut-equals-flow
    statement: >-
      Max-flow min-cut: the edges from the vertices still reachable at the end to the rest are
      saturated, so their capacity equals the flow value, exactly (tolerance 0).
    readout: Cut capacity
    expect: { against: Flow value, tolerance: 0 }
  - id: cut-equals-flow-on-150-vertices
    statement: >-
      On the largest network, 150 vertices, the final cut's capacity equals the flow value as
      well, exactly.
    readout: Cut capacity
    expect: { against: Flow value, tolerance: 0 }
    setup:
      params: { n: 150 }
  - id: augmentations-at-most-flow
    statement: >-
      Capacities are integers, so every augmentation pushes at least one unit and the rounds
      never exceed the flow value: rounds minus flow value below 1, that is at most 0 for two
      integers.
    readout: Rounds
    expect: { against: Flow value, below: 1 }
  - id: augmentations-within-the-edmonds-karp-bound
    statement: >-
      The Edmonds–Karp theorem: with shortest augmenting paths each edge is critical at most
      ⌊V/2⌋ times, so there are at most E·⌊V/2⌋ augmentations whatever the capacities; the
      default network has 40 vertices and 95 edges, so at most 95 · 20 = 1,900, and at least 1
      since its flow is positive (the derivation for this plate is in test/flows-claims.test.ts).
    readout: Rounds
    expect: { range: [1, 1900] }
  - id: augmentations-within-the-bound-at-seed-7
    statement: >-
      The network seed 7 draws has 40 vertices and 89 edges: at most 89 · 20 = 1,780
      augmentations by the same theorem, and at least 1.
    readout: Rounds
    expect: { range: [1, 1780] }
    setup:
      seed: 7
  - id: augmentations-within-the-bound-on-150-vertices
    statement: >-
      The 150-vertex network has 342 edges: at most 342 · 75 = 25,650 augmentations by the same
      theorem, and at least 1.
    readout: Rounds
    expect: { range: [1, 25650] }
    setup:
      params: { n: 150 }
---

Augment along the shortest path each time, which bounds the rounds by VE/2.

The same drawing as Ford–Fulkerson, but each search is breadth-first, so every augmenting path has as few edges as possible. In the max-flow lab both run on one network: the final flow value agrees, while the paths taken and the number of rounds generally differ.

Each edge can be the bottleneck of a shortest augmenting path at most ⌊V/2⌋ times, since the path through it grows by two edges between one time and the next, so there are at most E·⌊V/2⌋ rounds whatever the capacities; with these integer capacities, 1 to 12, every round also adds at least one unit, so the rounds never exceed the flow value. The readouts give the capacity of the final cut beside the flow value.
