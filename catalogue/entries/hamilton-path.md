---
id: hamilton-path
title: Hamilton path by backtracking
taxonomy: graphs/connectivity
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - backtracking
  - np-complete
  - paths
complexity: "exponential in the worst case; the problem is NP-complete"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Search exhaustively with backtracking, extending the path by a neighbour not on it and clearing the last vertex at every retreat, from each start in turn.
    - Try the neighbours with the fewest free neighbours first, and abandon a path as soon as its end can no longer reach every remaining vertex.
    - Use the structure of the input, a rectangular grid always having a path (row by row, like a snake) and three vertices of degree one ruling a path out at once.
    - Switch the pruning off and watch the plain search try every start and every branch instead.
  prerequisites:
    - depth-first-search
  misconceptions:
    - Pruning does not make the search inexact; both prunings cut only branches that cannot succeed, so with them on or off the search finds a path exactly when one exists.
algorithm:
  paradigm: backtracking
bounds:
  model: "edges examined: the degree count, every edge tried from a path's end, and the reachability searches of the pruning"
  best: "m with the pruning on, when three vertices have degree one or one has none: the degree count alone decides"
  worst: "exponential in V: every simple path from every start, until the event cap stops the run"
claims:
  - id: the-grid-has-a-snake
    statement: >-
      The default grid of 16 is 5 columns by 3 rows, 15 vertices, and its rows walked alternately
      left and right form a Hamilton path, which test/hamilton-path-claims.test.ts builds and
      checks edge by edge (and the subset dynamic programme there agrees): the search ends with
      every vertex on the path, On the path minus the Graph readout's vertices 0 at both seeds
      listed, with no tolerance.
    readout: On the path
    expect: { against: Graph, tolerance: 0 }
    setup:
      seeds: [4242, 7]
  - id: the-largest-grid-has-a-snake
    statement: >-
      At 36 vertices asked the grid is 8 columns by 5 rows, 40 vertices, and the snake the test
      builds is a Hamilton path of it, so the search finds one: On the path equals the Graph
      readout's vertices at both seeds listed, with no tolerance.
    readout: On the path
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { n: 36 }
      seeds: [4242, 7]
  - id: geometric-path-by-the-subset-programme
    statement: >-
      On the geometric input of 16 the subset dynamic programme in the test (a table of the
      vertex sets a path can cover and the vertices it can end at, no search) finds a Hamilton
      path at both seeds listed, and the search ends with every vertex on its path, with no
      tolerance.
    readout: On the path
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { shape: geometric }
      seeds: [4242, 7]
  - id: geometric-path-by-the-subset-programme-at-20
    statement: >-
      At 20 vertices the programme still finds a path on the geometric input at both seeds
      listed, and so does the search, with no tolerance.
    readout: On the path
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { shape: geometric, n: 20 }
      seeds: [4242, 7]
  - id: small-world-path-by-the-subset-programme
    statement: >-
      On the small-world ring of 16 the programme finds a path at both seeds listed, and the search
      ends with every vertex on its path, with no tolerance.
    readout: On the path
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { shape: small-world }
      seeds: [4242, 7]
  - id: no-path-on-the-random-input
    statement: >-
      On the random sparse input of 16 the subset programme finds no Hamilton path, so the search
      ends with nothing on its path: 0, exactly.
    readout: On the path
    expect: { value: 0 }
    setup:
      params: { shape: random }
  - id: two-leaves-two-starts
    statement: >-
      That input has 2 vertices of degree one and none of degree zero, counted from its edge list
      in the test: a path must end at each, so only they are tried as starts, and with no path
      each start fails and closes one round: 2 rounds, exactly.
    readout: Rounds
    expect: { value: 2 }
    setup:
      params: { shape: random }
  - id: three-leaves-decide-at-once
    statement: >-
      At seed 7 the random input has 3 vertices of degree one, counted in the test, and a path has
      only two ends, so the search stops after counting degrees: no vertex is discovered, 0,
      exactly.
    readout: Discoveries
    expect: { value: 0 }
    setup:
      params: { shape: random }
      seed: 7
  - id: three-leaves-cost-one-scan-per-edge
    statement: >-
      The degree count examines each edge once and decides there, so the edges examined equal the
      Graph readout's edges, with no tolerance.
    readout: Edges examined
    expect: { against: Graph, against_number: 2, tolerance: 0 }
    setup:
      params: { shape: random }
      seed: 7
  - id: the-plain-search-tries-every-start
    statement: >-
      With the pruning off the random input still has no path by the subset programme at both seeds
      listed, so the plain search fails from every vertex in turn, one round each: Rounds equals
      the Graph readout's vertices, with no tolerance.
    readout: Rounds
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { shape: random, prune: false }
      seeds: [4242, 7]
  - id: the-plain-search-finds-the-geometric-path
    statement: >-
      With the pruning off the search finds a path on the geometric input at both seeds listed,
      where the programme finds one, as it does with the pruning on: On the path equals the Graph
      readout's vertices, with no tolerance.
    readout: On the path
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { shape: geometric, prune: false }
      seeds: [4242, 7]
  - id: the-plain-search-finds-the-snake
    statement: >-
      With the pruning off the search still finds a path on the default grid at both seeds listed,
      with no tolerance.
    readout: On the path
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { prune: false }
      seeds: [4242, 7]
---

A path through every vertex once, found by exhaustive search with backtracking.

Ringed vertices form the path being tried, joined by thick edges; every retreat clears the last vertex. Neighbours with the fewest free neighbours are tried first, a path is abandoned as soon as its end can no longer reach every remaining vertex, and the first complete path is drawn in the foreground colour.

A rectangular grid always has one (row by row, like a snake). A vertex of degree one can only be an end, so three of them rule a path out at once. Switch the pruning off to watch the plain search try every start and every branch instead. Neither pruning cuts a branch that could succeed, so the answer is the same either way; only the work changes, and not always downwards: on the grid the plain search runs straight along the snake, while the pruned one runs a reachability search at every step. Raise the vertex count on the geometric input and watch the discoveries and events grow far faster than the graph; a run that reaches the event cap stops and says so.
