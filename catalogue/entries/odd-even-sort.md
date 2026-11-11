---
id: odd-even-sort
title: Odd-even transposition sort
taxonomy: sorting/elementary
status: planned
engine: array
labs:
  - sorting
sources:
  - id: habermann-1972
    ref: the proof that n rounds always suffice
  - id: knuth-taocp-3
    ref: "5.3.4 Networks for sorting"
tags:
  - sorting
  - quadratic
  - stable
  - in-place
  - adaptive
  - parallel
  - brick sort
complexity: n best, n² average and worst; extra space 1
related:
  - bubble-sort
  - shaker-sort
---

Alternate two kinds of round over neighbouring pairs: the odd round compares (0, 1), (2, 3), …, the even round (1, 2), (3, 4), …, and every pair out of order is exchanged.

The pairs of one round never overlap, so on a row of processors each round takes constant time and n rounds always sort n keys; Habermann proved this bound by induction. As a network it uses only comparators between neighbours, which is why it maps onto a linear array of simple cells. On one processor it compares the same neighbouring pairs as bubble sort in a different order, and exchanges exactly as many times as the input has inversions.

The sequential version here stops after an odd and an even round in a row make no exchange, so Already sorted costs two rounds. Try Random permutation at n = 64 and count the rounds: the work stays quadratic, which is the price of the regularity that makes it parallel.

It is stable, because only neighbours are exchanged and only when strictly out of order. For sorting large inputs in parallel, networks that also compare distant keys, such as bitonic sort and Batcher's merge, reach depth of order log² n instead of n.
