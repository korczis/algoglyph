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
---

An attractor reconstructed from one observed signal and its delays.

Only x(t) is observed. The delay τ is the first minimum of the average mutual information between x(t) and x(t + τ), estimated from a two-dimensional histogram, so that the coordinates are as independent as the signal allows.

False nearest neighbours decide the dimension: a neighbour that flies apart when one more delay is added was only close because the embedding was too flat. For the Lorenz signal the fraction collapses by m = 3; for white noise it never does, because noise has no low-dimensional state to reconstruct.
