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
---

A prior turned into a posterior one piece of evidence at a time.

The belief is held as the probability of each small cell of the rate. The prior's cell probabilities come exactly from the Beta distribution function, so a prior that is infinite at an end, like Jeffreys', still gives every cell a finite mass; each observation multiplies every cell by the likelihood of what was seen at its midpoint and renormalises, which is Bayes' rule with nothing assumed about the prior. Because the prior is a Beta density, the closed-form posterior Beta(a + events, b + non-events) is shown beside the grid's mean as a check.

The shaded region is the central 90% credible interval, its ends read to the width of one cell. A sceptical or hopeful prior pulls the early posterior away from the true rate; as evidence accumulates the likelihood dominates and every prior ends near the same curve, its width shrinking like 1/√n.
