---
id: kahn-waves
title: Kahn's algorithm and parallel waves
taxonomy: systems/scheduling
status: planned
engine: graph
sources:
  - id: practice-systems
tags:
  - topological sort
  - waves
  - parallelism
motivation: Coordinating many workers and machines without a shared clock depends on it.
---

Remove every vertex without incoming edges at once: each round is a wave that can run in parallel.
