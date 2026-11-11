---
id: stalin-sort
title: Stalin sort
taxonomy: sorting/esoteric
status: planned
engine: custom
sources:
  - id: depaula-2018
    ref: the community repository of implementations
  - id: cormen-2022
    ref: the sorting problem asks for a permutation of the input
  - id: knuth-1997
    ref: "1.2.10 Analysis of an algorithm: left-to-right maxima"
  - id: aldous-1999
    ref: longest increasing subsequences and patience sorting
tags:
  - sorting
  - esoteric
  - in-place
  - online
  - left-to-right maxima
complexity: n in every case; extra space 1
related:
  - mergesort-natural
  - miracle-sort
  - patience-sorting
  - strand-sort
  - wolfsort
---

Walk the array once and eliminate every key that is smaller than the last key kept; the survivors are sorted, in linear time, because everything else is gone.

It is a joke about the definition of sorting. The sorting problem asks for a permutation of the input in order, and Stalin sort returns only a subsequence: on any unsorted input at least one key is missing. What it actually solves is a much easier problem, finding some non-decreasing subsequence that starts with the first key, and it can do so online, key by key, keeping survivors at the front of the same array.

With distinct keys the survivors are exactly the left-to-right maxima, and Knuth's analysis of finding the maximum shows that on a random permutation the running maximum changes H_n − 1 times on average, so about ln n keys survive. The longest non-decreasing subsequence is typically far longer, and patience sorting finds it; as an algorithm for the problem it really solves, Stalin sort is still poor.

This is a bespoke plate: the output drops keys, so it is not a permutation of the input and cannot pass the array harness. The plate marks each key as kept or eliminated as the sweep passes, and counts the survivors against the expected harmonic number; Random permutation at n = 256 shows how little survives, and on Reversed only the first key does.

The joke is internet folklore with no citable origin; the best-known source is a community repository that collects implementations, cited here for the rule, not for its history. Strand sort turns the same greedy pass into a correct sort by keeping the rejected keys, pulling another strand from them and merging, and natural mergesort keeps every run instead of discarding.
