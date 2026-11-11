---
id: proxmap-sort
title: ProxmapSort
taxonomy: sorting/distribution
status: planned
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
---

Map every key to a subarray of the output with a monotone function, count the hits per subarray, turn the counts into start positions (the proximity map), then insert each key into its subarray by insertion among the keys already there.

The map never sends a larger key to an earlier subarray, so the order between subarrays is settled by arithmetic and only the order inside a subarray needs comparisons. The lower strips are the hit counts and the output array filling up subarray by subarray; Standish and Jacobson use the same map afterwards for a search that finds a key in constant average time.

The first passes are linear; the last costs the sum of the insertion sorts, roughly the sum of the squares of the subarray sizes. With keys spread uniformly that sum is linear on average, as in the analysis of bucket sort; if every key maps to one subarray it is plain insertion sort, quadratic. Random permutation at n = 128 is the uniform case, with about one key per subarray.

Inserting after equal keys keeps them in input order, so the kernel's version is stable; the paper does not discuss stability, which follows from the procedure rather than from a cited result. The method is a good teaching example because one run shows a key map, prefix sums and insertion sort together.
