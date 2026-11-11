---
id: bead-sort
title: Bead sort
taxonomy: sorting/special
status: planned
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
---

Represent every positive integer as a row of beads on the vertical poles of an abacus, let gravity pull the beads down, and read the rows back: their lengths are now in sorted order.

Falling never changes how many beads a pole carries, only which rows they sit in, so after the fall pole j holds exactly as many beads as there are keys of at least j, and each row is a solid run from the left. Those per-pole counts are cumulative frequencies, the same quantity counting sort computes; the lower strip shows the bead count on each pole as the rows drop one at a time.

Arulanandham, Calude and Dinneen put the time anywhere between constant and S, the sum of the keys, depending on the model of execution: in the idealised physical model all beads fall at once, while a simulation that moves beads one by one, as this plate does, pays for every bead. With keys 1..n that sum grows like n², so start with Random permutation at n = 64 and watch the work counter against counting sort's.

It sorts numbers, not records: a bead does not remember its row. The kernel re-attaches equal keys in input order afterwards, bookkeeping outside the method, and there are no comparisons at all. Its value is didactic, a sort that needs no comparisons and whose cost is decided by the machine model; for real data counting sort does the same with counts instead of beads.
