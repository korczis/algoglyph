---
id: proxmap-sort
title: ProxmapSort
taxonomy: sorting/distribution
status: live
engine: array
labs:
  - sorting
sources:
  - id: standish-2005
    ref: the classroom description
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
tags:
  - sorting
  - distribution
  - buckets
  - stable
  - prefix sums
complexity: n on uniformly spread keys, n² worst; extra space n
related:
  - bucket-sort
  - flashsort
  - insertion-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [bucket-sort]
  objectives:
  - 'Run Random permutation at 512 keys: the map sends every key of 1..n to a subarray of its own, and no comparison is made.'
  - 'Run Few distinct keys at 512 keys: four subarrays of equal keys, one comparison for every key after the first in each, n − 4 = 508.'
  - 'Read the Auxiliary writes on Already sorted: exactly 2n, the n hit counts and the output array filling in order.'
  misconceptions:
  - 'The insertion step makes ProxmapSort quadratic on repeated keys; a key that follows equal keys stops at its first comparison, so Few distinct keys at 512 keys costs 508.'
algorithm:
  properties:
    stable: true
    in_place: false
bounds:
  model: 'comparisons (inserting each key among the keys already in its subarray), array writes (the output copied back, one per key) and auxiliary writes (each cell of the drawn hit-count and output strips that changes)'
  average: 'n array writes and at least 2n auxiliary writes on every input with two distinct keys or more, exactly 2n on Already sorted; when the keys span fewer than n values, as on every plate input, n − d comparisons for d distinct keys'
claims:
  - id: equal-keys-stop-at-once
    statement: >-
      On Few distinct keys at 512 keys ProxmapSort makes n − 4 = 508 comparisons: each of the four key values has a subarray of its own, and a key inserted after equal keys stops at its first comparison.
    readout: Comparisons
    expect: { value: 508 }
    setup:
      params: { shape: few-unique, n: 512, speed: 2000 }
---

Map every key to a subarray of the output with a monotone function, count the hits per subarray, turn the counts into start positions (the proximity map), then insert each key into its subarray by insertion among the keys already there.

The map never sends a larger key to an earlier subarray, so the order between subarrays is settled by arithmetic and only the order inside a subarray needs comparisons. The lower strips are the hit counts and the output array filling up subarray by subarray; Standish and Jacobson use the same map afterwards for a search that finds a key in constant average time.

The first passes are linear; the last costs the sum of the insertion sorts, roughly the sum of the squares of the subarray sizes. With keys spread uniformly that sum is linear on average, as in the analysis of bucket sort; if every key maps to one subarray it is plain insertion sort, quadratic. Random permutation at n = 128 is the uniform case, with about one key per subarray.

Inserting after equal keys keeps them in input order, so the kernel's version is stable; the paper does not discuss stability, which follows from the procedure rather than from a cited result. The method is a good teaching example because one run shows a key map, prefix sums and insertion sort together.
