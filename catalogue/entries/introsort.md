---
id: introsort
title: Introsort
taxonomy: sorting/hybrid
status: live
engine: array
labs:
  - sorting
sources:
  - id: musser-1997
    ref: the original description
  - id: hoare-1962
    ref: the partitioning step
  - id: kristo-2021
    ref: the C++ std::sort hybrid, as summarised
tags:
  - sorting
  - hybrid
  - in-place
  - introspection
  - worst-case guarantee
complexity: n log n in every case; extra space log n
motivation: The C++ standard library's std::sort is this kind of hybrid of quicksort, insertion sort and heapsort.
related:
  - blockquicksort
  - heapsort
  - insertion-sort
  - ipnsort
  - pdqsort
  - quicksort
  - quicksort-median-of-three
  - randomized-quicksort
  - skasort
  - spreadsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [quicksort-median-of-three, heapsort, insertion-sort]
  objectives:
  - 'Run Already sorted at 512 keys: no write, and 3,164 comparisons, m + 3 for every partition of m > 16 keys (the median of three and the two scans meeting in the middle) plus n − 1 for the final insertion pass.'
  - 'Run Organ pipe at 512 keys and read the Phase readout: the depth limit of 2⌊lg n⌋ = 18 levels is reached four times, so four subarrays go to heapsort, six phases in all.'
  - 'Explain why up to 16 keys only the final insertion pass runs, so the Array writes are twice the inversions.'
  misconceptions:
  - 'Introsort is quicksort with a cutoff and so keeps its quadratic worst case; on the input McIlroy''s adversary builds against it, it reaches its depth limit from 64 keys on, hands that subarray to heapsort and stays below 4 n lg n comparisons.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (every write is half of an exchange); no auxiliary write'
  average: 'up to 16 keys the final insertion pass alone, with array writes twice the inversions and inversions ≤ comparisons ≤ inversions + n − 1; on Already sorted no write and m + 3 comparisons for every partition of m > 16 keys plus n − 1 for the pass, 3,164 at 512 keys; on Reversed from 17 keys 2 − (n mod 2) comparisons more and 2⌊n/2⌋ writes'
  worst: 'O(n log n) (Musser): at depth 2⌊lg n⌋ the subarray goes to heapsort. McIlroy''s adversary reaches that depth from 64 keys on, and its input costs fewer than 4 n lg n comparisons'
claims:
  - id: organ-pipe-reaches-the-depth-limit
    statement: >-
      On Organ pipe at 512 keys introsort reaches its depth limit four times: the Phase readout ends at six phases, the quicksort loop, four heapsorts of the subarrays it was working on, and the final insertion sort.
    readout: Phase
    expect: { value: 6 }
    setup:
      params: { shape: organ-pipe, n: 512 }
---

Quicksort that watches itself: it counts the depth of its own recursion, and when the depth passes a bound proportional to log n it hands the current subarray to heapsort; small subarrays are left for one final pass of insertion sort.

Musser's point was that median-of-three pivots do not protect quicksort: some inputs still drive it to quadratic time. Introsort keeps quicksort's speed on typical data, where the depth bound is never reached, and inherits heapsort's n log n bound on the inputs that would otherwise go quadratic.

The pivot is the median of the first, middle and last keys, the partition is Hoare's, and the depth counter starts at twice ⌊lg n⌋ and drops by one per partitioning level. Start with Random permutation at n = 256: the plate should look exactly like quicksort with a cutoff, followed by a sweep of insertion sort that finds almost nothing to do, because the array is already nearly sorted. On typical input the depth bound is never reached; when an input does exhaust it, the subarray it was working on is sorted by heapsort instead.

Introsort is in place and not stable, since both partitioning and the heap reorder equal keys, and it does not look for presorted runs: Already sorted is cheap only because the median of three then picks the middle key, 3,164 comparisons and no write at 512 keys against 5,499 and 3,616 on Random permutation. When stability matters, a mergesort or Timsort fits better; when presorted runs matter, pdqsort keeps the same guarantee and adapts to them.
