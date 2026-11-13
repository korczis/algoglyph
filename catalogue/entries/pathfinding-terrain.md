---
id: pathfinding-terrain
title: Cartographer
taxonomy: graphs/shortest-paths
status: live
engine: custom
sources:
  - id: hart-nilsson-raphael-1968
    purpose: algorithm-reference
tags:
  - graphs
  - A*
  - heuristics
complexity: O(E log V), binary heap
related:
  - dijkstra
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - dijkstra
  objectives:
    - Expand one cell at a time from a priority queue, Dijkstra by the cost so far, greedy best-first by the estimated distance left, A* by their sum.
    - Explain why an estimate that never overestimates lets A* at weight 1 return a path exactly as cheap as Dijkstra's while expanding fewer cells.
    - Raise the weight and watch A* turn greedy, faster and no longer guaranteed optimal.
  misconceptions:
    - Fewer expanded cells is not a cheaper path; greedy best-first sprints and pays for it in path cost.
claims:
  - id: a-star-is-optimal-at-weight-1
    statement: >-
      The estimate, Manhattan distance times the cheapest cell, never overestimates, so A* at
      weight 1 returns an optimal path: 0 % above the optimum, within half the printed decimal,
      0.05.
    readout: vs optimum
    expect: { value: 0, tolerance: 0.05 }
    source: hart-nilsson-raphael-1968
  - id: path-cost-is-the-optimum
    statement: >-
      A*'s path costs 247.643 on the default map (seed 4242), the distance a heap-free Dijkstra
      (a linear scan for the nearest open cell) gives in the test: 247.6 within half the printed
      decimal, 0.05.
    readout: path cost
    expect: { value: 247.6, tolerance: 0.05 }
  - id: a-star-expansions-are-bounded
    statement: >-
      The estimate is consistent (one step changes it by at most the cheapest cell, never more
      than the entered cell costs), so A* expands every cell with f = g* + h below the optimum C*,
      none above it, and some of those at C*, the goal among them. Counted from the heap-free
      Dijkstra's distances in the test, that is [#{f < C*} + 1, #{f ≤ C*}] = [1332, 1332] on the
      default map: exactly 1332.
    readout: expanded cells
    expect: { range: [1332, 1332] }
    source: hart-nilsson-raphael-1968
  - id: dijkstra-expansions-are-bounded
    statement: >-
      Dijkstra is the case h = 0: it expands every cell nearer than the goal and stops when the
      goal is popped, so its expansions lie in [#{g* < C*} + 1, #{g* ≤ C*}] = [1562, 1562] on the
      default map, counted in the test, more than A*'s.
    readout: expanded cells
    expect: { range: [1562, 1562] }
    setup:
      params: { algorithm: dijkstra }
  - id: flat-costs-are-optimal
    statement: >-
      With no cost of climbing every passable cell costs 1, so the optimum is the 137 steps a
      heap-free Dijkstra counts in the test, and A* at weight 1 finds it: 137.0 within 0.05.
    readout: path cost
    expect: { value: 137, tolerance: 0.05 }
    setup:
      params: { rough: 0 }
  - id: flat-costs-tie-many-cells
    statement: >-
      With every cell costing 1 the estimate is exact on open ground, so many cells tie at
      f = C* and the bound widens: A*'s expansions lie in [#{f < C*} + 1, #{f ≤ C*}] =
      [1068, 1976], counted in the test.
    readout: expanded cells
    expect: { range: [1068, 1976] }
    setup:
      params: { rough: 0 }
    source: hart-nilsson-raphael-1968
  - id: flat-costs-dijkstra-ties
    statement: >-
      Dijkstra on the same flat map expands within [#{g* < C*} + 1, #{g* ≤ C*}] = [2187, 2191],
      the 5 cells at distance C* being the ties, counted in the test.
    readout: expanded cells
    expect: { range: [2187, 2191] }
    setup:
      params: { algorithm: dijkstra, rough: 0 }
  - id: steep-costs-are-optimal
    statement: >-
      At the steepest cost of climbing, 3, A* at weight 1 is still optimal: 0 % above, within
      0.05.
    readout: vs optimum
    expect: { value: 0, tolerance: 0.05 }
    setup:
      params: { rough: 3 }
  - id: steep-path-cost-is-the-optimum
    statement: >-
      At cost of climbing 3 the heap-free Dijkstra in the test gives the optimum 511.108, and
      A*'s path costs 511.1 within half the printed decimal, 0.05.
    readout: path cost
    expect: { value: 511.1, tolerance: 0.05 }
    setup:
      params: { rough: 3 }
  - id: steep-a-star-expansions-are-bounded
    statement: >-
      At cost of climbing 3 A*'s expansions lie in [#{f < C*} + 1, #{f ≤ C*}] = [1492, 1492],
      counted in the test: exactly 1492.
    readout: expanded cells
    expect: { range: [1492, 1492] }
    setup:
      params: { rough: 3 }
  - id: seed-7-path-cost-is-the-optimum
    statement: >-
      On the map of seed 7 the heap-free Dijkstra in the test gives the optimum 220.802, and A*'s
      path costs 220.8 within 0.05.
    readout: path cost
    expect: { value: 220.8, tolerance: 0.05 }
    setup:
      seed: 7
  - id: seed-7-a-star-expansions-are-bounded
    statement: >-
      On the map of seed 7 A*'s expansions lie in [#{f < C*} + 1, #{f ≤ C*}] = [1614, 1614],
      counted in the test: exactly 1614.
    readout: expanded cells
    expect: { range: [1614, 1614] }
    setup:
      seed: 7
---

Three searches cross the same hills: Dijkstra floods everything, A* leans towards the goal, greedy sprints and pays for it. Same map, measured costs.

The terrain is seeded value noise; entering a cell costs more the higher it is, and the peaks are impassable. Each search expands one cell at a time from a priority queue: Dijkstra by the cost so far, greedy best-first by the estimated distance left, A* by their sum (with the estimate multiplied by the weight).

The estimate is the Manhattan distance times the cheapest cell, which never overestimates. With weight 1, A* therefore returns a path exactly as cheap as Dijkstra's while expanding fewer cells; the readout compares both against the optimum computed for the same map. Raise the weight and A* turns greedy: faster, no longer guaranteed optimal.

Dim cells are expanded, bright ones are the frontier waiting in the queue.

If none of 20 seeded maps has a passable start, goal and a path between them, the plate says that no map was found and, when new maps are on, draws another.
