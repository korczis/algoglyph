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
---

Sort a two-dimensional mesh into snake order by alternating phases: sort every row (even rows ascending, odd rows descending), then sort every column top to bottom, and finish with one more row phase.

The analysis uses the zero-one principle and the idea of clean and dirty rows: a row of only zeros or only ones is clean, and each pair of row and column phases roughly halves the dirty rows, so a logarithmic number of phases suffices. On a square mesh of n processors each phase takes on the order of √n steps, giving a parallel time on the order of √n log n, a logarithmic factor above the √n lower bound for mesh sorting.

The plate lays the mesh out boustrophedon, so the snake order is simply the order of the array, and sorts each row and column by odd-even transposition, the mesh's own local operation. It runs every processor's steps one after another and counts the total work; the n^1.5 log n line is that sequential total, derived from the phase lengths and the cost of odd-even transposition rather than taken from a source. Start with Random permutation at n = 64, an 8 × 8 mesh, and watch the rows shear into order.

It suits hardware with mesh topology, systolic arrays and VLSI circuits, where a processor talks only to its neighbours and the regular schedule is easy to build. In one thread or on shared memory an n log n sort is far cheaper. Like every comparator network it is in place and not stable.
