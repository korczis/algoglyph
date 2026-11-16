---
id: spreading-activation
title: Spreading activation
taxonomy: graphs/analysis
status: live
engine: graph
sources:
  - id: practice-systems
tags:
  - relevance
  - activation
  - weighted graphs
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: "O(E) per round"
interaction: "Tap a vertex to make it the seed."
schema: algoglyph.entry/v2
relations:
  - type: compares_with
    target: gaussian-elimination
    reason: >-
      Both compute (I − dW)⁻¹s; spreading activation sums the series round by round and lets a
      threshold stop it early, a linear solve eliminates once and gets every activation exactly.
pedagogy:
  difficulty: intermediate
  objectives:
    - Fire a pulse of 1 from the seed and let relevance flow along weighted edges and fade by the decay each round.
    - Raise the firing threshold and see activation stop at fewer vertices after fewer rounds; the threshold is what keeps the computation local.
    - At zero threshold, run until the pulses are negligible and compare the activations with (I − dW)⁻¹s from a linear solve.
  prerequisites:
    - personalised-pagerank
algorithm:
  paradigm: iterative-refinement
bounds:
  model: edge scans and rounds
  worst: "each firing vertex scans its edge list once a round, 2E per round at threshold 0"
  space: "O(V)"
claims:
  - id: total-is-the-geometric-series
    statement: >-
      At threshold 0 every pulse fires and passes on exactly d of itself, so round k carries d^k
      and the total activation is 1 + d + d² + … = 1/(1 − d) = 3.333 at d = 0.7, whatever the
      graph, to the four figures printed, at every seed.
    readout: Total activation
    expect: { value: 3.333 }
    setup:
      params: { threshold: 0 }
      seeds: [4242, 7]
  - id: total-is-the-geometric-series-on-the-links
    statement: >-
      On the links with confidences as weights the split differs and the total is still 3.333.
    readout: Total activation
    expect: { value: 3.333 }
    setup:
      params: { shape: links, threshold: 0 }
      seeds: [4242, 7]
  - id: total-is-the-geometric-series-at-the-top-decay
    statement: >-
      At the top decay, 0.85, the series is 1/0.15 = 6.667.
    readout: Total activation
    expect: { value: 6.667 }
    setup:
      params: { decay: 0.85, threshold: 0 }
      seeds: [4242, 7]
  - id: total-is-the-geometric-series-at-low-decay
    statement: >-
      At decay 0.1 the series is 1/0.9 = 1.111.
    readout: Total activation
    expect: { value: 1.111 }
    setup:
      params: { decay: 0.1, threshold: 0 }
      seeds: [4242, 7]
  - id: a-threshold-loses-activation
    statement: >-
      Above threshold 0 a pulse below the threshold dies and takes its share of every later round
      with it, so at the default threshold the total falls short of the series 3.3333.
    readout: Total activation
    expect: { below: 3.3333 }
    setup:
      seeds: [4242, 7]
  - id: most-activated-is-the-linear-solve
    statement: >-
      At threshold 0 the most activated vertex after the seed is vertex 51, the largest entry of
      (I − dW)⁻¹s by Gaussian elimination in test/spreading-activation-claims.test.ts.
    readout: Most activated
    expect: { value: 51 }
    setup:
      params: { threshold: 0 }
  - id: most-activation-is-the-linear-solve
    statement: >-
      Its activation is the solve's 0.227 to the three figures printed.
    readout: Most activated
    expect: { number: 2, value: 0.227 }
    setup:
      params: { threshold: 0 }
  - id: most-activated-is-the-linear-solve-at-seed-7
    statement: >-
      At seed 7 the solve puts the most activated vertex at vertex 48.
    readout: Most activated
    expect: { value: 48 }
    setup:
      params: { threshold: 0 }
      seed: 7
  - id: most-activation-is-the-linear-solve-at-seed-7
    statement: >-
      And its activation at 0.352, which the plate reads to the three figures printed.
    readout: Most activated
    expect: { number: 2, value: 0.352 }
    setup:
      params: { threshold: 0 }
      seed: 7
  - id: threshold-zero-activates-every-vertex
    statement: >-
      At threshold 0 a pulse reaches every vertex of the seed's component and none dies, and the
      input is connected, so Activated equals the Graph readout's vertex count, with no tolerance.
    readout: Activated
    expect: { against: Graph, tolerance: 0 }
    setup:
      params: { threshold: 0 }
      seeds: [4242, 7]
---

Relevance flows from a seed along weighted edges and fades, choosing what to look at.

The circled seed fires a pulse of 1; vertices ringed in a round are about to fire, and size and colour show the activation gathered so far.

Raise the firing threshold and activation stops at fewer vertices after fewer rounds: the threshold is what keeps the computation local. At zero it runs until the pulses are negligible, and the activations equal (I − dW)⁻¹s, which the test harness checks against a linear solve.
