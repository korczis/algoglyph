---
id: skasort
title: Ska sort
taxonomy: sorting/radix
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [american-flag-sort]
  objectives:
  - 'Compare Already sorted with Random permutation at 512 keys: 2,046 array writes on both, and on every seed tested.'
  - 'Count the passes at 512 keys: the bytes on which every key agrees are skipped, so one pass of 512 keys on the second-lowest byte and passes of 255 and 256 on the lowest, 1,023 exchanges.'
  - 'Explain why the sweep exchanges every key of a pass once, even a key already in its place, where American flag sort leaves such a key alone.'
  misconceptions:
  - 'Skasort is cheaper on sorted input; at 512 keys Already sorted costs the same 2,046 array writes as Random permutation, where American flag sort writes nothing on Already sorted.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparisons (only in the comparison sort of buckets of 16 keys or fewer) and array writes (each exchange two, the exchange of a key with itself included); no auxiliary write'
  average: 'at least one exchange for every key of every byte pass, exactly that when no comparison is made; on a permutation of 1..n with n > 16 and no block of 256 keys holding 2 to 16 of them: n exchanges on the second-lowest byte once n ≥ 256, plus one per key of every block of more than 16, 1,023 at 512 keys in every order'
claims:
  - id: sorted-costs-as-much
    statement: >-
      On Already sorted at 512 keys skasort makes 2,046 array writes, as many as on Random permutation: the sweep exchanges every key of each byte pass into its slot, also a key that is already there.
    readout: Array writes
    expect: { value: 2046 }
    setup:
      params: { shape: sorted, n: 512, speed: 2000 }
---

An in-place MSD radix sort on bytes: count the 256 bucket sizes of the current byte, swap every key of each unfinished bucket straight into the next free slot of its own bucket until all buckets are complete, then recurse on the next byte, finishing small buckets with a comparison sort.

Skarupke built it on American flag sort's counting and permuting, and reworked the inner loop: instead of following one cycle at a time, which makes each swap wait for the previous one, it sweeps over all unfinished buckets in turn. A byte on which every key agrees is skipped, which matters on the plate, where keys are at most 512 and the high bytes are all equal.

The original switches to std::sort below 128 elements and to American flag sort below 1024; the kernel lowers the comparison threshold to small buckets so the radix passes show at the plate's sizes. Start with Random permutation at n = 512 and compare it in the lab with American flag sort on the same keys.

There is no peer-reviewed analysis; the bounds come from the author, who warns that on millions of long strings it behaves more like n log n. It is not stable, as the author confirmed. The LearnedSort authors later describe it as a radix-derived distribution sort that ran two to three times faster than std::sort in their comparison.
