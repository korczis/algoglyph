---
id: preflow-push
title: Preflow-push
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
  - push relabel
complexity: "O(V³) with a FIFO queue of active vertices"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites:
    - ford-fulkerson
  objectives:
    - Start from a preflow, the source at height V saturating every edge it has, and push excess from active vertices downhill along residual arcs.
    - Lift a vertex that cannot push to just above its lowest residual neighbour, and watch the excess that cannot reach the sink climb above the source's height and drain back.
    - Read the end, the active-vertex count at zero, as a maximum flow with the minimum cut filled, as at the end of Ford–Fulkerson.
bounds:
  model: height writes (V at the start, then one per lift)
  worst: V + (V − 2)(2V − 1), an active vertex never rising above 2V − 1
claims:
  - id: max-flow-is-dinics
    statement: >-
      When no excess is left the flow is a maximum one: on the default 24-vertex network at seed
      4242 Dinic's algorithm, written in test/flows-claims.test.ts, finds 13, and the flow value
      is exactly 13 (integer capacities, tolerance 0).
    readout: Flow value
    expect: { value: 13 }
  - id: max-flow-is-dinics-at-seed-7
    statement: >-
      On the network seed 7 draws Dinic's algorithm finds 7, and so does the plate, exactly.
    readout: Flow value
    expect: { value: 7 }
    setup:
      seed: 7
  - id: max-flow-is-dinics-on-150-vertices
    statement: >-
      On the largest network, 150 vertices at seed 4242, Dinic's algorithm finds 1, a single
      edge of capacity 1 cutting the sink off, and the plate reads 1, exactly.
    readout: Flow value
    expect: { value: 1 }
    setup:
      params: { n: 150 }
  - id: cut-equals-flow
    statement: >-
      Max-flow min-cut: the edges from the vertices still reachable at the end to the rest are
      saturated, so their capacity equals the flow value, exactly (tolerance 0).
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
  - id: heights-within-the-push-relabel-bound
    statement: >-
      Every height is written once at the start, V writes, and once per lift; an active vertex
      never rises above 2V − 1 and each lift raises it by at least 1, so each of the V − 2 other
      vertices is lifted at most 2V − 1 times: on 24 vertices the writes lie between 24 and
      24 + 22 · 47 = 1,058 (the derivation for this plate is in test/flows-claims.test.ts).
    readout: Height writes
    expect: { range: [24, 1058] }
  - id: heights-within-the-bound-at-seed-7
    statement: >-
      On the network seed 7 draws the same count bounds the height writes between 24 and 1,058.
    readout: Height writes
    expect: { range: [24, 1058] }
    setup:
      seed: 7
  - id: heights-within-the-bound-on-150-vertices
    statement: >-
      On 150 vertices the writes lie between 150 and 150 + 148 · 299 = 44,402 by the same count.
    readout: Height writes
    expect: { range: [150, 44402] }
    setup:
      params: { n: 150 }
---

Flood the network from the source and push excess downhill until it drains.

Vertices are coloured by height; ringed ones hold excess. At the start the source, at height V, saturates every edge it has (a preflow); active vertices then push downhill along residual arcs, or are lifted just above their lowest residual neighbour.

Flow first overshoots towards the sink, then the excess that cannot get there climbs above the source’s height and drains back. The chart’s active-vertex count reaches zero when no excess is left, and the flow is then a maximum one, with the minimum cut filled and drawn as at the end of Ford–Fulkerson.

Heights are written once for every vertex at the start and once per lift. A vertex with excess can always send it back towards the source along the residual network, so it never rises above 2V − 1, and the lifts, each of at least one step, are at most 2V − 1 for every vertex but the source and the sink. The readouts give the capacity of the final cut beside the flow value.
