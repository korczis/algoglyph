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
  - id: no-spread-correlated-front-is-one
    statement: >-
      With no spread across the diagonal every correlated option lies on x = y, so the best of them
      dominates all the others: the front is exactly 1 option of 160.
    readout: Front
    expect: { value: 1, tolerance: 0 }
    setup:
      params: { shape: correlated, spread: 0 }
  - id: no-spread-correlated-layers-are-n
    statement: >-
      On the diagonal each peeled front is the best remaining option alone, so the 160 correlated
      options form exactly 160 layers.
    readout: Layers (non-dominated sorting)
    expect: { value: 160, tolerance: 0 }
    setup:
      params: { shape: correlated, spread: 0 }
  - id: no-spread-anti-front-is-everything
    statement: >-
      With no spread every anti-correlated option lies on x + y = 1, where a gain on one criterion
      is a loss on the other and no option dominates another: the front is exactly all 160 options.
    readout: Front
    expect: { value: 160, tolerance: 0 }
    setup:
      params: { shape: anti, spread: 0 }
  - id: full-spread-correlated-front-is-records
    statement: >-
      At spread 1 the criteria u + v and u − v of two standard normals are independent normals, so
      the front counts the records of a random permutation: mean H₁₆₀ = 5.656, variance
      H₁₆₀ − H₁₆₀⁽²⁾ = 5.656 − 1.639 = 4.017 (standard deviation 2.004). It lies between 1 and 11,
      the mean plus three standard deviations (11.67) rounded down to a whole option.
    readout: Front
    expect: { range: [1, 11] }
    setup:
      params: { shape: correlated, spread: 1 }
  - id: full-spread-anti-front-is-records
    statement: >-
      At spread 1 the anti-correlated criteria u + v and v − u are independent normals as well, so
      the same records bound holds: between 1 and 11 options, H₁₆₀ plus three standard deviations.
    readout: Front
    expect: { range: [1, 11] }
    setup:
      params: { shape: anti, spread: 1 }
---

The options no other option beats on every criterion.

Options are sorted by the first criterion, best first, and swept: an option is on the front exactly when its second criterion beats every option already swept. The horizontal line is the best second criterion so far, the staircase the front as it grows.

After the sweep, peeling off the front and sweeping again ranks every option by its layer (non-dominated sorting). The chart compares the comparisons of the sweep with checking every pair; anti-correlated criteria, a trade-off, make large fronts, correlated ones small.
