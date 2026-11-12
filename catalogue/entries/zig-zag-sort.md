---
id: zig-zag-sort
title: Zig-zag sort
taxonomy: sorting/networks
status: planned
engine: array
labs:
  - sorting
sources:
  - id: goodrich-2014
    ref: the original description and proof
  - id: ajtai-1983
    ref: the ε-halver it borrows
  - id: knuth-taocp-3
    ref: "5.2.2 Sorting by exchanging (merge exchange)"
tags:
  - sorting
  - sorting network
  - oblivious
  - in-place
  - shellsort
complexity: n log n in every case; extra space 1
related:
  - aks-sorting-network
  - batcher-merge-exchange
  - bitonic-sort
  - shellsort-knuth
---

Goodrich's deterministic, data-oblivious Shellsort variant: at each of log n levels the subarrays halve in size, and a zig pass left to right and a zag pass right to left apply a Reduce step to every pair of neighbouring subarrays.

Reduce is built from ε-halvers, the same block AKS uses, which pull the small keys into the left subarray and the large ones into the right. Because nothing depends on the keys, the whole procedure can be written as a network of size on the order of n log n, with constants Goodrich describes as large but far smaller than those of constructive AKS. The pseudocode is short; the proof of correctness is not, and rests on a system of potential functions.

The plate is a simplification and labels itself as one: each Reduce is a single halver made of fixed pseudo-random matchings, which are not certified, so Batcher's merge exchange cleans up at the end and guarantees a sorted result. The zig and zag passes over neighbouring subarrays are the real structure to watch. Start with Random permutation at n = 64 and look for keys bouncing between neighbouring blocks as the levels shrink.

Goodrich stresses that it is not a parallel algorithm: even as a network its time is on the order of n log n, not the logarithmic depth of AKS. Its use is privacy, sorting in oblivious RAM simulations where the access pattern must reveal nothing about the data; for ordinary sorting the constants make it slow.
