---
id: stalin-sort
title: Stalin sort
taxonomy: sorting/esoteric
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - 'Read comparisons, reads, writes: n − 1 comparisons on every input, and a read and a write only for each survivor after the first key eliminated.'
  - 'Choose Reversed: one survivor; choose Already sorted: all n survive and nothing is written.'
  - 'Watch mean survivors per run approach H_n on Random permutation: 4.74 for 64 keys.'
  misconceptions:
  - 'Its output is sorted, so it sorts; it returns a subsequence, H_n keys on average for a Random permutation, which is not a permutation of the input.'
algorithm:
  paradigm: greedy
  properties:
    stable: true
  postconditions:
    - The kept prefix holds the input's non-strict left-to-right maxima, a sorted subsequence of the input.
bounds:
  model: 'comparisons, reads and writes (each survivor compacted to the front) and survivors'
  best: 'Already sorted: n survivors and no write'
  average: 'n − 1 comparisons on every input; reads and writes equal the survivors after the first key eliminated; H_n expected survivors on a Random permutation (Knuth; test/plate-stalin-sort.test.ts)'
  worst: 'Reversed: one survivor'
---

Walk the array once and eliminate every key that is smaller than the last key kept; the survivors are sorted, in linear time, because everything else is gone.

It is a joke about the definition of sorting. The sorting problem asks for a permutation of the input in order, and Stalin sort returns only a subsequence: on any unsorted input at least one key is missing. What it actually solves is a much easier problem, finding some non-decreasing subsequence that starts with the first key, and it can do so online, key by key, keeping survivors at the front of the same array.

With distinct keys the survivors are exactly the left-to-right maxima, and Knuth's analysis of finding the maximum shows that on a random permutation the running maximum changes H_n − 1 times on average, so about ln n keys survive. The longest non-decreasing subsequence is typically far longer, and patience sorting finds it; as an algorithm for the problem it really solves, Stalin sort is still poor.

This is a bespoke plate: the output drops keys, so it is not a permutation of the input and cannot pass the array harness. The plate marks each key of the input as kept or eliminated as the sweep passes and shows, below it, the survivors compacted to the front of the array as the kernel writes them. The chart follows the survivors along the sweep, for this run and as the mean of the finished runs, against H_i, the expected number among the first i keys of a random permutation; Random permutation at n = 256 shows how little survives, and on Reversed only the first key does.

The joke is internet folklore with no citable origin; the best-known source is a community repository that collects implementations, cited here for the rule, not for its history. Strand sort turns the same greedy pass into a correct sort by keeping the rejected keys, pulling another strand from them and merging, and natural mergesort keeps every run instead of discarding.
