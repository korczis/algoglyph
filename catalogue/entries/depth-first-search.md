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
---

Go as deep as possible, back up only when stuck; the tree edges and back edges it leaves.

Ringed vertices are on the stack (grey in the textbook colouring), filled ones are finished. Thick edges form the DFS tree; edges in the frontier colour are back edges, each from a vertex to an ancestor still on the stack, and every one of them closes a cycle.

The search starts at the circled source and then restarts from the lowest-numbered vertex not yet visited, so a disconnected or directed input gives a forest; the readouts count its trees and back edges. Compare the chart with breadth-first search on the grid: here the stack grows into long snakes before it unwinds.
