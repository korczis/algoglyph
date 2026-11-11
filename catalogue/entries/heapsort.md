---
id: heapsort
title: Heapsort
taxonomy: sorting/priority-queues
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - heap
  - priority queue
  - in-place
complexity: 2 n lg n compares worst case, in place
related:
  - binary-heap
---

Build a max-heap bottom-up, then repeatedly exchange the maximum to the end and restore the heap.

The first phase leaves a rough slope, largest keys towards the left; the second phase peels the maximum off the root and sinks the key that replaced it.

It never needs extra memory and never goes quadratic, but its long jumps across the array are why quicksort usually beats it in practice.
