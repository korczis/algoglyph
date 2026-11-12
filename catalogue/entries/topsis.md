---
id: topsis
title: TOPSIS
taxonomy: inference/multi-criteria
status: live
engine: numeric
sources:
  - id: practice-decisions
tags:
  - multi-criteria
  - ideal point
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'O(m k) for m options and k criteria'
related:
  - pareto-front
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Divide each criterion by its Euclidean norm so units do not matter, then weight it.
  - Rank options by closeness D− / (D+ + D−) between the ideal and the anti-ideal.
  - Find where the ranking flips as the weight of one criterion moves.
claims:
  - id: equal-weights-rank-the-same-weighing-quality
    statement: >-
      At weight 0.25 for Quality the other three criteria get (1 − 0.25)/3 = 0.25 each, so
      every weight is exactly 0.25 and the ranking is TOPSIS at equal weights, whichever criterion
      the slider weighs: option D first with closeness 0.642, the value of an independent TOPSIS
      at equal weights on seed 4242's seven options, to the three digits the readout prints.
    readout: Ranking
    expect: { value: 0.642, tolerance: 0.0005 }
    setup:
      params: { swept: quality, w1: 0.25 }
  - id: equal-weights-rank-the-same-weighing-coverage
    statement: >-
      At weight 0.25 for Coverage the other three criteria get (1 − 0.25)/3 = 0.25 each, so
      every weight is exactly 0.25 and the ranking is TOPSIS at equal weights, whichever criterion
      the slider weighs: option D first with closeness 0.642, the value of an independent TOPSIS
      at equal weights on seed 4242's seven options, to the three digits the readout prints.
    readout: Ranking
    expect: { value: 0.642, tolerance: 0.0005 }
    setup:
      params: { swept: coverage, w1: 0.25 }
  - id: equal-weights-rank-the-same-weighing-cost
    statement: >-
      At weight 0.25 for Cost the other three criteria get (1 − 0.25)/3 = 0.25 each, so
      every weight is exactly 0.25 and the ranking is TOPSIS at equal weights, whichever criterion
      the slider weighs: option D first with closeness 0.642, the value of an independent TOPSIS
      at equal weights on seed 4242's seven options, to the three digits the readout prints.
    readout: Ranking
    expect: { value: 0.642, tolerance: 0.0005 }
    setup:
      params: { swept: cost, w1: 0.25 }
  - id: equal-weights-rank-the-same-weighing-risk
    statement: >-
      At weight 0.25 for Risk the other three criteria get (1 − 0.25)/3 = 0.25 each, so
      every weight is exactly 0.25 and the ranking is TOPSIS at equal weights, whichever criterion
      the slider weighs: option D first with closeness 0.642, the value of an independent TOPSIS
      at equal weights on seed 4242's seven options, to the three digits the readout prints.
    readout: Ranking
    expect: { value: 0.642, tolerance: 0.0005 }
    setup:
      params: { swept: risk, w1: 0.25 }
  - id: equal-weights-same-best-distance
    statement: >-
      At the same equal weights the best option's distance to the ideal is the same whichever
      criterion is weighed: D+ = 0.0956 for option D, the independent TOPSIS at equal weights to
      the three significant digits the readout prints.
    readout: Best
    expect: { value: 0.0956, tolerance: 0.00005 }
    setup:
      params: { swept: risk, w1: 0.25 }
---

Options ranked by closeness to the ideal and distance from the anti-ideal.

Each criterion is divided by its Euclidean norm, so units do not matter, then weighted. The ideal takes the best weighted value of every criterion and the anti-ideal the worst; each option's closeness is D− / (D+ + D−), its distance from the anti-ideal over the sum of both distances.

The right panel plots D+ against D− with lines of equal closeness. The chart repeats the whole computation as the weight of the chosen criterion (Quality by default) moves, which shows where the ranking flips: the answer depends on weights that someone has to choose.
