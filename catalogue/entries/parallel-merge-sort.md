---
id: parallel-merge-sort
title: Mergesort, parallel
taxonomy: sorting/parallel
status: live
engine: array
labs:
  - sorting
sources:
  - id: sanders-2019
    ref: "Chapter 5: Sorting and Selection"
  - id: cormen-2022
    ref: "Chapter 2: sequential mergesort"
  - id: cole-1988
    ref: logarithmic-time PRAM mergesort
  - id: green-2012
    ref: merge path on GPUs
tags:
  - sorting
  - parallel
  - merging
complexity: n log n in every case; extra space n
related:
  - batcher-merge-exchange
  - k-way-merge-sort
  - mergesort-top-down
  - psrs
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [mergesort-bottom-up]
  objectives:
  - 'Read the Rounds readout: 3 at every size the plate offers, a local sort of the four blocks and two rounds of pairwise merges, 1 + ⌈lg b⌉ for b blocks.'
  - 'Read the Lanes readout: 4, one per block in the local sort; the merge rounds use one lane per pair.'
  - 'Run Already sorted at 512 keys: 511 comparisons and no write, since every merge finds its halves already in order.'
  misconceptions:
  - 'Every merge of the plate is split among the workers; each pairwise merge here is done by one lane, so the last round runs one lane, and merge-path splitting is what the sources add.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons (local merge sorts and pairwise merges, each starting with one test whether its halves are in order), array writes and auxiliary writes (merges through a buffer), rounds and lanes'
  best: 'on Already sorted exactly n − 1 comparisons and no write'
  average: 'on every input of n ≥ 2 keys 1 + ⌈lg b⌉ rounds and b lanes for the b = ⌈n/⌈n/4⌉⌉ blocks, 3 rounds of 4 lanes at every size the plate offers; the (n log n)/p + log² n parallel time and Cole''s O(log n) are the sources'''
claims:
  - id: sorted-input
    statement: >-
      On Already sorted at 512 keys parallel merge sort makes 511 comparisons, n − 1, and no write: every block's merge sort and every pairwise merge finds its two halves already in order with one comparison.
    readout: Comparisons
    expect: { value: 511 }
    setup:
      params: { shape: sorted, n: 512 }
---

Mergesort in rounds: every worker sorts its share, then pairs of runs are merged, round after round, until one run is left. The parallel formulations of the sources also split each merge among the workers, cutting it into equal output pieces whose start points a binary search finds in both inputs at once; the plate gives every pairwise merge to one lane.

Running only the recursive calls in parallel is not enough: the final merge of two halves would still take order n steps on one processor, capping the speed-up near log n. The fix is to find, for a given k, where the k smallest elements of the union end in each input; cutting the output into equal pieces that way gives each worker an independent merge.

The plate runs the workers' steps one after another and counts the total work, which is order n log n in every case, the same as sequential mergesort. Start with Random permutation at n = 128 and watch the sorted blocks double in length round by round. On shared memory the parallel time of this scheme is of order (n log n)/p + log² n with p processors; Cole's far more intricate algorithm sorts in order log n time on an n-processor PRAM, and remains mainly a theoretical result.

Extra space is linear, as in sequential mergesort. It is stable when ties go to the left run and the output cuts treat equal keys consistently, which is why it counts as stable only as a variant. It moves the data logarithmically many times; on distributed machines multiway merging or samplesort, which move the data once, are usually better.
