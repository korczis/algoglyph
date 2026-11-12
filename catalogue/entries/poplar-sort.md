---
id: poplar-sort
title: Poplar sort
taxonomy: sorting/priority-queues
status: live
engine: array
labs:
  - sorting
sources:
  - id: bron-1991
    ref: Smoothsort revisited, where poplars are defined
  - id: morwenn-2017
    ref: reference implementation and its notes
  - id: dijkstra-1981
    ref: smoothsort, which it simplifies
tags:
  - sorting
  - heap
  - priority queue
  - in-place
complexity: n log n in every case; extra space log n
related:
  - heapsort
  - smoothsort
---

A simplified smoothsort: build a forest of poplars, perfect binary heaps of size 2^k − 1 stored with their two sub-poplars first and the root last, and repeatedly move the largest root to the end of the array.

Bron and Hesselink defined the poplar in their revisit of smoothsort. A poplar heap is a sequence of poplars from larger on the left to smaller on the right, each as large as possible, so a dozen keys become poplars of sizes 7, 3, 1 and 1; at most the two rightmost can share a size. Adding a key joins the two last poplars when they are equal in size and sifts the new root down, otherwise it starts a poplar of its own.

Unlike smoothsort, the roots are not kept in order, so every removal scans the roots of all poplars to find the maximum. That keeps the code simple and costs the linear best case: even an input that is already a valid poplar heap pays a logarithmic root scan for each key. Start with Nearly sorted at n = 128 and compare it with smoothsort on the same input to see what that simplification gives up.

The reference implementation is explicitly a demonstration of the idea, and its author notes that operations on a poplar heap are slow next to an ordinary binary heap. For practical in-place sorting with a guaranteed n log n, heapsort and its variants are the better tools. It sorts in place and is not stable.
