---
id: maze-flood
title: Maze & Flood
taxonomy: graphs/search
status: live
engine: custom
tags:
  - graphs
  - spanning tree
  - BFS
complexity: O(cells) carve, O(cells) BFS
related:
  - breadth-first-search
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - See that carving builds a spanning tree of the grid, every cell reachable with exactly one route between any two cells.
    - Compare the long winding corridors of the recursive backtracker with the bushy, short-branched tree randomised Prim grows from a frontier.
    - Follow the flood, a breadth-first search over the carved passages, colouring each cell by its distance from the centre.
    - Find the longest of all shortest routes from the centre, walked back downhill from the farthest cell.
  prerequisites:
    - breadth-first-search
claims:
  - id: passages-span-the-cells
    statement: >-
      A perfect maze is a spanning tree of its cells, and a tree on V vertices has V − 1 edges, so
      once the backtracker has carved the default maze the passages are the cells minus one, with
      no tolerance.
    readout: passages
    expect: { against: cells, offset: -1, tolerance: 0 }
  - id: passages-span-the-cells-with-prim
    statement: >-
      Randomised Prim also adds each cell once, by one passage from a cell already in the maze:
      passages = cells − 1 again, with no tolerance.
    readout: passages
    expect: { against: cells, offset: -1, tolerance: 0 }
    setup:
      params: { generator: prim }
  - id: passages-span-the-cells-at-the-finest-cells
    statement: >-
      At 8-pixel cells the maze has 6,200 cells, and still exactly one passage fewer.
    readout: passages
    expect: { against: cells, offset: -1, tolerance: 0 }
    setup:
      params: { cell: 8 }
  - id: longest-route-within-its-bounds
    statement: >-
      On the claims' 800-by-500 canvas 32-pixel cells give a grid of ⌊800/32⌋ = 25 by ⌊500/32⌋ = 15
      cells, flooded from the middle cell (12, 7). Each step of a route moves one cell, so the
      farthest corner is at least its Manhattan distance, 12 + 7 = 19, away; the maze is a tree, so
      no route has more than 375 − 1 = 374 steps. The longest shortest path lies in [19, 374].
    readout: longest shortest path
    expect: { range: [19, 374] }
  - id: longest-route-within-its-bounds-with-prim
    statement: >-
      Prim's maze on the same 25-by-15 grid obeys the same two bounds: [19, 374].
    readout: longest shortest path
    expect: { range: [19, 374] }
    setup:
      params: { generator: prim }
  - id: longest-route-within-its-bounds-at-the-finest-cells
    statement: >-
      At 8-pixel cells the grid is 100 by 62, flooded from (50, 31): the farthest corner, (0, 0),
      is 50 + 31 = 81 cells away by Manhattan distance and the tree has 6,200 cells, so the longest
      shortest path lies in [81, 6199].
    readout: longest shortest path
    expect: { range: [81, 6199] }
    setup:
      params: { cell: 8 }
  - id: longest-route-within-its-bounds-at-the-coarsest-cells
    statement: >-
      At 48-pixel cells the grid is 16 by 10, flooded from (8, 5): the farthest corner is 8 + 5 = 13
      away and the tree has 160 cells, so the longest shortest path lies in [13, 159].
    readout: longest shortest path
    expect: { range: [13, 159] }
    setup:
      params: { cell: 48 }
---

A perfect maze carved cell by cell, then flooded breadth-first from its heart: colour is distance, the white thread is the longest shortest path.

Carving builds a spanning tree of the grid: every cell is reachable and there is exactly one route between any two cells. The recursive backtracker grows long winding corridors; randomised Prim grows a bushy, short-branched tree from a frontier.

The flood is a breadth-first search over the carved passages. Colour runs from the source to the current frontier, so the whole maze shifts hue as the wave advances.

When the flood ends, the path is walked back downhill from the farthest cell: the longest of all shortest routes from the centre.
