---
id: tornado-sensitivity
title: Tornado sensitivity
taxonomy: inference/attribution
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - sensitivity
  - one at a time
complexity: "2 d + 1 model evaluations for d inputs, plus the Monte Carlo runs"
related:
  - sobol-indices
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
---

Each input swung from low to high alone, sorted into a tornado.

The model is a generic margin, volume × (price − unit cost) × (1 − loss rate) − fixed cost, around a seeded base case. Each input in turn is set to its low and then its high value with the others held at the base, and the bars are sorted widest first; colour shows whether the output rises or falls as the input goes up.

One at a time is cheap and readable but blind to interactions: price and unit cost multiply volume, so their swings depend on where volume is held. The joint Monte Carlo run below draws all inputs together from triangular distributions on the same ranges, and its P10–P90 spread is what the swings add up to in combination.
