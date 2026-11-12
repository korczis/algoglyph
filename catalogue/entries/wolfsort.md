---
id: wolfsort
title: Wolfsort
taxonomy: sorting/hybrid
status: live
engine: array
labs:
  - sorting
sources:
  - id: vandenhoven-2020-wolfsort
    ref: reference implementation and its README
  - id: vandenhoven-2021-fluxsort
    ref: the fallback sort
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
tags:
  - sorting
  - hybrid
  - stable
  - adaptive
  - buckets
complexity: n best, n log n average and worst; extra space n
related:
  - bucket-sort
  - fluxsort
  - lsd-radix-sort
  - quadsort
  - skasort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [fluxsort, bucket-sort]
  objectives:
  - 'Run Already sorted at 512 keys: 32 buckets of 16 keys, each finished by a binary insertion of 38 comparisons, 1,216 in all, with n array writes and n auxiliary writes for the distribution.'
  - 'Compare Random permutation at 512 keys with fluxsort: 1,417 comparisons against 4,528, fewer than a third.'
  - 'Below 256 keys, on any input not already in order, read fluxsort''s counts without its first scan: the same writes, and fewer comparisons by the scan''s.'
  misconceptions:
  - 'A bucket distribution needs comparisons to place the keys; wolfsort computes each key''s bucket from its offset between the minimum and the maximum, so on Already sorted at 512 keys every comparison is one of the buckets'' binary insertions.'
algorithm:
  properties:
    stable: true
    in_place: false
bounds:
  model: 'comparisons (inside the buckets; the distribution compares nothing), array writes (the distributed keys written back, then fluxsort''s copies and shifts) and auxiliary writes (the bucket strips and fluxsort''s buffer, each cell that changes)'
  average: 'below 256 keys fluxsort''s counts less the comparisons of its first scan; from 256 keys up to the plate''s 512, on a permutation of 1..n, ⌊n/16⌋ buckets of at most 24 keys each finished by a binary insertion sort, after n array writes and n auxiliary writes for the distribution'
claims:
  - id: sorted-is-bucket-insertions
    statement: >-
      On Already sorted at 512 keys wolfsort makes exactly 1,216 comparisons: the keys fill 32 buckets of 16 without a comparison, and each bucket's binary insertion makes ⌊lg 2⌋ + ⌊lg 3⌋ + … + ⌊lg 16⌋ = 38.
    readout: Comparisons
    expect: { value: 1216 }
    setup:
      params: { shape: sorted, n: 512 }
---

Distribute the keys into buckets by value, about sixteen keys per bucket, and sort each bucket with Fluxsort; small inputs, and inputs whose keys all fall into one bucket, go to Fluxsort directly.

The author's argument for the mix: an adaptive mergesort is fast on ordered data but cannot partition well, a bucket sort partitions fast but ignores order. A first scan finds the smallest and the largest key, and each key's bucket is computed from its offset between them, so the distribution needs no comparisons, which is why the author files it among the radix sorts, although the Fluxsort that finishes the buckets compares keys.

Bucket sorts degrade when keys pile into a few buckets. In the author's repository keys that overflow their bucket are copied back into the input, in the manner of dropsort, sorted with Fluxsort and merged in at the end, so a crowded bucket costs comparisons rather than quadratic time. The kernel has no overflow path: from 256 keys on it takes n/16 buckets, at most 256, and a crowded bucket is simply a larger Fluxsort. Start with Random permutation at n = 256, where a permutation of 1..n puts 16 keys into every bucket and a binary insertion finishes each, then try Few distinct keys, which crowds them into four.

It is a proof of concept that sorts non-negative integers only, and the bounds come from the author's repository, not from a peer-reviewed analysis.
