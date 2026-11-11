---
id: bottom-up-heapsort
title: Bottom-up heapsort
taxonomy: sorting/priority-queues
status: planned
engine: array
labs:
  - sorting
sources:
  - id: wegener-1993
    ref: the original description and its comparison bounds
  - id: williams-1964
    ref: classical heapsort
  - id: cormen-2022
    ref: "Chapter 6: Heapsort"
  - id: edelkamp-2000
    ref: comparison with weak-heapsort
tags:
  - sorting
  - heap
  - priority queue
  - in-place
complexity: n log n in every case; extra space 1
related:
  - binary-heap
  - heapsort
---

Heapsort with a cheaper sift-down: after the root is exchanged with the last key, walk down the path of larger children to a leaf with one comparison per level, then climb back up to find where the displaced key belongs.

Classical heapsort spends two comparisons on every level: the two children against each other, then the larger child against the key being sifted. But the key that arrives at the root comes from the end of the array and is usually small, so it ends up near the leaves anyway. Wegener's variant defers that second comparison to a short climb back up the remembered path; the resulting heap is exactly the one classical sift-down would build.

Wegener proved at most 1.5 n log n + O(n) comparisons in the worst case, against roughly 2 n log n for classical heapsort, and his paper's title states its claim: on average it beats quicksort in comparisons once n is not very small. Run Random permutation at n = 256 in the sorting lab next to heapsort and compare the comparison counters, not only the finishing order.

It pays where comparisons are expensive, such as long strings or composite keys compared through a user function; with cheap integer keys memory traffic dominates and both versions behave alike. It keeps heapsort's other properties: in place, not stable, and not adaptive, so Already sorted brings no speed-up. Weak-heapsort takes the saving of comparisons further at the price of one extra bit per key.
