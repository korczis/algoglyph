---
id: oscillating-merge-sort
title: Oscillating merge
taxonomy: sorting/external
status: live
engine: array
labs:
  - sorting
sources:
  - id: sobel-1962
    ref: the original description
  - id: knuth-taocp-3
    ref: "5.4.5 The oscillating sort"
  - id: aggarwal-1988
    ref: the I/O lower bound
  - id: vitter-2008
    ref: multiway merging on disks
tags:
  - sorting
  - external sorting
  - merging
  - tapes
  - read backwards
complexity: n log n comparisons in every case; extra space n on tapes
related:
  - balanced-multiway-merge
  - cascade-merge-sort
  - external-merge-sort
  - polyphase-merge-sort
  - tape-merge-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [balanced-multiway-merge]
  objectives:
  - 'Watch the Phase readout at 512 keys: the first merge comes after three memory loads, long before the 23rd load is read.'
  - 'Count the phases: 23 loads, (3³ − 1)/2 = 13 merges for the three levels, the header and the final write, 38 in all.'
  - 'Read the Auxiliary writes: (L + 1)·n = 2,048 at 512 keys on every input, each key written to a work tape once per level.'
  misconceptions:
  - 'Oscillating sort reads all the input before it merges, as the other tape sorts do; at 512 keys its first merge follows the third of 23 memory loads.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
bounds:
  model: 'comparisons (memory sorts and three-way merges), array writes (the sorted file written once), auxiliary writes (the four work tapes) and phases; no whole pass'
  average: 'on every input of n ≥ 2 keys, with r = ⌈n/M⌉ loads and L = ⌈log₃ r⌉ levels: n array writes, exactly (L + 1)·n auxiliary writes and r + (3^L − 1)/2 + 2 phases, 38 at 512 keys; comparisons at most the memory sorts'' bound plus 2nL'
claims:
  - id: one-write-per-level
    statement: >-
      On Random permutation at 512 keys the oscillating sort makes 2,048 auxiliary writes, (L + 1)·n for its L = 3 levels: every key is written to a work tape once as a memory load and once by the merge of each level.
    readout: Auxiliary writes
    expect: { value: 2048 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

A tape sort that does not wait for all the runs: it forms a few runs, merges them at once by reading the tapes backwards, forms a few more, and so swings between run formation and merging until one run is left.

The method rests on tapes that can be read in both directions. A run written ascending reads backwards as descending, so merging backward-read runs needs no rewinding between phases, which cost a great deal of time on early drives; the direction flips from one level to the next. Sobel published it in 1962; the exact schedule of which run goes to which tape is in his paper and in Knuth's analysis, and is not reproduced here.

The plate simulates the work tapes in the auxiliary strip, read backwards like stacks, and counts element operations; rewinding and tape traffic are the model in these notes. Start with Random permutation at n = 256: merges begin before the input is used up, which no other tape schedule on this shelf does.

Comparisons total n log n in every case, and no external sort beats Θ((N/B) log_{M/B}(N/B)) block transfers; the gain is saved rewinding and continuous merging, not a better bound. In Sobel's method runs from different tapes are merged and backward reading reverses their order, so the method is not stable; the plate keeps every run ascending and gives ties to the lower tape, and no input its test tried had equal keys reordered. It only pays on drives that read backwards; on disks, multiway merging with a fan-in near M/B replaces it.
