---
id: ford-fulkerson
title: Augmenting paths (Ford–Fulkerson)
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
  - augmenting paths
  - cuts
complexity: "O(E f) for integer capacities, f the maximum flow"
related:
  - preflow-push
  - min-cost-flow
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - depth-first-search
  objectives:
    - Search the residual network depth-first for a path with spare room and push its bottleneck along it, round after round.
    - Read an edge's thickness and colour as its flow against its capacity.
    - Recognise, once no such path is left, the vertices still reachable as one side of a minimum cut, whose capacity equals the flow value (the max-flow min-cut theorem).
bounds:
  model: augmenting paths (rounds), each pushing its bottleneck of at least one unit
  worst: f, the value of the maximum flow, for integer capacities
claims:
  - id: max-flow-is-dinics
    statement: >-
      The flow it ends with is a maximum one: on the default 40-vertex network at seed 4242
      Dinic's algorithm, written in test/flows-claims.test.ts, finds a maximum flow of 12, so the
      flow value is exactly 12 (integer capacities, tolerance 0).
    readout: Flow value
    expect: { value: 12 }
  - id: max-flow-is-dinics-at-seed-7
    statement: >-
      On the network seed 7 draws Dinic's algorithm finds 15, and so does the plate, exactly.
    readout: Flow value
    expect: { value: 15 }
    setup:
      seed: 7
  - id: max-flow-is-dinics-on-150-vertices
    statement: >-
      On the largest network, 150 vertices at seed 4242, Dinic's algorithm finds a maximum flow
      of only 1: a single edge of capacity 1 separates the source from the sink, and the plate
      reads 1, exactly.
    readout: Flow value
    expect: { value: 1 }
    setup:
      params: { n: 150 }
  - id: max-flow-is-dinics-on-4-vertices
    statement: >-
      On the smallest network, 4 vertices at seed 4242, Dinic's algorithm finds 17, and so does
      the plate, exactly.
    readout: Flow value
    expect: { value: 17 }
    setup:
      params: { n: 4 }
  - id: cut-equals-flow
    statement: >-
      Max-flow min-cut: the edges from the vertices still reachable at the end to the rest are
      all saturated and carry nothing back, so their capacity is the flow value, exactly
      (tolerance 0).
    readout: Cut capacity
    expect: { against: Flow value, tolerance: 0 }
  - id: cut-equals-flow-at-seed-7
    statement: >-
      On the network seed 7 draws the final cut's capacity equals the flow value as well,
      exactly.
    readout: Cut capacity
    expect: { against: Flow value, tolerance: 0 }
    setup:
      seed: 7
  - id: cut-equals-flow-on-150-vertices
    statement: >-
      On 150 vertices the final cut is the one edge of capacity 1, equal to the flow value,
      exactly.
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
  - id: augmentations-at-most-flow-on-4-vertices
    statement: >-
      On 4 vertices the flow of 17 needs at most 17 augmentations by the same count: rounds minus
      flow value below 1.
    readout: Rounds
    expect: { against: Flow value, below: 1 }
    setup:
      params: { n: 4 }
---

Push flow along any path with spare capacity until none is left; the saturated edges form a cut.

The source is circled on the left, the sink boxed on the right; an edge’s thickness and colour show its flow against its capacity. Each round a depth-first search over the residual network (ringed as it explores) finds a path with spare room and pushes its bottleneck.

When no such path is left, the vertices still reachable are filled: one side of a minimum cut, and the saturated edges leaving it are drawn as the cut. The flow value equals the cut’s capacity, the max-flow min-cut theorem.

Capacities are integers from 1 to 12, so every augmentation adds at least one unit to the flow and the rounds never exceed the flow value. The readouts give the flow value and the capacity of the final cut side by side.
