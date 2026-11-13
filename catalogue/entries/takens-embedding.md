---
id: takens-embedding
title: Delay embedding (Takens)
taxonomy: dynamics/time-series
status: live
engine: numeric
sources:
  - id: practice-decisions
tags:
  - phase space
  - embedding
  - false nearest neighbours
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'O(N²) per dimension for the false-neighbour search over N vectors'
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - lorenz-attractor
  objectives:
    - Rebuild an attractor equivalent to the hidden one from one observed signal x(t) and its delays.
    - Choose the delay τ as the first minimum of the average mutual information between x(t) and x(t + τ), so that the coordinates are as independent as the signal allows.
    - Decide the dimension by false nearest neighbours, a neighbour that flies apart when one more delay is added having been close only because the embedding was too flat.
  misconceptions:
    - Every signal has a dimension to find; white noise has no low-dimensional state to reconstruct, so its false-neighbour fraction never collapses.
claims:
  - id: noise-keeps-false-neighbours
    statement: >-
      On white noise the added delay is a coordinate independent of the neighbour search, so the
      added distance |X − Y| is |N(0, 2σ²)| and exceeds the test's 2·ra, which flags a false
      neighbour, with probability 2(1 − Φ(√2)) = 15.7% when ra = σ, and at least 13.0% with ra up
      to three standard errors (1.07σ) above σ over 900 samples. Of the 895 vectors at m = 5 that
      is a binomial mean of at least 116 with a standard deviation of at most 10.1, so 5% (45) lies
      7 standard deviations below it.
    readout: False neighbours at the largest m
    expect: { above: 5 }
    setup:
      params: { signal: noise }
---

An attractor reconstructed from one observed signal and its delays.

Only x(t) is observed. The delay τ is the first minimum of the average mutual information between x(t) and x(t + τ), estimated from a two-dimensional histogram, so that the coordinates are as independent as the signal allows.

False nearest neighbours decide the dimension: a neighbour that flies apart when one more delay is added was only close because the embedding was too flat. For the Lorenz signal the fraction is already under 5% at m = 2 and near zero from m = 3; for white noise it never does, because noise has no low-dimensional state to reconstruct.
