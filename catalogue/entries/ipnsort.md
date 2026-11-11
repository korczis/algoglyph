---
id: ipnsort
title: ipnsort
taxonomy: sorting/quicksort
status: planned
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
---

The unstable sort of Rust's standard library: detect a single existing run, otherwise quicksort with an introsort depth limit, a sampled pivot, a filter for keys equal to the ancestor pivot, insertion sort for short inputs and heapsort when the limit runs out.

Its authors call it an implementation rather than an algorithm, a combination of strategies tuned for a wide range of types and data patterns. Above twenty keys it first checks whether the whole input is one non-descending or strictly descending run; then it finishes in n − 1 comparisons, reversing the descending case. Their stated guarantees are O(n log n) comparisons in the worst case, O(n) for fully ascending or descending input and an expected O(n log k) for k distinct values.

Compared with pdqsort it drops the pattern breaking and the bad-partition bookkeeping, and relies on a better pivot and a cheaper heapsort instead. The kernel follows the structure of the library code with two simplifications: a plain Lomuto partition in place of the branchless cyclic one, and insertion sort in place of the sorting-network small sort.

Start with Reversed at n = 128 to see the run detection, then Few distinct keys for the equal-key filter. The properties above are the authors' goals and measurements; there is no peer-reviewed analysis of ipnsort. It is not stable; its stable sibling in the same library is driftsort.
