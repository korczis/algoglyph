---
id: quickxsort
title: QuickXsort
taxonomy: sorting/hybrid
status: live
engine: array
labs:
  - sorting
sources:
  - id: edelkamp-2014
    ref: the original scheme and its comparison counts
  - id: edelkamp-2020
    ref: transfer theorems and refined bounds
  - id: hoare-1962
    ref: the partitioning step
tags:
  - sorting
  - hybrid
  - in-place
  - comparison-efficient
complexity: n log n best, n log n average, n² worst; extra space log n
related:
  - heapsort
  - introsort
  - mergesort-top-down
  - quicksort
  - weak-heapsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [quicksort-median-of-three, mergesort-top-down]
  objectives:
  - 'Follow the Phase readout: every quicksort partition is followed by a mergesort of one side, with the other side as its buffer, and insertion sort finishes the last segment of at most 16 keys.'
  - 'Compare the counters on Random permutation at 512 keys: 4,234 comparisons against 9,772 array writes, since the mergesort moves every key by exchanging it with a key of the buffer.'
  - 'Explain why up to 16 keys only insertion sort runs, so the Array writes are twice the inversions.'
  misconceptions:
  - 'The plate shows the papers'' n lg n − 1.4n comparisons; with its median-of-three pivot the kernel averages more than n lg n − n over 100 random permutations of 512 keys. The papers'' bounds need a pivot sample that grows with n, and the 1.4n also merge insertion for small subproblems.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (every write is half of an exchange: the mergesort moves keys only by exchanging them with the buffer side); no auxiliary write'
  average: 'up to 16 keys insertion sort alone, with array writes twice the inversions and inversions ≤ comparisons ≤ inversions + n − 1; over 100 random permutations of 512 keys a mean above n lg n − n'
  worst: 'more than n²/4 comparisons from 64 keys on, on the input McIlroy''s adversary builds against its median-of-three pivot'
claims:
  - id: exchanges-double-the-writes
    statement: >-
      On Random permutation at 512 keys QuickXsort writes the array more than twice per comparison, 9,772 writes against 4,234 comparisons: the mergesort moves every key by exchanging it with a key of the buffer side, two writes each time.
    readout: Array writes
    expect: { above: 8468 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Partition as in quicksort, sort one side with a method X that normally needs extra memory, and let the other side serve as that memory; then repeat on the side that was used as scratch space.

The trick is that X never copies: every move it makes is an exchange with a key of the scratch side, so no key is lost and the scratch side simply comes back shuffled. That is how QuickMergesort, QuickHeapsort and QuickWeakHeapsort turn sorts that need a buffer into sorts that work in place.

The scheme exists to save comparisons. Edelkamp and Weiß show that QuickMergesort and QuickWeakHeapsort need about n log n − 1.26n + o(n) comparisons on average, and that using merge insertion for small subproblems brings QuickMergesort down to n log n − 1.399n + o(n). With Wild they prove that, when the pivot is the median of a growing sample, QuickXsort's average differs from X's own only by o(n).

Start with Random permutation at n = 128 and read the comparison counter against mergesort's and quicksort's in the lab: the sorted side grows in place, with the other half of the array standing in for mergesort's buffer. The method is not stable; it pays off where comparisons are expensive and memory is not available.
