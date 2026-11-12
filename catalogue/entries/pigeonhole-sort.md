---
id: pigeonhole-sort
title: Pigeonhole sort
taxonomy: sorting/distribution
status: planned
engine: array
labs:
  - sorting
sources:
  - id: black-2022-pigeonhole
    ref: definition and comparison with counting sort
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
tags:
  - sorting
  - distribution
  - buckets
  - stable
  - non-comparison
  - key-indexed
complexity: n + k in every case, for k possible key values; extra space n + k
related:
  - bucket-sort
  - counting-sort
  - cycle-sort
  - lsd-radix-sort
---

Make one pigeonhole for every possible key value, move each record into the hole of its key, then empty the holes in key order.

The key is used directly as an address, so there are no comparisons at all and the comparison counter stays at zero; the lower strip is the row of holes, filled in arrival order and emptied left to right. The n log n lower bound for comparison sorts does not apply to it.

The NIST dictionary separates it from counting sort by how often a record travels: pigeonhole sort moves every record twice, into its hole and then to its place, while counting sort first counts the keys and moves each record once, straight to a computed position. Keeping arrival order within a hole makes it stable.

It pays off only while the key range is about as large as the number of keys: the second pass visits every hole, empty or not. Random permutation at n = 64 has exactly one key per hole, the ideal case; Few distinct keys shows several records sharing a hole and coming out in the order they went in. For a wide key range, radix sort splits the key into digits instead.
