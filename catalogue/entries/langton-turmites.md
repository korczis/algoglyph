---
id: langton-turmites
title: Langton's ant and turmites
taxonomy: dynamics/automata
status: live
engine: custom
sources:
  - id: langton-artificial-life-1986
  - id: gale-further-travels-1995
tags:
  - cellular automata
  - Langton's ant
  - turmites
  - emergence
complexity: O(1) per ant step, O(cells) per frame drawn
interaction: Click or drag to toggle a patch of cells under the ants.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Follow Langton's ant as it turns right on an empty cell and left on a filled one, flips the cell and steps forward.
    - See it wander from an empty grid for about 10 000 steps, then build a highway that repeats every 104 steps and carries it 2 cells diagonally.
    - Read the shortest repeating period of the first ant's moves that goes somewhere, and the step where that repetition began.
    - Generalise to turmites, where letter k of a longer rule string is the turn on colour k, after which the cell takes colour k + 1.
algorithm:
  paradigm: simulation
bounds:
  model: cells read and recoloured, one per ant per step
  best: one per ant per step
  worst: one per ant per step
  space: the colour, visit and glow of every cell of the torus, and the first ant's 8192 most recent moves
claims:
  - id: highway-period-104
    statement: >-
      Langton's ant, alone on the empty 266 × 166 torus of the default 3 px cells, is building its
      highway at step 12000: the smallest period that its last moves repeat with and that carries
      it somewhere is 104. A separate ant and period search in
      test/langton-turmites-claims.test.ts finds 104 over the last 1500 moves (about 14 periods)
      and none over the last 4000, which reach back into the chaos before the highway.
    readout: highway (first ant)
    expect: { value: 104 }
    setup:
      params: { runs: 12000 }
  - id: visited-covers-coloured
    statement: >-
      Every cell starts at colour 0 and changes colour only under an ant, and every cell an ant
      stands on counts as visited, so the coloured cells are among the visited ones: at step
      12000 the cells visited minus the coloured cells is at least 0, above −1 for two whole
      counts.
    readout: cells visited
    expect: { against: coloured cells, above: -1 }
    setup:
      params: { runs: 12000 }
  - id: visited-covers-coloured-four-ants
    statement: >-
      The same holds for any rule and any number of ants, each placed on a cell it then counts as
      visited: four LLRR ants (four colours) after 20000 steps leave the cells visited minus the
      cells not of colour 0 at least 0, above −1.
    readout: cells visited
    expect: { against: coloured cells, above: -1 }
    setup:
      params: { turmite: LLRR, ants: 4, runs: 20000 }
---

An ant on a grid turns right on white, left on black, and flips the cell it leaves: ten thousand steps of chaos, then a straight highway it builds for as long as the grid lets it.

Langton's ant turns right on an empty cell and left on a filled one, flips the cell and steps forward. From an empty grid it wanders for about 10 000 steps, then builds a highway that repeats every 104 steps and carries it 2 cells diagonally, until the torus brings it back into its own debris.

The readout finds the shortest repeating period of the first ant's moves that goes somewhere and the step where that repetition began; for one ant under RL it reports period 104. The chart follows the cells visited and the cells coloured now: the chaos fills a ragged blob, the highway adds cells at a steady rate.

In longer rule strings letter k is the turn on colour k, after which the cell takes colour k + 1; with several letters the same machine is a turmite. Several ants share one grid and steer each other through the colours they leave.
