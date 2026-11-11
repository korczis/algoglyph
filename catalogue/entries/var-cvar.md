---
id: var-cvar
title: Value at risk and expected shortfall
taxonomy: inference/uncertainty
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - risk
  - tails
  - quantiles
complexity: "n log n to sort the simulated losses"
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
---

The loss exceeded with a given probability, and the average of the losses beyond it.

Value at risk at level α is the α-quantile of the loss distribution, read here as the smallest simulated loss with at least α of the runs at or below it; expected shortfall is the mean of the losses at or beyond it. Their standard errors come from ten independent batches of runs, and are withheld while a batch's tail holds too few losses to mean anything.

For normal losses at 95% the two are 1.645 and 2.063 standard deviations. The heavy-tailed portfolio, five Student-t positions with four degrees of freedom sharing one factor, pushes expected shortfall further from VaR, and rare jumps can leave VaR almost untouched while shortfall sees them; few runs land in the tail, so tail estimates converge slowly.
