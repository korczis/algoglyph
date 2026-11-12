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
---

The share of output variance each input explains, alone and with the others.

The first-order index of an input is the share of the output's variance its own variation explains; the total index adds every interaction it takes part in. Both come from two independent sample matrices and the hybrids that swap in one column: the first-order estimator of Saltelli (2010) and the total-effect estimator of Jansen.

On the Ishigami function the third input has no first-order effect at all yet a total index near 0.24, because it acts only through its interaction with the first. On an additive model first-order and total indices coincide and sum to one; the ticks are the analytic values.
