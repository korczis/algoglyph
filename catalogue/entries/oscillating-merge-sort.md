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
---

A tape sort that does not wait for all the runs: it forms a few runs, merges them at once by reading the tapes backwards, forms a few more, and so swings between run formation and merging until one run is left.

The method rests on tapes that can be read in both directions. A run written ascending reads backwards as descending, so merging backward-read runs needs no rewinding between phases, which cost a great deal of time on early drives; the direction flips from one level to the next. Sobel published it in 1962; the exact schedule of which run goes to which tape is in his paper and in Knuth's analysis, and is not reproduced here.

The plate simulates the work tapes in the auxiliary strip, read backwards like stacks, and counts element operations; rewinding and tape traffic are the model in these notes. Start with Random permutation at n = 256: merges begin before the input is used up, which no other tape schedule on this shelf does.

Comparisons total n log n in every case, and no external sort beats Θ((N/B) log_{M/B}(N/B)) block transfers; the gain is saved rewinding and continuous merging, not a better bound. Runs from different tapes are merged and backward reading reverses their order, so the sort is not stable. It only pays on drives that read backwards; on disks, multiway merging with a fan-in near M/B replaces it.
