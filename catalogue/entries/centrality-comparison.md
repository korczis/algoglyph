---
id: centrality-comparison
title: Degree, closeness and eigenvector centrality
taxonomy: graphs/analysis
status: live
engine: graph
labs:
  - centrality
sources:
  - id: practice-investigation
tags:
  - centrality
  - ranking
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "degree O(E); closeness O(VE); eigenvector O(E) per power-iteration round"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - "Compute three answers to who is central on one graph in turn, each left on the vertices until the next replaces it: degree first, then closeness one breadth-first search at a time, then the power iteration."
    - Tell the measures apart; degree is local, closeness rewards being near everyone, and eigenvector centrality rewards having central neighbours.
    - Read the rank agreement between them (Spearman's ρ), and whether the power iteration converged within the rounds its control allows.
  prerequisites:
    - breadth-first-search
    - pagerank
bounds:
  model: edge scans
  worst: "2E for degree, 2E per breadth-first search for closeness (2VE on a connected input), E per power-iteration round"
  space: "O(V + E)"
claims:
  - id: eigenvalue-is-lambda-max-at-the-cap
    statement: >-
      At the default the power iteration stops at its 300-round cap before its own 1e-10 rule, and
      the eigenvalue it prints is still λ_max of the adjacency matrix, 5.8778 by cyclic Jacobi in
      test/centrality-comparison-claims.test.ts, within 0.001: an eigenvalue read off an
      unconverged iterate is wrong only to second order in the iterate's error.
    readout: Power iteration
    expect: { number: 2, value: 5.8778, tolerance: 0.001 }
  - id: eigenvalue-is-lambda-max-at-seed-7
    statement: >-
      At seed 7 the iteration converges by its own rule before the cap, and its eigenvalue is
      Jacobi's 6.2702, within 0.001.
    readout: Power iteration
    expect: { number: 2, value: 6.2702, tolerance: 0.001 }
    setup:
      seed: 7
  - id: eigenvalue-is-lambda-max-at-the-lowest-cap
    statement: >-
      Cut to 150 rounds, half the default, the iteration is further from its eigenvector, and the
      eigenvalue is still Jacobi's 5.8778 within 0.001: the test computes the iterate's error from
      the spectrum at the plate's own stop and holds it below 0.0004.
    readout: Power iteration
    expect: { number: 2, value: 5.8778, tolerance: 0.001 }
    setup:
      params: { powerRounds: 150 }
  - id: eigenvalue-is-lambda-max-on-the-grid
    statement: >-
      On the grid, the same graph at every seed, the eigenvalue is Jacobi's 3.7041 within 0.001.
    readout: Power iteration
    expect: { number: 2, value: 3.7041, tolerance: 0.001 }
    setup:
      params: { shape: grid }
      seeds: [4242, 7]
  - id: eigenvalue-is-lambda-max-on-a-slow-geometric-input
    statement: >-
      On the geometric input at 80 vertices the largest eigenvalues lie close together, so the
      iteration is still moving when it stops at its cap, and the eigenvalue is still Jacobi's
      3.7444 within 0.001.
    readout: Power iteration
    expect: { number: 2, value: 3.7444, tolerance: 0.001 }
    setup:
      params: { shape: geometric, n: 80 }
      seed: 7
  - id: eigenvalue-between-average-and-largest-degree
    statement: >-
      At every round the printed eigenvalue lies between the average degree 2m/n = 5.28 and the
      largest degree 9, converged or not: the iterate's ‖(A + I)x‖ never falls below its uniform
      start's, which is 1 + 2m/n, and never exceeds λ_max + 1 ≤ Δ + 1 (derived in the test). A hard
      bound.
    readout: Power iteration
    expect: { number: 2, range: [5.28, 9] }
  - id: eigenvalue-between-average-and-largest-degree-at-the-lowest-cap
    statement: >-
      On the slow geometric input at 80 vertices, stopped at 150 rounds, the eigenvalue still lies
      between the average degree 3.525 and the largest degree 5.
    readout: Power iteration
    expect: { number: 2, range: [3.525, 5] }
    setup:
      params: { shape: geometric, n: 80, powerRounds: 150 }
      seed: 7
---

Three answers to who is central, side by side on one graph.

The three measures are computed in turn and each is left on the vertices (size and colour) until the next replaces it: degree first, then closeness one breadth-first search at a time, then the power iteration (for at most the rounds its control allows, 300 by default; the readouts say whether it converged), whose change per round falls on the log chart.

At the end the readouts name the most central vertex by each measure and the rank agreement between them (Spearman’s ρ). Degree is local, closeness rewards being near everyone, and eigenvector centrality rewards having central neighbours.
