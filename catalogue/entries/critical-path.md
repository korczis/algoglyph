---
id: critical-path
title: Critical path
taxonomy: systems/scheduling
status: live
engine: graph
sources:
  - id: practice-systems
tags:
  - longest path
  - scheduling
  - slack
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: "O(V + E)"
related:
  - kahn-waves
  - dag-shortest-paths
  - topological-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Run the forward pass that fixes each task's earliest start and the backward pass that gives each task its slack.
    - Identify the critical tasks, those with no slack, and the tight dependencies between them.
    - Explain why delaying a critical task delays the whole project by as much, while every other task can slip by its slack.
claims:
  - id: no-slack-tasks-are-the-marked-ones
    statement: >-
      Tasks with no slack are the ones marked: the marked tasks equal the critical tasks the
      backward pass found, exactly.
    readout: Critical (no slack)
    expect: { against: Critical tasks, tolerance: 0 }
  - id: unit-durations-give-the-longest-chain
    statement: >-
      With every task lasting 1 (longest task duration 1) the project lasts as many steps as the
      longest dependency chain has tasks. On the default 40-task layered DAG at seed 4242 that
      chain has 6 tasks, counted from the edges alone and equal to the 6 waves kahn-waves removes
      from the same graph (n 40, seed 4242), so the project length is exactly 6.
    readout: Project length
    expect: { value: 6 }
    setup:
      params: { maxDuration: 1 }
  - id: no-slack-tasks-are-the-marked-ones-at-unit-durations
    statement: >-
      At unit durations many chains tie for the longest, and still the marked tasks equal the
      critical tasks the backward pass found, exactly.
    readout: Critical (no slack)
    expect: { against: Critical tasks, tolerance: 0 }
    setup:
      params: { maxDuration: 1 }
  - id: no-slack-tasks-are-the-marked-ones-at-the-longest-durations
    statement: >-
      With durations up to 20 the marked tasks still equal the critical tasks, exactly.
    readout: Critical (no slack)
    expect: { against: Critical tasks, tolerance: 0 }
    setup:
      params: { maxDuration: 20 }
  - id: long-durations-bound-the-project
    statement: >-
      The 6-task longest chain of the same graph, each task lasting 1 to 20, bounds the project:
      it lasts at least 6 (that chain at one step a task) and at most 6 · 20 = 120 (every chain
      has at most 6 tasks), a hard range.
    readout: Project length
    expect: { range: [6, 120] }
    setup:
      params: { maxDuration: 20 }
---

The longest chain through a task graph, and the slack every other task has.

Each vertex is a task with a duration from 1 to the longest task duration, 9 by default. The forward pass rings each task as its earliest start is fixed and colours it by that start; the backward pass fills each task and recolours it by its slack.

Tasks with no slack are marked in the foreground colour, with the tight dependencies between them: delaying one of them delays the whole project by as much, while every other task can slip by its slack.
