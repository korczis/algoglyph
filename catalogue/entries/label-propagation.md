---
id: label-propagation
title: Label propagation
taxonomy: graphs/analysis
status: live
engine: graph
labs:
  - communities
sources:
  - id: raghavan-albert-kumara-2007
    purpose: algorithm-reference
  - id: practice-investigation
tags:
  - communities
  - label propagation
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(E) per round"
related:
  - louvain-leiden
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Start every vertex in a label of its own, then, round by round in a shuffled order, let each adopt the commonest label among its neighbours until the labels settle.
    - Watch the labels in use collapse over the first rounds on the chart, and read the modularity of the current labels.
    - See that ties are broken at random, so different seeds can settle into different partitions.
  misconceptions:
    - Label propagation does not recover the known communities by design; one label can take over two true communities, and another seed can settle on a different partition of the same graph.
algorithm:
  paradigm: iterative-refinement
bounds:
  model: edge scans
  worst: "2E edge scans per round, every vertex with a neighbour scanning its edge list once"
  space: "O(V + E)"
claims:
  - id: labels-at-most-half-the-vertices
    statement: >-
      The rounds stop when one changes nothing, and then every vertex holds a label that is most
      common among its neighbours, so held by one of them too: with no isolated vertex every label
      in use has two holders at least, and at most ⌊90/2⌋ = 45 labels remain; the input is
      connected, so at least 1. A hard bound at every seed (derived in
      test/label-propagation-claims.test.ts).
    readout: Labels in use
    expect: { range: [1, 45] }
    setup:
      seeds: [4242, 7]
  - id: labels-at-most-half-the-vertices-on-the-geometric-input
    statement: >-
      On the geometric input, connected and with no isolated vertex, the labels in use lie in
      [1, 45] too.
    readout: Labels in use
    expect: { range: [1, 45] }
    setup:
      params: { shape: geometric }
      seeds: [4242, 7]
  - id: labels-at-most-half-the-vertices-at-300
    statement: >-
      At 300 vertices the bound is ⌊300/2⌋ = 150 labels.
    readout: Labels in use
    expect: { range: [1, 150] }
    setup:
      params: { n: 300 }
      seeds: [4242, 7]
  - id: labels-never-cross-components
    statement: >-
      A label moves only along an edge, so it never leaves its component and every component keeps
      one at least: on the separate islands, 4 components by breadth-first search in the test, the
      labels in use lie in [4, 45].
    readout: Labels in use
    expect: { range: [4, 45] }
    setup:
      params: { shape: islands }
  - id: labels-never-cross-components-at-seed-7
    statement: >-
      At seed 7 the islands are 3, and the labels in use lie in [3, 45].
    readout: Labels in use
    expect: { range: [3, 45] }
    setup:
      params: { shape: islands }
      seed: 7
---

Every vertex adopts the most common label among its neighbours until the labels settle.

Every vertex starts in a colour of its own; the outer rings show the input’s known communities where it has them. Each round shuffles the vertices and lets each adopt the commonest label among its neighbours.

The chart shows the labels in use collapsing over the first rounds, the readouts the modularity of the current labels. Ties are broken at random, so different seeds can settle into different partitions, and one label can take over two true communities.
