---
id: ps4o
title: Parallel super scalar samplesort (PS⁴o)
taxonomy: sorting/parallel
status: live
engine: array
labs:
  - sorting
sources:
  - id: sanders-2004
    ref: the original super scalar samplesort
  - id: axtmann-2022
    ref: the PS⁴o reimplementation and its properties
  - id: axtmann-2020
    ref: reference implementation
  - id: sanders-2019
    ref: "Chapter 5: Sorting and Selection"
tags:
  - sorting
  - parallel
  - stable
  - samplesort
  - branchless
complexity: n log n expected in every case; extra space n
related:
  - ips4o
  - parallel-samplesort
  - samplesort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [samplesort]
  objectives:
  - 'Read the Rounds readout at 512 keys: 16, two per bucketing, classification into the oracle and distribution into the temporary array.'
  - 'Count the comparisons of one classification: 3 steps down the splitter tree and at most one equality test, between 3n and 4n at the first level.'
  - 'Read the Lanes readout: 4 at every size above 32 keys.'
  misconceptions:
  - 'The distribution must compare a key again to find its bucket; the oracle stores each key''s bucket, so the distribution makes no comparison at all.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons (sample insertion sort, classification, insertion sorts of buckets of at most 32), array writes (each bucketing writes its part back), auxiliary writes (splitters and the temporary array), rounds and lanes'
  average: 'up to 32 keys insertion sort alone; above, 2 rounds of 4 lanes per bucketing, between 3 and 4 comparisons per key in the classification of the whole input and none in any distribution; n log n expected is the authors'' bound'
claims:
  - id: eight-bucketings
    statement: >-
      On Random permutation at 512 keys PS⁴o takes 16 rounds: eight bucketings, the whole input and the parts larger than 32 keys below it, each a classification into the oracle and a distribution.
    readout: Rounds
    expect: { value: 16 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Samplesort with a branchless classifier: the splitters sit in an implicit search tree in an array, each element walks it by arithmetic on comparison results, and its bucket number is stored in an oracle before the elements are copied out to their buckets.

Partitioning takes two passes. The first computes and stores every element's bucket and counts the bucket sizes; the second copies each element, in input order, to the position its bucket's prefix sum gives. Walking the tree is i = 2i + [e > t[i]] repeated log k times, so the processor never has to predict a branch and can work on several elements at once. Copying in input order keeps equal keys in their order within a bucket.

The plate runs the workers' steps one after another and counts total work, not parallel time. Start with Random permutation at n = 256: the auxiliary strip receives the elements bucket by bucket, and the recursion then sorts each bucket. With a large enough random sample the buckets are balanced with high probability, so the expected work is of order n log n comparisons.

The extra memory is linear: the oracle and the target array. PS⁴o reimplements super scalar samplesort (Sanders and Winkel, 2004) inside the IPS⁴o framework (Axtmann and colleagues, 2022), sharing its tree, base case and parameters; its authors list it as the stable member of the family and recommend the in-place IPS⁴o when stability is not needed, which they report as considerably faster.
