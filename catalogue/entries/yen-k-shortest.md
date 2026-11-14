---
id: yen-k-shortest
title: Yen's k shortest paths
taxonomy: graphs/shortest-paths
status: live
engine: graph
sources:
  - id: yen-1971-k-shortest
    purpose: algorithm-reference
  - id: practice-investigation
tags:
  - k shortest paths
  - alternatives
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(k V E log V) with a binary heap"
interaction: "Tap a vertex to start from it."
related:
  - dijkstra
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites:
    - dijkstra
  objectives:
    - Find the best path, then the best that differs from it, and so on, by spur paths.
    - Follow one Dijkstra per spur vertex of the last path found, each keeping that path up to the spur and forbidding the edges earlier paths took next.
    - Check that the path costs come in order, that equal costs are possible, and that every path is loopless and no two are the same.
claims:
  - id: first-path-is-the-distance
    statement: >-
      Yen's first path is Dijkstra's shortest path, so its cost is the source–target distance:
      558 on the default graph (16 vertices, seed 4242), the distance an independent
      Floyd–Warshall over the edge lengths gives in the test. The lengths are integers, so the
      cost is exact.
    readout: Path costs
    expect: { value: 558 }
  - id: k-paths-found
    statement: >-
      The default graph has far more than 3 loopless source–target paths (the test enumerates
      them all by depth-first search), so Yen finds exactly k = 3 of them.
    readout: Paths found
    expect: { value: 3 }
  - id: third-cost-by-enumeration
    statement: >-
      The third path costs 571, the third smallest cost among all loopless source–target paths,
      found by exhaustive enumeration in the test (a different algorithm from Yen's spur
      searches): the first cost minus the third is 558 − 571 = −13, exactly.
    readout: Path costs
    expect: { against: Path costs, against_number: 3, offset: -13, tolerance: 0 }
  - id: one-round-per-path
    statement: >-
      One round ends with each path found (the first after the first Dijkstra, every later one
      when its candidate is taken), so the rounds equal the paths found, exactly.
    readout: Rounds
    expect: { against: Paths found, tolerance: 0 }
  - id: one-path-at-k-1
    statement: >-
      At k = 1 Yen stops after the first Dijkstra: one path is found.
    readout: Paths found
    expect: { value: 1 }
    setup:
      params: { k: 1 }
  - id: no-later-edges-at-k-1
    statement: >-
      At k = 1 there is no later path, so no edge lies on a later path and off the best one: 0,
      exactly.
    readout: Edges only on later paths
    expect: { value: 0 }
    setup:
      params: { k: 1 }
  - id: eight-paths-found
    statement: >-
      At k = 8 the default graph still has more loopless paths than asked, so Yen finds exactly
      8.
    readout: Paths found
    expect: { value: 8 }
    setup:
      params: { k: 8 }
  - id: eighth-cost-by-enumeration
    statement: >-
      At k = 8 the eighth path costs 603, the eighth smallest loopless path cost by exhaustive
      enumeration in the test: the first cost minus the eighth is 558 − 603 = −45, exactly.
    readout: Path costs
    expect: { against: Path costs, against_number: 8, offset: -45, tolerance: 0 }
    setup:
      params: { k: 8 }
  - id: one-round-per-path-at-k-8
    statement: >-
      At k = 8 too the rounds equal the paths found, exactly.
    readout: Rounds
    expect: { against: Paths found, tolerance: 0 }
    setup:
      params: { k: 8 }
  - id: fewer-paths-than-asked
    statement: >-
      The 4-vertex graph at seed 4242 has exactly 5 loopless source–target paths, enumerated in
      the test, so at k = 8 Yen runs out of candidates and finds 5.
    readout: Paths found
    expect: { value: 5 }
    setup:
      params: { n: 4, k: 8 }
  - id: last-cost-when-fewer-paths
    statement: >-
      Those 5 paths cost 170 to 309 by enumeration, so the first cost minus the fifth is
      170 − 309 = −139, exactly: the last path Yen finds is the most expensive loopless path.
    readout: Path costs
    expect: { against: Path costs, against_number: 5, offset: -139, tolerance: 0 }
    setup:
      params: { n: 4, k: 8 }
  - id: grid-first-path-is-the-distance
    statement: >-
      On the weighted grid (15 vertices at the default size) the first path costs the
      source–target distance by Floyd–Warshall in the test, 21, exactly.
    readout: Path costs
    expect: { value: 21 }
    setup:
      params: { shape: grid }
  - id: grid-ties
    statement: >-
      On that grid the second and third smallest loopless path costs are both 22 (enumerated in
      the test): equal costs are possible, and the first cost minus the third is 21 − 22 = −1,
      exactly.
    readout: Path costs
    expect: { against: Path costs, against_number: 3, offset: -1, tolerance: 0 }
    setup:
      params: { shape: grid }
  - id: digraph-third-cost
    statement: >-
      On the directed input, where a path must follow the edges' directions, the enumeration in
      the test gives the costs 603, 679 and 759: the first cost minus the third is −156, exactly.
    readout: Path costs
    expect: { against: Path costs, against_number: 3, offset: -156, tolerance: 0 }
    setup:
      params: { shape: digraph }
---

The best path, then the best that differs from it, and so on, by spur paths.

The best path from the circled source to the boxed target is drawn in the foreground colour, every further path in the tree colour. Between paths the plate runs one Dijkstra per spur vertex of the last path found, so ringed and filled vertices flicker through many small searches; the readouts count their edge examinations and relaxations.

Each spur search keeps the last path up to its spur vertex, forbids the edges that earlier paths with the same start took next and the start's own vertices, and offers the cheapest way on to the target; the cheapest candidate not yet taken is the next path, and each path found ends a round.

The path costs appear in order at the end, with the number of paths found, which is k unless fewer loopless paths exist. Equal costs are possible, every path is loopless, and no two are the same. The edge count beside them is the edges that lie on a later path and not on the best one.
