---
id: bead-sort
title: Bead sort
taxonomy: sorting/special
status: live
engine: array
labs:
  - sorting
sources:
  - id: arulanandham-2002
    ref: the original description
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
tags:
  - sorting
  - special-purpose
  - non-comparison
  - natural computing
  - gravity
complexity: S bead moves for keys summing to S when simulated sequentially; extra space n·m for n keys up to m
related:
  - counting-sort
  - pigeonhole-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites: [counting-sort]
  objectives:
  - 'Read Comparisons on any input: 0. The order comes from the heights of the poles, never from comparing two keys.'
  - 'Run Random permutation at 64 keys: 855 auxiliary writes, the pole heights redrawn after every fourth row, while the kernel moves 2,016 beads, the sum of key − min.'
  - 'Run Few distinct keys: keys 1 to 4 need three poles, so the auxiliary writes stay at most 3⌈n/4⌉.'
  misconceptions:
  - 'A sort without comparisons costs nothing per key; on Random permutation at 64 keys the pole heights it draws change 855 times, against 64 array writes, and the work grows with the size of the keys, not with their number.'
algorithm:
  paradigm: simulation
  properties:
    in_place: false
    comparison_based: false
bounds:
  model: 'array writes (each row read back), auxiliary writes (the pole heights, drawn after every fourth row); no comparisons'
  best: 'no auxiliary write when all keys are equal'
  average: 'no comparison, n array writes and 2 phases on every input'
  worst: 'at most ⌈n/4⌉(max − min) auxiliary writes; the beads moved, Σ (key − min), are the source''s cost S, between constant and S by the model of execution (Arulanandham, Calude and Dinneen), and grow like n² for keys 1..n'
  space: 'max − min poles'
claims:
  - id: no-comparison
    statement: >-
      On Random permutation at 64 keys bead sort makes no comparison at all: the poles' heights order the keys.
    readout: Comparisons
    expect: { value: 0 }
    setup:
      params: { shape: random, n: 64 }
---

Represent every positive integer as a row of beads on the vertical poles of an abacus, let gravity pull the beads down, and read the rows back: their lengths are now in sorted order.

Falling never changes how many beads a pole carries, only which rows they sit in, so after the fall pole j holds exactly as many beads as there are keys of at least j, and each row is a solid run from the left. Those per-pole counts are cumulative frequencies, the same quantity counting sort computes; the lower strip shows the bead count on each pole, redrawn after every fourth row as the rows drop.

Arulanandham, Calude and Dinneen put the time anywhere between constant and S, the sum of the keys, depending on the model of execution: in the idealised physical model all beads fall at once, while a simulation that moves beads one by one, as this plate's kernel does, pays for every bead. The plate's readouts count only the pole heights it draws: on Random permutation at 64 keys 855 auxiliary writes for 2,016 beads. With keys 1..n that sum grows like n², so start with Random permutation at n = 64 and watch the work counter against counting sort's.

It sorts numbers, not records: a bead does not remember its row. The kernel re-attaches equal keys in input order afterwards, bookkeeping outside the method, and there are no comparisons at all. Its value is didactic, a sort that needs no comparisons and whose cost is decided by the machine model; for real data counting sort does the same with counts instead of beads.
