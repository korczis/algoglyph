---
id: pathfinding-terrain
title: Cartographer
taxonomy: graphs/shortest-paths
status: live
engine: custom
tags:
  - graphs
  - A*
  - heuristics
complexity: O(E log V), binary heap
related:
  - dijkstra
---

Three searches cross the same hills: Dijkstra floods everything, A* leans towards the goal, greedy sprints and pays for it. Same map, measured costs.

The terrain is seeded value noise; entering a cell costs more the higher it is, and the peaks are impassable. Each search expands one cell at a time from a priority queue: Dijkstra by the cost so far, greedy best-first by the estimated distance left, A* by their sum (with the estimate multiplied by the weight).

The estimate is the Manhattan distance times the cheapest cell, which never overestimates. With weight 1, A* therefore returns a path exactly as cheap as Dijkstra's while expanding fewer cells; the readout compares both against the optimum computed for the same map. Raise the weight and A* turns greedy: faster, no longer guaranteed optimal.

Dim cells are expanded, bright ones are the frontier waiting in the queue.
