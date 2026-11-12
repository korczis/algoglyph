---
id: kahn-waves
title: Kahn's algorithm and parallel waves
taxonomy: systems/scheduling
status: live
engine: graph
sources:
  - id: practice-systems
tags:
  - topological sort
  - waves
  - parallelism
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: "O(V + E)"
related:
  - topological-sort
  - critical-path
  - sugiyama-layout
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Remove every vertex without incoming edges at once, so each round is a wave whose tasks can run in parallel.
    - Read the width of each wave as the most tasks that could run at once if every task took one step.
    - Relate the number of waves to the dependencies, one more than the number of edges on the longest dependency chain.
---

Remove every vertex without incoming edges at once: each round is a wave that can run in parallel.

Ringed vertices are the current wave, filled ones removed, and every wave has a colour of its own. The chart’s frontier line is the width of each wave, the most that could run at once if every task took one step.

The number of waves is one more than the number of edges on the longest dependency chain.
