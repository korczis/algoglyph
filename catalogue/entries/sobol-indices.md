---
id: sobol-indices
title: Sobol sensitivity indices
taxonomy: inference/attribution
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - sensitivity
  - variance decomposition
complexity: "N (d + 2) model evaluations for d inputs"
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
  - Tell an input's first-order index, its own share of the variance, from its total index.
  - Recognise an input that acts only through an interaction, as the Ishigami function's third.
  - Check an additive model, whose first-order and total indices coincide and sum to one.
algorithm:
  paradigm: randomized
bounds:
  model: model evaluations
  best: N(d + 2)
  worst: N(d + 2)
claims:
  - id: ishigami-indices-near-analytic
    statement: >-
      On the Ishigami function with N = 4,000 every first-order and total index lies within 0.066
      of its analytic value, so the third input's first-order index is near 0 and its total index
      near 0.244. The margin is the mean (0.025) plus four standard deviations (0.010) of the
      largest error over 200 other seeds; four, because a largest error is skewed.
    readout: Largest error against analytic
    expect: { below: 0.066 }
  - id: additive-first-order-sums-to-one
    statement: >-
      On the additive model the first-order indices sum to one, within three standard deviations
      (0.019) of the sum over 200 other seeds.
    readout: Sum of first-order indices
    expect: { value: 1, tolerance: 0.058 }
    setup:
      params: { model: additive }
  - id: additive-first-order-and-total-coincide
    statement: >-
      On the additive model first-order and total indices both lie within 0.044 of the analytic
      a_i² / Σ a_j²: the mean (0.016) plus four standard deviations (0.007) of the largest error
      over 200 other seeds.
    readout: Largest error against analytic
    expect: { below: 0.044 }
    setup:
      params: { model: additive }
---

The share of output variance each input explains, alone and with the others.

The first-order index of an input is the share of the output's variance its own variation explains; the total index adds every interaction it takes part in. Both come from two independent sample matrices and the hybrids that swap in one column: the first-order estimator of Saltelli (2010) and the total-effect estimator of Jansen.

On the Ishigami function the third input has no first-order effect at all yet a total index near 0.24, because it acts only through its interaction with the first. On an additive model first-order and total indices coincide and sum to one; the ticks are the analytic values.
