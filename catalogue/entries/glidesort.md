---
id: glidesort
title: Glidesort
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: peters-2023
    ref: the author's repository and description
  - id: munro-wild-2018
    ref: the powersort merge order it follows
  - id: vandenhoven-2020
    ref: the parity merge it generalises
  - id: bergdoll-2024b
    ref: driftsort, its successor in Rust's standard library
tags:
  - sorting
  - merging
  - stable
  - adaptive
  - duplicate keys
complexity: n best, n log n average and worst; extra space n
related:
  - pdqsort
  - quadsort
  - timsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [powersort, pdqsort]
  objectives:
  - 'Count Already sorted from 33 keys on: n − 1 comparisons and no write; Reversed adds 2⌊n/2⌋ writes.'
  - 'Compare Few distinct keys with Random permutation at 512 keys: fewer than half the comparisons (1,888 against 4,403).'
  - 'Watch the Auxiliary writes: the stable quicksort partitions through the buffer and the merges use it too.'
  misconceptions:
  - 'A stable mergesort cannot profit from repeated keys; on Few distinct keys at 512 keys glidesort makes fewer than ½ n lg n comparisons, fewer than top-down mergesort on any input of that size.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes, a copy one) and auxiliary writes (the shorter run, copied for each merge)'
  best: 'from 33 keys on, n − 1 comparisons and no writes (Already sorted, keys all equal); n − 1 comparisons and 2⌊n/2⌋ array writes on Reversed, no auxiliary write'
  average: 'n log k for k distinct values (the author''s claim)'
  worst: 'n log n (the author''s claim)'
claims:
  - id: few-keys-below-mergesort
    statement: >-
      On Few distinct keys at 512 keys glidesort makes fewer than ½ n lg n = 2,304 comparisons, the fewest top-down mergesort makes on any input of 512 keys.
    readout: Comparisons
    expect: { below: 2304 }
    setup:
      params: { shape: few-unique, n: 512 }
---

A stable sort that marries Timsort-style run detection with pattern-defeating quicksort's strength on duplicates: it scans for sorted runs as powersort does but leaves unsorted stretches unsorted, as lazy logical runs, and only sorts one with a stable quicksort when it must be merged with a sorted run.

Merging follows powersort's order, but logically: two unsorted runs simply concatenate into a bigger unsorted run, two sorted runs are kept as a pending double-sorted pair, and real work happens only where sorted meets unsorted. The stable quicksort partitions bidirectionally, interleaving a left-to-right and a right-to-left pass, and sorted runs are merged by an interleaved branchless ping-pong merge, with large merges split by binary search so several proceed at once.

The repository states, for n keys with k distinct values, n best, n log k average and n log n worst, stable and deterministic; the log k term is the payoff on few distinct values. Try Few distinct keys at n = 256, then Nearly sorted at the same size: both are the inputs it was designed for. By default it allocates up to n keys of buffer (less above a megabyte); with only constant memory the bounds degrade to n log² n.

There is no peer-reviewed analysis of glidesort as a whole; the bounds are the author's, and only its merge policy, powersort's, has been analysed. Driftsort, now Rust's stable sort, derives from it.
