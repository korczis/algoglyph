---
id: shear-sort
title: Shearsort
taxonomy: sorting/networks
status: live
engine: array
labs:
  - sorting
sources:
  - id: scherson-1989
    ref: analysis on two-dimensional meshes
  - id: knuth-taocp-3
    ref: "5.3.4 Networks for sorting"
  - id: leighton-1985
    ref: columnsort, the fixed-step relative
tags:
  - sorting
  - sorting network
  - oblivious
  - in-place
  - parallel
  - mesh
complexity: n^1.5 log n compare-exchanges in every case (simulated in one thread); extra space 1
related:
  - bitonic-sort
  - odd-even-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [odd-even-sort]
  objectives:
  - 'Run 256 keys, a 16 × 16 mesh: 144 rounds, four row and column phases of 16 odd-even transposition steps each and a final row phase, and 17,280 comparators.'
  - 'Run 512 keys: a 23 × 23 mesh with a partial last row whose missing cells never move, 253 rounds.'
  - 'Explain with the zero-one principle why ⌈lg r⌉ pairs of row and column phases suffice: each pair roughly halves the rows that are not yet clean.'
  misconceptions:
  - 'Shearsort needs a square mesh; the plate lays any n on a mesh ⌈√n⌉ wide, missing cells acting as +∞, and 512 keys take 253 rounds.'
algorithm:
  paradigm: iterative-refinement
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparators (one comparison each, and an exchange of two writes when its keys are out of order) and rounds (one odd-even transposition step of every row or of every column); no auxiliary write'
  average: 'the same network on every input: on the r × c mesh, c = ⌈√n⌉ and r = ⌈n/c⌉, (P + 1)c + P·r rounds for P = ⌈lg r⌉; on n = s² keys (2P + 1)·s²(s − 1)/2 comparators; no write on Already sorted'
claims:
  - id: mesh-rounds
    statement: >-
      On Random permutation at 512 keys shearsort takes 253 rounds on its 23 × 23 mesh: six row phases and five column phases of 23 odd-even transposition steps each, (P + 1)c + P·r for P = ⌈lg 23⌉ = 5.
    readout: Rounds
    expect: { value: 253 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Sort a two-dimensional mesh into snake order by alternating phases: sort every row (even rows ascending, odd rows descending), then sort every column top to bottom, and finish with one more row phase.

The analysis uses the zero-one principle and the idea of clean and dirty rows: a row of only zeros or only ones is clean, and each pair of row and column phases roughly halves the dirty rows, so a logarithmic number of phases suffices. On a square mesh of n processors each phase takes on the order of √n steps, giving a parallel time on the order of √n log n, a logarithmic factor above the √n lower bound for mesh sorting.

The plate lays the mesh out boustrophedon, so the snake order is simply the order of the array, and sorts each row and column by odd-even transposition, the mesh's own local operation. It runs every processor's steps one after another and counts the total work; the n^1.5 log n line is that sequential total, derived from the phase lengths and the cost of odd-even transposition rather than taken from a source. Start with Random permutation at n = 64, an 8 × 8 mesh, and watch the rows shear into order.

It suits hardware with mesh topology, systolic arrays and VLSI circuits, where a processor talks only to its neighbours and the regular schedule is easy to build. In one thread or on shared memory an n log n sort is far cheaper. Like every comparator network it is in place and not stable.
