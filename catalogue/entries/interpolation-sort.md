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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [bucket-sort]
  objectives:
  - 'Run Random permutation at 512 keys: 2(n − 1) = 1,022 comparisons to find the minimum and the maximum, then one key per bucket and nothing more.'
  - 'Run Few distinct keys at 512 keys: every bucket of equal keys finds its own minimum and maximum before it stops, 2(n − 1) + 2(n − 4) = 2,038 comparisons.'
  - 'Read the Auxiliary writes: n, the buckets of the first interpolation drawn once.'
  misconceptions:
  - 'A distribution sort never compares keys; interpolation sort compares every key twice to find the minimum and maximum of each range it interpolates, 1,022 times on Random permutation at 512 keys.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
bounds:
  model: 'comparisons (the minimum and maximum of every range that is interpolated), array writes (the result written back, one per key) and auxiliary writes (the first level''s buckets, one per key)'
  average: 'n array writes on every input; when the keys span fewer than n values, as on every plate input, 2(n − 1) + 2(n − d) comparisons for d distinct keys and n auxiliary writes'
claims:
  - id: equal-buckets-cost-their-extremes
    statement: >-
      On Few distinct keys at 512 keys interpolation sort makes 2(n − 1) + 2(n − 4) = 2,038 comparisons: two per key for the extremes of the whole range, then two per key again in each of the four buckets of equal keys, which then stop.
    readout: Comparisons
    expect: { value: 2038 }
    setup:
      params: { shape: few-unique, n: 512 }
---

Estimate each key's rank by linear interpolation between the minimum and the maximum, send it to the bucket of that estimate, and sort each bucket the same way until every bucket holds equal keys.

The NIST dictionary lists the name as another word for histogram sort: a refinement of bucket sort that counts the bucket sizes first, so the buckets are laid out exactly as large as they need to be in one contiguous array. Its rank function n(x − min)/(max − min) is the interpolation. The kernel applies it recursively, interpolating again inside every bucket rather than finishing buckets with insertion sort; the lower strip shows the buckets in order.

On roughly uniform keys a bucket holds about one key and the work is linear, as in the analysis of bucket sort; in the three-pass version, where buckets are finished by insertion sort, keys crowding into one bucket make it quadratic. Random permutation at n = 128 is the ideal case; Few distinct keys shows the recursion stopping at once on buckets of equal keys.

The first and the published origin of the method are not established; the NIST entry gives neither, and also notes that a bucket per key costs much memory, so large inputs are better served by fewer buckets. The first two passes keep equal keys in order; whether the whole sort is stable depends on how the buckets are finished, which is why stability is a property of the variant and not of the method.
