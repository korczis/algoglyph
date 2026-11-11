---
id: pareto-front
title: Pareto front
taxonomy: inference/multi-criteria
status: live
engine: numeric
sources:
  - id: practice-decisions
tags:
  - pareto
  - dominance
  - skyline
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'O(n log n) for two criteria: one sort, one sweep'
related:
  - topsis
  - simplex-method
---

The options no other option beats on every criterion.

Options are sorted by the first criterion, best first, and swept: an option is on the front exactly when its second criterion beats every option already swept. The horizontal line is the best second criterion so far, the staircase the front as it grows.

After the sweep, peeling off the front and sweeping again ranks every option by its layer (non-dominated sorting). The chart compares the comparisons of the sweep with checking every pair; anti-correlated criteria, a trade-off, make large fronts, correlated ones small.
