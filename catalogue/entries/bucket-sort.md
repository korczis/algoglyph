---
id: bucket-sort
title: Bucket sort
taxonomy: sorting/distribution
status: live
engine: array
labs:
  - sorting
sources:
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
  - id: isaac-1956
    ref: the original address-calculation idea
  - id: knuth-taocp-3
    ref: "5.2.5 Sorting by distribution"
tags:
  - sorting
  - distribution
  - buckets
  - insertion sort
complexity: n + k best and average, n² worst; extra space n + k
related:
  - counting-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites: [insertion-sort]
  objectives:
  - 'Run Random permutation at 512 keys: no comparison at all, since a permutation of 1..n puts one key into each of the n buckets.'
  - 'Run Few distinct keys at 512 keys: four buckets of equal keys, m − 1 comparisons each and no move, n − 4 = 508 in all.'
  - 'Explain why every plate input stays linear, n − d comparisons for d distinct keys, and which input would make it quadratic: keys that crowd one bucket without being equal.'
  misconceptions:
  - 'Bucket sort slows down when many keys are equal; equal keys share a bucket that insertion sort leaves as it is, so Few distinct keys at 512 keys costs 508 comparisons.'
algorithm:
  properties:
    in_place: false
bounds:
  model: 'comparisons (the insertion sorts inside the buckets), array writes (the concatenated buckets, one per key) and auxiliary writes (the bucket strip, one per key)'
  average: 'when the keys span at most n values, as on every plate input: n − d comparisons for d distinct keys, n array writes and n auxiliary writes, and none of them when all keys are equal'
claims:
  - id: equal-keys-share-a-bucket
    statement: >-
      On Few distinct keys at 512 keys bucket sort makes n − 4 = 508 comparisons: the four key values fill four buckets of equal keys, and each insertion sort of m equal keys costs m − 1 and moves nothing.
    readout: Comparisons
    expect: { value: 508 }
    setup:
      params: { shape: few-unique, n: 512, speed: 2000 }
---

Divide the key range into n equal intervals, drop every key into the bucket of its interval, sort each bucket by insertion, and concatenate the buckets in order.

The order between buckets is decided by arithmetic on the key, not by comparisons; comparisons happen only inside a bucket. The lower strip shows the buckets side by side in bucket order, so the picture is already almost sorted before the first insertion runs.

The expected linear time rests on an assumption about the data: when keys are spread uniformly, each bucket holds a constant number of keys on average and the insertion sorts add up to linear work. If every key falls into one bucket, the method degenerates into insertion sort and goes quadratic. Start with Random permutation at n = 128: a permutation of 1..n is the uniform case, one key per bucket, and the comparison counter stays at zero.

Few distinct keys crowds the keys into a handful of buckets, but the keys inside each bucket are equal and insertion sort leaves them where they are, so the plate's inputs never reach the quadratic case; that needs keys that cluster without being equal. Knuth files the method under sorting by distribution, and Isaac and Singleton's address calculation of 1956 is where the idea starts; counting sort is the limit with one bucket per key value.
