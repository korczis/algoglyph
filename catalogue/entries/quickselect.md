---
id: quickselect
title: Quickselect
taxonomy: sorting/selection
status: live
engine: array
labs: []
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - selection
  - partitioning
  - k-th smallest
  - linear time
complexity: linear on average
---

Partition, then continue only in the side that holds rank k.

The band halves on average each round and never returns to the other side, so the total work is about 2n to 3n comparisons, not n lg n.

When it stops, every key left of index k is no larger and every key right of it no smaller; the readout checks a[k] against the sorted input.
