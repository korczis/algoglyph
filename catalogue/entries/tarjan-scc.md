---
id: tarjan-scc
title: Strong components (Tarjan)
taxonomy: graphs/digraphs
status: live
engine: graph
labs:
  - strong-components
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - strong components
  - dfs
  - low link
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(V + E)"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
    - Pop each strong component as it completes, with one DFS, a stack and low links.
    - Watch vertices wait on the component stack and take their component's colour only when the whole component is popped, as the search leaves its root, the vertex whose low link equals its own discovery time.
    - See the components come out in reverse topological order, no component having an edge into one popped after it.
  prerequisites:
    - depth-first-search
algorithm:
  paradigm: search
bounds:
  model: "edges examined: one DFS scans each vertex's out-edges once"
  best: "m on every input"
  worst: "m on every input"
claims:
  - id: components-are-mutual-reachability
    statement: >-
      Each popped component is a class of vertices that reach each other: on the default
      70-vertex digraph a breadth-first search from every vertex finds 10 such classes
      (test/tarjan-scc-readouts.test.ts), so 10 components, exactly.
    readout: Strong components
    expect: { value: 10 }
  - id: largest-component-is-mutual-reachability
    statement: >-
      The largest class of mutual reachability found by those breadth-first searches has 41
      vertices, and so does the largest component popped, exactly.
    readout: Largest
    expect: { value: 41 }
  - id: components-are-mutual-reachability-at-seed-7
    statement: >-
      At seed 7 the breadth-first searches find 10 classes of mutual reachability, and the search
      pops 10 components, exactly.
    readout: Strong components
    expect: { value: 10 }
    setup:
      seed: 7
  - id: components-are-mutual-reachability-at-300
    statement: >-
      At 300 vertices, the most the plate takes, the breadth-first searches find 18 classes of
      mutual reachability, and the search pops 18 components, exactly.
    readout: Strong components
    expect: { value: 18 }
    setup:
      params: { n: 300 }
  - id: reverse-topological-order
    statement: >-
      A component is popped only when its root finishes, after the search has left every vertex
      the root reaches, so every component it has an edge into is already popped: no edge points
      into a component popped later, 0, exactly.
    readout: Edges into a later-popped component
    expect: { value: 0 }
  - id: reverse-topological-order-at-300
    statement: >-
      On the 300-vertex digraph too, with 18 components, no edge points into a component popped
      later, 0, exactly.
    readout: Edges into a later-popped component
    expect: { value: 0 }
    setup:
      params: { n: 300 }
  - id: reverse-topological-order-on-ownership
    statement: >-
      On the ownership graph, with its many small components, no edge points into a component
      popped later either, 0, exactly.
    readout: Edges into a later-popped component
    expect: { value: 0 }
    setup:
      params: { shape: ownership }
  - id: dag-components-are-single-vertices
    statement: >-
      No vertex of a DAG reaches back to itself, so on the layered DAG every component popped is
      one vertex: as many components as the Graph readout has vertices, exactly.
    readout: Strong components
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { shape: dag }
  - id: every-edge-scanned-once
    statement: >-
      The one search scans every vertex's out-edges once, so the edges examined equal the Graph
      readout's edge count (its second number), exactly.
    readout: Edges examined
    expect: { against: Graph, against_number: 2, tolerance: 0 }
  - id: every-edge-scanned-once-at-300
    statement: >-
      At 300 vertices the edges examined equal the Graph readout's edge count as well, exactly.
    readout: Edges examined
    expect: { against: Graph, against_number: 2, tolerance: 0 }
    setup:
      params: { n: 300 }
  - id: every-edge-scanned-once-on-the-dag
    statement: >-
      On the layered DAG the edges examined equal its edge count, exactly.
    readout: Edges examined
    expect: { against: Graph, against_number: 2, tolerance: 0 }
    setup:
      params: { shape: dag }
---

One DFS with a stack and low links pops each strong component as it completes.

Ringed vertices are waiting on the component stack; a vertex takes its component’s colour only when the whole component is popped, at the moment the search leaves the component’s root (the vertex whose low link equals its own discovery time).

Components come out in reverse topological order: no component has an edge into one popped after it. In the strong-components lab it runs beside Kosaraju on the same graph with one search instead of two.
