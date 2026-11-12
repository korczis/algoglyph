---
id: shapley-values
title: Shapley values by sampling
taxonomy: inference/attribution
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - shapley
  - attribution
complexity: "2ᵈ + m(d + 1) model evaluations: the 2ᵈ exact values, then d + 1 per sampled ordering"
related:
  - sobol-indices
  - tornado-sensitivity
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Value a coalition as the model's output with its inputs at the instance, the rest at a baseline.
  - See why sampled orderings' contributions telescope, so the estimates add up to v(all) − v(none).
  - Watch the largest error against the exact values fall like one over the square root of m.
algorithm:
  paradigm: randomized
bounds:
  model: model evaluations
  best: 2ᵈ + m(d + 1)
  worst: 2ᵈ + m(d + 1)
claims:
  - id: error-small-at-600-orderings
    statement: >-
      With 600 sampled orderings of seed 4242's five inputs the largest error against the exact
      values is below three standard errors of the least certain input, 3σ/√600 = 0.0195, where
      σ = 0.159 is that input's exact spread of marginal contributions over all 120 orderings.
    readout: Largest error
    expect: { below: 0.0195 }
  - id: error-falls-like-one-over-root-m
    statement: >-
      With 4,000 sampled orderings of the same model the largest error falls below
      3σ/√4000 = 0.00756, the same three standard errors shrunk by √(600/4000).
    readout: Largest error
    expect: { below: 0.00756 }
    setup:
      params: { m: 4000 }
  - id: estimates-add-up-exactly
    statement: >-
      The sampled contributions telescope, so the estimates add up to v(all) − v(none) exactly at
      every step: the two agree to the six decimals the readout prints.
    readout: Sum of estimates
    expect: { against: Sum of estimates, against_number: 2, tolerance: 0.000001 }
---

Each input's average marginal contribution over random orderings.

The game's value of a coalition is the model's output with the coalition's inputs at the instance and the others at a baseline. In each sampled ordering every input's marginal contribution is recorded; the averages are unbiased estimates, and because each ordering's contributions telescope to v(all) − v(none), the estimates add up to it exactly at every step.

With at most six inputs every ordering can be walked, so the exact values are drawn as ticks and the largest error is measured against them; it falls like one over the square root of the orderings sampled. The model has two pairwise interactions, whose credit the Shapley value splits evenly between the pair.
