---
id: conformal-intervals
title: Conformal prediction intervals
taxonomy: inference/uncertainty
status: live
engine: stochastic
labs:
  - uncertainty
sources:
  - id: practice-decisions
tags:
  - conformal
  - intervals
  - coverage
complexity: "one sort of the calibration residuals"
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
schema: algoglyph.entry/v2
claims:
  - id: covers-at-the-guaranteed-rate
    statement: >-
      Over 150 repeated experiments with 60 calibration cases, the 90% split conformal interval
      covers between 1 − α = 90% and 1 − α + 1/(n + 1) ≈ 91.6% of test cases, give or take three
      standard errors of the repetition (about 1.1 points).
    readout: 90% intervals covering
    expect: { range: [88.9, 92.7] }
---

Intervals from held-out residuals that cover the truth at the stated rate.

Split conformal prediction fits the model on training cases only, then measures absolute residuals on calibration cases the model never saw. If the calibration and test cases are exchangeable, the ⌈(n + 1)(1 − α)⌉-th smallest residual is a radius that covers a new case with probability at least 1 − α, and at most 1 − α + 1/(n + 1), whatever the model.

The guarantee is marginal: averaged over cases, not for each x. With noise that grows with x, the constant-width band over-covers on the left and under-covers on the right while the overall coverage stays at the nominal level; a badly chosen polynomial degree makes the band wider but no less honest.
