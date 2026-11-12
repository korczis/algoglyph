---
id: interpolation-sort
title: Interpolation sort
taxonomy: sorting/distribution
status: live
engine: array
labs:
  - sorting
sources:
  - id: black-2019-histogram
    ref: histogram sort, also known as interpolation sort
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
tags:
  - sorting
  - distribution
  - buckets
  - interpolation
complexity: n on uniformly spread keys, n² worst; extra space n
related:
  - american-flag-sort
  - bucket-sort
  - counting-sort
  - flashsort
  - proxmap-sort
---

Estimate each key's rank by linear interpolation between the minimum and the maximum, send it to the bucket of that estimate, and sort each bucket the same way until every bucket holds equal keys.

The NIST dictionary lists the name as another word for histogram sort: a refinement of bucket sort that counts the bucket sizes first, so the buckets are laid out exactly as large as they need to be in one contiguous array. Its rank function n(x − min)/(max − min) is the interpolation. The kernel applies it recursively, interpolating again inside every bucket rather than finishing buckets with insertion sort; the lower strip shows the buckets in order.

On roughly uniform keys a bucket holds about one key and the work is linear, as in the analysis of bucket sort; in the three-pass version, where buckets are finished by insertion sort, keys crowding into one bucket make it quadratic. Random permutation at n = 128 is the ideal case; Few distinct keys shows the recursion stopping at once on buckets of equal keys.

The first and the published origin of the method are not established; the NIST entry gives neither, and also notes that a bucket per key costs much memory, so large inputs are better served by fewer buckets. The first two passes keep equal keys in order; whether the whole sort is stable depends on how the buckets are finished, which is why stability is a property of the variant and not of the method.
