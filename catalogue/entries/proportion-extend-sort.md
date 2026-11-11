---
id: proportion-extend-sort
title: Proportion extend sort
taxonomy: sorting/quicksort
status: planned
engine: array
labs:
  - sorting
sources:
  - id: chen-2001
    ref: the original description and the worst-case bound
  - id: chen-2006
    ref: average-case analysis
tags:
  - sorting
  - quicksort
  - partitioning
  - in-place
  - sorted sample
complexity: n log n in every case; extra space log n
related:
  - quicksort
---

Keep a sorted prefix and extend it: take an unsorted block up to p times its length, partition it around the median of the prefix, and recurse on both sides, each again a sorted part followed by an unsorted one.

The trick is where the pivot comes from. Quicksort guesses a pivot from unsorted keys; here it is taken from keys already in order, so it is well placed, and the prefix that has been sorted grows geometrically until it covers the array. Chen proves a worst case of n log n comparisons with a constant that depends on p, without falling back to heapsort as introsort does.

The kernel takes p = 16, the value Chen used in his experiments on integers. Start with Random permutation at n = 128 and watch the sorted region on the left spread outwards in stages; then try Reversed, where a quicksort with a fixed pivot would go quadratic and this one does not.

For the average case Chen first reported experiments close to n log n − O(n) comparisons; a rigorous analysis followed in his later paper on efficient sample sorts, which treats this method as one of its cases. Partitioning reorders equal keys, so it is not stable. The cited works do not compare it with modern library sorts, which leaves its practical standing open.
