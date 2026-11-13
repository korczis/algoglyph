---
id: life-like-automata
title: Life-like automata
taxonomy: dynamics/automata
status: live
engine: custom
sources:
  - id: gardner-life-1970
    purpose: history
tags:
  - cellular automata
  - Game of Life
  - emergence
complexity: O(cells) per generation
interaction: Click or drag to toggle a patch of cells; the first cell decides on or off.
related:
  - langton-turmites
  - rule-weaver
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Count every cell's eight live neighbours and read a rule in B/S notation as the counts at which a dead cell is born and a live one survives.
    - Recognise B3/S23 as Conway's Game of Life, HighLife adding birth on 6, Seeds (B2/S) where no cell outlives a generation, and Day & Night evolving the same way with live and dead swapped.
    - Find the period of the whole board, proposed when a hash repeats and confirmed only when the board equals a copy of itself one period later.
    - Watch the Gosper gun add a glider every 30 generations until its stream wraps round and hits it.
  misconceptions:
    - A lone glider takes its shape again every 4 generations, but it has moved one cell diagonally, so on a w × h torus the board repeats only after 4·lcm(w, h).
algorithm:
  paradigm: simulation
bounds:
  model: cell updates, one per cell of the torus per generation
  best: w·h per generation
  worst: w·h per generation
  space: two boards of w·h cells, their ages and traces, and the 8192 most recent board hashes
claims:
  - id: gun-population-at-300
    statement: >-
      The Gosper gun has 36 cells and takes its shape again every 30 generations, one 5-cell
      glider further on, so at generation 30k its population is 36 + 5k as long as the glider
      stream has not wrapped round the torus into the gun: on the default board of 266 × 166
      cells that is up to generation 5280 (k = 176; at 5310 the count breaks, both counted by a
      separate Life in test/controls-life-like-automata.test.ts). At 300, k = 10: 86 cells,
      exactly.
    readout: population
    expect: { value: 86 }
    setup:
      params: { preset: gun, runs: 300 }
  - id: blinker-period-2
    statement: >-
      A blinker alone on the board flips between a row and a column of three cells, so the board
      repeats every 2 generations and never every 1: the hash of generation 2 repeats generation
      0's, and the board is confirmed equal to its copy at generation 4, where the run stops.
    readout: period of the board
    expect: { value: 2 }
    setup:
      params: { preset: blinker, runs: 4 }
  - id: block-period-1
    statement: >-
      A block is a still life: each of its four cells has three live neighbours and survives, and
      no dead cell has exactly three, so the board repeats every generation, proposed at
      generation 1 and confirmed at generation 2, where the run stops.
    readout: period of the board
    expect: { value: 1 }
    setup:
      params: { preset: block, runs: 2 }
---

Conway's Game of Life and its cousins on a wrapping grid: one line of rule, and out come gliders, guns, oscillators and ash, coloured by how long each cell has lived.

Every cell counts its eight live neighbours. A rule in B/S notation lists the counts at which a dead cell is born and a live one survives: B3/S23 is Conway's Game of Life, HighLife adds birth on 6, in Seeds (B2/S) no cell outlives a generation, and Day & Night evolves the same way with live and dead swapped. The rule can be changed mid-run.

Live cells are coloured by the generations they have survived, newborns at one end of the palette and old still lifes at the other, and every death leaves a trace that fades. The chart follows the population and the births and deaths of each step.

The period readout hashes every board; when a hash repeats, the gap proposes a period of the whole board, and it is confirmed only when the board equals a copy of itself one period later (a blinker gives 2, a block 1). The generation where the cycle began comes from the hash match. A lone glider moves one cell diagonally every 4 generations, so on a w × h torus it repeats only after 4·lcm(w, h). The Gosper gun adds a glider every 30 generations until its stream wraps round and hits it; the R-pentomino and the acorn are methuselahs, a handful of cells that keep changing long before they settle. The blinker, the block and the glider start alone at the centre of the board.
