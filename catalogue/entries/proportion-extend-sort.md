---
id: proportion-extend-sort
title: Proportion extend sort
taxonomy: sorting/quicksort
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [quicksort]
  objectives:
  - 'Watch the sorted region on the left spread outwards in stages, each extension at most p = 16 times the sorted part it extends.'
  - 'Count Already sorted: no array writes at all, since no key of an extension falls below its pivot.'
  - 'Explain why a pivot taken from keys already in order cannot be a bad guess the way an unsorted key can.'
  misconceptions:
  - 'An n log n worst case for a quicksort needs a heapsort fallback; proportion extend sort gets it from pivots drawn from its sorted prefix.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (an exchange is two writes)'
  average: 'close to n lg n − O(n) comparisons on random keys, in Chen''s experiments'
  worst: 'O(n log n) comparisons, with a constant that depends on p (Chen 2001)'
claims:
  - id: sorted-small-is-quadratic
    statement: >-
      On Already sorted at 16 keys proportion extend sort makes n(n − 1)/2 = 120 comparisons and no write.
    readout: Comparisons
    expect: { value: 120 }
    setup:
      params: { shape: sorted, n: 16 }
---

Keep a sorted prefix and extend it: take an unsorted block up to p times its length, partition it around the median of the prefix, and recurse on both sides, each again a sorted part followed by an unsorted one.

The trick is where the pivot comes from. Quicksort guesses a pivot from unsorted keys; here it is taken from keys already in order, so it is well placed, and the prefix that has been sorted grows geometrically until it covers the array. Chen proves a worst case of n log n comparisons with a constant that depends on p, without falling back to heapsort as introsort does.

The kernel takes p = 16, the value Chen used in his experiments on integers. Start with Random permutation at n = 128 and watch the sorted region on the left spread outwards in stages; then try Reversed, where a quicksort with a fixed pivot would go quadratic and this one does not.

For the average case Chen first reported experiments close to n log n − O(n) comparisons; a rigorous analysis followed in his later paper on efficient sample sorts, which treats this method as one of its cases. Partitioning reorders equal keys, so it is not stable. The cited works do not compare it with modern library sorts, which leaves its practical standing open.
