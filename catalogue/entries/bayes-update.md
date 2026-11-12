---
id: bayes-update
title: Bayesian updating
taxonomy: inference/belief
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - bayes
  - posterior
  - evidence
complexity: "one pass over the grid per observation"
related:
  - noisy-or
  - dempster-shafer
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Apply Bayes' rule on a grid, multiplying every cell by the likelihood of what was seen and renormalising.
    - Check a grid posterior against the closed-form Beta(a + events, b + non-events).
    - See the prior's pull fade as evidence accumulates, every prior ending near the same curve, its width shrinking like 1/√n.
algorithm:
  paradigm: incremental
claims:
  - id: sceptical-prior-ends-near-the-truth
    statement: >-
      After 500 observations at a true rate of 0.3 the sceptical Beta(2, 8) prior's posterior mean
      is within 0.062 of 0.3: three standard deviations of the posterior mean over samples,
      3·√(500·0.3·0.7)/510 = 0.060, plus the prior's pull, |2 − 10·0.3|/510 = 0.002.
    readout: Posterior mean
    expect: { value: 0.3, tolerance: 0.062 }
    setup:
      params: { prior: sceptical, n: 500 }
  - id: hopeful-prior-ends-near-the-truth
    statement: >-
      After 500 observations at a true rate of 0.3 the hopeful Beta(8, 2) prior's posterior mean is
      within 0.071 of 0.3: three standard deviations of the posterior mean over samples,
      3·√(500·0.3·0.7)/510 = 0.060, plus the prior's pull, |8 − 10·0.3|/510 = 0.010.
    readout: Posterior mean
    expect: { value: 0.3, tolerance: 0.071 }
    setup:
      params: { prior: hopeful, n: 500 }
  - id: grid-mean-matches-the-closed-form
    statement: >-
      The grid's posterior mean agrees with the closed-form Beta(a + events, b + non-events) mean to
      within the width of one of its 400 cells (0.0025).
    readout: Posterior mean
    expect: { against: Closed form Beta mean, tolerance: 0.0025 }
  - id: coarse-grid-mean-matches-the-closed-form
    statement: >-
      On a grid of 100 cells the posterior mean still agrees with the closed-form
      Beta(a + events, b + non-events) mean to within the width of one cell, 1/100 = 0.01: each
      cell stands for the rate at its midpoint, which is never more than half a cell from any rate
      in it.
    readout: Posterior mean
    expect: { against: Closed form Beta mean, tolerance: 0.01 }
    setup:
      params: { cells: "100" }
  - id: medium-grid-mean-matches-the-closed-form
    statement: >-
      On a grid of 200 cells the posterior mean agrees with the closed-form
      Beta(a + events, b + non-events) mean to within the width of one cell, 1/200 = 0.005.
    readout: Posterior mean
    expect: { against: Closed form Beta mean, tolerance: 0.005 }
    setup:
      params: { cells: "200" }
---

A prior turned into a posterior one piece of evidence at a time.

The belief is held as the probability of each small cell of the rate. The prior's cell probabilities come exactly from the Beta distribution function, so a prior that is infinite at an end, like Jeffreys', still gives every cell a finite mass; each observation multiplies every cell by the likelihood of what was seen at its midpoint and renormalises, which is Bayes' rule with nothing assumed about the prior. Because the prior is a Beta density, the closed-form posterior Beta(a + events, b + non-events) is shown beside the grid's mean as a check.

The shaded region is the central 90% credible interval, its ends read to the width of one cell. A sceptical or hopeful prior pulls the early posterior away from the true rate; as evidence accumulates the likelihood dominates and every prior ends near the same curve, its width shrinking like 1/√n.
