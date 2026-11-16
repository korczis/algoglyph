---
id: action-plan
title: Plan, then act
taxonomy: systems/scheduling
status: live
engine: custom
sources:
  - id: openttd-track
    purpose: implementation
tags:
  - DAG
  - topological order
  - cash flow
  - OpenTTD
complexity: O(A + D + P) for A actions, D dependencies and P presses
related:
  - kahn-waves
  - critical-path
  - topological-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites:
    - kahn-waves
  objectives:
    - Write a plan as actions and the actions each waits for, and let Kahn's waves order it.
    - Expand an action into the presses that carry it out, and walk the cash and the loan through every one before anything runs.
    - Read a refusal as the plan's own fault, named at the press that breaks it.
  misconceptions:
    - Acting one step at a time and checking as you go is not planning; a plan that overdraws is found before the first press, not at the fortieth.
bounds:
  model: presses
  worst: 'one walk over the actions, their dependencies and every press: A + D + P'
claims:
  - id: the-default-plan-repays-everything
    statement: >-
      The default plan borrows what the line needs, builds and runs it for twelve months, then
      repays in presses of the loan step until nothing is owed: the loan after the last step is 0.
    readout: final loan
    expect: { value: 0, tolerance: 0.5 }
  - id: the-default-plan-has-six-waves
    statement: >-
      Its dependencies put the actions in six waves (borrow and plan the line; track and stations;
      depot; trains; run; repay), the longest chain counted by Kahn's waves and by brute force in
      the test: exactly 6.
    readout: waves
    expect: { range: [6, 6] }
  - id: the-default-plan-takes-84-presses
    statement: >-
      Expanded into presses, borrowing and repaying one loan step at a time, the plan is 84 steps,
      re-walked in the test: exactly 84.
    readout: steps
    expect: { range: [84, 84] }
---

A plan before it runs: the actions, what each waits for, every press that carries them out, and the cash and loan after each one, refused if any press would overdraw.

The actions and their dependencies are a directed acyclic graph. Kahn's waves (the collection's own kernel, run on the graph engine) order it: an action runs once everything it waits for has run, and each wave holds actions that wait on nothing among themselves. A cycle cannot be ordered and is refused, the actions on it named.

Each action then expands into presses: "repay 50k" with a loan step of 10k is five presses of one action, not five separate decisions. The cash and the loan are walked through every press, a repayment taking at most what is still owed, as the game does; a press that would leave cash below zero, repay a loan already repaid or borrow past the limit refuses the whole plan before anything runs.

The OpenTTD fork's player and bot send their plans through the flow's command line (`npm run flow -- kernel action-plan -`), draw the DAG before acting, and then press the steps in order.
