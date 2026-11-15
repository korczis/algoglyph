---
id: connected-components
title: Connected components
taxonomy: graphs/connectivity
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - components
  - dfs
complexity: "O(V + E)"
related:
  - kosaraju-scc
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Label every vertex with the component a search from it reaches, one depth-first search from each vertex not yet labelled, each component in a colour of its own.
    - Compare the Separate islands input, which has several components by construction, with the random sparse input, usually one large component and a few small ones, and with the connected geometric and grid inputs.
    - Raise the edges per vertex of the random input and watch its many small components merge into one large one.
  prerequisites:
    - depth-first-search
algorithm:
  paradigm: search
bounds:
  model: "edges examined: every vertex is popped once and scans its whole edge list"
  best: "2m on every input"
  worst: "2m on every input"
claims:
  - id: components-on-islands
    statement: >-
      The default Separate islands input of 110 vertices falls into 4 classes of vertices that
      reach each other, counted by breadth-first search from every vertex not yet reached in
      test/connected-components-claims.test.ts, so 4 components, exactly.
    readout: Components
    expect: { value: 4 }
  - id: largest-on-islands
    statement: >-
      The largest of those classes has 28 vertices, and so has the largest component labelled,
      exactly.
    readout: Largest
    expect: { value: 28 }
  - id: components-on-islands-at-seed-7
    statement: >-
      At seed 7 breadth-first search finds 3 islands, and the search labels 3 components, exactly.
    readout: Components
    expect: { value: 3 }
    setup:
      seed: 7
  - id: components-on-islands-at-400
    statement: >-
      At 400 vertices breadth-first search finds 4 islands, and the search labels 4, exactly.
    readout: Components
    expect: { value: 4 }
    setup:
      params: { n: 400 }
  - id: components-on-random
    statement: >-
      The random sparse input has 13 components by breadth-first search, exactly.
    readout: Components
    expect: { value: 13 }
    setup:
      params: { shape: random }
  - id: largest-on-random
    statement: >-
      Its largest component holds 98 of its 110 vertices by breadth-first search, the one large
      component the notes describe, exactly.
    readout: Largest
    expect: { value: 98 }
    setup:
      params: { shape: random }
  - id: geometric-is-connected
    statement: >-
      The geometric input joins its nearest-neighbour pairs until one component remains, and
      breadth-first search confirms one at both seeds listed: 1 component, exactly.
    readout: Components
    expect: { value: 1 }
    setup:
      params: { shape: geometric }
      seeds: [4242, 7]
  - id: grid-is-connected
    statement: >-
      The grid is connected, row by row and column by column: 1 component at both seeds listed,
      exactly.
    readout: Components
    expect: { value: 1 }
    setup:
      params: { shape: grid }
      seeds: [4242, 7]
  - id: sparse-random-components-are-bounded
    statement: >-
      Each edge joins at most two components into one, so m edges leave at least n − m of the n
      vertices' components: at 0.1 edges per vertex the random input has 110 vertices and
      round(0.1 · 110) = 11 edges, so between 99 and 110 components at every seed, a hard bound,
      checked at both listed.
    readout: Components
    expect: { range: [99, 110] }
    setup:
      params: { shape: random, edgesPerVertex: 0.1 }
      seeds: [4242, 7]
  - id: dense-random-is-connected
    statement: >-
      At 3 edges per vertex the random input is connected at both seeds listed, by breadth-first
      search in the test: 1 component, exactly.
    readout: Components
    expect: { value: 1 }
    setup:
      params: { shape: random, edgesPerVertex: 3 }
      seeds: [4242, 7]
  - id: every-edge-scanned-twice-on-islands
    statement: >-
      Every vertex is popped once and scans its whole edge list, and an undirected edge lies in two
      lists: the islands' 153 edges give 306 edges examined, exactly.
    readout: Edges examined
    expect: { value: 306 }
  - id: every-vertex-labelled
    statement: >-
      Every vertex gets a label, the searches restarting from each one not yet labelled: Labelled
      reads n of n at both seeds listed, its first number minus its second 0, with no tolerance.
    readout: Labelled
    expect: { against: Labelled, against_number: 2, tolerance: 0 }
    setup:
      seeds: [4242, 7]
---

Label every vertex with the component a search from it reaches.

Each search labels one component with a colour of its own; hollow vertices are not reached yet and ringed ones wait on the stack. The Separate islands input has several components by construction; the random sparse input usually has one large component and a few small ones; the geometric and grid inputs are connected. The Edges per vertex control sets how dense the random input is: at its low end most vertices touch no edge and stand alone, at its high end all but a few vertices join one component.
