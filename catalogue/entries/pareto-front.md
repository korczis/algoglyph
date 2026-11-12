---
id: pareto-front
title: Pareto front
taxonomy: inference/multi-criteria
status: live
engine: numeric
sources:
  - id: practice-decisions
tags:
  - pareto
  - dominance
  - skyline
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'O(n log n) for two criteria: one sort, one sweep'
related:
  - topsis
  - simplex-method
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Find the options no other option beats with one sort by the first criterion and one sweep.
  - Rank every option by its layer, peeling the front off and sweeping again.
  - Predict a large front from a trade-off between the criteria and a small one from correlation.
algorithm:
  paradigm: incremental
bounds:
  model: comparisons (sort and sweep)
  average: O(n log n)
  worst: O(n log n)
claims:
  - id: trade-off-makes-a-large-front
    statement: >-
      With 160 anti-correlated options (a trade-off) the front holds more options than
      H₁₆₀ ≈ 5.65, the expected front of 160 options with independent criteria. Replicating the
      plate's option generator over 4,000 other seeds puts the anti-correlated front at 14.1 on
      average with a standard deviation of 2.9, so H₁₆₀ lies about three standard deviations
      below it.
    readout: Front
    expect: { above: 5.65 }
  - id: correlation-makes-a-small-front
    statement: >-
      With 160 correlated options the front is small: between 1 and 6 options, the mean (2.3)
      plus three standard deviations (1.2) of the front over 4,000 other seeds of the plate's
      option generator.
    readout: Front
    expect: { range: [1, 6] }
    setup:
      params: { shape: correlated }
---

The options no other option beats on every criterion.

Options are sorted by the first criterion, best first, and swept: an option is on the front exactly when its second criterion beats every option already swept. The horizontal line is the best second criterion so far, the staircase the front as it grows.

After the sweep, peeling off the front and sweeping again ranks every option by its layer (non-dominated sorting). The chart compares the comparisons of the sweep with checking every pair; anti-correlated criteria, a trade-off, make large fronts, correlated ones small.
