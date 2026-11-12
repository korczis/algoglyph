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
complexity: "d + 1 model evaluations per sampled ordering of d inputs"
related:
  - sobol-indices
  - tornado-sensitivity
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
---

Each input's average marginal contribution over random orderings.

The game's value of a coalition is the model's output with the coalition's inputs at the instance and the others at a baseline. In each sampled ordering every input's marginal contribution is recorded; the averages are unbiased estimates, and because each ordering's contributions telescope to v(all) − v(none), the estimates add up to it exactly at every step.

With at most six inputs every ordering can be walked, so the exact values are drawn as ticks and the largest error is measured against them; it falls like one over the square root of the orderings sampled. The model has two pairwise interactions, whose credit the Shapley value splits evenly between the pair.
