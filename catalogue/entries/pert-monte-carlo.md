---
id: pert-monte-carlo
title: PERT schedule by Monte Carlo
taxonomy: inference/uncertainty
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - pert
  - beta distribution
  - schedules
complexity: "linear in tasks and dependencies per run"
related:
  - var-cvar
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
---

Task durations drawn from Beta distributions, the critical path re-run each time, P50 to P90 read off.

A task with optimistic, most likely and pessimistic durations a, m, b gets the PERT-Beta distribution with shape parameters 1 + 4(m − a)/(b − a) and 1 + 4(b − m)/(b − a), whose mean is (a + 4m + b)/6; each draw takes two Gamma variates. The forward pass through the network gives the project's finish and the critical path of that run.

Setting every task to its mean and adding along the longest path underestimates the expected finish whenever paths merge, because the project waits for the latest of its predecessors: the maximum of uncertain durations has a larger mean than the maximum of their means. Tasks are shaded by how often they were critical.
