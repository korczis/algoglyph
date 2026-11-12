---
id: binary-heap
title: Binary heap priority queue
taxonomy: sorting/priority-queues
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - heap
  - priority queue
  - sift up
  - sift down
complexity: at most lg n compares per insert and 2 lg n per remove-max
related:
  - heapsort
  - binomial-queue
---

Insert sifts a key up, remove-max sinks the replacement down, in a complete binary tree.

The heap lives in the array strip at the bottom, positions 1 to n; the tree above is the same array read with the parent of position k at k/2. An insert starts at a new leaf and swims, a remove-max starts at the root and sinks, and the highlighted cells and nodes are the positions the operation touched.

Every key is inserted first, then the maxima are removed one by one and fill the output strip, largest first: heapsort through a priority-queue interface. Building by repeated insertion costs up to n lg n compares, where the bottom-up construction used by heapsort is linear.
