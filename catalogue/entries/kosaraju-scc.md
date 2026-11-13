---
id: kosaraju-scc
title: Strong components (Kosaraju)
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
  - reverse graph
complexity: "O(V + E)"
related:
  - tarjan-scc
  - transitive-closure
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Run a DFS on the reverse graph, then one on the graph in reverse postorder, each tree of the second being a strong component.
    - Watch the second pass take its roots in reverse finishing order and paint each tree it grows a colour of its own, so that vertices that can reach each other share a colour.
    - See every component of the layered DAG be a single vertex, since no vertex of a DAG reaches back to itself.
  prerequisites:
    - depth-first-search
algorithm:
  paradigm: search
bounds:
  model: "edges examined: the first pass scans each vertex's in-edges, the second its out-edges"
  best: "2m on every input: each edge once reversed, once forwards"
  worst: "2m on every input"
claims:
  - id: components-are-mutual-reachability
    statement: >-
      Each tree of the second pass is one strong component, a class of vertices that reach each
      other: on the default 70-vertex digraph a breadth-first search from every vertex finds 10
      such classes (test/kosaraju-scc-readouts.test.ts), so 10 components, exactly.
    readout: Strong components
    expect: { value: 10 }
  - id: largest-component-is-mutual-reachability
    statement: >-
      The largest class of mutual reachability found by those breadth-first searches has 41
      vertices, and so does the largest tree of the second pass, exactly.
    readout: Largest
    expect: { value: 41 }
  - id: components-are-mutual-reachability-at-seed-7
    statement: >-
      At seed 7 the breadth-first searches find 10 classes of mutual reachability among the 70
      vertices, and the second pass grows 10 trees, exactly.
    readout: Strong components
    expect: { value: 10 }
    setup:
      seed: 7
  - id: components-are-mutual-reachability-at-300
    statement: >-
      At 300 vertices, the most the plate takes, the breadth-first searches find 18 classes of
      mutual reachability, and the second pass grows 18 trees, exactly.
    readout: Strong components
    expect: { value: 18 }
    setup:
      params: { n: 300 }
  - id: dag-components-are-single-vertices
    statement: >-
      No vertex of a DAG reaches back to itself, so on the layered DAG every strong component is
      one vertex: as many components as the Graph readout has vertices, exactly.
    readout: Strong components
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { shape: dag }
  - id: dag-components-are-single-vertices-at-300
    statement: >-
      On the layered DAG of 300 vertices too, the components equal the vertices, exactly.
    readout: Strong components
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { shape: dag, n: 300 }
  - id: every-edge-scanned-twice
    statement: >-
      The first pass scans every vertex's in-edges and the second its out-edges, so each edge is
      examined twice: the default digraph has 163 edges (the Graph readout), so 2 · 163 = 326,
      exactly.
    readout: Edges examined
    expect: { value: 326 }
  - id: every-edge-scanned-twice-at-300
    statement: >-
      At 300 vertices the digraph has 734 edges, so the two passes examine 2 · 734 = 1,468,
      exactly.
    readout: Edges examined
    expect: { value: 1468 }
    setup:
      params: { n: 300 }
  - id: every-edge-scanned-twice-on-the-dag
    statement: >-
      The layered DAG of 70 vertices has 114 edges, so the two passes examine 2 · 114 = 228,
      exactly.
    readout: Edges examined
    expect: { value: 228 }
    setup:
      params: { shape: dag }
---

A DFS on the reverse graph, then one on the graph in reverse postorder: each tree is a strong component.

The first pass walks the edges backwards and fills vertices as they finish. Then every vertex is cleared, and the second pass, taking roots in reverse finishing order, paints each tree it grows a colour of its own: vertices that can reach each other share a colour.

On the layered DAG every component is a single vertex, since no vertex of a DAG reaches back to itself; on the directed input with cycles the reverse edges glue larger components together.
