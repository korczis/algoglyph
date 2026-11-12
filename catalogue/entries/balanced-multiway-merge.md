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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [mergesort-bottom-up, replacement-selection]
  objectives:
  - 'Run the defaults (240 records, M = 8, P = 3): 30 runs after distribution, then 10, 4, 2 and 1, so 4 merge passes.'
  - 'Read Records written at the end: N(1 + passes) = 1,200, the distribution and every pass writing every record once.'
  - 'Raise P to 6 and predict the passes from ⌈log_P ⌈N/M⌉⌉ before the plate shows them.'
  misconceptions:
  - 'More memory helps only the in-memory sorts; M sets the number of initial runs, ⌈N/M⌉, and with it the number of passes, the cost that matters on tape.'
algorithm:
  paradigm: divide-and-conquer
bounds:
  model: 'Runs on the tapes, Merge passes done and Records written (one per record moved to a tape); Key comparisons include the in-memory sorts of the distribution'
  average: 'on every input of N records ⌈log_P ⌈N/M⌉⌉ merge passes, each leaving ⌈r/P⌉ runs of r, and exactly N(1 + passes) records written'
claims:
  - id: four-passes-at-defaults
    statement: >-
      At the plate's defaults, 240 records, memory M = 8 and P = 3 ways, the balanced merge needs 4 merge passes: 30 initial runs fall to 10, 4, 2 and 1, ⌈log₃ 30⌉ = 4.
    readout: Merge passes done
    expect: { value: 4 }
    setup:
      params: { records: 240, memory: 8, ways: 3 }
---

Sort runs that fit in memory, distribute them over tapes, and merge them in passes.

External sorting, for files too large for memory. Distribution reads M records at a time, sorts them in memory and writes each sorted run to the next of P tapes in turn. Each merge pass takes one run from every input tape, merges them into one run up to P times longer on an output tape, cycles through the P output tapes, and then input and output tapes swap roles.

With N records the distribution makes ⌈N/M⌉ runs and each pass divides the run count by P, rounding up, so the file is one run after ⌈log_P ⌈N/M⌉⌉ passes. The chart plots the runs left after each pass on a log scale, where the fall by a factor of P per pass is close to a straight line.

The merge picks the smallest of the front records with a binary heap holding one entry per input tape, so a record costs O(log P) comparisons. The readouts count them, together with the comparisons of the in-memory sorts during distribution.
