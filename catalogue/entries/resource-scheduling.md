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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - critical-path
  objectives:
    - Start ready tasks at time zero and at every completion, from the highest bottom level down, each one that fits in the units still free, so that a small task can overtake a large one waiting for room.
    - Frame the makespan by two lower bounds, the critical path and the total work divided by the number of units.
    - Explain why list scheduling is a heuristic that can miss the optimum, which is NP-hard to find with resource limits.
algorithm:
  paradigm: greedy
claims:
  - id: makespan-at-least-both-bounds
    statement: >-
      No schedule beats the larger of the critical path and the total work divided by the units,
      which the result line reports rounded to the millisecond (its third number): the makespan
      minus that bound is at least 0, and since both are whole milliseconds, above −1.
    readout: Makespan
    expect: { against: Result, against_number: 3, above: -1 }
  - id: work-bound
    statement: >-
      The utilisation is the total work divided by the units times the makespan, so the bound
      that the makespan is at least the work divided by the units is a utilisation of at most
      100%.
    readout: Utilisation
    expect: { range: [0, 100] }
  - id: unit-demands-never-wait-for-a-unit
    statement: >-
      With every task needing one unit (largest demand 1) and no more tasks than units (8 of
      each), a ready task always finds a free unit, so each starts as soon as its predecessors
      finish and the makespan is the critical path, exactly: the difference is 0.
    readout: Makespan
    expect: { against: Critical path (lower bound), tolerance: 0 }
    setup:
      params: { maxDemand: 1, units: 8, tasks: 8 }
  - id: bounds-hold-at-the-largest-demand
    statement: >-
      Tasks needing up to all 8 units still cannot beat the larger of the critical path and the
      work divided by the units, reported rounded to the millisecond (the result line's third
      number): whole milliseconds, so the makespan minus that bound is above −1.
    readout: Makespan
    expect: { against: Result, against_number: 3, above: -1 }
    setup:
      params: { maxDemand: 8, units: 8, tasks: 30 }
  - id: work-bound-at-the-largest-demand
    statement: >-
      At the same setting the utilisation, the work divided by the units times the makespan, is
      at most 100%, since the makespan is at least the work divided by the units.
    readout: Utilisation
    expect: { range: [0, 100] }
    setup:
      params: { maxDemand: 8, units: 8, tasks: 30 }
---

Tasks start in priority order when their predecessors are done and a resource is free.

Each lane is one unit of a shared resource (a build machine's slots, say), and a band on it is the task holding that unit. A task's colour follows its priority: its bottom level, the longest chain of durations from its start to the end of the graph. Arrows join a predecessor's end to the start of each task that waited for it.

The scheduler decides only at time zero and when something finishes. It walks the ready tasks from the highest bottom level down and starts each one that fits in the units still free, skipping any that do not, so a small task can overtake a large one that is waiting for room. The harness checks after every decision that no waiting task would have fitted.

Two lower bounds frame the makespan: the critical path (no schedule can beat the longest chain) and the total work divided by the number of units. The readout reports how close the greedy schedule came to the larger of the two; list scheduling is a heuristic and can miss the optimum, which is NP-hard to find with resource limits.
