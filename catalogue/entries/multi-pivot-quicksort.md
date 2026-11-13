---
id: multi-pivot-quicksort
title: Quicksort, multi-pivot
taxonomy: sorting/quicksort
status: live
engine: array
labs:
  - sorting
sources:
  - id: kushagra-2014
    ref: the three-pivot algorithm and its cache analysis
  - id: aumuller-2016
    ref: comparison-optimal multi-pivot partitioning
  - id: aumuller-2015
    ref: the dual-pivot lower bound
tags:
  - sorting
  - quicksort
  - partitioning
  - in-place
  - multiple pivots
complexity: n log n best, n log n average, n² worst; extra space log n
related:
  - proportion-extend-sort
  - quicksort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [dual-pivot-quicksort]
  objectives:
  - 'Classify a key with two comparisons, first against the middle pivot and then against an outer one, and name the part it joins.'
  - 'Compare the comparisons and the Array writes with dual-pivot quicksort on Random permutation at 256 keys.'
  - 'Explain why three pivots that are the three smallest keys of every subarray cost ⌊(n² − 1)/3⌋ comparisons.'
  misconceptions:
  - 'More pivots remove the quadratic worst case; with the three pivots the smallest keys of every subarray it costs ⌊(n² − 1)/3⌋ comparisons.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (an exchange is two writes)'
  worst: 'quadratic: ⌊(n² − 1)/3⌋ comparisons from 4 keys on, when the three pivots are the three smallest keys of every subarray'
claims:
  - id: no-auxiliary-write
    statement: >-
      On Reversed at 128 keys three-pivot quicksort makes no auxiliary write: every key moves by exchanges inside the array.
    readout: Auxiliary writes
    expect: { value: 0 }
    setup:
      params: { shape: reversed, n: 128 }
---

Choose k pivots, sort them, and partition the subarray into k + 1 parts by which pair of pivots each key falls between; this plate runs the three-pivot version, which splits into four parts in a single pass.

The kernel follows Kushagra, López-Ortiz, Qiao and Munro: four indices, two moving right and two moving left, and the quartile keys as pivots. With three pivots a key is classified with two comparisons, first against the middle pivot and then against one of the outer ones. Their argument for the scheme is not fewer comparisons but fewer cache misses than one- or two-pivot partitioning.

The theory agrees with that reading. For comparison-optimal strategies, Aumüller, Dietzfelbinger and Klaue found the gain from more pivots in comparisons to be marginal, and worse than simply taking the median of a sample as one pivot; counted by array accesses, three to five pivots do best, which matches the measured times, though the improvement over known algorithms is small.

Start with Random permutation at n = 256 and compare the reads and writes, not just the comparisons, with dual-pivot quicksort in the lab. The worst case remains quadratic and the partition is not stable. With very many pivots drawn from a large sample the method turns into samplesort.
