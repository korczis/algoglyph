---
id: address-calculation-sort
title: Address calculation sort
taxonomy: sorting/distribution
status: planned
engine: array
labs:
  - sorting
sources:
  - id: isaac-1956
    ref: the original description
  - id: flores-1960
    ref: analysis of the machine time
  - id: knuth-taocp-3
    ref: "5.2.1 Sorting by insertion"
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
tags:
  - sorting
  - distribution
  - buckets
  - history
complexity: n on uniformly spread keys with a table to spare, n² worst; extra space n
related:
  - bucket-sort
  - insertion-sort
  - interpolation-sort
  - library-sort
  - proxmap-sort
---

Compute from each key its expected address in a table larger than the input and store it there; when the address is taken, shift neighbours towards the nearest empty cell so the occupied cells stay in key order; finally read the table out, skipping the gaps.

Isaac and Singleton published it in 1956, and Cormen and colleagues date bucket sorting from that paper. The address function is monotone, so keys land roughly in order and only collisions need comparisons and moves; the lower strip is the table, here twice as large as the input, filling in key order.

The cost is the length of the runs of occupied cells. With uniformly spread keys and room to spare the runs are short and the average time linear, which Flores analysed in detail as a function of table size in 1960; when keys cluster, one long run forms and each insertion shifts on the order of n keys, the quadratic case of insertion sort. Random permutation at n = 128 shows few collisions.

Today it matters mostly as the ancestor of bucket, interpolation and proxmap sorts, which precompute bucket sizes and so avoid the shifting. Leaving gaps for later insertions is also the idea behind library sort. The kernel places an equal key after those already stored, which keeps it stable, but that is a choice of the implementation, not of the method.
