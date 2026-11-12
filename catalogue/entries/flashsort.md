---
id: flashsort
title: Flashsort
taxonomy: sorting/distribution
status: live
engine: array
labs:
  - sorting
sources:
  - id: neubert-1998
    ref: the original description and measurements
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
tags:
  - sorting
  - distribution
  - buckets
  - in-place
  - interpolation
complexity: n on uniformly spread keys, n² worst; extra space m class counters
related:
  - american-flag-sort
  - bucket-sort
  - insertion-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [bucket-sort, insertion-sort]
  objectives:
  - 'Read the phases at 512 keys: 2(n − 1) comparisons to find the minimum and the maximum, one exchange, a flash permutation of n − 1 or n writes, then an insertion sort.'
  - 'Compare Already sorted with Random permutation at 512 keys: 1,829 comparisons against 1,708, because the permutation leaves 297 inversions for the insertion pass against 175.'
  - 'Explain why the insertion pass costs its inversions plus n − 1, less the keys smaller than every key before them, and why a good classification keeps those inversions few.'
  misconceptions:
  - 'Sorted input is flashsort''s best case; at 512 keys Already sorted costs 1,829 comparisons, more than Random permutation on every seed tested.'
algorithm:
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparisons (the scan for the minimum and the maximum, then the final insertion sort) and array writes (one exchange, a write for every key the flash permutation moves, and the insertion sort''s shifts); no auxiliary write'
  average: 'on every input of n ≥ 2 keys not all equal: 2(n − 1) comparisons in the scan, one exchange, n − 1 or n writes in the flash permutation, and an insertion sort of I + n − 1 − z comparisons and I + v writes, for the I inversions it starts from, the z keys smaller than every key before them and the v keys with a larger key before them'
claims:
  - id: sorted-costs-more
    statement: >-
      On Already sorted at 512 keys flashsort makes more than the 1,708 comparisons it needs on Random permutation: its flash permutation leaves 297 inversions for the insertion pass, against 175.
    readout: Comparisons
    expect: { above: 1708 }
    setup:
      params: { shape: sorted, n: 512, speed: 2000 }
---

Classify every key into one of m classes by linear interpolation between the minimum and the maximum, count the classes, permute the keys into their classes in place by following cycles, and finish the nearly sorted result with insertion sort.

Neubert's three steps divide the work by distance: classification and the cycle-leader permutation move keys a long way with no comparisons between them, and the final insertion sort does the short-range tidying. Unlike classic bucket sort it needs no bucket storage of size n, only the vector of class counters; the kernel uses m of about 0.42 n, inside the broad optimum Neubert measured between 0.2 n and 0.5 n.

Start with Random permutation at n = 256: the classes come out in a few long cycles and the insertion pass that follows is short. On uniformly spread keys every step is linear, and Neubert notes that the running time hardly depends on the initial order. On the plate the counts differ a little, not in kind: at 512 keys Already sorted makes 1,829 comparisons, Reversed 1,764 and Random permutation 1,708, because the permutation leaves Already sorted more inversions for the insertion pass.

There is no protection against a bad distribution: when keys pile into one class, the final insertion sort does all the work and the time goes quadratic, as with an overfull bucket. The cycles do not keep equal keys in order, so flashsort is not stable.
