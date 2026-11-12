---
id: resource-scheduling
title: Resource-constrained list scheduling
taxonomy: systems/scheduling
status: live
engine: systems
sources:
  - id: practice-systems
tags:
  - scheduling
  - resources
  - priorities
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: O(n² + e) for n tasks and e precedence edges; no guarantee of optimality (the problem is NP-hard)
related:
  - critical-path
  - kahn-waves
---

Tasks start in priority order when their predecessors are done and a resource is free.

Each lane is one unit of a shared resource (a build machine's slots, say), and a band on it is the task holding that unit. A task's colour follows its priority: its bottom level, the longest chain of durations from its start to the end of the graph. Arrows join a predecessor's end to the start of each task that waited for it.

The scheduler decides only at time zero and when something finishes. It walks the ready tasks from the highest bottom level down and starts each one that fits in the units still free, skipping any that do not, so a small task can overtake a large one that is waiting for room. The harness checks after every decision that no waiting task would have fitted.

Two lower bounds frame the makespan: the critical path (no schedule can beat the longest chain) and the total work divided by the number of units. The readout reports how close the greedy schedule came to the larger of the two; list scheduling is a heuristic and can miss the optimum, which is NP-hard to find with resource limits.
