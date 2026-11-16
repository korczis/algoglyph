---
id: pagerank
title: PageRank
taxonomy: graphs/analysis
status: live
engine: graph
labs:
  - centrality
sources:
  - id: brin-page-1998
    purpose: algorithm-reference
  - id: practice-investigation
tags:
  - pagerank
  - power iteration
  - influence
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(E) per round; the error shrinks by a factor d per round"
related:
  - personalised-pagerank
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Pass the scores along the edges round by round and watch the total change fall by about the damping factor per round, a straight line on the log chart, until it drops below 1e-12.
    - Lower the damping and see the ranks converge faster and flatten towards uniform; raise it and the structure of the graph dominates.
    - Check that the scores sum to one in every round, the stationary distribution of a random surfer who sometimes teleports.
algorithm:
  paradigm: iterative-refinement
bounds:
  model: edge scans and rounds
  worst: "E edge scans per round, for at most ⌈ln(5·10⁻¹³) / ln d⌉ rounds"
  space: "O(V)"
claims:
  - id: scores-sum-to-one
    statement: >-
      Every round keeps 1 − d of the score as teleport mass and passes d on, a vertex with no
      out-edges along the teleport vector, so the scores stay a probability vector: their sum,
      printed to six decimals in the Converged row, is 1 within 1e-6 at every seed.
    readout: Converged
    expect: { number: 2, value: 1, tolerance: 1e-6 }
    setup:
      seeds: [4242, 7]
  - id: scores-sum-to-one-at-low-damping
    statement: >-
      At damping 0.05 the surfer almost always teleports, and the sum is still 1 within 1e-6.
    readout: Converged
    expect: { number: 2, value: 1, tolerance: 1e-6 }
    setup:
      params: { damping: 0.05 }
      seeds: [4242, 7]
  - id: scores-sum-to-one-at-high-damping
    statement: >-
      At damping 0.95 the surfer almost always follows an edge, and the sum is still 1 within 1e-6.
    readout: Converged
    expect: { number: 2, value: 1, tolerance: 1e-6 }
    setup:
      params: { damping: 0.95 }
      seeds: [4242, 7]
  - id: rounds-within-the-contraction-bound
    statement: >-
      On vectors that sum to zero a round is a contraction by d in L1, and the first change is at
      most 2d, so round k changes the scores by at most 2·d^k and the run stops by the first k
      with 2·d^k below 1e-12: at d = 0.85 that is round 175, a hard bound on Rounds at any input
      (derived in test/pagerank-claims.test.ts).
    readout: Rounds
    expect: { range: [1, 175] }
    setup:
      seeds: [4242, 7]
  - id: rounds-within-the-contraction-bound-at-low-damping
    statement: >-
      At damping 0.05 the same bound is ⌈ln(5·10⁻¹³) / ln 0.05⌉ = 10 rounds.
    readout: Rounds
    expect: { range: [1, 10] }
    setup:
      params: { damping: 0.05 }
      seeds: [4242, 7]
  - id: rounds-within-the-contraction-bound-at-high-damping
    statement: >-
      At damping 0.95 the change falls by only 5 % a round, and the bound is 553 rounds.
    readout: Rounds
    expect: { range: [1, 553] }
    setup:
      params: { damping: 0.95 }
      seeds: [4242, 7]
  - id: highest-rank-is-the-linear-solve
    statement: >-
      The highest-ranked vertex is vertex 70, the largest entry of the fixed point found by one
      linear solve, (I − dS)x = (1 − d)/n with the dangling vertices' share sent along the
      teleport vector, by Gaussian elimination in test/pagerank-claims.test.ts.
    readout: Highest rank
    expect: { value: 70 }
  - id: highest-score-is-the-linear-solve
    statement: >-
      Its score is the solve's 0.0506 to the four decimals printed: the run stops within 1e-11 of
      the fixed point, far closer than a rounding boundary.
    readout: Highest rank
    expect: { number: 2, value: 0.0506 }
  - id: highest-rank-is-the-linear-solve-at-seed-7
    statement: >-
      At seed 7 the solve puts the highest rank at vertex 76.
    readout: Highest rank
    expect: { value: 76 }
    setup:
      seed: 7
  - id: highest-score-is-the-linear-solve-at-seed-7
    statement: >-
      And its score at 0.0333, which the plate reads to the four decimals printed.
    readout: Highest rank
    expect: { number: 2, value: 0.0333 }
    setup:
      seed: 7
---

Influence as the stationary distribution of a random surfer who sometimes teleports.

Vertex size and colour show rank. The scores start uniform and each round passes them along the edges (both ways on undirected inputs); the total change falls by about the damping factor per round, a straight line on the log chart, until it drops below 1e-12.

Lower the damping and the ranks converge faster and flatten towards uniform; raise it and the structure of the graph dominates. The readouts check that the scores sum to one.
