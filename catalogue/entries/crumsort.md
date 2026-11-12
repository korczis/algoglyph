---
id: crumsort
title: Crumsort
taxonomy: sorting/hybrid
status: live
engine: array
labs:
  - sorting
sources:
  - id: vandenhoven-2022-crumsort
    ref: reference implementation and its README
  - id: hoare-1962
    ref: the partitioning it modifies
  - id: edelkamp-2016
    ref: branchless partitioning
tags:
  - sorting
  - hybrid
  - in-place
  - adaptive
  - branchless
complexity: n best, n log n average and worst; extra space log n
related:
  - blockquicksort
  - fluxsort
  - pdqsort
  - quadsort
  - quicksort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [fluxsort]
  objectives:
  - 'Run Few distinct keys at 512 keys: 2,255 comparisons, under a third of the 8,390 of Random permutation, because a pivot no larger than the previous one splits off the keys equal to it for good.'
  - 'Up to 64 keys only insertion sort by exchanges runs: the Array writes are twice the inversions.'
  - 'Run Already sorted at 512 keys: without an analyser the kernel partitions it like any other input, 7,858 comparisons and 12,888 array writes.'
  misconceptions:
  - 'Crumsort, like fluxsort, finishes sorted input in one scan; the plate''s kernel has no analyser, and Already sorted at 512 keys costs 7,858 comparisons and 12,888 array writes.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons, array writes (copies in the fulcrum partition; the insertion sort''s exchanges count two) and auxiliary writes (the 32 parked keys, each cell that changes)'
  average: 'up to 64 keys insertion sort by exchanges alone, with array writes twice the inversions and inversions ≤ comparisons ≤ inversions + n − 1; keys all equal above 64 keys: 2n + 12 comparisons and 2n array writes'
claims:
  - id: equal-keys-split-off
    statement: >-
      On Few distinct keys at 512 keys crumsort makes fewer than a third of the 8,390 comparisons of Random permutation: once a pivot is no larger than the previous one, the keys equal to it are split off and never compared again.
    readout: Comparisons
    expect: { below: 2796 }
    setup:
      params: { shape: few-unique, n: 512 }
---

The in-place, unstable sibling of Fluxsort: the same pivot selection and the same treatment of keys equal to the pivot, but partitioning in place with what its author calls a fulcrum partition.

The fulcrum partition parks 16 keys from each end of the range in a swap area, which opens a gap at both ends. It then reads the next key from whichever side has the smaller gap and writes it to the left side when it is not larger than the pivot, to the right side otherwise; the gaps never close, so no unread key is overwritten, and the 32 parked keys are placed last. Each key is copied once per partition, where an exchange writes two keys. Start with Random permutation at n = 256 and read the write counter against the comparison counter.

In the author's repository the pivot is a pseudo-median of nine, a median of sixteen or the median of a random sample, depending on the size of the range, an analyser hands presorted input to quadsort, and both sides go to quadsort when one is smaller than a sixteenth of the other; the author argues that this makes killer patterns unlikely, but there is no peer-reviewed analysis of these claims. The kernel keeps the pseudo-median of nine and the partitions that split off keys equal to the pivot, and finishes ranges of at most 64 keys by insertion sort. Without the analyser, Already sorted above 64 keys is partitioned like any other input, 7,858 comparisons at 512 keys, while Few distinct keys costs 2,255, under a third of Random permutation's 8,390.

Being unstable, it breaks existing patterns and adapts less than Fluxsort; in exchange it needs no buffer of size n. The branchless idea it uses comes from BlockQuicksort, which partitions in a Hoare-like way rather than with a fulcrum.
