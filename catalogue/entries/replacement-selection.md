---
id: replacement-selection
title: Replacement selection
taxonomy: sorting/external
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - external sorting
  - priority queue
  - runs
complexity: lg M compares per key; runs of expected length 2M on random input
related:
  - binary-heap
  - balanced-multiway-merge
---

A priority queue that produces initial runs about twice the size of memory.

Each heap value packs a run number above the key, so the minimum is the smallest key of the current run, and keys held back for the next run sort after all of them. Heap cells and nodes are coloured by run; the output strip shows the runs as they are written, separated by gaps.

Every run except the last holds at least M keys, because a run ends only when all M keys in memory belong to the next one; on random input the expected length is 2M, which the test harness measures. Ascending input comes out as a single run, and descending input as runs of exactly M.
