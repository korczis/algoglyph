---
id: octosort
title: Octosort
taxonomy: sorting/hybrid
status: live
engine: array
labs:
  - sorting
sources:
  - id: vandenhoven-2021-octosort
    ref: reference implementation and its README
  - id: vandenhoven-2021-blitsort
    ref: comparison with its successor
tags:
  - sorting
  - hybrid
  - stable
  - in-place
  - adaptive
  - block merge
complexity: n best, n log n average and worst; extra space 1
related:
  - blitsort
  - block-merge-sort
  - grailsort
  - quadsort
  - wikisort
---

WikiSort's block merge sort with faster parts: the same skeleton of stable merging through a small internal buffer, with several building blocks replaced by quicker ones.

The author's repository documents the changes rather than the block merge itself: an octo swap that sorts four to eight keys at once and handles reversed runs, a monobound binary search, a rotation by triple reversal, and quadsort's merge routine. Read the block merge sort and WikiSort entries for how blocks are rearranged and merged; this one is about what engineering does to the constant factors.

Start with Random permutation at n = 256: the short sorted runs the octo swap produces at the start are then merged stably, block by block, through a buffer far smaller than the array. Few distinct keys is a good second input, since stability with constant extra memory is the method's whole point.

Its table claims n comparisons at best, n log n on average and at worst, and constant extra memory; there is no peer-reviewed analysis and the table does not count moves. Its author reports the later Blitsort as faster in the same role.
