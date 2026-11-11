---
id: two-way-insertion-sort
title: Two-way insertion sort
taxonomy: sorting/elementary
status: planned
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.2.1 Sorting by insertion"
  - id: bender-2006
    ref: gapped insertion, the idea carried further
tags:
  - sorting
  - insertion
  - quadratic
  - adaptive
  - online
complexity: n best, n² average and worst; extra space n
related:
  - binary-insertion-sort
  - insertion-sort
---

Insertion sort into an output area about twice the size of the input: the first key goes in the middle, and the sorted run grows in both directions, each new key opening its slot by shifting whichever side of the run is shorter.

Straight insertion only grows to the right, so a small key has to push every larger key along. Here a key smaller than the current minimum or larger than the current maximum lands at an end of the run without a single shift. Start with Random permutation at n = 64 and watch the run spread out from the middle of the auxiliary strip, then try Reversed, where every key is a new minimum and nothing moves.

The saving is a constant factor in the moves, never in the growth: the average and worst numbers of shifts stay quadratic, and the comparisons are those of the position search, sequential or binary. Knuth presents it among the refinements of straight insertion, next to binary insertion and list insertion; no author or date of a first publication is known, and there is no separate peer-reviewed analysis.

Shifting never reorders equal keys, so stability depends only on where a key equal to one already placed is inserted; the formulation decides, which is why the entry does not claim it. The idea of leaving free room in the output is taken to its conclusion by library sort, which scatters gaps between all the keys.
