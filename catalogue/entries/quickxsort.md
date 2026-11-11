---
id: quickxsort
title: QuickXsort
taxonomy: sorting/hybrid
status: planned
engine: array
labs:
  - sorting
sources:
  - id: edelkamp-2014
    ref: the original scheme and its comparison counts
  - id: edelkamp-2020
    ref: transfer theorems and refined bounds
  - id: hoare-1962
    ref: the partitioning step
tags:
  - sorting
  - hybrid
  - in-place
  - comparison-efficient
complexity: n log n best, n log n average, n² worst; extra space log n
related:
  - heapsort
  - introsort
  - mergesort-top-down
  - quicksort
  - weak-heapsort
---

Partition as in quicksort, sort one side with a method X that normally needs extra memory, and let the other side serve as that memory; then repeat on the side that was used as scratch space.

The trick is that X never copies: every move it makes is an exchange with a key of the scratch side, so no key is lost and the scratch side simply comes back shuffled. That is how QuickMergesort, QuickHeapsort and QuickWeakHeapsort turn sorts that need a buffer into sorts that work in place.

The scheme exists to save comparisons. Edelkamp and Weiß show that QuickMergesort and QuickWeakHeapsort need about n log n − 1.26n + o(n) comparisons on average, and that using merge insertion for small subproblems brings QuickMergesort down to n log n − 1.399n + o(n). With Wild they prove that, when the pivot is the median of a growing sample, QuickXsort's average differs from X's own only by o(n).

Start with Random permutation at n = 128 and read the comparison counter against mergesort's and quicksort's in the lab: the sorted side grows in place, with the other half of the array standing in for mergesort's buffer. The method is not stable; it pays off where comparisons are expensive and memory is not available.
