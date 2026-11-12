---
id: external-quicksort
title: External quicksort
taxonomy: sorting/external
status: live
engine: array
labs:
  - sorting
sources:
  - id: vitter-2008
    ref: distribution sorts and their pass counts
  - id: aggarwal-1988
    ref: the I/O model and its bound
  - id: cormen-2022
    ref: "Chapter 7: Quicksort"
  - id: vitter-1994
    ref: distribution over parallel disks
tags:
  - sorting
  - external sorting
  - partitioning
  - quicksort
complexity: n log n comparisons on average, n² worst; about log₂(N/M) passes; extra space n
related:
  - external-merge-sort
  - quicksort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [quicksort, external-merge-sort]
  objectives:
  - 'Read the Phase readout at 512 keys: every partition of a part larger than M = 23 keys, then the internal sorts of the parts that fit in memory.'
  - 'Compare Already sorted with Random permutation at 512 keys: 10,721 comparisons against 5,722.'
  - 'Explain why a partition writes every key of its part exactly once, the middle group included.'
  misconceptions:
  - 'Presorted input is easy for external quicksort; on Already sorted every key lies between the middle group''s ends and is inserted into it by binary search, 10,721 comparisons at 512 keys, nearly twice Random''s 5,722.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: false
bounds:
  model: 'comparisons (against the middle group''s ends, binary insertion into it, and the memory sorts), array writes (each partition writes every key of its part once; an internal sort writes its part) and auxiliary writes (memory and the middle group); memory M = max(4, ⌈√n⌉)'
  average: 'every partition is of a part larger than M and writes each of its keys once, without an exchange; at 512 keys 5,722 comparisons on Random and 10,721 on Already sorted, more than 1.5 times Random''s at every size tested from 64 keys; n log n on average and n² worst are the published bounds of the method with M fixed'
claims:
  - id: sorted-input-costs-more
    statement: >-
      On Already sorted at 512 keys external quicksort makes 10,721 comparisons, nearly twice the 5,722 of Random permutation: every key falls between the ends of the middle group and is inserted into it by binary search.
    readout: Comparisons
    expect: { value: 10721 }
    setup:
      params: { shape: sorted, n: 512, speed: 2000 }
---

Hoare's partitioning carried over to files: one sequential pass splits the file around a pivot into smaller and larger parts, and each part is split again until it fits in memory and is sorted there.

Comparisons behave as in quicksort, n log n on average and n² with persistently bad pivots, but on disk the passes are what costs. A single pivot splits into at most two parts, so even perfect pivots need about log₂(N/M) levels, each a full pass over the data. A distribution sort that splits into a number of parts growing with M/B needs only log_{M/B}(N/B) passes; with room for a thousand blocks that logarithm is about ten times smaller.

The plate partitions the array with a small memory holding the middle group, shown in the auxiliary strip, and counts element operations; passes are the model in these notes. Start with Random permutation at n = 256 and count the levels of splitting before every part fits in memory: on disk each unbalanced level is another expensive pass, not just more comparisons.

No single original paper, author or year can be documented; in the external-memory literature it serves as the baseline that multiway distribution improves on. It makes sense when memory holds only a few blocks, and as a lesson in why two-way splitting wastes the memory that could hold many output buffers. It is neither stable nor in place on disk.
