---
id: breadth-first-search
title: Breadth-first search
taxonomy: graphs/search
status: live
engine: graph
labs:
  - graph-search
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - bfs
  - graph search
  - queue
complexity: "O(V + E)"
interaction: "Tap a vertex to start from it."
related:
  - depth-first-search
  - ego-network
  - dijkstra
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Watch the vertices leave a FIFO queue in order of their distance in hops from the source, one level per round.
    - Read the BFS tree, in which each edge joins a vertex to one a hop nearer the source.
    - See the visited region on the grid grow as a diamond, because hop distance on a grid is the Manhattan distance.
    - Compare the levels of the small-world input, where a few rewired edges act as shortcuts, with its size.
  misconceptions:
    - Breadth-first search does not find the cheapest route when edges have weights; edge weights play no part, it counts hops.
algorithm:
  paradigm: search
claims:
  - id: levels-on-the-grid
    statement: >-
      The default grid of 140 vertices is laid out 16 columns by 9 rows (16 = round(√(140 · 16/9)),
      9 = round(140/16)), 144 vertices, and the source is the corner, so a vertex's hop distance is
      its Manhattan distance from it: levels 0 to 8 + 15 = 23. A round ends at each level and once
      more when the queue empties, so Rounds is 23 + 1 = rows + cols − 1 = 24, exactly.
    readout: Rounds
    expect: { value: 24 }
  - id: farthest-on-the-grid
    statement: >-
      The farthest vertex is the opposite corner, (rows − 1) + (cols − 1) = 8 + 15 = 23 hops from
      the source, exactly.
    readout: Farthest
    expect: { value: 23 }
  - id: every-edge-scanned-twice-on-the-grid
    statement: >-
      Every vertex of the connected grid is dequeued once and scans its whole edge list, and an
      undirected edge lies in two lists, so the edges examined are 2m: the 16-by-9 grid has
      9 · 15 + 8 · 16 = 263 edges, so 526, exactly.
    readout: Edges examined
    expect: { value: 526 }
  - id: levels-on-the-largest-grid
    statement: >-
      At 400 vertices the grid is 27 columns (round(√(400 · 16/9)) = round(26.7)) by 15 rows
      (round(400/27)), 405 vertices, so Rounds is rows + cols − 1 = 41, exactly.
    readout: Rounds
    expect: { value: 41 }
    setup:
      params: { n: 400 }
  - id: every-edge-scanned-twice-on-the-largest-grid
    statement: >-
      The 27-by-15 grid has 15 · 26 + 14 · 27 = 768 edges, each examined from both ends: 1,536
      edges examined, exactly.
    readout: Edges examined
    expect: { value: 1536 }
    setup:
      params: { n: 400 }
  - id: levels-on-the-smallest-grid
    statement: >-
      At 8 vertices the grid is 4 columns (round(√(8 · 16/9)) = round(3.77)) by 2 rows, so Rounds is
      rows + cols − 1 = 5, exactly.
    readout: Rounds
    expect: { value: 5 }
    setup:
      params: { n: 8 }
  - id: every-vertex-dequeued
    statement: >-
      The geometric input is connected by construction (its nearest-neighbour pairs are joined
      until one component remains), so every vertex is dequeued exactly once: the dequeued count
      equals the Graph readout's vertices, with no tolerance.
    readout: Dequeued
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { shape: geometric }
  - id: small-world-levels
    statement: >-
      On the small-world ring of 140 vertices the rewired shortcuts bring the farthest vertex to 10
      hops from the source, the source's eccentricity counted by unit-weight Floyd–Warshall in
      test/breadth-first-search-readouts.test.ts (no queue), so Rounds is 10 + 1 = 11, exactly; a
      plain ring with steps of 1 and 2 would put its farthest vertex 70 / 2 = 35 hops away.
    readout: Rounds
    expect: { value: 11 }
    setup:
      params: { shape: small-world }
  - id: digraph-dequeues-the-reachable
    statement: >-
      On the digraph only what the source's out-edges lead to is dequeued: 138 of the 140 vertices,
      the reachable set counted by a depth-first search over the edge list in
      test/breadth-first-search-readouts.test.ts, exactly.
    readout: Dequeued
    expect: { value: 138 }
    setup:
      params: { shape: digraph }
  - id: digraph-scans-the-reachable-out-edges
    statement: >-
      Each reachable vertex scans its out-edges once, so the edges examined are the out-degrees of
      the 138 reachable vertices summed, 345 of the digraph's 352 edges, counted from the edge list
      in the same test, exactly.
    readout: Edges examined
    expect: { value: 345 }
    setup:
      params: { shape: digraph }
---

Visit vertices in order of distance, a queue holding the frontier.

Vertices are coloured by their distance in hops from the circled source; ringed vertices are still on the queue, the thick edges form the BFS tree (each joins a vertex to one a hop nearer), and the highlighted edges are the last ones examined. Edge weights play no part.

On the grid the visited region is a diamond, because hop distance on a grid is the Manhattan distance. On the small-world input a few rewired edges act as shortcuts, so the number of levels (the Rounds readout) stays small for the size of the ring. A directed input reaches only what the source’s out-edges lead to.
