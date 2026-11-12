---
id: two-way-insertion-sort
title: Two-way insertion sort
taxonomy: sorting/elementary
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - insertion-sort
  objectives:
  - 'Watch the run spread from the middle of the auxiliary strip in both directions, each key shifting the shorter side.'
  - 'Count n auxiliary writes on Already sorted and on Reversed, where every key lands at an end of the run without a shift.'
  - 'Count exactly n array writes on every input, the copy back from the output area.'
  misconceptions:
  - 'Growing in both directions changes the growth of the shifts; it saves a constant factor, and they stay quadratic.'
algorithm:
  paradigm: incremental
  properties:
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons, array writes and auxiliary writes (a shift in the output area is one auxiliary write)'
  best: 'n auxiliary writes (Already sorted, Reversed), and never fewer than Σ_{i=1}^{n−1} ⌊lg i⌋ comparisons'
  average: 'on every input, exactly n array writes'
  worst: 'Σ_{i=1}^{n−1} (⌊lg i⌋ + 1) comparisons (Reversed), and O(n²) auxiliary writes'
---

Insertion sort into an output area about twice the size of the input: the first key goes in the middle, and the sorted run grows in both directions, each new key opening its slot by shifting whichever side of the run is shorter.

Straight insertion only grows to the right, so a small key has to push every larger key along. Here a key smaller than the current minimum or larger than the current maximum lands at an end of the run without a single shift. Start with Random permutation at n = 64 and watch the run spread out from the middle of the auxiliary strip, then try Reversed, where every key is a new minimum and nothing moves.

The saving is a constant factor in the moves, never in the growth: the average and worst numbers of shifts stay quadratic, and the comparisons are those of the position search, sequential or binary. Knuth presents it among the refinements of straight insertion, next to binary insertion and list insertion; no author or date of a first publication is known, and there is no separate peer-reviewed analysis.

Shifting never reorders equal keys, so stability depends only on where a key equal to one already placed is inserted; the formulation decides, which is why the entry does not claim it. The idea of leaving free room in the output is taken to its conclusion by library sort, which scatters gaps between all the keys.
