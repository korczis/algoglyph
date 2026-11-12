---
id: skasort
title: Ska sort
taxonomy: sorting/radix
status: planned
engine: array
labs:
  - sorting
sources:
  - id: skarupke-2016
    ref: the author's description and code
  - id: mcilroy-1993
    ref: American flag sort, its inner loop's ancestor
  - id: kristo-2021
    ref: comparison in later benchmarks
tags:
  - sorting
  - radix
  - in-place
  - msd
complexity: about n·b for b distinguishing bytes by the author's estimate, no proved bound; extra space b·R counters
related:
  - american-flag-sort
  - msd-radix-sort
  - spreadsort
---

An in-place MSD radix sort on bytes: count the 256 bucket sizes of the current byte, swap every key of each unfinished bucket straight into the next free slot of its own bucket until all buckets are complete, then recurse on the next byte, finishing small buckets with a comparison sort.

Skarupke built it on American flag sort's counting and permuting, and reworked the inner loop: instead of following one cycle at a time, which makes each swap wait for the previous one, it sweeps over all unfinished buckets in turn. A byte on which every key agrees is skipped, which matters on the plate, where keys are at most 512 and the high bytes are all equal.

The original switches to std::sort below 128 elements and to American flag sort below 1024; the kernel lowers the comparison threshold to small buckets so the radix passes show at the plate's sizes. Start with Random permutation at n = 512 and compare it in the lab with American flag sort on the same keys.

There is no peer-reviewed analysis; the bounds come from the author, who warns that on millions of long strings it behaves more like n log n. It is not stable, as the author confirmed. The LearnedSort authors later describe it as a radix-derived distribution sort that ran two to three times faster than std::sort in their comparison.
