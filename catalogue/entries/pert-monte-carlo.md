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
relations:
  - { type: uses, target: critical-path, reason: "The critical path is re-run on every drawn set of durations." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - critical-path
  objectives:
  - Give a task with optimistic, most likely and pessimistic durations its PERT-Beta distribution.
  - Push sampled durations through the network's forward pass and read P50 to P90 off the finishes.
  - Explain why the project waits longer on average than its tasks at their means suggest.
algorithm:
  paradigm: simulation
claims:
  - id: merging-paths-delay-the-mean-finish
    statement: >-
      Setting every task to its mean underestimates the expected finish where paths merge: over
      6,000 simulated projects of seed 4242's network the mean length exceeds 206/6 ≈ 34.33, that
      network's exact deterministic finish with every task at (a + 4m + b)/6. The threshold belongs
      to this seed's network; the mean's standard error is about 0.05, a twentieth of the gap.
    readout: Mean length
    expect: { above: 34.34 }
    setup:
      seed: 4242
---

Task durations drawn from Beta distributions, the critical path re-run each time, P50 to P90 read off.

A task with optimistic, most likely and pessimistic durations a, m, b gets the PERT-Beta distribution with shape parameters 1 + 4(m − a)/(b − a) and 1 + 4(b − m)/(b − a), whose mean is (a + 4m + b)/6; each draw takes two Gamma variates. The forward pass through the network gives the project's finish and the critical path of that run.

Setting every task to its mean and adding along the longest path underestimates the expected finish whenever paths merge, because the project waits for the latest of its predecessors: the maximum of uncertain durations has a larger mean than the maximum of their means. Tasks are shaded by how often they were critical.
