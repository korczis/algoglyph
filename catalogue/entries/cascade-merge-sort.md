---
id: cascade-merge-sort
title: Cascade merge
taxonomy: sorting/external
status: live
engine: array
labs:
  - sorting
sources:
  - id: betz-1959
    ref: the original description
  - id: knuth-taocp-3
    ref: "5.4.3 The cascade merge"
  - id: gilstad-1960
    ref: the polyphase merge it is compared with
  - id: vitter-2008
    ref: why disks make tape schedules obsolete
tags:
  - sorting
  - external sorting
  - merging
  - tapes
complexity: n log n comparisons in every case; extra space n on tapes
related:
  - balanced-multiway-merge
  - external-merge-sort
  - polyphase-merge-sort
  - tape-merge-sort
---

A tape sort whose every pass is a cascade: a (T − 1)-way merge onto the empty tape until the shortest input runs out, then a (T − 2)-way merge onto the tape just emptied, and so on down to a two-way merge and a final copy.

After one cascade the tapes again hold a perfect distribution of a lower level, so the pass repeats until one run is left. The distributions are found backwards from the end: with four tapes they run (1, 1, 1), (3, 2, 1), (6, 5, 3), (14, 11, 6). Betz and Carter described the method in 1959, a year before Gilstad's polyphase merge.

The plate simulates the tapes in the auxiliary strip and counts element operations; passes and the amount of tape read are the model in these notes. Start with Random permutation at n = 256 and watch the fan-in drop within each pass; the final copy moves data without merging and is pure overhead.

Comparisons total n log n in every case. Which of cascade and polyphase reads less depends on the number of tapes and on what the drives can do, such as reading backwards. Like polyphase it merges runs from different tapes and is not stable. On disks with random access, a plain k-way merge with the largest possible k replaces both.
