---
id: balanced-multiway-merge
title: Balanced multiway merge
taxonomy: sorting/external
status: live
engine: custom
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - external sorting
  - merging
  - tapes
complexity: '⌈log_P ⌈N/M⌉⌉ merge passes, each reading and writing every record once with O(log P) comparisons per record'
related:
  - mergesort-bottom-up
  - replacement-selection
---

Sort runs that fit in memory, distribute them over tapes, and merge them in passes.

External sorting, for files too large for memory. Distribution reads M records at a time, sorts them in memory and writes each sorted run to the next of P tapes in turn. Each merge pass takes one run from every input tape, merges them into one run up to P times longer on an output tape, cycles through the P output tapes, and then input and output tapes swap roles.

With N records the distribution makes ⌈N/M⌉ runs and each pass divides the run count by P, rounding up, so the file is one run after ⌈log_P ⌈N/M⌉⌉ passes. The chart plots the runs left after each pass on a log scale, where the fall by a factor of P per pass is close to a straight line.

The merge picks the smallest of the front records with a binary heap holding one entry per input tape, so a record costs O(log P) comparisons. The readouts count them, together with the comparisons of the in-memory sorts during distribution.
