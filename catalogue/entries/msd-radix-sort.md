---
id: msd-radix-sort
title: MSD radix sort
taxonomy: sorting/radix
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - radix
  - non-comparison
  - digits
  - recursive
complexity: about n log_R n digit examinations
related:
  - lsd-radix-sort
  - three-way-radix-quicksort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [lsd-radix-sort]
  objectives:
  - 'Compare Random permutation at 512 keys with LSD radix sort: 2,556 array writes against 2,560, because only key 512 is alone in its bin after the first digit and skips the four levels below.'
  - 'Watch the bands: a bin is sorted on the next digit only while it holds two keys or more.'
  - 'Explain why MSD radix sort never writes more than LSD''s d·n, and why on a permutation of 1..n it saves almost nothing: nearly every bin is full.'
  misconceptions:
  - 'MSD radix sort examines far fewer digits than LSD radix sort on any input; on a permutation of 1..512 it writes 2,556 times against LSD''s 2,560.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
    comparison_based: false
bounds:
  model: 'array writes and auxiliary writes (each bin is distributed into the auxiliary row and copied back); no comparison'
  average: 'on every input array writes = auxiliary writes = Σ over the d base-4 digit levels of the keys whose bin at that level holds two keys or more, at most d·n, LSD radix sort''s count'
claims:
  - id: lone-key-skips-levels
    statement: >-
      On Random permutation at 512 keys MSD radix sort makes 2,556 array writes, four fewer than LSD radix sort's d·n = 2,560: key 512 is alone in its bin after the first of the five digits.
    readout: Array writes
    expect: { value: 2556 }
    setup:
      params: { shape: random, n: 512 }
---

Distribute by the leading base-4 digit, then sort each bin on the next digit, recursively.

The bands are the bins: four at the top level, each splitting into four. Small bins are where MSD wastes effort, which is why practical versions cut over to insertion sort.
