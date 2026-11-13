---
id: depth-first-search
title: Depth-first search
taxonomy: graphs/search
status: live
engine: graph
labs:
  - graph-search
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - dfs
  - graph search
  - stack
complexity: "O(V + E)"
interaction: "Tap a vertex to start from it."
related:
  - topological-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Follow a vertex turning grey when entered and black when its edges are exhausted, the stack growing deep before it backs up.
    - Tell the DFS tree edges from the back edges, each from a vertex to an ancestor still on the stack, and see that every back edge closes a cycle.
    - Count the trees of the forest a disconnected or directed input gives, the search restarting from the lowest-numbered vertex not yet visited.
    - Compare the depth of the stack on the grid with the breadth-first frontier on the same input.
  prerequisites:
    - breadth-first-search
algorithm:
  paradigm: search
claims:
  - id: tree-edges-span-the-graph
    statement: >-
      The geometric input is connected by construction, so the search grows one tree that reaches
      every vertex, each but the source entered along one tree edge: DFS tree edges = n − 1, the
      Graph readout's vertex count minus 1, with no tolerance.
    readout: DFS tree edges
    expect: { against: Graph, offset: -1, tolerance: 0 }
  - id: back-edges-are-the-cyclomatic-number
    statement: >-
      On an undirected input every edge left out of the tree joins a vertex to an ancestor, and is
      counted once, from the descendant, while the ancestor is still on the stack; so the back
      edges are m − (n − 1), the cyclomatic number, the number of independent cycles. The
      geometric input has exactly n = 90 vertices, so back edges minus the Graph readout's edge
      count is −89, with no tolerance.
    readout: Back edges
    expect: { against: Graph, against_number: 2, offset: -89, tolerance: 0 }
  - id: back-edges-on-the-grid
    statement: >-
      At 90 vertices the grid is 13 columns (round(√(90 · 16/9)) = round(12.6)) by 7 rows
      (round(90/13)), 91 vertices and 7 · 12 + 6 · 13 = 162 edges; it is connected, so its back
      edges are m − n + 1 = 72 = (rows − 1)(cols − 1), one for each unit square of the grid,
      exactly.
    readout: Back edges
    expect: { value: 72 }
    setup:
      params: { shape: grid }
  - id: edges-examined-on-the-grid
    statement: >-
      A tree edge is examined once, from its parent (the child skips the edge it came in by), and
      every other edge twice, once from each end: 90 + 2 · 72 = 234 = 2m − n + 1 edges examined on
      the 13-by-7 grid, exactly.
    readout: Edges examined
    expect: { value: 234 }
    setup:
      params: { shape: grid }
  - id: trees-are-the-components
    statement: >-
      On an undirected input each restart begins a new tree exactly when it starts in a component
      not yet searched, so the trees in the forest are the components: 7 on the random input of 90
      vertices and 108 edges, counted by a union-find over the edge list in
      test/depth-first-search-readouts.test.ts, exactly.
    readout: Trees in the forest
    expect: { value: 7 }
    setup:
      params: { shape: random }
  - id: tree-edges-with-several-trees
    statement: >-
      With 7 trees, 7 vertices are roots and the other n − 7 each have a tree edge: DFS tree edges
      minus the Graph readout's vertex count is −7, with no tolerance.
    readout: DFS tree edges
    expect: { against: Graph, offset: -7, tolerance: 0 }
    setup:
      params: { shape: random }
  - id: back-edges-with-several-trees
    statement: >-
      And the back edges are m − n + 7, the cyclomatic number of a forest of 7 components: back
      edges minus the Graph readout's edge count is −(90 − 7) = −83, with no tolerance.
    readout: Back edges
    expect: { against: Graph, against_number: 2, offset: -83, tolerance: 0 }
    setup:
      params: { shape: random }
  - id: a-cyclic-digraph-has-a-back-edge
    statement: >-
      A directed graph has a cycle exactly when a depth-first search of it finds a back edge,
      whatever the order of its starts. The digraph reciprocates about a third of its edges, and
      Kahn's peeling in test/depth-first-search-readouts.test.ts leaves vertices behind, so it has
      a cycle and the back edges are above 0.
    readout: Back edges
    expect: { above: 0 }
    setup:
      params: { shape: digraph }
---

Go as deep as possible, back up only when stuck; the tree edges and back edges it leaves.

Ringed vertices are on the stack (grey in the textbook colouring), filled ones are finished. Thick edges form the DFS tree; edges in the frontier colour are back edges, each from a vertex to an ancestor still on the stack, and every one of them closes a cycle.

The search starts at the circled source and then restarts from the lowest-numbered vertex not yet visited, so a disconnected or directed input gives a forest; the readouts count its trees and back edges. Compare the chart with breadth-first search on the grid: here the stack grows into long snakes before it unwinds.
