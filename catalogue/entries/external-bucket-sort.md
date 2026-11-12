---
id: external-bucket-sort
title: External bucket sort
taxonomy: sorting/external
status: live
engine: array
labs:
  - sorting
sources:
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
  - id: vitter-2008
    ref: distribution by key ranges
  - id: aggarwal-1988
    ref: the I/O bound for balanced buckets
tags:
  - sorting
  - external sorting
  - buckets
  - distribution
complexity: n expected for uniform keys, n² worst; extra space n
related:
  - bucket-sort
  - external-quicksort
  - external-radix-sort
  - external-samplesort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [bucket-sort]
  objectives:
  - 'Run Random permutation at 512 keys: 2,048 array writes, three distributions of four equal key ranges (512 to 128, 32 and 8 keys) and the memory sorts of the buckets of 8.'
  - 'Run Already sorted at 512 keys: the same buckets and 448 comparisons, n − 64 for the 64 memory sorts of 8 keys.'
  - 'Run Few distinct keys at 512 keys: 0 comparisons, since every bucket of the first distribution holds one key value.'
  misconceptions:
  - 'A bucket sort compares keys to place them; the distribution computes a bucket from the key range and compares nothing, so the only comparisons are those of the memory sorts, none at all on Few distinct keys at 512 keys.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
bounds:
  model: 'comparisons (memory sorts only), array writes (each distribution writes its part back; an internal sort writes its part) and auxiliary writes (memory and bucket files); memory M = max(4, ⌈√n⌉), k = 4 equal key ranges'
  best: 'on Few distinct keys from 128 keys on no comparison, n array writes and n auxiliary writes'
  average: 'array writes equal auxiliary writes on every input; on a permutation of 1..n the buckets depend on n alone, so do the writes (2,048 at 512 keys) and the comparisons on Already sorted (448 at 512 keys); n expected for uniform keys and n² worst are the published bounds'
claims:
  - id: no-comparison-on-few-keys
    statement: >-
      On Few distinct keys at 512 keys external bucket sort makes no comparison at all: the first distribution splits the key range 1 to 4 into four buckets of one key value each, larger than memory and finished without sorting.
    readout: Comparisons
    expect: { value: 0 }
    setup:
      params: { shape: few-unique, n: 512, speed: 2000 }
---

Bucket sort with files for buckets: cut the key range into fixed intervals, append every record in one sequential pass to the file of its interval, sort the buckets that fit in memory and bucket the larger ones again over their own range.

Unlike external samplesort, the boundaries do not come from a sample of the data but from the expected distribution of keys, usually equal slices of a known range. Computing a bucket number is cheaper than a binary search among splitters; the price is that nothing guarantees the buckets come out even.

For uniformly distributed keys the expected internal work is linear, the in-memory analysis of bucket sort carried over; if every key falls into one interval, the bucket must be split again and nothing was gained by the pass. The plate shows the bucket files in the auxiliary strip and counts element operations; block transfers are the model in these notes. Start with Random permutation at n = 256, whose keys are uniform over their range, and compare it with Few distinct keys, where buckets of equal keys are already finished.

With balanced buckets the passes number about log_{M/B}(N/M), matching the optimal transfer bound. Appending keeps file order inside every bucket, so the sort is stable when the in-memory sort is. No original paper, author or year can be documented for the external form; it belongs to the general class of distribution sorts.
