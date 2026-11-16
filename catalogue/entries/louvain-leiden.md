---
id: louvain-leiden
title: Louvain and Leiden communities
taxonomy: graphs/analysis
status: live
engine: graph
labs:
  - communities
sources:
  - id: blondel-2008-louvain
    purpose: algorithm-reference
  - id: traag-waltman-van-eck-2019
    purpose: algorithm-reference
  - id: practice-investigation
tags:
  - communities
  - modularity
  - clustering
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(E) per sweep of local moving"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
    - Move vertices to the neighbour community that most raises modularity, then contract every community to a node and repeat on the smaller graph.
    - See the later levels move whole contracted communities, so blocks of vertices change colour together, while the chart's modularity rises sweep by sweep.
    - Compare Louvain with Leiden, which splits every community into well-connected parts before contracting.
  prerequisites:
    - label-propagation
  misconceptions:
    - A community that maximises modularity locally need not be connected inside; Louvain can leave one whose members are joined only through other communities, the known failure Leiden's refinement is built to avoid.
algorithm:
  paradigm: greedy
bounds:
  model: edge scans
  worst: "2E edge scans per sweep of the first level; later levels sweep the contracted graph, whose links are not counted"
  space: "O(V + E)"
claims:
  - id: modularity-never-below-the-singletons
    statement: >-
      The run starts with every vertex alone, whose modularity −Σ(k/2m)² is −0.012 at both seeds by
      Newman's formula in test/louvain-leiden-claims.test.ts, and a node moves only when that raises
      the modularity, while contracting a level keeps it: Modularity Q ends in [−0.012, 1], a hard
      bound.
    readout: Modularity Q
    expect: { range: [-0.012, 1] }
    setup:
      seeds: [4242, 7]
  - id: modularity-never-below-the-singletons-for-louvain
    statement: >-
      Louvain, contracting by the communities themselves, keeps the same bound.
    readout: Modularity Q
    expect: { range: [-0.012, 1] }
    setup:
      params: { method: louvain }
      seeds: [4242, 7]
  - id: modularity-never-below-the-singletons-on-the-grid
    statement: >-
      On the grid, with no communities planted, the singletons' modularity is −0.011 and Q ends at
      or above it.
    readout: Modularity Q
    expect: { range: [-0.011, 1] }
    setup:
      params: { shape: grid }
      seeds: [4242, 7]
---

Move vertices to the neighbour community that most raises modularity, then contract and repeat.

Colours are communities, the outer rings the input’s known ones. The first level moves single vertices; later levels move whole contracted communities, so blocks of vertices change colour together. The chart’s modularity rises sweep by sweep.

Leiden (Traag, Waltman and van Eck) splits every community into well-connected parts before contracting, to avoid communities whose members are not connected inside them, a known failure of Louvain. Here the refinement is greedy: each vertex joins the best well-connected subcommunity rather than one drawn at random.
