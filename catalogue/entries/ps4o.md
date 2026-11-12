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
---

Samplesort with a branchless classifier: the splitters sit in an implicit search tree in an array, each element walks it by arithmetic on comparison results, and its bucket number is stored in an oracle before the elements are copied out to their buckets.

Partitioning takes two passes. The first computes and stores every element's bucket and counts the bucket sizes; the second copies each element, in input order, to the position its bucket's prefix sum gives. Walking the tree is i = 2i + [e > t[i]] repeated log k times, so the processor never has to predict a branch and can work on several elements at once. Copying in input order keeps equal keys in their order within a bucket.

The plate runs the workers' steps one after another and counts total work, not parallel time. Start with Random permutation at n = 256: the auxiliary strip receives the elements bucket by bucket, and the recursion then sorts each bucket. With a large enough random sample the buckets are balanced with high probability, so the expected work is of order n log n comparisons.

The extra memory is linear: the oracle and the target array. PS⁴o reimplements super scalar samplesort (Sanders and Winkel, 2004) inside the IPS⁴o framework (Axtmann and colleagues, 2022), sharing its tree, base case and parameters; its authors list it as the stable member of the family and recommend the in-place IPS⁴o when stability is not needed, which they report as considerably faster.
