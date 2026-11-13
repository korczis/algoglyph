---
id: bipartite-matching
title: Bipartite matching
taxonomy: graphs/flows
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - matching
  - bipartite
  - augmenting paths
complexity: "O(V E)"
related:
  - ford-fulkerson
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - ford-fulkerson
  objectives:
    - For each left vertex in turn, search depth-first along alternating paths, any edge to the right and the matched edge back, until a free right vertex is found, and flip the path to grow the matching by one.
    - Pair up two sides along alternating paths as a flow problem in disguise, Ford–Fulkerson on a network of unit capacities.
    - Certify the matching maximum with a vertex cover of the same size, which König's theorem guarantees in a bipartite graph.
  misconceptions:
    - That a left vertex whose search failed must be tried again once the matching has grown; a left vertex that fails once never succeeds later, so one pass over the left side is enough.
claims:
  - id: maximum-matching-is-hopcroft-karps
    statement: >-
      The matching it ends with is a maximum one: on the default 40 vertices at seed 4242
      Hopcroft–Karp, written in test/flows-claims.test.ts, which grows the matching along many
      shortest alternating paths at once, finds 18 pairs, and the plate reads 18, exactly.
    readout: Maximum matching
    expect: { value: 18 }
  - id: maximum-matching-at-seed-7
    statement: >-
      On the graph seed 7 draws Hopcroft–Karp finds 19 pairs, and so does the plate, exactly.
    readout: Maximum matching
    expect: { value: 19 }
    setup:
      seed: 7
  - id: maximum-matching-on-160-vertices
    statement: >-
      On the largest graph, 160 vertices at seed 4242, Hopcroft–Karp finds 69 pairs, and so does
      the plate, exactly.
    readout: Maximum matching
    expect: { value: 69 }
    setup:
      params: { n: 160 }
  - id: maximum-matching-on-4-vertices
    statement: >-
      On the smallest graph, two vertices a side, Hopcroft–Karp finds 2 pairs, a perfect
      matching, and so does the plate, exactly.
    readout: Maximum matching
    expect: { value: 2 }
    setup:
      params: { n: 4 }
  - id: konig-cover-equals-matching
    statement: >-
      König's theorem: in a bipartite graph the smallest vertex cover is exactly as large as the
      largest matching, and the cover built from the final matching has one vertex per pair, so
      the two readouts are equal (tolerance 0); since every cover is at least as large as every
      matching, that equality certifies the matching maximum.
    readout: König vertex cover
    expect: { against: Maximum matching, tolerance: 0 }
  - id: konig-cover-equals-matching-at-seed-7
    statement: >-
      On the graph seed 7 draws the cover equals the matching as well, exactly.
    readout: König vertex cover
    expect: { against: Maximum matching, tolerance: 0 }
    setup:
      seed: 7
  - id: konig-cover-equals-matching-on-160-vertices
    statement: >-
      On 160 vertices the cover equals the matching as well, exactly.
    readout: König vertex cover
    expect: { against: Maximum matching, tolerance: 0 }
    setup:
      params: { n: 160 }
---

Pair up two sides along alternating paths, as a flow problem in disguise.

The two columns are the two sides. For each left vertex in turn, a depth-first search follows any edge to the right and the matched edge back (ringed as it goes) until it finds a free right vertex; the alternating path is then flipped, and the matching, drawn thick, grows by one.

A left vertex that fails once never succeeds later, so one pass over the left side is enough.

Every edge of a vertex cover has an endpoint in it and no two matched edges share one, so no cover is smaller than a matching. König’s theorem says that in a bipartite graph the smallest cover is exactly as large as the largest matching, and builds it from the final matching: from every free left vertex follow the alternating paths, then take the left vertices they miss and the right vertices they reach. The readouts give that cover beside the matching; when the two agree, no larger matching exists.
