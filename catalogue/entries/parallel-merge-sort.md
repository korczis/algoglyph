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
---

Mergesort with the merging itself split among workers: every worker sorts its share, then pairs of runs are merged in rounds, each merge cut into equal output pieces whose start points a binary search finds in both inputs at once.

Running only the recursive calls in parallel is not enough: the final merge of two halves would still take order n steps on one processor, capping the speed-up near log n. The fix is to find, for a given k, where the k smallest elements of the union end in each input; cutting the output into equal pieces that way gives each worker an independent merge.

The plate runs the workers' steps one after another and counts the total work, which is order n log n in every case, the same as sequential mergesort. Start with Random permutation at n = 128 and watch the sorted blocks double in length round by round. On shared memory the parallel time of this scheme is of order (n log n)/p + log² n with p processors; Cole's far more intricate algorithm sorts in order log n time on an n-processor PRAM, and remains mainly a theoretical result.

Extra space is linear, as in sequential mergesort. It is stable when ties go to the left run and the output cuts treat equal keys consistently, which is why it counts as stable only as a variant. It moves the data logarithmically many times; on distributed machines multiway merging or samplesort, which move the data once, are usually better.
