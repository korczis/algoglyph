---
id: flashsort
title: Flashsort
taxonomy: sorting/distribution
status: planned
engine: array
labs:
  - sorting
sources:
  - id: neubert-1998
    ref: the original description and measurements
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
tags:
  - sorting
  - distribution
  - buckets
  - in-place
  - interpolation
complexity: n on uniformly spread keys, n² worst; extra space m class counters
related:
  - american-flag-sort
  - bucket-sort
  - insertion-sort
---

Classify every key into one of m classes by linear interpolation between the minimum and the maximum, count the classes, permute the keys into their classes in place by following cycles, and finish the nearly sorted result with insertion sort.

Neubert's three steps divide the work by distance: classification and the cycle-leader permutation move keys a long way with no comparisons between them, and the final insertion sort does the short-range tidying. Unlike classic bucket sort it needs no bucket storage of size n, only the vector of class counters; the kernel uses m of about 0.42 n, inside the broad optimum Neubert measured between 0.2 n and 0.5 n.

Start with Random permutation at n = 256: the classes come out in a few long cycles and the insertion pass that follows is short. On uniformly spread keys every step is linear, and Neubert notes that the running time does not depend on the initial order, which Already sorted and Reversed make visible.

There is no protection against a bad distribution: when keys pile into one class, the final insertion sort does all the work and the time goes quadratic, as with an overfull bucket. The cycles do not keep equal keys in order, so flashsort is not stable.
