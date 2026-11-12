---
id: life-like-automata
title: Life-like automata
taxonomy: dynamics/automata
status: live
engine: custom
sources:
  - id: gardner-life-1970
tags:
  - cellular automata
  - Game of Life
  - emergence
complexity: O(cells) per generation
interaction: Click or drag to toggle a patch of cells; the first cell decides on or off.
related:
  - langton-turmites
  - rule-weaver
---

Conway's Game of Life and its cousins on a wrapping grid: one line of rule, and out come gliders, guns, oscillators and ash, coloured by how long each cell has lived.

Every cell counts its eight live neighbours. A rule in B/S notation lists the counts at which a dead cell is born and a live one survives: B3/S23 is Conway's Game of Life, HighLife adds birth on 6, in Seeds (B2/S) no cell outlives a generation, and Day & Night evolves the same way with live and dead swapped. The rule can be changed mid-run.

Live cells are coloured by the generations they have survived, newborns at one end of the palette and old still lifes at the other, and every death leaves a trace that fades. The chart follows the population and the births and deaths of each step.

The period readout hashes every board; when a hash repeats, the gap proposes a period of the whole board, and it is confirmed only when the board equals a copy of itself one period later (a blinker gives 2, a block 1). The generation where the cycle began comes from the hash match. A lone glider moves one cell diagonally every 4 generations, so on a w × h torus it repeats only after 4·lcm(w, h). The Gosper gun adds a glider every 30 generations until its stream wraps round and hits it; the R-pentomino and the acorn are methuselahs, a handful of cells that keep changing long before they settle.
