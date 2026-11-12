---
id: weavesort
title: Weave merge sort
taxonomy: sorting/hybrid
status: live
engine: array
labs:
  - sorting
sources:
  - id: w0rthy-2019
    ref: the only description, its source code
  - id: knuth-taocp-3
    ref: "5.2.1 Sorting by insertion"
tags:
  - sorting
  - hybrid
  - quadratic
  - in-place
  - interleaving
complexity: n² in every case; extra space log n
related:
  - in-place-merge-sort
  - insertion-sort
  - mergesort-top-down
  - shellsort-knuth
---

A mergesort whose merge is replaced: sort both halves recursively, interleave them like the teeth of two combs so that keys of the left and right halves alternate, and let insertion sort tidy the nearly sorted result.

The only source is the code in the ArrayV sorting visualiser, where it is filed among the hybrid sorts; no paper or analysis has been published, so every bound here is read off the code. Interleaving a right half of length m shifts the i-th key m − i + 1 places, so each merge costs on the order of m²/2 moves whatever the data, and the whole sort is quadratic in the best, average and worst case.

The final insertion pass costs one step per inversion left by the interleaving. That is the lesson of the plate: on Already sorted the interleaving leaves on the order of n²/8 inversions, because it shuffles two consecutive ranges of values into each other, so the best case is no better than the rest. Run it at n = 64 on Already sorted and then on Random permutation, and compare the write counters.

It works in place with recursion depth log n and is not stable: the interleaving changes the relative order of keys from different halves. It has no practical use; it belongs with Shellsort as an illustration that insertion sort is cheap only on input with few inversions.
