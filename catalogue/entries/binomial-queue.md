---
id: binomial-queue
title: Binomial queue
taxonomy: sorting/priority-queues
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - priority queue
  - binomial trees
  - mergeable
complexity: lg n per insert, remove-max and join
related:
  - binary-heap
---

A forest of power-of-two trees that merges like binary addition.

Root slot k holds a heap-ordered tree of exactly 2^k keys, or nothing, so the occupied slots spell the number of keys in binary. Linking two trees of the same order makes the smaller root the first child of the larger: one comparison and one link.

An insert adds a one-node queue to the slots, carrying like binary addition. A remove-max scans the roots, takes the largest, and merges its children back in, since the children of a root of order k are trees of orders k-1 down to 0. The plate inserts every key, then removes them all; the strip shows the maxima as they come out.
