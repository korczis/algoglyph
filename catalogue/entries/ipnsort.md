---
id: ipnsort
title: ipnsort
taxonomy: sorting/quicksort
status: live
engine: array
labs:
  - sorting
sources:
  - id: bergdoll-2024
    ref: the authors' design write-up
  - id: rust-2024
    ref: slice::sort_unstable
tags:
  - sorting
  - quicksort
  - partitioning
  - in-place
  - adaptive
  - hybrid
complexity: n best, n log n average and worst; extra space log n
motivation: Rust's slice::sort_unstable is based on it since Rust 1.81.
related:
  - blockquicksort
  - heapsort
  - pdqsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [pdqsort]
  objectives:
  - 'Count Already sorted: n − 1 comparisons and no writes, the fewest any comparison sort can make.'
  - 'Count Reversed above 20 keys: n − 1 comparisons to find the descending run and 2⌊n/2⌋ array writes to reverse it.'
  - 'Read the Phase readout above 20 keys: the run search alone when the input is one run, a quicksort phase after it otherwise.'
  misconceptions:
  - 'Run detection makes ipnsort adaptive to any presortedness; only an input that is one run finishes in n − 1 comparisons, and Nearly sorted goes through the quicksort.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (an exchange is two writes)'
  best: 'n − 1 comparisons and no writes (Already sorted, or all keys equal)'
  average: 'O(n log n) comparisons, and an expected O(n log k) for k distinct values (the authors'' stated guarantees); up to 20 keys insertion sort alone, with array writes = 2 × inversions and inversions ≤ comparisons ≤ inversions + n − 1'
  worst: 'O(n log n) comparisons, heapsort once the introsort depth limit runs out (the authors'' stated guarantee)'
---

The unstable sort of Rust's standard library: detect a single existing run, otherwise quicksort with an introsort depth limit, a sampled pivot, a filter for keys equal to the ancestor pivot, insertion sort for short inputs and heapsort when the limit runs out.

Its authors call it an implementation rather than an algorithm, a combination of strategies tuned for a wide range of types and data patterns. Above twenty keys it first checks whether the whole input is one non-descending or strictly descending run; then it finishes in n − 1 comparisons, reversing the descending case. Their stated guarantees are O(n log n) comparisons in the worst case, O(n) for fully ascending or descending input and an expected O(n log k) for k distinct values.

Compared with pdqsort it drops the pattern breaking and the bad-partition bookkeeping, and relies on a better pivot and a cheaper heapsort instead. The kernel follows the structure of the library code with two simplifications: a plain Lomuto partition in place of the branchless cyclic one, and insertion sort in place of the sorting-network small sort.

Start with Reversed at n = 128 to see the run detection, then Few distinct keys for the equal-key filter. The properties above are the authors' goals and measurements; there is no peer-reviewed analysis of ipnsort. It is not stable; its stable sibling in the same library is driftsort.
