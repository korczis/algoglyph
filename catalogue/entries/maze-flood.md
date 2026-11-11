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
---

A perfect maze carved cell by cell, then flooded breadth-first from its heart: colour is distance, the white thread is the longest shortest path.

Carving builds a spanning tree of the grid: every cell is reachable and there is exactly one route between any two cells. The recursive backtracker grows long winding corridors; randomised Prim grows a bushy, short-branched tree from a frontier.

The flood is a breadth-first search over the carved passages. Colour runs from the source to the current frontier, so the whole maze shifts hue as the wave advances.

When the flood ends, the path is walked back downhill from the farthest cell: the longest of all shortest routes from the centre.
