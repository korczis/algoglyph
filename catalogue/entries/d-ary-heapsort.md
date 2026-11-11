---
id: d-ary-heapsort
title: d-ary heapsort
taxonomy: sorting/priority-queues
status: planned
engine: array
labs:
  - sorting
sources:
  - id: johnson-1975
    ref: d-heaps as a priority queue
  - id: cormen-2022
    ref: "Chapter 6: Heapsort (d-ary heaps)"
  - id: williams-1964
    ref: binary heapsort, the case d = 2
  - id: edelkamp-2000
    ref: weak heaps, the opposite trade-off
tags:
  - sorting
  - heap
  - priority queue
  - in-place
complexity: n log n in every case; extra space 1
related:
  - binary-heap
  - bottom-up-heapsort
  - heapsort
  - weak-heapsort
---

Heapsort on a heap in which every node has up to d children: node i's children sit at d·i + 1 to d·i + d, the heap is only about log n / log d levels deep, and the two phases are heapsort's own.

A shallower heap is not free. Sifting a key down crosses fewer levels, but on each level it has to find the largest of up to d children, which costs d − 1 comparisons, and then compare that child with the key. Removing the maximum therefore costs on the order of d · log_d n, while inserting, which only climbs and compares with one parent per level, costs log_d n. For any fixed d the sort stays n log n on every input.

The kernel uses d = 3 by default. Start with Random permutation at n = 128 and run it beside heapsort in the sorting lab: the difference is a constant factor in comparisons and in how far apart the touched slots lie, not a different order of growth. Children of one node sit next to each other in the array, which is the usual argument for wider heaps on real hardware, but the sources do not quantify that gain; only a measurement can.

As a priority queue the d-ary heap earns more than as a sort, in graph algorithms where cheap insertions and key decreases outnumber removals. Bottom-up heapsort's trick, descending the path of largest children first and climbing back, carries over to d-ary heaps; weak-heapsort goes the other way and cuts the work to one comparison per level. It sorts in place and is neither stable nor adaptive.
