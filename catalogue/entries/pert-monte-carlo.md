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
  - id: uniform-tasks-delay-the-mean-finish
    statement: >-
      At PERT weight λ = 0 each task is uniform on [a, b]: every task's mean is (a + b)/2, and
      seed 4242's network finishes at 86/2 = 43 with every task at its mean. The maximum of
      uncertain path lengths has a larger mean than the maximum of their means, so the mean
      length exceeds that deterministic finish as printed by more than 0.05, half its last
      printed digit, and so exceeds the exact finish; the mean's standard error is about 0.08,
      the gap about 1.7.
    readout: Mean length
    expect: { against: With every task at its mean, above: 0.05 }
    setup:
      seed: 4242
      params: { lambda: 0 }
  - id: light-weight-delays-the-mean-finish
    statement: >-
      At λ = 2 every task's mean is (a + 2m + b)/4, and seed 4242's network finishes at 146/4
      = 36.5 with every task at its mean. The maximum of uncertain path lengths has a larger
      mean than the maximum of their means, so the mean length exceeds that deterministic
      finish as printed by more than 0.05, half its last printed digit, and so exceeds the
      exact finish; the mean's standard error is about 0.06, the gap about 1.3.
    readout: Mean length
    expect: { against: With every task at its mean, above: 0.05 }
    setup:
      seed: 4242
      params: { lambda: 2 }
  - id: heavy-weight-still-delays-the-mean-finish
    statement: >-
      At λ = 10, every task leaning hard on its most likely duration, every task's mean is (a
      + 10m + b)/12, and seed 4242's network finishes at 386/12 ≈ 32.17 with every task at its
      mean. The maximum of uncertain path lengths has a larger mean than the maximum of their
      means, so the mean length exceeds that deterministic finish as printed by more than
      0.05, half its last printed digit, and so exceeds the exact finish; the mean's standard
      error is about 0.04, the gap about 0.65.
    readout: Mean length
    expect: { against: With every task at its mean, above: 0.05 }
    setup:
      seed: 4242
      params: { lambda: 10 }
---

Task durations drawn from Beta distributions, the critical path re-run each time, P50 to P90 read off.

A task with optimistic, most likely and pessimistic durations a, m, b gets the PERT-Beta distribution with shape parameters 1 + λ(m − a)/(b − a) and 1 + λ(b − m)/(b − a), whose mean is (a + λm + b)/(λ + 2), the classical (a + 4m + b)/6 at the default weight λ = 4; each draw takes two Gamma variates. The forward pass through the network gives the project's finish and the critical path of that run.

Setting every task to its mean and adding along the longest path underestimates the expected finish whenever paths merge, because the project waits for the latest of its predecessors: the maximum of uncertain durations has a larger mean than the maximum of their means. Tasks are shaded by how often they were critical.
