---
id: sugiyama-layout
title: Layered DAG layout (Sugiyama)
taxonomy: graphs/layout
status: live
engine: graph
sources:
  - id: practice-systems
tags:
  - layered layout
  - crossing minimisation
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: "crossing minimisation is NP-hard; each barycentre sweep sorts every layer, O(N log N) for N vertices and dummy nodes, and counts the crossings by testing pairs of segments, O(S²) for S segments"
related:
  - topological-sort
relations:
  - { type: related_to, target: critical-path, reason: "Its longest-path layering puts every vertex at its earliest start when every task takes one unit of time." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Assign layers, order each layer to reduce crossings, then place, the way plans are drawn.
    - Break cycles by reversing the back edges a depth-first search finds, then assign each vertex a layer by the longest path into it.
    - Compare the crossings of the layered drawing before the barycentre sweeps with the best order the sweeps find.
  prerequisites:
    - topological-sort
  misconceptions:
    - That the barycentre sweeps find the fewest crossings possible; crossing minimisation is NP-hard, and the sweeps only keep the best order they meet.
algorithm:
  paradigm: iterative-refinement
bounds:
  model: "edges examined: the depth-first search that breaks cycles examines every edge once, and the longest-path layering every edge but a loop once more"
  best: "2m − ℓ for ℓ loops: 2m on every input here, none of which has a loop"
  worst: "2m − ℓ for ℓ loops"
claims:
  - id: layers-are-the-longest-path-plus-one
    statement: >-
      Every vertex sits one layer after the latest of its predecessors, so the layers are the
      longest path's edges plus one: the default dag's longest path has 5 edges at both seeds, by
      the memoised longest-path recursion in test/sugiyama-layout-claims.test.ts, so 6 layers,
      exactly.
    readout: Layers
    expect: { value: 6 }
    setup:
      seeds: [4242, 7]
  - id: layers-on-the-reasoning-input
    statement: >-
      The reasoning input's longest path has 3 edges at both seeds, so 4 layers, exactly.
    readout: Layers
    expect: { value: 4 }
    setup:
      params: { shape: reasoning }
      seeds: [4242, 7]
  - id: layers-on-the-ownership-input
    statement: >-
      On the ownership input, once the back edges of the test's own depth-first search are
      reversed, the longest path has 3 edges at both seeds, so 4 layers, exactly.
    readout: Layers
    expect: { value: 4 }
    setup:
      params: { shape: ownership }
      seeds: [4242, 7]
  - id: no-edge-reversed-on-a-dag
    statement: >-
      A depth-first search of an acyclic graph finds no edge back to a vertex still on its path
      (such an edge would close a cycle), so nothing is reversed on the dag, exactly, at both
      seeds; the test confirms by Kahn's algorithm that the input is acyclic.
    readout: Edges reversed to break cycles
    expect: { value: 0 }
    setup:
      seeds: [4242, 7]
  - id: no-edge-reversed-at-no-cross-holdings
    statement: >-
      At 0 cross-holdings no company holds a stake in one of its owners and the ownership input
      is a DAG (Kahn's algorithm in the test removes every vertex), so nothing is reversed,
      exactly, at both seeds.
    readout: Edges reversed to break cycles
    expect: { value: 0 }
    setup:
      params: { shape: ownership, crossHoldings: 0 }
      seeds: [4242, 7]
  - id: a-cycle-is-broken-on-the-ownership-input
    statement: >-
      The default ownership input has a cycle (Kahn's algorithm in the test leaves vertices
      behind), and a depth-first search of a graph with a cycle finds at least one back edge: the
      first of the cycle's vertices to be visited stays on the path until the cycle's vertex
      before it is reached, whose edge to it is then a back edge. Above 0 edges reversed, a hard
      bound, at both seeds.
    readout: Edges reversed to break cycles
    expect: { above: 0 }
    setup:
      params: { shape: ownership }
      seeds: [4242, 7]
  - id: a-cycle-is-broken-at-the-most-cross-holdings
    statement: >-
      At 12 cross-holdings per 12 companies, the control's top, the input has a cycle too, and
      above 0 edges are reversed, a hard bound, at both seeds.
    readout: Edges reversed to break cycles
    expect: { above: 0 }
    setup:
      params: { shape: ownership, crossHoldings: 12 }
      seeds: [4242, 7]
  - id: no-edge-against-the-layer-order
    statement: >-
      A longest-path layer is at least one more than every predecessor's, so no edge's head sits
      in a layer at or before its tail's: 0 edges against the layer order, exactly, at both seeds.
    readout: Edges against the layer order
    expect: { value: 0 }
    setup:
      seeds: [4242, 7]
  - id: no-edge-against-the-layer-order-on-the-ownership-input
    statement: >-
      Reversing every back edge of a depth-first search leaves an acyclic graph, so the layering
      reaches every vertex and no edge on the ownership input points against it either: 0,
      exactly, at both seeds.
    readout: Edges against the layer order
    expect: { value: 0 }
    setup:
      params: { shape: ownership }
      seeds: [4242, 7]
  - id: no-edge-against-the-layer-order-at-the-most-cross-holdings
    statement: >-
      At 12 cross-holdings per 12 companies, with the most cycles to break, still 0 edges against
      the layer order, exactly, at both seeds.
    readout: Edges against the layer order
    expect: { value: 0 }
    setup:
      params: { shape: ownership, crossHoldings: 12 }
      seeds: [4242, 7]
  - id: dummy-nodes-are-the-spans-less-one
    statement: >-
      An edge spanning k layers is split into k segments by k − 1 dummy nodes: on the default dag
      the spans of the test's own layering add up to 14 dummy nodes, exactly.
    readout: Dummy nodes
    expect: { value: 14 }
  - id: dummy-nodes-at-seed-7
    statement: >-
      On the dag seed 7 draws the spans add up to 9 dummy nodes, exactly.
    readout: Dummy nodes
    expect: { value: 9 }
    setup:
      seed: 7
  - id: crossings-before-the-sweeps
    statement: >-
      Before the sweeps every layer is in vertex order, dummy nodes after in the order the edges
      create them: the test counts that drawing's crossings independently, as inversions of the
      lower ends once each layer gap's segments are sorted by their upper ends, and finds 303,
      exactly.
    readout: Crossings
    expect: { value: 303 }
  - id: crossings-before-the-sweeps-at-seed-7
    statement: >-
      On the dag seed 7 draws the same count gives 197 crossings before the sweeps, exactly.
    readout: Crossings
    expect: { value: 197 }
    setup:
      seed: 7
  - id: crossings-before-the-sweeps-on-the-ownership-input
    statement: >-
      On the ownership input, with its back edges reversed, the count gives 480 crossings before
      the sweeps, exactly.
    readout: Crossings
    expect: { value: 480 }
    setup:
      params: { shape: ownership }
  - id: every-edge-examined-twice
    statement: >-
      The depth-first search examines every edge once and the layering every edge but a loop
      once more; the default dag has 68 edges and no loop, so 136 edges examined, exactly.
    readout: Edges examined
    expect: { value: 136 }
  - id: every-edge-examined-twice-on-the-ownership-input
    statement: >-
      A reversed edge is examined by the layering too, in its new direction: the ownership
      input's 71 edges, none a loop, give 142 edges examined, exactly.
    readout: Edges examined
    expect: { value: 142 }
    setup:
      params: { shape: ownership }
---

Assign layers, order each layer to reduce crossings, then place: how plans are drawn.

Colours are layers. The first steps break cycles (reversed edges are drawn in the frontier colour; only the ownership input has any) and assign layers by longest path; then every sweep re-places the vertices.

The readouts compare the crossings before the sweeps with the best order found. Edges that skip layers are drawn straight; the count is of the layered drawing, where they bend through dummy positions.

The readouts also count the dummy nodes, one for each layer a long edge passes, and the edges whose head is not in a later layer than their tail, none after a longest-path layering. The cross-holdings control sets how many cycles the ownership input has; at 0 it is a DAG and nothing is reversed.
