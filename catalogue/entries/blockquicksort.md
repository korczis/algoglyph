---
id: blockquicksort
title: BlockQuicksort
taxonomy: sorting/quicksort
status: live
engine: array
labs:
  - sorting
sources:
  - id: edelkamp-2016
    ref: the original description and the misprediction bound
  - id: edelkamp-2019
    ref: the journal version
  - id: musser-1997
    ref: the depth-limited fallback it lacks
  - id: peters-2015
    ref: block partitioning inside pdqsort
tags:
  - sorting
  - quicksort
  - partitioning
  - in-place
  - branch prediction
complexity: n log n best, n log n average, n² worst; extra space log n
related:
  - quicksort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [quicksort-median-of-three]
  objectives:
  - 'Watch the Auxiliary writes: the offset buffers are used only when a subarray holds more than 256 keys besides its pivot, so from 264 keys on the slider.'
  - 'Compare Random permutation at 512 keys with quicksort: the comparisons within a few percent, the Array writes well above.'
  - 'Explain why the branch mispredictions it saves are invisible to every count on the plate.'
  misconceptions:
  - 'BlockQuicksort is faster because it does fewer operations; it makes about as many comparisons as quicksort and more writes, and its gain is in mispredictions the plate cannot count.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes) and auxiliary writes (the recorded offsets)'
  average: 'up to 16 keys insertion sort alone, with array writes = 2 × inversions and inversions ≤ comparisons ≤ inversions + n − 1; no auxiliary write up to 257 keys'
  worst: 'quadratic: more than n²/4 comparisons from 49 keys on, on the input an adversary builds against the median-of-three rule'
---

Hoare partitioning done in blocks: scan a block of keys on each side, record without branching the offsets of the keys that sit on the wrong side, then exchange the recorded keys in pairs.

The point is the processor, not the count. In Hoare's inner loop a conditional jump depends on the comparison with the pivot; on random data it is unpredictable, and every misprediction costs many cycles. Recording offsets unconditionally, and advancing a counter by the 0 or 1 of the comparison, separates the control flow from the data. Edelkamp and Weiß prove an average of at most ε n log n + O(n) mispredictions for a static predictor, with a small ε that depends on the block size, and measured more than 80% speed-up over GCC's std::sort on random integers.

The kernel uses blocks of 128 keys, a median-of-three pivot and insertion sort for subarrays of at most 16 keys; it exchanges the recorded keys pairwise rather than by the paper's cyclic permutation, which gives the same result with more moves. The plate counts comparisons, which stay within a few percent of quicksort's, and writes, which the pairwise exchanges push well above them: the mispredictions it saves are invisible to any operation count. Start with Random permutation at n = 512 so that the blocks are full.

The basic algorithm has no worst-case fallback, so its worst case is still quadratic; introsort's depth limit supplies one. Block partitioning matters most when comparisons are cheap and branch-free, which is why pdqsort adopted it for large arrays.
