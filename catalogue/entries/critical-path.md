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
---

The longest chain through a task graph, and the slack every other task has.

Each vertex is a task with a duration from 1 to 9. The forward pass rings each task as its earliest start is fixed and colours it by that start; the backward pass fills each task and recolours it by its slack.

Tasks with no slack are marked in the foreground colour, with the tight dependencies between them: delaying one of them delays the whole project by as much, while every other task can slip by its slack.
