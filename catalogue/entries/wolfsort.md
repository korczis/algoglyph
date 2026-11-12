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
---

Distribute the keys into buckets by value, about eight keys per bucket, sort each bucket with Fluxsort, and merge the buckets with the keys that overflowed them; presorted stretches go straight to quadsort.

The author's argument for the mix: an adaptive mergesort is fast on ordered data but cannot partition well, a bucket sort partitions fast but ignores order. The analyser borrowed from Fluxsort finds the smallest and largest key and the presorted quarters; the distribution then needs no comparisons, which is why the author files it among the radix sorts, although the bucket and merge phases compare keys.

Bucket sorts degrade when keys pile into a few buckets. Wolfsort copies keys that overflow their bucket back into the input, in the manner of dropsort, sorts them with Fluxsort and merges them in at the end, so a crowded bucket costs comparisons rather than quadratic time. Start with Random permutation at n = 256, where the keys spread evenly over the buckets, then try Few distinct keys, which crowds them.

It is a proof of concept that sorts non-negative integers only, and the bounds come from the author's repository, not from a peer-reviewed analysis.
