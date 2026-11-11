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
---

An ant on a grid turns right on white, left on black, and flips the cell it leaves: ten thousand steps of chaos, then a straight highway it builds for as long as the grid lets it.

Langton's ant turns right on an empty cell and left on a filled one, flips the cell and steps forward. From an empty grid it wanders for about 10 000 steps, then builds a highway that repeats every 104 steps and carries it 2 cells diagonally, until the torus brings it back into its own debris.

The readout finds the shortest repeating period of the first ant's moves that goes somewhere and the step where that repetition began; for one ant under RL it reports period 104. The chart follows the cells visited and the cells coloured now: the chaos fills a ragged blob, the highway adds cells at a steady rate.

In longer rule strings letter k is the turn on colour k, after which the cell takes colour k + 1; with several letters the same machine is a turmite. Several ants share one grid and steer each other through the colours they leave.
