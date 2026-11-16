---
id: brandes-betweenness
title: Betweenness centrality (Brandes)
taxonomy: graphs/analysis
status: live
engine: graph
labs:
  - centrality
sources:
  - id: brandes-2001
    purpose: algorithm-reference
  - id: practice-investigation
tags:
  - betweenness
  - brokers
  - centrality
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(VE) for unweighted graphs"
related:
  - centrality-comparison
  - pagerank
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Run one source's breadth-first search a round, counting the shortest paths to every vertex, followed by the backward accumulation that passes each vertex's dependency to its predecessors.
    - Count paths in hops, with edge weights ignored, and see why the sum of every vertex's betweenness is the sum over the joined pairs of their interior hops.
    - Find the brokers on the three-communities input, the vertices at the ends of the few edges between communities, because every shortest path from one community to another runs through them.
  prerequisites:
    - breadth-first-search
bounds:
  model: edge scans and rounds
  worst: "exactly V rounds, one per source; 2E edge scans per source on a connected input, 2VE in all"
  space: "O(V + E)"
claims:
  - id: one-round-per-source
    statement: >-
      Every vertex is a source once and each source's search and accumulation end with a round, so
      Rounds equals the Graph readout's vertex count, with no tolerance, at every seed.
    readout: Rounds
    expect: { against: Graph, tolerance: 0 }
    setup:
      seeds: [4242, 7]
  - id: one-round-per-source-on-a-disconnected-input
    statement: >-
      The random sparse input falls apart into components, and still every vertex is a source
      once: Rounds equals the vertex count.
    readout: Rounds
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { shape: random }
      seeds: [4242, 7]
  - id: every-edge-scanned-twice-from-every-source
    statement: >-
      The three-communities input is connected, so every source's search dequeues all n vertices
      and scans each one's edge list, every edge twice: 2mn = 2 · 132 · 50 = 13,200 edges
      examined, exactly (the components and degrees by breadth-first search in
      test/brandes-betweenness-claims.test.ts).
    readout: Edges examined
    expect: { value: 13200 }
  - id: every-edge-scanned-twice-from-every-source-at-seed-7
    statement: >-
      At seed 7 the input has 135 edges, so 2 · 135 · 50 = 13,500, exactly.
    readout: Edges examined
    expect: { value: 13500 }
    setup:
      seed: 7
  - id: scans-stay-in-the-source-component
    statement: >-
      On the random sparse input a search never leaves its source's component, so the edges
      examined are the sum over the components of their size times twice their edges: 5,000, exactly, against 2mn = 6,000 had the input been connected.
    readout: Edges examined
    expect: { value: 5000 }
    setup:
      params: { shape: random }
  - id: sum-is-the-interior-hops
    statement: >-
      Each shortest path between a pair passes through d − 1 interior vertices and a vertex's
      betweenness is its share of the pair's paths, so the sum of every vertex's betweenness is
      the sum over the joined pairs of d − 1: 3597, by breadth-first search from every vertex in
      the test, exactly.
    readout: Sum of betweenness
    expect: { value: 3597 }
  - id: sum-is-the-interior-hops-at-seed-7
    statement: >-
      At seed 7 the interior hops add up to 3528, exactly.
    readout: Sum of betweenness
    expect: { value: 3528 }
    setup:
      seed: 7
  - id: sum-is-the-interior-hops-on-a-disconnected-input
    statement: >-
      On the random sparse input a pair in different components has no path and adds nothing: the
      sum is the joined pairs' 2351 interior hops, exactly.
    readout: Sum of betweenness
    expect: { value: 2351 }
    setup:
      params: { shape: random }
  - id: top-broker-at-most-the-pairs
    statement: >-
      A vertex can lie inside the shortest paths of at most every pair of the other 49 vertices,
      so no betweenness exceeds C(49, 2) = 1176: a hard bound on the top broker's at every seed.
    readout: Top broker
    expect: { number: 2, range: [0, 1176] }
    setup:
      seeds: [4242, 7]
  - id: top-broker-is-the-pair-formula
    statement: >-
      The top broker is vertex 30, the largest betweenness by the pair formula: for every joined
      pair s, t, a vertex v with d(s, v) + d(v, t) = d(s, t) carries σ_sv · σ_vt of the pair's
      σ_st shortest paths, with path counts from a breadth-first search from every vertex, and
      nothing accumulated backwards.
    readout: Top broker
    expect: { value: 30 }
  - id: top-betweenness-is-the-pair-formula
    statement: >-
      Its betweenness is the pair formula's 538.0 to the one decimal printed.
    readout: Top broker
    expect: { number: 2, value: 538 }
  - id: top-broker-is-the-pair-formula-at-seed-7
    statement: >-
      At seed 7 the pair formula puts the top broker at vertex 48.
    readout: Top broker
    expect: { value: 48 }
    setup:
      seed: 7
  - id: top-betweenness-is-the-pair-formula-at-seed-7
    statement: >-
      And its betweenness at 331.6, which the plate reads to the one decimal printed.
    readout: Top broker
    expect: { number: 2, value: 331.6 }
    setup:
      seed: 7
  - id: writes-are-the-interior-vertices
    statement: >-
      The plate writes every vertex's betweenness once at the start and then, from each source,
      every other vertex with a positive dependency, one with a neighbour a hop farther from the
      source: 1465 writes, the count of such source–vertex pairs by breadth-first search in the
      test, exactly.
    readout: Betweenness writes
    expect: { value: 1465 }
---

How many shortest paths pass through each vertex, accumulated backwards from every source.

Vertex size and colour show betweenness so far; each round is one source’s breadth-first search, ringed as it spreads, followed by the backward accumulation. Edge weights are ignored and paths are counted in hops.

On the three-communities input the vertices at the ends of the few edges between communities stand out, because every shortest path from one community to another runs through them.
