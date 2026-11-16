---
id: personalised-pagerank
title: Personalised PageRank
taxonomy: graphs/analysis
status: live
engine: graph
labs:
  - centrality
sources:
  - id: practice-investigation
tags:
  - pagerank
  - personalised
  - proximity
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(E) per round; the error shrinks by a factor d per round"
interaction: "Tap a vertex to make it the subject."
related:
  - spreading-activation
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Let the surfer teleport only to the subject, so the scores say who matters relative to them rather than globally.
    - See the scores fall off with distance from the subject, and compare with plain PageRank on the same input, where the global hubs dominate.
    - Lower the damping and watch the scores concentrate further on the immediate neighbourhood.
  prerequisites:
    - pagerank
algorithm:
  paradigm: iterative-refinement
bounds:
  model: edge scans and rounds
  worst: "E edge scans per round, for at most ⌈ln(5·10⁻¹³) / ln d⌉ rounds"
  space: "O(V)"
claims:
  - id: scores-sum-to-one
    statement: >-
      Each round keeps 1 − d of the score as teleport mass, all of it at the subject, and passes d
      on, so the scores stay a probability vector: their sum, printed to six decimals in the
      Converged row, is 1 within 1e-6 at every seed.
    readout: Converged
    expect: { number: 2, value: 1, tolerance: 1e-6 }
    setup:
      seeds: [4242, 7]
  - id: subject-keeps-its-restart-share
    statement: >-
      The surfer restarts at the subject with probability 1 − d every round, and everything else
      that reaches it only adds, so the subject's rank is at least 1 − d = 0.15; the scores sum to
      one, so it is at most 1. A hard bound at every seed.
    readout: Subject's rank
    expect: { range: [0.15, 1] }
    setup:
      seeds: [4242, 7]
  - id: subject-keeps-its-restart-share-at-half-damping
    statement: >-
      At damping 0.5 the subject keeps at least half of the score, and at most all of it.
    readout: Subject's rank
    expect: { range: [0.5, 1] }
    setup:
      params: { damping: 0.5 }
      seeds: [4242, 7]
  - id: subject-keeps-its-restart-share-on-the-digraph
    statement: >-
      On the digraph the subject may have no edge in, and the bound still holds: its rank lies in
      [0.15, 1] at d = 0.85, the lower end reached only when nothing flows back to it.
    readout: Subject's rank
    expect: { range: [0.15, 1] }
    setup:
      params: { shape: digraph }
      seeds: [4242, 7]
  - id: subject-score-is-the-linear-solve
    statement: >-
      The subject's rank is 0.2129, its entry in the fixed point found by one linear solve with the
      subject as the teleport vector, by Gaussian elimination in
      test/personalised-pagerank-claims.test.ts, to the four decimals printed.
    readout: Subject's rank
    expect: { value: 0.2129 }
  - id: rounds-within-the-contraction-bound
    statement: >-
      The contraction bound of PageRank holds for any teleport vector: the first change is at most
      2d and each later one at most d times the one before, so at d = 0.85 the run stops by round
      175, a hard bound at every seed.
    readout: Rounds
    expect: { range: [1, 175] }
    setup:
      seeds: [4242, 7]
  - id: closest-is-the-linear-solve
    statement: >-
      The vertex closest to the subject is vertex 51, the largest entry of the solve other than the
      subject's own.
    readout: Closest to the subject
    expect: { value: 51 }
  - id: closest-score-is-the-linear-solve
    statement: >-
      Its score is the solve's 0.0660 to the four decimals printed.
    readout: Closest to the subject
    expect: { number: 2, value: 0.066 }
  - id: closest-is-the-linear-solve-at-seed-7
    statement: >-
      At seed 7 the solve puts the closest vertex at vertex 48.
    readout: Closest to the subject
    expect: { value: 48 }
    setup:
      seed: 7
  - id: closest-score-is-the-linear-solve-at-seed-7
    statement: >-
      And its score at 0.0946, which the plate reads to the four decimals printed.
    readout: Closest to the subject
    expect: { number: 2, value: 0.0946 }
    setup:
      seed: 7
---

The surfer teleports only to the subject, so the scores say who matters relative to them.

The circled vertex is the subject. Everything else is sized and coloured by how often a surfer who keeps restarting there would be found at it, which falls off with distance from the subject.

Compare with plain PageRank on the same input: the global hubs fade and the subject’s surroundings take over. Lower the damping and the scores concentrate further on the immediate neighbourhood.
