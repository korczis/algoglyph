---
id: parallel-quicksort
title: Quicksort, parallel
taxonomy: sorting/parallel
status: live
engine: array
labs:
  - sorting
sources:
  - id: sanders-2019
    ref: "Chapter 5: Sorting and Selection"
  - id: cormen-2022
    ref: "Chapter 7: Quicksort"
tags:
  - sorting
  - parallel
  - in-place
  - quicksort
complexity: n log n best, n log n average, n² worst; extra space log n
related:
  - parallel-merge-sort
  - parallel-samplesort
  - quicksort
  - randomized-quicksort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [quicksort-three-way]
  objectives:
  - 'Read the Rounds readout at 512 keys on Random permutation: 12, one per level of the recursion, and the Lanes readout: 20, the most segments partitioned in one round.'
  - 'Run Few distinct keys at 512 keys: at most 4 rounds, since a three-way partition finishes every key equal to its pivot.'
  - 'Count one partition: every key of its segment compared with the pivot exactly once.'
  misconceptions:
  - 'Parallel quicksort uses a fixed number of processors; the plate gives every segment of a level its own lane, so the lanes grow with the recursion, 20 at 512 keys, and the rounds are the recursion''s depth.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons (one per key and partition, insertion sorts of segments of at most 16), array writes (exchanges, two each), rounds (levels of the recursion) and lanes (segments of a round)'
  average: 'on every input as many rounds as levels of the recursion and no more than its distinct keys, one round up to 16 keys, at most 4 on Few distinct keys; as many lanes as the largest round''s segments; each partition compares every key of its segment once; n log n average and n² worst are quicksort''s'
claims:
  - id: few-keys-few-rounds
    statement: >-
      On Few distinct keys at 512 keys parallel quicksort takes 4 rounds, against 12 on Random permutation: each three-way partition finishes the keys equal to its pivot, so a segment's children hold one key value fewer than it does.
    readout: Rounds
    expect: { value: 4 }
    setup:
      params: { shape: few-unique, n: 512 }
---

Quicksort with the partitioning shared among workers. In the formulations of the sources the group agrees on a random pivot, every worker partitions its own share, the counts of the two sides decide how many workers take each side, and both subgroups recurse; the plate's kernel hands every segment of a recursion level to a lane of its own and partitions it there in three ways around a random pivot, so the lanes multiply as the segments shrink.

Launching only the recursive calls in parallel leaves the first partition of the whole array sequential, which caps the speed-up. Partitioning in parallel is easier than merging, but it raises a load-balancing question: the pivot never splits exactly in half, so the workers must be divided between the sides in proportion. A group of one finishes with sequential quicksort.

The plate runs the workers' steps one after another and counts total work: order n log n comparisons on average and n² with persistently bad pivots, as for sequential quicksort. Start with Random permutation at n = 128, then try Few distinct keys: the three-way partition finishes every key equal to its pivot, so the recursion stops after at most four rounds. In the distributed version the recursion depth is of order log p with high probability, and the time is of order (n/p) log n + log² p, the second term coming from the broadcasts and prefix sums at every level.

The weak spot is balance: rounding the number of workers compounds over the levels, so small groups are better served by a pivot chosen from a large sample or by switching to samplesort, which is quicksort with p − 1 pivots at once. It is not stable; the shared-memory version works almost in place with a recursion stack, and on many distributed processors samplesort, which exchanges the data only once, is usually faster.
